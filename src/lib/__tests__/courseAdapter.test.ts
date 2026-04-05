import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Dexie from 'dexie'
import type { ImportedCourse, ImportedVideo, ImportedPdf } from '@/data/types'

// Dynamic import pattern — reset Dexie between tests to avoid stale state
type AdapterModule = typeof import('@/lib/courseAdapter')
let adapterLib: AdapterModule

beforeEach(async () => {
  await Dexie.delete('ElearningDB')
  vi.resetModules()
  adapterLib = await import('@/lib/courseAdapter')
})

// ---------------------------------------------------------------------------
// Test Factories
// ---------------------------------------------------------------------------

function makeLocalCourse(overrides: Partial<ImportedCourse> = {}): ImportedCourse {
  return {
    id: 'local-course-1',
    name: 'TypeScript Fundamentals',
    importedAt: '2026-03-01T10:00:00.000Z',
    category: 'programming',
    tags: ['typescript', 'fundamentals'],
    status: 'active',
    videoCount: 2,
    pdfCount: 1,
    directoryHandle: null,
    source: 'local',
    ...overrides,
  }
}

function makeYouTubeCourse(overrides: Partial<ImportedCourse> = {}): ImportedCourse {
  return {
    id: 'yt-course-1',
    name: 'React Masterclass',
    importedAt: '2026-03-05T12:00:00.000Z',
    category: 'web-dev',
    tags: ['react'],
    status: 'active',
    videoCount: 3,
    pdfCount: 0,
    directoryHandle: null,
    source: 'youtube',
    youtubePlaylistId: 'PLtest123',
    youtubeChannelId: 'UCtest',
    youtubeChannelTitle: 'React Academy',
    youtubeThumbnailUrl: 'https://i.ytimg.com/vi/thumb/hqdefault.jpg',
    ...overrides,
  }
}

function makeVideo(overrides: Partial<ImportedVideo> = {}): ImportedVideo {
  return {
    id: 'vid-1',
    courseId: 'local-course-1',
    filename: '01-intro.mp4',
    path: 'videos/01-intro.mp4',
    duration: 600,
    format: 'mp4',
    order: 1,
    fileHandle: null,
    ...overrides,
  }
}

function makeYouTubeVideo(overrides: Partial<ImportedVideo> = {}): ImportedVideo {
  return {
    id: 'yt-vid-1',
    courseId: 'yt-course-1',
    filename: 'Getting Started with React',
    path: '',
    duration: 900,
    format: 'mp4',
    order: 1,
    fileHandle: null,
    youtubeVideoId: 'dQw4w9WgXcQ',
    youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    thumbnailUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
    ...overrides,
  }
}

