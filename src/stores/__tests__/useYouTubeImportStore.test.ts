import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act } from 'react'
import Dexie from 'dexie'
import type { YouTubeVideoCache } from '@/data/types'

vi.mock('@/lib/persistWithRetry', () => ({
  persistWithRetry: (fn: () => Promise<void>) => fn(),
}))

let useYouTubeImportStore: (typeof import('@/stores/useYouTubeImportStore'))['useYouTubeImportStore']

function makeParsedUrl(valid = true, type = 'video' as string) {
  return {
    parseResult: {
      valid,
      type,
      videoId: valid ? 'vid-' + Math.random().toString(36).slice(2) : undefined,
      playlistId: type === 'playlist' ? 'pl-123' : undefined,
    },
  }
}

function makeVideoMetadata(videoId: string): YouTubeVideoCache {
  return {
    videoId,
    title: `Video ${videoId}`,
    channelId: 'ch-1',
    channelTitle: 'Test Channel',
    description: 'Test description',
    thumbnailUrl: `https://img.youtube.com/vi/${videoId}/default.jpg`,
    duration: 600,
    publishedAt: '2026-01-01T00:00:00Z',
    expiresAt: '2026-12-01T00:00:00Z',
    chapters: [],
  }
}

beforeEach(async () => {
  await Dexie.delete('ElearningDB')
  vi.resetModules()
  const mod = await import('@/stores/useYouTubeImportStore')
  useYouTubeImportStore = mod.useYouTubeImportStore
})

describe('useYouTubeImportStore initial state', () => {
  it('should have correct defaults', () => {
    const state = useYouTubeImportStore.getState()
    expect(state.urlInput).toBe('')
    expect(state.parsedUrls).toEqual([])
    expect(state.feedbackMessage).toBe('')
    expect(state.feedbackType).toBe('none')
    expect(state.videos).toEqual([])
    expect(state.currentStep).toBe(1)
    expect(state.isOpen).toBe(false)
    expect(state.isSaving).toBe(false)
    expect(state.saveError).toBeNull()
    expect(state.chapters).toEqual([])
  })
})

describe('Step 1 actions', () => {
  it('setUrlInput updates url input', () => {
    useYouTubeImportStore.getState().setUrlInput('https://youtube.com/watch?v=abc')
    expect(useYouTubeImportStore.getState().urlInput).toBe('https://youtube.com/watch?v=abc')
  })

  it('setParsedUrls updates parsed urls', () => {
    const urls = [makeParsedUrl(true)]
    useYouTubeImportStore.getState().setParsedUrls(urls)
    expect(useYouTubeImportStore.getState().parsedUrls).toEqual(urls)
  })

  it('setFeedback updates feedback message and type', () => {
    useYouTubeImportStore.getState().setFeedback('Found 3 videos', 'success')
    const state = useYouTubeImportStore.getState()
    expect(state.feedbackMessage).toBe('Found 3 videos')
    expect(state.feedbackType).toBe('success')
  })

  it('setCurrentStep navigates to a step', () => {
    useYouTubeImportStore.getState().setCurrentStep(3)
    expect(useYouTubeImportStore.getState().currentStep).toBe(3)
  })
})

describe('setIsOpen', () => {
  it('opening sets isOpen to true', () => {
    useYouTubeImportStore.getState().setIsOpen(true)
    expect(useYouTubeImportStore.getState().isOpen).toBe(true)
  })

  it('closing resets entire state to initial values', () => {
    // Set some state first
    useYouTubeImportStore.getState().setUrlInput('some url')
    useYouTubeImportStore.getState().setCurrentStep(3)
    useYouTubeImportStore.getState().setIsOpen(true)
    expect(useYouTubeImportStore.getState().isOpen).toBe(true)

    // Close resets everything
    useYouTubeImportStore.getState().setIsOpen(false)
    const state = useYouTubeImportStore.getState()
    expect(state.isOpen).toBe(false)
    expect(state.urlInput).toBe('')
    expect(state.currentStep).toBe(1)
  })
})

