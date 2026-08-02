import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CourseThumbnail, ImportedCourse, ImportedVideo } from '@/data/types'

const mocks = vi.hoisted(() => ({
  getThumbnail: vi.fn(),
  sortVideos: vi.fn(),
  fetchThumbnailFromUrl: vi.fn(),
  extractThumbnailFromVideo: vi.fn(),
  loadThumbnailFromFile: vi.fn(),
  attemptedUrls: [] as string[],
  unreachableUrls: new Set<string>(),
}))

vi.mock('@/db', () => ({
  db: {
    courseThumbnails: {
      get: mocks.getThumbnail,
    },
    importedVideos: {
      where: () => ({
        equals: () => ({
          sortBy: mocks.sortVideos,
        }),
      }),
    },
  },
}))

vi.mock('@/lib/thumbnailService', () => ({
  fetchThumbnailFromUrl: mocks.fetchThumbnailFromUrl,
  extractThumbnailFromVideo: mocks.extractThumbnailFromVideo,
  loadThumbnailFromFile: mocks.loadThumbnailFromFile,
}))

import { findCourseThumbnailRepair } from '../courseThumbnailRepair'

class ReachabilityImage {
  onload: (() => void) | null = null
  onerror: (() => void) | null = null

  set src(url: string) {
    if (!url) return
    mocks.attemptedUrls.push(url)
    queueMicrotask(() => {
      if (mocks.unreachableUrls.has(url)) this.onerror?.()
      else this.onload?.()
    })
  }
}

function makeCourse(overrides: Partial<ImportedCourse> = {}): ImportedCourse {
  return {
    id: 'course-1',
    name: 'YouTube Course',
    importedAt: '2026-08-02T10:00:00.000Z',
    category: 'youtube',
    tags: [],
    status: 'not-started',
    videoCount: 1,
    pdfCount: 0,
    directoryHandle: null,
    source: 'youtube',
    ...overrides,
  }
}

function makeVideo(overrides: Partial<ImportedVideo> = {}): ImportedVideo {
  return {
    id: 'video-1',
    courseId: 'course-1',
    filename: 'Lesson',
    path: 'youtube://video-1',
    duration: 120,
    format: 'mp4',
    order: 0,
    fileHandle: null,
    youtubeVideoId: 'video-1',
    ...overrides,
  }
}

beforeEach(() => {
  vi.stubGlobal('Image', ReachabilityImage)
  mocks.getThumbnail.mockReset().mockResolvedValue(undefined)
  mocks.sortVideos.mockReset().mockResolvedValue([])
  mocks.fetchThumbnailFromUrl.mockReset().mockRejectedValue(new Error('CORS blocked'))
  mocks.extractThumbnailFromVideo.mockReset()
  mocks.loadThumbnailFromFile.mockReset()
  mocks.attemptedUrls.length = 0
  mocks.unreachableUrls.clear()
})

describe('findCourseThumbnailRepair', () => {
  it('keeps a reachable persisted remote thumbnail', async () => {
    mocks.getThumbnail.mockResolvedValue({
      courseId: 'course-1',
      remoteUrl: 'https://example.com/existing.jpg',
      source: 'url',
      createdAt: '2026-08-02T10:00:00.000Z',
    } satisfies CourseThumbnail)

    await expect(findCourseThumbnailRepair(makeCourse())).resolves.toBeNull()
    expect(mocks.sortVideos).not.toHaveBeenCalled()
  })

  it('replaces an unreachable persisted remote thumbnail with the course URL', async () => {
    const staleUrl = 'https://example.com/unreachable.jpg'
    const courseUrl = 'https://example.com/course.jpg'
    mocks.unreachableUrls.add(staleUrl)
    mocks.getThumbnail.mockResolvedValue({
      courseId: 'course-1',
      remoteUrl: staleUrl,
      source: 'url',
      createdAt: '2026-08-02T10:00:00.000Z',
    } satisfies CourseThumbnail)

    await expect(
      findCourseThumbnailRepair(makeCourse({ youtubeThumbnailUrl: courseUrl }))
    ).resolves.toEqual({ kind: 'remote', url: courseUrl, source: 'url' })
    expect(mocks.attemptedUrls).toEqual([staleUrl, courseUrl])
  })

  it('prefers the course-level YouTube URL over video candidates', async () => {
    const courseBlob = new Blob(['course'], { type: 'image/jpeg' })
    mocks.sortVideos.mockResolvedValue([
      makeVideo({ thumbnailUrl: 'https://example.com/video.jpg' }),
    ])
    mocks.fetchThumbnailFromUrl.mockResolvedValue(courseBlob)

    await expect(
      findCourseThumbnailRepair(
        makeCourse({ youtubeThumbnailUrl: 'https://example.com/course.jpg' })
      )
    ).resolves.toEqual({ kind: 'blob', blob: courseBlob, source: 'url' })
    expect(mocks.fetchThumbnailFromUrl).toHaveBeenCalledOnce()
    expect(mocks.fetchThumbnailFromUrl).toHaveBeenCalledWith('https://example.com/course.jpg')
  })

  it('recovers a missing course thumbnail from imported-video metadata', async () => {
    mocks.sortVideos.mockResolvedValue([
      makeVideo({ thumbnailUrl: 'https://example.com/video.jpg' }),
    ])

    await expect(findCourseThumbnailRepair(makeCourse())).resolves.toEqual({
      kind: 'remote',
      url: 'https://example.com/video.jpg',
      source: 'url',
    })
  })

  it('tries generated YouTube URLs in descending quality order', async () => {
    const highUrl = 'https://i.ytimg.com/vi/video-1/hqdefault.jpg'
    const mediumUrl = 'https://i.ytimg.com/vi/video-1/mqdefault.jpg'
    mocks.unreachableUrls.add(highUrl)
    mocks.sortVideos.mockResolvedValue([makeVideo()])

    await expect(findCourseThumbnailRepair(makeCourse())).resolves.toEqual({
      kind: 'remote',
      url: mediumUrl,
      source: 'url',
    })
    expect(mocks.attemptedUrls).toEqual([highUrl, mediumUrl])
  })

  it('returns null when every YouTube candidate is unreachable', async () => {
    const urls = [
      'https://i.ytimg.com/vi/video-1/hqdefault.jpg',
      'https://i.ytimg.com/vi/video-1/mqdefault.jpg',
      'https://i.ytimg.com/vi/video-1/default.jpg',
    ]
    urls.forEach(url => mocks.unreachableUrls.add(url))
    mocks.sortVideos.mockResolvedValue([makeVideo()])

    await expect(findCourseThumbnailRepair(makeCourse())).resolves.toBeNull()
    expect(mocks.attemptedUrls).toEqual(urls)
  })
})
