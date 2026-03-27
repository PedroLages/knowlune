/**
 * Unit Tests: youtubeTranscriptPipeline.ts
 *
 * Tests the tiered YouTube transcript pipeline:
 * - Tier 1: youtube-transcript (single video + batch)
 * - Tier 2: yt-dlp fallback (when Tier 1 returns no-captions-available)
 * - Tier 3: Whisper fallback (when Tier 1 + Tier 2 fail)
 * - All-tiers-exhausted → unavailable status
 * - Unconfigured tiers skipped gracefully
 * - Error handling (network errors, timeouts)
 * - Dexie storage (success and failure records)
 * - Query helpers (getTranscript, searchTranscripts)
 * - yt-dlp metadata enrichment
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock Dexie — use vi.hoisted to avoid factory hoisting issues
const { mockPut, mockGet, mockUpdate, mockToArray, mockWhere } = vi.hoisted(() => {
  const mockToArray = vi.fn().mockResolvedValue([])
  const mockWhere = vi.fn().mockReturnValue({
    equals: vi.fn().mockReturnValue({
      toArray: mockToArray,
    }),
  })
  return {
    mockPut: vi.fn().mockResolvedValue(undefined),
    mockGet: vi.fn().mockResolvedValue(undefined),
    mockUpdate: vi.fn().mockResolvedValue(1),
    mockToArray,
    mockWhere,
  }
})

vi.mock('@/db/schema', () => ({
  db: {
    youtubeTranscripts: {
      put: mockPut,
      get: mockGet,
      update: mockUpdate,
      where: mockWhere,
    },
  },
}))

// Mock youtubeConfiguration — control what tiers are configured
const mockGetConfig = vi.hoisted(() => vi.fn())
vi.mock('@/lib/youtubeConfiguration', () => ({
  getYouTubeConfiguration: mockGetConfig,
}))

// Import after mocks
import {
  fetchTranscript,
  fetchTranscriptsBatch,
  getTranscript,
  getCourseTranscripts,
  searchTranscripts,
  fetchYtDlpMetadata,
} from '../youtubeTranscriptPipeline'

// Default config: no Tier 2/3 configured
const BASE_CONFIG = {
  cacheTtlDays: 7,
  ytDlpServerUrl: undefined,
  whisperEndpointUrl: undefined,
}

describe('youtubeTranscriptPipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
    mockGet.mockResolvedValue(undefined)
    mockToArray.mockResolvedValue([])
    mockGetConfig.mockReturnValue({ ...BASE_CONFIG })
    // Re-wire mockWhere chain after clearAllMocks
    mockWhere.mockReturnValue({
      equals: vi.fn().mockReturnValue({
        toArray: mockToArray,
      }),
    })
  })

  // =========================================================================
  // Tier 1: youtube-transcript
  // =========================================================================

  describe('Tier 1: youtube-transcript', () => {
    it('fetches and stores a transcript successfully', async () => {
      const mockCues = [
        { startTime: 0, endTime: 5, text: 'Hello world' },
        { startTime: 5, endTime: 10, text: 'Welcome to the course' },
      ]

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ cues: mockCues, language: 'en' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )

      const result = await fetchTranscript('course-1', 'abc12345678')

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.record.courseId).toBe('course-1')
        expect(result.record.videoId).toBe('abc12345678')
        expect(result.record.cues).toHaveLength(2)
        expect(result.record.fullText).toBe('Hello world Welcome to the course')
        expect(result.record.source).toBe('youtube-transcript')
        expect(result.record.status).toBe('done')
        expect(result.record.language).toBe('en')
      }

      expect(mockPut).toHaveBeenCalledOnce()
    })

    it('stores failure for non-fallbackable errors (network)', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('fetch failed'))

      const result = await fetchTranscript('course-1', 'abc12345678')

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.code).toBe('network-error')
      }

      expect(mockPut).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed',
          failureReason: 'network-error',
        })
      )
    })

    it('stores failure for timeout errors without fallback', async () => {
      const abortError = new DOMException('The operation was aborted', 'AbortError')
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(abortError)

      const result = await fetchTranscript('course-1', 'abc12345678')

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.code).toBe('timeout')
      }
    })

    it('stores failure for rate-limit without fallback', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'Rate limited', code: 'rate-limited' }), {
          status: 429,
          headers: { 'Content-Type': 'application/json' },
        })
      )

      const result = await fetchTranscript('course-1', 'abc12345678')

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.code).toBe('rate-limited')
      }

      // Should store as failed, not trigger fallback
      expect(mockPut).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed',
          failureReason: 'rate-limited',
        })
      )
    })

    it('passes language parameter to the endpoint', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ cues: [], language: 'es' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )

      await fetchTranscript('course-1', 'abc12345678', 'es')

      const [, options] = fetchSpy.mock.calls[0]
      const body = JSON.parse(options?.body as string)
      expect(body.lang).toBe('es')
    })
  })

  // =========================================================================
  // Tier 2: yt-dlp fallback
  // =========================================================================

  describe('Tier 2: yt-dlp fallback', () => {
    it('falls back to Tier 2 when Tier 1 returns no-captions-available', async () => {
      mockGetConfig.mockReturnValue({
        ...BASE_CONFIG,
        ytDlpServerUrl: 'http://192.168.1.100:5000',
      })

      const vttContent = `WEBVTT

00:00:00.000 --> 00:00:05.000
Hello from yt-dlp

00:00:05.000 --> 00:00:10.000
Second cue`

      vi.spyOn(globalThis, 'fetch')
        // Tier 1: no captions
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ error: 'No captions', code: 'no-captions-available' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          })
        )
        // Tier 2: success with VTT
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ vtt: vttContent, language: 'en' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )

      const result = await fetchTranscript('course-1', 'abc12345678')

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.record.source).toBe('yt-dlp')
        expect(result.record.cues).toHaveLength(2)
        expect(result.record.cues[0].text).toBe('Hello from yt-dlp')
        expect(result.record.fullText).toContain('Hello from yt-dlp')
      }
    })

    it('falls back to Tier 2 when Tier 1 returns captions-disabled', async () => {
      mockGetConfig.mockReturnValue({
        ...BASE_CONFIG,
        ytDlpServerUrl: 'http://192.168.1.100:5000',
      })

      vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ error: 'Captions disabled', code: 'captions-disabled' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          })
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              vtt: 'WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nTest',
              language: 'en',
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        )

      const result = await fetchTranscript('course-1', 'abc12345678')

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.record.source).toBe('yt-dlp')
      }
    })

    it('skips Tier 2 when yt-dlp is not configured', async () => {
      // No ytDlpServerUrl configured
      mockGetConfig.mockReturnValue({ ...BASE_CONFIG })

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'No captions', code: 'no-captions-available' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        })
      )

      const result = await fetchTranscript('course-1', 'abc12345678')

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.code).toBe('all-tiers-exhausted')
      }

      // Should mark as unavailable
      expect(mockPut).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'unavailable',
          failureReason: 'all-tiers-exhausted',
        })
      )
    })
  })

  // =========================================================================
  // Tier 3: Whisper fallback
  // =========================================================================

  describe('Tier 3: Whisper fallback', () => {
    it('falls back to Tier 3 when Tier 1 and Tier 2 both fail', async () => {
      mockGetConfig.mockReturnValue({
        ...BASE_CONFIG,
        ytDlpServerUrl: 'http://192.168.1.100:5000',
        whisperEndpointUrl: 'http://192.168.1.100:9000',
      })

      const whisperVtt = `WEBVTT

00:00:00.000 --> 00:00:05.000
Whisper transcription result`

      vi.spyOn(globalThis, 'fetch')
        // Tier 1: no captions
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ error: 'No captions', code: 'no-captions-available' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          })
        )
        // Tier 2: also fails
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ error: 'No subtitles', code: 'ytdlp-fetch-error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          })
        )
        // Tier 3: Whisper success
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ vtt: whisperVtt, language: 'en', duration: 120 }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )

      const result = await fetchTranscript('course-1', 'abc12345678')

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.record.source).toBe('whisper')
        expect(result.record.cues).toHaveLength(1)
        expect(result.record.cues[0].text).toBe('Whisper transcription result')
      }
    })

    it('skips Tier 3 when Whisper is not configured', async () => {
      mockGetConfig.mockReturnValue({
        ...BASE_CONFIG,
        ytDlpServerUrl: 'http://192.168.1.100:5000',
        // No whisperEndpointUrl
      })

      vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ error: 'No captions', code: 'no-captions-available' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          })
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ error: 'Failed', code: 'ytdlp-fetch-error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          })
        )

      const result = await fetchTranscript('course-1', 'abc12345678')

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.code).toBe('all-tiers-exhausted')
      }
    })

    it('handles Tier 3 network error gracefully', async () => {
      mockGetConfig.mockReturnValue({
        ...BASE_CONFIG,
        ytDlpServerUrl: 'http://192.168.1.100:5000',
        whisperEndpointUrl: 'http://192.168.1.100:9000',
      })

      vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ error: 'No captions', code: 'no-captions-available' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          })
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ error: 'Failed', code: 'ytdlp-fetch-error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          })
        )
        // Tier 3 throws network error
        .mockRejectedValueOnce(new Error('ECONNREFUSED'))

      const result = await fetchTranscript('course-1', 'abc12345678')

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.code).toBe('all-tiers-exhausted')
      }

      // Should mark as unavailable
      expect(mockPut).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'unavailable',
        })
      )
    })
  })

  // =========================================================================
  // All tiers exhausted
  // =========================================================================

  describe('all tiers exhausted', () => {
    it('marks video as unavailable when all configured tiers fail', async () => {
      mockGetConfig.mockReturnValue({
        ...BASE_CONFIG,
        ytDlpServerUrl: 'http://192.168.1.100:5000',
        whisperEndpointUrl: 'http://192.168.1.100:9000',
      })

      vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ error: 'No captions', code: 'no-captions-available' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          })
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ error: 'No subs', code: 'ytdlp-fetch-error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          })
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ error: 'Whisper failed', code: 'whisper-fetch-error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          })
        )

      const result = await fetchTranscript('course-1', 'abc12345678')

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.code).toBe('all-tiers-exhausted')
        expect(result.message).toContain('No transcript source available')
      }

      expect(mockPut).toHaveBeenCalledWith(
        expect.objectContaining({
          courseId: 'course-1',
          videoId: 'abc12345678',
          status: 'unavailable',
          failureReason: 'all-tiers-exhausted',
        })
      )
    })

    it('marks unavailable with only Tier 1 configured', async () => {
      mockGetConfig.mockReturnValue({ ...BASE_CONFIG })

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'No captions', code: 'no-captions-available' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        })
      )

      const result = await fetchTranscript('course-1', 'abc12345678')

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.code).toBe('all-tiers-exhausted')
      }
    })
  })

  // =========================================================================
  // yt-dlp metadata enrichment
  // =========================================================================

  describe('fetchYtDlpMetadata', () => {
    it('returns null when yt-dlp is not configured', async () => {
      mockGetConfig.mockReturnValue({ ...BASE_CONFIG })

      const result = await fetchYtDlpMetadata('abc12345678')

      expect(result).toBeNull()
    })

    it('fetches metadata when yt-dlp is configured', async () => {
      mockGetConfig.mockReturnValue({
        ...BASE_CONFIG,
        ytDlpServerUrl: 'http://192.168.1.100:5000',
      })

      const metadata = {
        title: 'Test Video',
        description: 'A great video',
        chapters: [{ title: 'Intro', startTime: 0, endTime: 60 }],
        duration: 600,
      }

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify(metadata), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )

      const result = await fetchYtDlpMetadata('abc12345678')

      expect(result).toEqual(metadata)
    })

    it('returns null on fetch error', async () => {
      mockGetConfig.mockReturnValue({
        ...BASE_CONFIG,
        ytDlpServerUrl: 'http://192.168.1.100:5000',
      })

      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'))

      const result = await fetchYtDlpMetadata('abc12345678')

      expect(result).toBeNull()
    })
  })

  // =========================================================================
  // Batch fetch
  // =========================================================================

  describe('fetchTranscriptsBatch', () => {
    it('fetches multiple transcripts with progress callbacks', async () => {
      const progressUpdates: Array<{ completed: number; total: number }> = []

      vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        return new Response(
          JSON.stringify({ cues: [{ startTime: 0, endTime: 5, text: 'Hello' }], language: 'en' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      })

      const results = await fetchTranscriptsBatch(
        'course-1',
        ['vid1_______', 'vid2_______'],
        progress => progressUpdates.push({ completed: progress.completed, total: progress.total })
      )

      expect(results).toHaveLength(2)
      expect(results.every(r => r.ok)).toBe(true)
      expect(progressUpdates.length).toBeGreaterThan(0)
    })

    it('skips already-done transcripts', async () => {
      mockGet.mockResolvedValue({
        courseId: 'course-1',
        videoId: 'vid1_______',
        status: 'done',
        cues: [],
        fullText: '',
        source: 'youtube-transcript',
        language: 'en',
        fetchedAt: '2026-01-01T00:00:00Z',
      })

      const fetchSpy = vi.spyOn(globalThis, 'fetch')

      await fetchTranscriptsBatch('course-1', ['vid1_______'])

      // fetch should NOT be called because the video is already done
      expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('handles mixed success and failure in batch', async () => {
      mockGet.mockResolvedValue(undefined)

      vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ cues: [{ startTime: 0, endTime: 1, text: 'ok' }], language: 'en' }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ error: 'No captions', code: 'no-captions-available' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          })
        )

      const results = await fetchTranscriptsBatch('course-1', ['vid1_______', 'vid2_______'])

      expect(results).toHaveLength(2)
      expect(results[0].ok).toBe(true)
      expect(results[1].ok).toBe(false)
    })
  })

  // =========================================================================
  // Query helpers
  // =========================================================================

  describe('query helpers', () => {
    it('getTranscript retrieves from Dexie by compound key', async () => {
      const mockRecord = {
        courseId: 'course-1',
        videoId: 'vid1_______',
        status: 'done' as const,
        cues: [],
        fullText: 'test',
        source: 'youtube-transcript' as const,
        language: 'en',
        fetchedAt: '2026-01-01T00:00:00Z',
      }
      mockGet.mockResolvedValueOnce(mockRecord)

      const result = await getTranscript('course-1', 'vid1_______')

      expect(mockGet).toHaveBeenCalledWith(['course-1', 'vid1_______'])
      expect(result).toEqual(mockRecord)
    })

    it('getCourseTranscripts queries by courseId', async () => {
      const mockRecords = [
        { courseId: 'course-1', videoId: 'v1', status: 'done', fullText: 'hello' },
        { courseId: 'course-1', videoId: 'v2', status: 'done', fullText: 'world' },
      ]
      mockToArray.mockResolvedValueOnce(mockRecords)

      const results = await getCourseTranscripts('course-1')

      expect(results).toHaveLength(2)
    })

    it('searchTranscripts filters by query in fullText', async () => {
      const mockRecords = [
        { courseId: 'c1', videoId: 'v1', status: 'done', fullText: 'Introduction to React hooks' },
        { courseId: 'c1', videoId: 'v2', status: 'done', fullText: 'Advanced TypeScript patterns' },
        { courseId: 'c1', videoId: 'v3', status: 'failed', fullText: '' },
      ]
      mockToArray.mockResolvedValueOnce(mockRecords)

      const results = await searchTranscripts('c1', 'react')

      expect(results).toHaveLength(1)
      expect(results[0].videoId).toBe('v1')
    })

    it('searchTranscripts is case-insensitive', async () => {
      const mockRecords = [
        { courseId: 'c1', videoId: 'v1', status: 'done', fullText: 'React Hooks Tutorial' },
      ]
      mockToArray.mockResolvedValueOnce(mockRecords)

      const results = await searchTranscripts('c1', 'REACT')

      expect(results).toHaveLength(1)
    })

    it('searchTranscripts excludes failed records', async () => {
      const mockRecords = [
        { courseId: 'c1', videoId: 'v1', status: 'failed', fullText: 'react hooks' },
      ]
      mockToArray.mockResolvedValueOnce(mockRecords)

      const results = await searchTranscripts('c1', 'react')

      expect(results).toHaveLength(0)
    })
  })
})