describe('Step 2 actions', () => {
  it('setVideosForFetch initializes videos with pending status', () => {
    useYouTubeImportStore.getState().setVideosForFetch(['v1', 'v2', 'v3'])
    const state = useYouTubeImportStore.getState()
    expect(state.videos).toHaveLength(3)
    expect(state.videos[0].videoId).toBe('v1')
    expect(state.videos[0].status).toBe('pending')
    expect(state.videos[0].removed).toBe(false)
    expect(state.videos[0].metadata).toBeNull()
    expect(state.metadataTotal).toBe(3)
    expect(state.metadataFetchedCount).toBe(0)
    expect(state.isFetchingMetadata).toBe(true)
  })

  it('updateVideoMetadata updates specific video', () => {
    useYouTubeImportStore.getState().setVideosForFetch(['v1', 'v2'])
    const meta = makeVideoMetadata('v1')
    useYouTubeImportStore.getState().updateVideoMetadata('v1', {
      metadata: meta,
      status: 'loaded',
    })

    const state = useYouTubeImportStore.getState()
    const v1 = state.videos.find(v => v.videoId === 'v1')
    expect(v1!.status).toBe('loaded')
    expect(v1!.metadata!.title).toBe('Video v1')

    // v2 unchanged
    const v2 = state.videos.find(v => v.videoId === 'v2')
    expect(v2!.status).toBe('pending')
  })

  it('updateFetchProgress updates counters', () => {
    useYouTubeImportStore.getState().updateFetchProgress(5, 10)
    const state = useYouTubeImportStore.getState()
    expect(state.metadataFetchedCount).toBe(5)
    expect(state.metadataTotal).toBe(10)
  })

  it('setIsFetchingMetadata toggles fetching state', () => {
    useYouTubeImportStore.getState().setIsFetchingMetadata(true)
    expect(useYouTubeImportStore.getState().isFetchingMetadata).toBe(true)

    useYouTubeImportStore.getState().setIsFetchingMetadata(false)
    expect(useYouTubeImportStore.getState().isFetchingMetadata).toBe(false)
  })

  it('removeVideo marks video as removed', () => {
    useYouTubeImportStore.getState().setVideosForFetch(['v1', 'v2'])
    useYouTubeImportStore.getState().removeVideo('v1')

    const state = useYouTubeImportStore.getState()
    expect(state.videos.find(v => v.videoId === 'v1')!.removed).toBe(true)
    expect(state.videos.find(v => v.videoId === 'v2')!.removed).toBe(false)
  })
})

describe('Step 3: Chapter management', () => {
  const chapter1 = { id: 'ch1', title: 'Chapter 1', videoIds: ['v1'] }
  const chapter2 = { id: 'ch2', title: 'Chapter 2', videoIds: ['v2'] }

  it('setChapters replaces all chapters', () => {
    useYouTubeImportStore.getState().setChapters([chapter1, chapter2])
    expect(useYouTubeImportStore.getState().chapters).toHaveLength(2)
  })

  it('updateChapter updates a specific chapter', () => {
    useYouTubeImportStore.getState().setChapters([chapter1, chapter2])
    useYouTubeImportStore.getState().updateChapter('ch1', { title: 'Updated Chapter 1' })

    const ch = useYouTubeImportStore.getState().chapters.find(c => c.id === 'ch1')
    expect(ch!.title).toBe('Updated Chapter 1')
  })

  it('updateChapter does not affect non-matching chapters', () => {
    useYouTubeImportStore.getState().setChapters([chapter1, chapter2])
    useYouTubeImportStore.getState().updateChapter('ch1', { title: 'Updated' })

    const ch2 = useYouTubeImportStore.getState().chapters.find(c => c.id === 'ch2')
    expect(ch2!.title).toBe('Chapter 2')
  })

  it('addChapter appends a new chapter', () => {
    useYouTubeImportStore.getState().setChapters([chapter1])
    useYouTubeImportStore.getState().addChapter(chapter2)
    expect(useYouTubeImportStore.getState().chapters).toHaveLength(2)
  })

  it('removeChapter removes by ID', () => {
    useYouTubeImportStore.getState().setChapters([chapter1, chapter2])
    useYouTubeImportStore.getState().removeChapter('ch1')

    const chapters = useYouTubeImportStore.getState().chapters
    expect(chapters).toHaveLength(1)
    expect(chapters[0].id).toBe('ch2')
  })
})

describe('computed getters', () => {
  it('getActiveVideos returns non-removed videos', () => {
    useYouTubeImportStore.getState().setVideosForFetch(['v1', 'v2', 'v3'])
    useYouTubeImportStore.getState().removeVideo('v2')

    const active = useYouTubeImportStore.getState().getActiveVideos()
    expect(active).toHaveLength(2)
    expect(active.map(v => v.videoId)).toEqual(['v1', 'v3'])
  })

  it('getValidUrlCount counts valid parsed URLs', () => {
    useYouTubeImportStore.getState().setParsedUrls([
      makeParsedUrl(true),
      makeParsedUrl(false),
      makeParsedUrl(true),
    ])

    expect(useYouTubeImportStore.getState().getValidUrlCount()).toBe(2)
  })

  it('canProceedFromStep1 returns true when at least one valid URL exists', () => {
    useYouTubeImportStore.getState().setParsedUrls([makeParsedUrl(false)])
    expect(useYouTubeImportStore.getState().canProceedFromStep1()).toBe(false)

    useYouTubeImportStore.getState().setParsedUrls([makeParsedUrl(true)])
    expect(useYouTubeImportStore.getState().canProceedFromStep1()).toBe(true)
  })

  it('getUnavailableCount counts unavailable non-removed videos', () => {
    useYouTubeImportStore.getState().setVideosForFetch(['v1', 'v2', 'v3'])
    useYouTubeImportStore.getState().updateVideoMetadata('v1', { status: 'unavailable' })
    useYouTubeImportStore.getState().updateVideoMetadata('v2', { status: 'unavailable' })
    useYouTubeImportStore.getState().removeVideo('v2') // removed, should not count

    expect(useYouTubeImportStore.getState().getUnavailableCount()).toBe(1)
  })
})

