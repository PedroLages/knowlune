/**
 * Unit Tests: youtubeApi.ts
 *
 * Tests the YouTube Data API v3 client:
 * - ISO 8601 duration parsing
 * - Chapter extraction from descriptions
 * - Single video metadata fetching
 * - Batch video metadata fetching
 * - Playlist item fetching with pagination
 * - oEmbed fallback
 * - Cache interactions
 * - Error classification
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock dependencies before imports
vi.mock('sonner', () => ({
  toast: {
    warning: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
  },
}))

vi.mock('@/db/schema', () => ({
  db: {
    youtubeVideoCache: {
      get: vi.fn(),
      put: vi.fn(),
      bulkGet: vi.fn().mockResolvedValue([]),
      bulkPut: vi.fn(),
      bulkDelete: vi.fn(),
      delete: vi.fn(),
      clear: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
      orderBy: vi.fn().mockReturnValue({ first: vi.fn().mockResolvedValue(null) }),
    },
  },
}))

const mockGetDecryptedYouTubeApiKey = vi
  .fn()
  .mockResolvedValue('AIzaFakeTestKeyForUnitTesting1234567')
const mockIsQuotaExceeded = vi.fn().mockReturnValue(false)
const mockRecordQuotaUsage = vi.fn()

vi.mock('@/lib/youtubeConfiguration', () => ({
  getDecryptedYouTubeApiKey: (...args: unknown[]) => mockGetDecryptedYouTubeApiKey(...args),
  getYouTubeConfiguration: vi.fn().mockReturnValue({ cacheTtlDays: 7 }),
  getCacheTtlMs: vi.fn().mockReturnValue(7 * 24 * 60 * 60 * 1000),
}))

vi.mock('@/lib/youtubeRateLimiter', () => ({
  getYouTubeRateLimiter: vi.fn().mockReturnValue({
    execute: vi.fn().mockImplementation((fn: () => Promise<unknown>) => fn()),
    executeWithRetry: vi.fn().mockImplementation((fn: () => Promise<unknown>) => fn()),
  }),
}))

vi.mock('@/lib/youtubeQuotaTracker', () => ({
  recordQuotaUsage: (...args: unknown[]) => mockRecordQuotaUsage(...args),
  isQuotaExceeded: (...args: unknown[]) => mockIsQuotaExceeded(...args),
}))

import {
  parseIsoDuration,
  extractChapters,
  getVideoMetadata,
  getVideoMetadataBatch,
  getPlaylistItems,
  getOEmbedMetadata,
  MAX_BATCH_SIZE,
} from '@/lib/youtubeApi'
import { db } from '@/db/schema'

describe('youtubeApi.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset to default mock values
    mockGetDecryptedYouTubeApiKey.mockResolvedValue('AIzaFakeTestKeyForUnitTesting1234567')
    mockIsQuotaExceeded.mockReturnValue(false)
    vi.mocked(db.youtubeVideoCache.get).mockResolvedValue(undefined)
    vi.mocked(db.youtubeVideoCache.bulkGet).mockResolvedValue([])
  })

  describe('parseIsoDuration', () => {
    it('parses hours, minutes, seconds', () => {
      expect(parseIsoDuration('PT1H2M3S')).toBe(3723)
    })

    it('parses minutes and seconds only', () => {
      expect(parseIsoDuration('PT15M30S')).toBe(930)
    })

    it('parses seconds only', () => {
      expect(parseIsoDuration('PT45S')).toBe(45)
    })

    it('parses hours only', () => {
      expect(parseIsoDuration('PT2H')).toBe(7200)
    })

    it('parses minutes only', () => {
      expect(parseIsoDuration('PT10M')).toBe(600)
    })

    it('returns 0 for invalid format', () => {
      expect(parseIsoDuration('invalid')).toBe(0)
    })

    it('returns 0 for empty string', () => {
      expect(parseIsoDuration('')).toBe(0)
    })

    it('parses PT0S (zero duration)', () => {
      expect(parseIsoDuration('PT0S')).toBe(0)
    })

    it('parses long durations', () => {
      expect(parseIsoDuration('PT10H30M15S')).toBe(37815)
    })
  })

  describe('extractChapters', () => {
    it('extracts chapters from description with MM:SS format', () => {
      const description = `
Check out this video!

0:00 Introduction
2:30 Chapter 1 - Getting Started
5:45 Chapter 2 - Advanced Topics
10:00 Conclusion

Like and subscribe!
      `.trim()

      const chapters = extractChapters(description)
      expect(chapters).toHaveLength(4)
      expect(chapters[0]).toEqual({ time: 0, title: 'Introduction' })
      expect(chapters[1]).toEqual({ time: 150, title: 'Chapter 1 - Getting Started' })
      expect(chapters[2]).toEqual({ time: 345, title: 'Chapter 2 - Advanced Topics' })
      expect(chapters[3]).toEqual({ time: 600, title: 'Conclusion' })
    })

    it('extracts chapters with HH:MM:SS format', () => {
      const description = `
0:00:00 Intro
1:05:30 Part 2
      `.trim()

      const chapters = extractChapters(description)
      expect(chapters).toHaveLength(2)
      expect(chapters[0]).toEqual({ time: 0, title: 'Intro' })
      expect(chapters[1]).toEqual({ time: 3930, title: 'Part 2' })
    })

    it('returns empty array for description without chapters', () => {
      const description = 'Just a regular description with no timestamps.'
      expect(extractChapters(description)).toHaveLength(0)
    })

    it('ignores lines that do not match chapter format', () => {
      const description = `
Hello world
0:00 Introduction
Not a chapter
3:30 Next Section
More text
      `.trim()

      const chapters = extractChapters(description)
      expect(chapters).toHaveLength(2)
    })

    it('returns empty array for empty string', () => {
      expect(extractChapters('')).toHaveLength(0)
    })
  })

  describe('MAX_BATCH_SIZE', () => {
    it('is 50 (YouTube API limit)', () => {
      expect(MAX_BATCH_SIZE).toBe(50)
    })
  })

  describe('getVideoMetadata', () => {
    it('returns cached video when available and not expired', async () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString()
      const cached = {
        videoId: 'test123test',
        title: 'Cached Video',
        description: '',
        channelId: 'UC123',
        channelTitle: 'Test Channel',
        thumbnailUrl: 'https://i.ytimg.com/test.jpg',
        duration: 120,
        publishedAt: '2024-01-01T00:00:00Z',
        chapters: [],
        fetchedAt: new Date().toISOString(),
        expiresAt: futureDate,
      }
      vi.mocked(db.youtubeVideoCache.get).mockResolvedValue(cached)

      const result = await getVideoMetadata('test123test')
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.fromCache).toBe(true)
        expect(result.data.title).toBe('Cached Video')
      }
    })

    it('fetches from API when cache miss', async () => {
      const apiResponse = {
        items: [
          {
            id: 'abc123DEF_-',
            snippet: {
              title: 'API Video',
              description: '0:00 Intro\n1:30 Main',
              channelId: 'UC456',
              channelTitle: 'API Channel',
              publishedAt: '2024-06-15T12:00:00Z',
              thumbnails: { high: { url: 'https://i.ytimg.com/high.jpg' } },
            },
            contentDetails: { duration: 'PT5M30S' },
          },
        ],
        pageInfo: { totalResults: 1 },
      }

      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify(apiResponse), { status: 200 })
      )

      const result = await getVideoMetadata('abc123DEF_-')
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.fromCache).toBe(false)
        expect(result.data.title).toBe('API Video')
        expect(result.data.duration).toBe(330)
        expect(result.data.chapters).toHaveLength(2)
      }
    })

    it('falls back to oEmbed when quota exceeded', async () => {
      mockIsQuotaExceeded.mockReturnValue(true)

      const oembedResponse = {
        title: 'Fallback Title',
        author_name: 'Fallback Author',
        author_url: 'https://youtube.com/@author',
        thumbnail_url: 'https://i.ytimg.com/fallback.jpg',
      }

      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify(oembedResponse), { status: 200 })
      )

      const result = await getVideoMetadata('abc123DEF_-')
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data.title).toBe('Fallback Title')
        expect(result.data.channelTitle).toBe('Fallback Author')
        expect(result.data.duration).toBe(0) // Not available via oEmbed
      }
    })

    it('returns error when no API key configured', async () => {
      mockGetDecryptedYouTubeApiKey.mockResolvedValue(null)

      const result = await getVideoMetadata('abc123DEF_-')
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.code).toBe('NO_API_KEY')
      }
    })
  })

  describe('getPlaylistItems', () => {
    it('fetches playlist items from API', async () => {
      const apiResponse = {
        items: [
          {
            snippet: {
              title: 'Video 1',
              position: 0,
              channelTitle: 'Channel',
              resourceId: { videoId: 'vid1_______' },
              thumbnails: { high: { url: 'https://i.ytimg.com/v1.jpg' } },
            },
          },
          {
            snippet: {
              title: 'Video 2',
              position: 1,
              channelTitle: 'Channel',
              resourceId: { videoId: 'vid2_______' },
              thumbnails: { medium: { url: 'https://i.ytimg.com/v2.jpg' } },
            },
          },
        ],
        pageInfo: { totalResults: 2 },
      }

      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify(apiResponse), { status: 200 })
      )

      const result = await getPlaylistItems('PLtest123')
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data).toHaveLength(2)
        expect(result.data[0].videoId).toBe('vid1_______')
        expect(result.data[0].position).toBe(0)
        expect(result.data[1].videoId).toBe('vid2_______')
      }
    })

    it('returns error when API key not configured', async () => {
      mockGetDecryptedYouTubeApiKey.mockResolvedValue(null)

      const result = await getPlaylistItems('PLtest123')
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.code).toBe('NO_API_KEY')
      }
    })
  })

  describe('getOEmbedMetadata', () => {
    it('fetches oEmbed data successfully', async () => {
      const oembedResponse = {
        title: 'Test Video',
        author_name: 'Test Author',
        author_url: 'https://youtube.com/@test',
        thumbnail_url: 'https://i.ytimg.com/test.jpg',
      }

      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify(oembedResponse), { status: 200 })
      )

      const result = await getOEmbedMetadata('abc123DEF_-')
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data.title).toBe('Test Video')
        expect(result.data.authorName).toBe('Test Author')
      }
    })

    it('returns NOT_FOUND for non-existent video', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('Not Found', { status: 404 }))

      const result = await getOEmbedMetadata('nonexistent_')
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.code).toBe('NOT_FOUND')
      }
    })

    it('returns NETWORK_ERROR on fetch failure', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network'))

      const result = await getOEmbedMetadata('abc123DEF_-')
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.code).toBe('NETWORK_ERROR')
      }
    })
  })

  describe('getVideoMetadataBatch', () => {
    it('returns empty map for empty input', async () => {
      const result = await getVideoMetadataBatch([])
      expect(result.size).toBe(0)
    })

    it('returns cached results without API call', async () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString()
      const cached = {
        videoId: 'vid1_______',
        title: 'Cached',
        description: '',
        channelId: 'UC1',
        channelTitle: 'Ch',
        thumbnailUrl: 'https://i.ytimg.com/c.jpg',
        duration: 60,
        publishedAt: '2024-01-01T00:00:00Z',
        chapters: [],
        fetchedAt: new Date().toISOString(),
        expiresAt: futureDate,
      }
      vi.mocked(db.youtubeVideoCache.bulkGet).mockResolvedValue([cached])

      const result = await getVideoMetadataBatch(['vid1_______'])
      expect(result.size).toBe(1)
      const r = result.get('vid1_______')
      expect(r?.ok).toBe(true)
      if (r?.ok) {
        expect(r.fromCache).toBe(true)
      }
    })

    it('deduplicates video IDs', async () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString()
      const cached = {
        videoId: 'dup________',
        title: 'Dup',
        description: '',
        channelId: 'UC1',
        channelTitle: 'Ch',
        thumbnailUrl: 'https://i.ytimg.com/d.jpg',
        duration: 60,
        publishedAt: '2024-01-01T00:00:00Z',
        chapters: [],
        fetchedAt: new Date().toISOString(),
        expiresAt: futureDate,
      }
      vi.mocked(db.youtubeVideoCache.bulkGet).mockResolvedValue([cached])

      const result = await getVideoMetadataBatch(['dup________', 'dup________', 'dup________'])
      expect(result.size).toBe(1)
    })
  })
})