function makePdf(overrides: Partial<ImportedPdf> = {}): ImportedPdf {
  return {
    id: 'pdf-1',
    courseId: 'local-course-1',
    filename: 'cheatsheet.pdf',
    path: 'docs/cheatsheet.pdf',
    pageCount: 10,
    fileHandle: null as unknown as FileSystemFileHandle,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// revokeObjectUrl utility
// ---------------------------------------------------------------------------

describe('revokeObjectUrl()', () => {
  it('calls URL.revokeObjectURL with the given url', () => {
    const spy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    adapterLib.revokeObjectUrl('blob:http://localhost/fake-id')
    expect(spy).toHaveBeenCalledWith('blob:http://localhost/fake-id')
    spy.mockRestore()
  })
})

// ---------------------------------------------------------------------------
// CourseAdapter Interface (AC1)
// ---------------------------------------------------------------------------

describe('CourseAdapter interface', () => {
  it('LocalCourseAdapter exposes all required methods', () => {
    const adapter = new adapterLib.LocalCourseAdapter(makeLocalCourse(), [makeVideo()], [makePdf()])

    expect(typeof adapter.getCourse).toBe('function')
    expect(typeof adapter.getSource).toBe('function')
    expect(typeof adapter.getLessons).toBe('function')
    expect(typeof adapter.getMediaUrl).toBe('function')
    expect(typeof adapter.getTranscript).toBe('function')
    expect(typeof adapter.getThumbnailUrl).toBe('function')
    expect(typeof adapter.getCapabilities).toBe('function')
  })

  it('YouTubeCourseAdapter exposes all required methods', () => {
    const adapter = new adapterLib.YouTubeCourseAdapter(makeYouTubeCourse(), [makeYouTubeVideo()])

    expect(typeof adapter.getCourse).toBe('function')
    expect(typeof adapter.getSource).toBe('function')
    expect(typeof adapter.getLessons).toBe('function')
    expect(typeof adapter.getMediaUrl).toBe('function')
    expect(typeof adapter.getTranscript).toBe('function')
    expect(typeof adapter.getThumbnailUrl).toBe('function')
    expect(typeof adapter.getCapabilities).toBe('function')
  })
})

// ---------------------------------------------------------------------------
// LessonItem (AC2)
// ---------------------------------------------------------------------------

describe('LessonItem normalization', () => {
  it('includes id, title, type, duration, order, and sourceMetadata for videos', async () => {
    const adapter = new adapterLib.LocalCourseAdapter(makeLocalCourse(), [makeVideo()], [])
    const lessons = await adapter.getLessons()

    expect(lessons).toHaveLength(1)
    expect(lessons[0]).toMatchObject({
      id: 'vid-1',
      title: '01-intro.mp4',
      type: 'video',
      duration: 600,
      order: 1,
    })
    expect(lessons[0].sourceMetadata).toBeDefined()
  })

  it('includes id, title, type, order, and sourceMetadata for PDFs', async () => {
    const adapter = new adapterLib.LocalCourseAdapter(makeLocalCourse(), [], [makePdf()])
    const lessons = await adapter.getLessons()

    expect(lessons).toHaveLength(1)
    expect(lessons[0]).toMatchObject({
      id: 'pdf-1',
      title: 'cheatsheet.pdf',
      type: 'pdf',
    })
    expect(lessons[0].sourceMetadata).toBeDefined()
    expect(lessons[0].sourceMetadata).toHaveProperty('pageCount', 10)
  })
})

// ---------------------------------------------------------------------------
// ContentCapabilities (AC3)
// ---------------------------------------------------------------------------

describe('ContentCapabilities', () => {
  it('LocalCourseAdapter declares correct capabilities with videos and PDFs', () => {
    const adapter = new adapterLib.LocalCourseAdapter(makeLocalCourse(), [makeVideo()], [makePdf()])
    const caps = adapter.getCapabilities()

    expect(caps).toEqual({
      hasVideo: true,
      hasPdf: true,
      hasTranscript: true,
      supportsNotes: true,
      supportsQuiz: true,
      supportsPrevNext: true,
      supportsBreadcrumbs: true,
      requiresNetwork: false,
      supportsRefresh: false,
      supportsFileVerification: true,
    })
  })

  it('LocalCourseAdapter with no videos reports hasVideo: false', () => {
    const adapter = new adapterLib.LocalCourseAdapter(makeLocalCourse(), [], [makePdf()])
    const caps = adapter.getCapabilities()

    expect(caps.hasVideo).toBe(false)
    expect(caps.hasPdf).toBe(true)
  })

  it('YouTubeCourseAdapter declares hasPdf: false', () => {
    const adapter = new adapterLib.YouTubeCourseAdapter(makeYouTubeCourse(), [makeYouTubeVideo()])
    const caps = adapter.getCapabilities()

    expect(caps).toEqual({
      hasVideo: true,
      hasPdf: false,
      hasTranscript: true,
      supportsNotes: true,
      supportsQuiz: true,
      supportsPrevNext: true,
      supportsBreadcrumbs: true,
      requiresNetwork: true,
      supportsRefresh: true,
      supportsFileVerification: false,
    })
  })

  it('YouTubeCourseAdapter with no videos reports hasVideo: false', () => {
    const adapter = new adapterLib.YouTubeCourseAdapter(makeYouTubeCourse(), [])
    expect(adapter.getCapabilities().hasVideo).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// LocalCourseAdapter.getLessons() (AC4)
// ---------------------------------------------------------------------------

describe('LocalCourseAdapter.getLessons()', () => {
  it('combines videos and PDFs sorted by order', async () => {
    const videos = [
      makeVideo({ id: 'v2', order: 3, filename: '03-advanced.mp4' }),
      makeVideo({ id: 'v1', order: 1, filename: '01-intro.mp4' }),
    ]
    const pdfs = [makePdf({ id: 'p1', filename: '02-resources.pdf', pageCount: 10 })]

    const adapter = new adapterLib.LocalCourseAdapter(makeLocalCourse(), videos, pdfs)
    const lessons = await adapter.getLessons()

    expect(lessons).toHaveLength(3)
    expect(lessons[0].id).toBe('v1') // order 1 (01-intro.mp4)
    expect(lessons[1].id).toBe('p1') // order 2 (02-resources.pdf — filename prefix)
    expect(lessons[2].id).toBe('v2') // order 3 (03-advanced.mp4)
  })

  it('returns empty array when no content exists', async () => {
    const adapter = new adapterLib.LocalCourseAdapter(makeLocalCourse(), [], [])
    const lessons = await adapter.getLessons()
    expect(lessons).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// YouTubeCourseAdapter.getMediaUrl() (AC5)
// ---------------------------------------------------------------------------

describe('YouTubeCourseAdapter.getMediaUrl()', () => {
  it('returns YouTube embed URL for a known video', async () => {
    const adapter = new adapterLib.YouTubeCourseAdapter(makeYouTubeCourse(), [
      makeYouTubeVideo({ id: 'yt-vid-1', youtubeVideoId: 'abc123' }),
    ])

    const url = await adapter.getMediaUrl('yt-vid-1')
    expect(url).toBe('https://www.youtube.com/embed/abc123')
  })

  it('returns null for unknown lesson ID', async () => {
    const adapter = new adapterLib.YouTubeCourseAdapter(makeYouTubeCourse(), [makeYouTubeVideo()])

    const url = await adapter.getMediaUrl('nonexistent')
    expect(url).toBeNull()
  })

  it('returns null when video has no youtubeVideoId', async () => {
    const adapter = new adapterLib.YouTubeCourseAdapter(makeYouTubeCourse(), [
      makeYouTubeVideo({ id: 'yt-vid-1', youtubeVideoId: undefined }),
    ])

    const url = await adapter.getMediaUrl('yt-vid-1')
    expect(url).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// createCourseAdapter factory (AC6)
// ---------------------------------------------------------------------------

describe('createCourseAdapter()', () => {
  it('returns YouTubeCourseAdapter for source: youtube', () => {
    const adapter = adapterLib.createCourseAdapter(makeYouTubeCourse(), [makeYouTubeVideo()], [])
    expect(adapter).toBeInstanceOf(adapterLib.YouTubeCourseAdapter)
    expect(adapter.getSource()).toBe('youtube')
  })

  it('returns LocalCourseAdapter for source: local', () => {
    const adapter = adapterLib.createCourseAdapter(
      makeLocalCourse({ source: 'local' }),
      [makeVideo()],
      [makePdf()]
    )
    expect(adapter).toBeInstanceOf(adapterLib.LocalCourseAdapter)
    expect(adapter.getSource()).toBe('local')
  })

  it('returns LocalCourseAdapter for source: undefined (backward-compatible)', () => {
    const adapter = adapterLib.createCourseAdapter(
      makeLocalCourse({ source: undefined }),
      [makeVideo()],
      []
    )
    expect(adapter).toBeInstanceOf(adapterLib.LocalCourseAdapter)
    expect(adapter.getSource()).toBe('local')
  })
})

// ---------------------------------------------------------------------------
// getCourse() and getSource() basics
// ---------------------------------------------------------------------------

describe('getCourse() and getSource()', () => {
  it('LocalCourseAdapter returns the course object and "local" source', () => {
    const course = makeLocalCourse()
    const adapter = new adapterLib.LocalCourseAdapter(course, [], [])

    expect(adapter.getCourse()).toBe(course)
    expect(adapter.getSource()).toBe('local')
  })

  it('YouTubeCourseAdapter returns the course object and "youtube" source', () => {
    const course = makeYouTubeCourse()
    const adapter = new adapterLib.YouTubeCourseAdapter(course, [])

    expect(adapter.getCourse()).toBe(course)
    expect(adapter.getSource()).toBe('youtube')
  })
})

// ---------------------------------------------------------------------------
// LocalCourseAdapter.getMediaUrl() — null when no fileHandle
// ---------------------------------------------------------------------------

describe('LocalCourseAdapter.getMediaUrl()', () => {
  it('returns null for unknown lesson ID', async () => {
    const adapter = new adapterLib.LocalCourseAdapter(makeLocalCourse(), [makeVideo()], [])

    const url = await adapter.getMediaUrl('nonexistent')
    expect(url).toBeNull()
  })

  it('returns null when video has null fileHandle', async () => {
    const adapter = new adapterLib.LocalCourseAdapter(
      makeLocalCourse(),
      [makeVideo({ fileHandle: null })],
      []
    )

    const url = await adapter.getMediaUrl('vid-1')
    expect(url).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// LocalCourseAdapter.getGroupedLessons() — video-primary groups (AC7)
// ---------------------------------------------------------------------------

describe('LocalCourseAdapter.getGroupedLessons()', () => {
  it('returns MaterialGroup[] with video as primary and matched PDFs in materials', async () => {
    const videos = [
      makeVideo({ id: 'v1', order: 1, filename: '01-Intro.mp4' }),
      makeVideo({ id: 'v2', order: 2, filename: '02-Advanced.mp4' }),
    ]
    const pdfs = [
      makePdf({ id: 'p1', filename: '01-Intro.pdf', pageCount: 5 }),
      makePdf({ id: 'p2', filename: 'Resources.pdf', pageCount: 20 }),
    ]

    const adapter = new adapterLib.LocalCourseAdapter(makeLocalCourse(), videos, pdfs)
    const groups = await adapter.getGroupedLessons()

    // Video group 1 should have the matching PDF as a material
    const group1 = groups.find(g => g.primary.id === 'v1')!
    expect(group1).toBeDefined()
    expect(group1.primary.type).toBe('video')
    expect(group1.materials).toHaveLength(1)
    expect(group1.materials[0].title).toBe('01-Intro.pdf')

    // Video group 2 has no matching PDF
    const group2 = groups.find(g => g.primary.id === 'v2')!
    expect(group2).toBeDefined()
    expect(group2.materials).toHaveLength(0)

    // Unmatched PDF becomes standalone group
    const standalone = groups.find(g => g.primary.title === 'Resources.pdf')
    expect(standalone).toBeDefined()
    expect(standalone!.primary.type).toBe('pdf')
  })
})

// ---------------------------------------------------------------------------
// LocalCourseAdapter.getLessons() — excludes companion PDFs
// ---------------------------------------------------------------------------

describe('LocalCourseAdapter.getLessons() companion exclusion', () => {
  it('excludes companion PDFs that are matched to videos', async () => {
    const videos = [makeVideo({ id: 'v1', order: 1, filename: '01-Intro.mp4' })]
    const pdfs = [
      makePdf({ id: 'p1', filename: '01-Intro.pdf', pageCount: 5 }),
      makePdf({ id: 'p2', filename: 'Resources.pdf', pageCount: 20 }),
    ]

    const adapter = new adapterLib.LocalCourseAdapter(makeLocalCourse(), videos, pdfs)
    const lessons = await adapter.getLessons()

    // The companion PDF "01-Intro.pdf" should be excluded from the flat list
    const ids = lessons.map(l => l.id)
    expect(ids).toContain('v1')
    expect(ids).not.toContain('p1') // companion — excluded
    expect(ids).toContain('p2') // standalone — included
  })
})

// ---------------------------------------------------------------------------
// YouTubeCourseAdapter.getLessons() — sorted by order
// ---------------------------------------------------------------------------

describe('YouTubeCourseAdapter.getLessons()', () => {
  it('returns lessons sorted by order', async () => {
    const videos = [
      makeYouTubeVideo({ id: 'v3', order: 3, filename: 'Part 3' }),
      makeYouTubeVideo({ id: 'v1', order: 1, filename: 'Part 1' }),
      makeYouTubeVideo({ id: 'v2', order: 2, filename: 'Part 2' }),
    ]
    const adapter = new adapterLib.YouTubeCourseAdapter(makeYouTubeCourse(), videos)

    const lessons = await adapter.getLessons()
    expect(lessons.map(l => l.id)).toEqual(['v1', 'v2', 'v3'])
  })

  it('includes YouTube-specific sourceMetadata', async () => {
    const adapter = new adapterLib.YouTubeCourseAdapter(makeYouTubeCourse(), [
      makeYouTubeVideo({ youtubeVideoId: 'xyz789' }),
    ])

    const lessons = await adapter.getLessons()
    expect(lessons[0].sourceMetadata).toMatchObject({
      youtubeVideoId: 'xyz789',
    })
  })
})

// ---------------------------------------------------------------------------
// getThumbnailUrl()
// ---------------------------------------------------------------------------

describe('YouTubeCourseAdapter.getThumbnailUrl()', () => {
  it('returns youtubeThumbnailUrl when present', async () => {
    const adapter = new adapterLib.YouTubeCourseAdapter(
      makeYouTubeCourse({ youtubeThumbnailUrl: 'https://example.com/thumb.jpg' }),
      []
    )

    const url = await adapter.getThumbnailUrl()
    expect(url).toBe('https://example.com/thumb.jpg')
  })

  it('returns null when no thumbnail URL and no stored thumbnail', async () => {
    const adapter = new adapterLib.YouTubeCourseAdapter(
      makeYouTubeCourse({ youtubeThumbnailUrl: undefined }),
      []
    )

    const url = await adapter.getThumbnailUrl()
    expect(url).toBeNull()
  })
})

describe('LocalCourseAdapter.getThumbnailUrl()', () => {
  it('returns null when no cover image handle and no stored thumbnail', async () => {
    const adapter = new adapterLib.LocalCourseAdapter(
      makeLocalCourse({ coverImageHandle: undefined }),
      [],
      []
    )

    const url = await adapter.getThumbnailUrl()
    expect(url).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// LocalCourseAdapter.getTranscript() — reads from videoCaptions table
// ---------------------------------------------------------------------------

describe('LocalCourseAdapter.getTranscript()', () => {
  it('returns caption content when a matching videoCaptions record exists', async () => {
    const { db: freshDb } = await import('@/db')
    const course = makeLocalCourse()
    const video = makeVideo()

    await freshDb.importedCourses.add(course)
    await freshDb.importedVideos.add(video)
    await freshDb.videoCaptions.add({
      courseId: 'local-course-1',
      videoId: 'vid-1',
      filename: '01-intro.srt',
      content: '1\n00:00:00,000 --> 00:00:05,000\nHello world',
      format: 'srt',
      createdAt: '2026-03-01T10:00:00.000Z',
    })

    const adapter = new adapterLib.LocalCourseAdapter(course, [video], [])
    const transcript = await adapter.getTranscript('vid-1')
    expect(transcript).toBe('1\n00:00:00,000 --> 00:00:05,000\nHello world')
  })

  it('returns null when no caption record exists for the lesson', async () => {
    const { db: freshDb } = await import('@/db')
    const course = makeLocalCourse()
    const video = makeVideo()

    await freshDb.importedCourses.add(course)
    await freshDb.importedVideos.add(video)

    const adapter = new adapterLib.LocalCourseAdapter(course, [video], [])
    const transcript = await adapter.getTranscript('vid-1')
    expect(transcript).toBeNull()
  })

  it('returns null for a non-existent lessonId', async () => {
    const course = makeLocalCourse()
    const adapter = new adapterLib.LocalCourseAdapter(course, [], [])
    const transcript = await adapter.getTranscript('nonexistent')
    expect(transcript).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// YouTubeCourseAdapter.getTranscript() — reads from youtubeTranscripts table
// ---------------------------------------------------------------------------

describe('YouTubeCourseAdapter.getTranscript()', () => {
  it('returns fullText when a done transcript record exists', async () => {
    const { db: freshDb } = await import('@/db')
    const course = makeYouTubeCourse()
    const video = makeYouTubeVideo({ id: 'yt-vid-1', youtubeVideoId: 'dQw4w9WgXcQ' })

    await freshDb.importedCourses.add(course)
    await freshDb.importedVideos.add(video)
    await freshDb.youtubeTranscripts.add({
      courseId: 'yt-course-1',
      videoId: 'dQw4w9WgXcQ',
      language: 'en',
      cues: [{ startTime: 0, endTime: 5, text: 'Hello world' }],
      fullText: 'Hello world',
      source: 'youtube-transcript',
      status: 'done',
      fetchedAt: '2026-03-05T12:00:00.000Z',
    })

    const adapter = new adapterLib.YouTubeCourseAdapter(course, [video])
    const transcript = await adapter.getTranscript('yt-vid-1')
    expect(transcript).toBe('Hello world')
  })

  it('returns null when transcript status is not done', async () => {
    const { db: freshDb } = await import('@/db')
    const course = makeYouTubeCourse()
    const video = makeYouTubeVideo({ id: 'yt-vid-1', youtubeVideoId: 'dQw4w9WgXcQ' })

    await freshDb.importedCourses.add(course)
    await freshDb.importedVideos.add(video)
    await freshDb.youtubeTranscripts.add({
      courseId: 'yt-course-1',
      videoId: 'dQw4w9WgXcQ',
      language: 'en',
      cues: [],
      fullText: '',
      source: 'youtube-transcript',
      status: 'pending',
      fetchedAt: '2026-03-05T12:00:00.000Z',
    })

    const adapter = new adapterLib.YouTubeCourseAdapter(course, [video])
    const transcript = await adapter.getTranscript('yt-vid-1')
    expect(transcript).toBeNull()
  })

  it('returns null when no transcript record exists', async () => {
    const course = makeYouTubeCourse()
    const video = makeYouTubeVideo({ id: 'yt-vid-1', youtubeVideoId: 'dQw4w9WgXcQ' })

    const adapter = new adapterLib.YouTubeCourseAdapter(course, [video])
    const transcript = await adapter.getTranscript('yt-vid-1')
    expect(transcript).toBeNull()
  })

  it('returns null when video has no youtubeVideoId', async () => {
    const course = makeYouTubeCourse()
    const video = makeYouTubeVideo({ id: 'yt-vid-1', youtubeVideoId: undefined })

    const adapter = new adapterLib.YouTubeCourseAdapter(course, [video])
    const transcript = await adapter.getTranscript('yt-vid-1')
    expect(transcript).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// loadCourseAdapter() integration — uses Dexie
// ---------------------------------------------------------------------------

describe('loadCourseAdapter()', () => {
  it('returns null for non-existent courseId', async () => {
    const { db: freshDb } = await import('@/db')
    // Ensure DB is initialized
    await freshDb.importedCourses.count()

    const adapter = await adapterLib.loadCourseAdapter('nonexistent-id')
    expect(adapter).toBeNull()
  })

  it('creates LocalCourseAdapter for a local course in Dexie', async () => {
    const { db: freshDb } = await import('@/db')
    const course = makeLocalCourse()
    const video = makeVideo()

    await freshDb.importedCourses.add(course)
    await freshDb.importedVideos.add(video)

    const adapter = await adapterLib.loadCourseAdapter('local-course-1')
    expect(adapter).not.toBeNull()
    expect(adapter!.getSource()).toBe('local')
    expect(adapter!.getCourse().name).toBe('TypeScript Fundamentals')

    const lessons = await adapter!.getLessons()
    expect(lessons).toHaveLength(1)
    expect(lessons[0].id).toBe('vid-1')
  })

  it('creates YouTubeCourseAdapter for a YouTube course in Dexie', async () => {
    const { db: freshDb } = await import('@/db')
    const course = makeYouTubeCourse()
    const video = makeYouTubeVideo()

    await freshDb.importedCourses.add(course)
    await freshDb.importedVideos.add(video)

    const adapter = await adapterLib.loadCourseAdapter('yt-course-1')
    expect(adapter).not.toBeNull()
    expect(adapter!.getSource()).toBe('youtube')

    const url = await adapter!.getMediaUrl('yt-vid-1')
    expect(url).toBe('https://www.youtube.com/embed/dQw4w9WgXcQ')
  })
})