describe('reset', () => {
  it('resets all state to initial values', () => {
    useYouTubeImportStore.getState().setUrlInput('test')
    useYouTubeImportStore.getState().setCurrentStep(4)
    useYouTubeImportStore.getState().setVideosForFetch(['v1'])

    useYouTubeImportStore.getState().reset()
    const state = useYouTubeImportStore.getState()
    expect(state.urlInput).toBe('')
    expect(state.currentStep).toBe(1)
    expect(state.videos).toEqual([])
  })
})

describe('saveCourse', () => {
  it('returns error when no loaded videos exist', async () => {
    useYouTubeImportStore.getState().setVideosForFetch(['v1'])
    // v1 is still 'pending' (not loaded)

    const result = await useYouTubeImportStore.getState().saveCourse({
      name: 'Test Course',
      description: '',
      tags: [],
      selectedThumbnailVideoId: null,
    })

    expect(result).toEqual({ ok: false, error: 'No videos available to save' })
  })

  it('saves course with loaded videos to IndexedDB', async () => {
    const meta = makeVideoMetadata('v1')
    useYouTubeImportStore.getState().setVideosForFetch(['v1'])
    useYouTubeImportStore.getState().updateVideoMetadata('v1', {
      metadata: meta,
      status: 'loaded',
    })
    useYouTubeImportStore.getState().setChapters([
      { id: 'ch1', title: 'Intro', videoIds: ['v1'] },
    ])

    const result = await act(async () => {
      return useYouTubeImportStore.getState().saveCourse({
        name: 'My YouTube Course',
        description: 'A great course',
        tags: ['react', 'JavaScript'],
        selectedThumbnailVideoId: null,
      })
    })

    expect(result).toEqual({ ok: true, courseId: expect.any(String) })
    expect(useYouTubeImportStore.getState().isSaving).toBe(false)

    // Verify data was persisted
    const { db } = await import('@/db')
    const courses = await db.importedCourses.toArray()
    expect(courses).toHaveLength(1)
    expect(courses[0].name).toBe('My YouTube Course')
    expect(courses[0].source).toBe('youtube')
    expect(courses[0].tags).toEqual(['javascript', 'react'])

    const videos = await db.importedVideos.toArray()
    expect(videos).toHaveLength(1)
    expect(videos[0].youtubeVideoId).toBe('v1')
  })

  it('uses selected thumbnail video URL', async () => {
    const meta1 = makeVideoMetadata('v1')
    const meta2 = { ...makeVideoMetadata('v2'), thumbnailUrl: 'https://thumb2.jpg' }
    useYouTubeImportStore.getState().setVideosForFetch(['v1', 'v2'])
    useYouTubeImportStore.getState().updateVideoMetadata('v1', { metadata: meta1, status: 'loaded' })
    useYouTubeImportStore.getState().updateVideoMetadata('v2', { metadata: meta2, status: 'loaded' })
    useYouTubeImportStore.getState().setChapters([])

    await act(async () => {
      await useYouTubeImportStore.getState().saveCourse({
        name: 'Course',
        description: '',
        tags: [],
        selectedThumbnailVideoId: 'v2',
      })
    })

    const { db } = await import('@/db')
    const courses = await db.importedCourses.toArray()
    expect(courses[0].youtubeThumbnailUrl).toBe('https://thumb2.jpg')
  })

  it('uses playlist info from parsed URLs', async () => {
    const meta = makeVideoMetadata('v1')
    useYouTubeImportStore.getState().setVideosForFetch(['v1'])
    useYouTubeImportStore.getState().updateVideoMetadata('v1', { metadata: meta, status: 'loaded' })
    useYouTubeImportStore.getState().setParsedUrls([{
      parseResult: { valid: true, type: 'playlist', playlistId: 'PLabc123' },
    }])
    useYouTubeImportStore.getState().setChapters([])

    await act(async () => {
      await useYouTubeImportStore.getState().saveCourse({
        name: 'Playlist Course',
        description: '',
        tags: [],
        selectedThumbnailVideoId: null,
      })
    })

    const { db } = await import('@/db')
    const courses = await db.importedCourses.toArray()
    expect(courses[0].youtubePlaylistId).toBe('PLabc123')
  })

  it('creates chapter records with sub-chapters for videos that have them', async () => {
    const meta = {
      ...makeVideoMetadata('v1'),
      chapters: [
        { title: 'Part 1', time: 0 },
        { title: 'Part 2', time: 300 },
      ],
    }
    useYouTubeImportStore.getState().setVideosForFetch(['v1'])
    useYouTubeImportStore.getState().updateVideoMetadata('v1', { metadata: meta, status: 'loaded' })
    useYouTubeImportStore.getState().setChapters([
      { id: 'ch1', title: 'Module 1', videoIds: ['v1'] },
    ])

    await act(async () => {
      await useYouTubeImportStore.getState().saveCourse({
        name: 'Course with chapters',
        description: '',
        tags: [],
        selectedThumbnailVideoId: null,
      })
    })

    const { db } = await import('@/db')
    const chapters = await db.youtubeChapters.orderBy('order').toArray()
    expect(chapters).toHaveLength(2)
    expect(chapters[0].title).toBe('Module 1 — Part 1')
    expect(chapters[1].title).toBe('Module 1 — Part 2')
  })

  it('handles error during save gracefully', async () => {
    const meta = makeVideoMetadata('v1')
    useYouTubeImportStore.getState().setVideosForFetch(['v1'])
    useYouTubeImportStore.getState().updateVideoMetadata('v1', { metadata: meta, status: 'loaded' })
    useYouTubeImportStore.getState().setChapters([])

    // Mock db to throw
    const dbMod = await import('@/db')
    vi.spyOn(dbMod.db.importedCourses, 'add').mockRejectedValue(new Error('Disk full'))

    const result = await act(async () => {
      return useYouTubeImportStore.getState().saveCourse({
        name: 'Failing course',
        description: '',
        tags: [],
        selectedThumbnailVideoId: null,
      })
    })

    expect(result).toEqual({ ok: false, error: 'Disk full' })
    expect(useYouTubeImportStore.getState().isSaving).toBe(false)
    expect(useYouTubeImportStore.getState().saveError).toBe('Disk full')
  })

  it('handles non-Error thrown during save', async () => {
    const meta = makeVideoMetadata('v1')
    useYouTubeImportStore.getState().setVideosForFetch(['v1'])
    useYouTubeImportStore.getState().updateVideoMetadata('v1', { metadata: meta, status: 'loaded' })
    useYouTubeImportStore.getState().setChapters([])

    const dbMod = await import('@/db')
    vi.spyOn(dbMod.db.importedCourses, 'add').mockRejectedValue('string error')

    const result = await act(async () => {
      return useYouTubeImportStore.getState().saveCourse({
        name: 'Failing',
        description: '',
        tags: [],
        selectedThumbnailVideoId: null,
      })
    })

    expect(result).toEqual({ ok: false, error: 'Failed to save course' })
  })

  it('skips removed videos during save', async () => {
    const meta1 = makeVideoMetadata('v1')
    const meta2 = makeVideoMetadata('v2')
    useYouTubeImportStore.getState().setVideosForFetch(['v1', 'v2'])
    useYouTubeImportStore.getState().updateVideoMetadata('v1', { metadata: meta1, status: 'loaded' })
    useYouTubeImportStore.getState().updateVideoMetadata('v2', { metadata: meta2, status: 'loaded' })
    useYouTubeImportStore.getState().removeVideo('v2')
    useYouTubeImportStore.getState().setChapters([])

    await act(async () => {
      await useYouTubeImportStore.getState().saveCourse({
        name: 'Course',
        description: '',
        tags: [],
        selectedThumbnailVideoId: null,
      })
    })

    const { db } = await import('@/db')
    const videos = await db.importedVideos.toArray()
    expect(videos).toHaveLength(1)
    expect(videos[0].youtubeVideoId).toBe('v1')
  })

  it('uses full-playlist choice for playlistId', async () => {
    const meta = makeVideoMetadata('v1')
    useYouTubeImportStore.getState().setVideosForFetch(['v1'])
    useYouTubeImportStore.getState().updateVideoMetadata('v1', { metadata: meta, status: 'loaded' })
    useYouTubeImportStore.getState().setParsedUrls([{
      parseResult: { valid: true, type: 'video', videoId: 'v1', playlistId: 'PL999' },
      playlistChoice: 'full-playlist',
    }])
    useYouTubeImportStore.getState().setChapters([])

    await act(async () => {
      await useYouTubeImportStore.getState().saveCourse({
        name: 'Course',
        description: '',
        tags: [],
        selectedThumbnailVideoId: null,
      })
    })

    const { db } = await import('@/db')
    const courses = await db.importedCourses.toArray()
    expect(courses[0].youtubePlaylistId).toBe('PL999')
  })
})
