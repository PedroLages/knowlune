import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockDb, mockGetVideoMetadataBatch } = vi.hoisted(() => ({
  mockDb: {
    importedCourses: {
      toArray: vi.fn(() => Promise.resolve([])),
      update: vi.fn(() => Promise.resolve()),
    },
    importedVideos: {
      where: vi.fn(() => ({
        equals: vi.fn(() => ({
          toArray: vi.fn(() => Promise.resolve([])),
        })),
      })),
      update: vi.fn(() => Promise.resolve()),
    },
  },
  mockGetVideoMetadataBatch: vi.fn(() => Promise.resolve(new Map())),
}))

vi.mock('@/db', () => ({ db: mockDb }))
vi.mock('@/lib/youtubeApi', () => ({
  getVideoMetadataBatch: (...args: unknown[]) => mockGetVideoMetadataBatch(...(args as [])),
}))

import {
  isMetadataStale,
  STALE_THRESHOLD_MS,
  getStaleCourses,
  refreshCourseMetadata,
  refreshStaleMetadata,
} from '../youtubeMetadataRefresh'

describe('youtubeMetadataRefresh', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('isMetadataStale', () => {
    it('returns false for non-youtube courses', () => {
      expect(isMetadataStale({ source: 'local' } as never)).toBe(false)
    })

    it('returns true when lastRefreshedAt is missing', () => {
      expect(isMetadataStale({ source: 'youtube', lastRefreshedAt: undefined } as never)).toBe(true)
    })

    it('returns true for invalid date', () => {
      expect(isMetadataStale({ source: 'youtube', lastRefreshedAt: 'invalid' } as never)).toBe(true)
    })

    it('returns false for recently refreshed course', () => {
      const recent = new Date(Date.now() - 1000).toISOString()
      expect(isMetadataStale({ source: 'youtube', lastRefreshedAt: recent } as never)).toBe(false)
    })

    it('returns true for stale course (>30 days)', () => {
      const stale = new Date(Date.now() - STALE_THRESHOLD_MS - 1).toISOString()
      expect(isMetadataStale({ source: 'youtube', lastRefreshedAt: stale } as never)).toBe(true)
    })
  })

  describe('getStaleCourses', () => {
    it('returns empty array when no courses', async () => {
      mockDb.importedCourses.toArray.mockResolvedValue([])
      const result = await getStaleCourses()
      expect(result).toEqual([])
    })

    it('filters to stale youtube courses', async () => {
      const staleDate = new Date(Date.now() - STALE_THRESHOLD_MS - 1).toISOString()
       
      mockDb.importedCourses.toArray.mockResolvedValue([
        { id: '1', source: 'youtube', lastRefreshedAt: staleDate },
        { id: '2', source: 'youtube', lastRefreshedAt: new Date().toISOString() },
        { id: '3', source: 'local' },
      ] as any)

      const result = await getStaleCourses()
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('1')
    })
  })

  describe('refreshCourseMetadata', () => {
    it('skips non-youtube courses', async () => {
      const result = await refreshCourseMetadata({ source: 'local', id: '1' } as never)
      expect(result).toEqual({ updated: 0, removed: 0 })
    })

    it('updates lastRefreshedAt even with no videos', async () => {
      mockDb.importedVideos.where.mockReturnValue({
        equals: vi.fn(() => ({
          toArray: vi.fn(() => Promise.resolve([])),
        })),
      })

      await refreshCourseMetadata({ source: 'youtube', id: '1' } as never)
      expect(mockDb.importedCourses.update).toHaveBeenCalled()
    })

    it('updates videos with fresh metadata', async () => {
      const videos = [{ id: 'v1', youtubeVideoId: 'yt1', filename: 'Old Title', duration: 100 }]
       
      mockDb.importedVideos.where.mockReturnValue({
        equals: vi.fn(() => ({
          toArray: vi.fn(() => Promise.resolve(videos)),
        })),
      } as any)

      const metadata = new Map([
        [
          'yt1',
          {
            ok: true,
            data: {
              title: 'New Title',
              duration: 200,
              thumbnailUrl: null,
              description: null,
              chapters: [],
            },
          },
        ],
      ])
      mockGetVideoMetadataBatch.mockResolvedValue(metadata)

      const result = await refreshCourseMetadata({ source: 'youtube', id: '1' } as never)
      expect(result.updated).toBe(1)
      expect(mockDb.importedVideos.update).toHaveBeenCalled()
    })

    it('marks removed videos', async () => {
      const videos = [{ id: 'v1', youtubeVideoId: 'yt1', filename: 'Title' }]
       
      mockDb.importedVideos.where.mockReturnValue({
        equals: vi.fn(() => ({
          toArray: vi.fn(() => Promise.resolve(videos)),
        })),
      } as any)

      const metadata = new Map([['yt1', { ok: false, code: 'NOT_FOUND' }]])
      mockGetVideoMetadataBatch.mockResolvedValue(metadata)

      const result = await refreshCourseMetadata({ source: 'youtube', id: '1' } as never)
      expect(result.removed).toBe(1)
    })
  })

  describe('refreshStaleMetadata', () => {
    it('returns zeros when no stale courses', async () => {
      mockDb.importedCourses.toArray.mockResolvedValue([])
      const result = await refreshStaleMetadata()
      expect(result).toEqual({ coursesProcessed: 0, totalUpdated: 0, totalRemoved: 0 })
    })

    it('processes stale courses', async () => {
      const staleDate = new Date(Date.now() - STALE_THRESHOLD_MS - 1).toISOString()
       
      mockDb.importedCourses.toArray.mockResolvedValue([
        { id: '1', source: 'youtube', lastRefreshedAt: staleDate },
      ] as any)
      mockDb.importedVideos.where.mockReturnValue({
        equals: vi.fn(() => ({
          toArray: vi.fn(() => Promise.resolve([])),
        })),
      })

      const result = await refreshStaleMetadata()
      expect(result.coursesProcessed).toBe(1)
    })
  })
})
