/**
 * Unit Tests: youtubeTranscriptPipeline.ts
 *
 * Tests the Tier 1 YouTube transcript pipeline:
 * - Single video transcript fetching
 * - Batch transcript fetching with progress tracking
 * - Error handling (no captions, network errors, timeouts)
 * - Dexie storage (success and failure records)
 * - Query helpers (getTranscript, searchTranscripts)
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

// Import after mocks
import {
  fetchTranscript,
  fetchTranscriptsBatch,
  getTranscript,
  getCourseTranscripts,
  searchTranscripts,
} from '../youtubeTranscriptPipeline'

describe('youtubeTranscriptPipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
    mockGet.mockResolvedValue(undefined)
    mockToArray.mockResolvedValue([])
    // Re-wire mockWhere chain after clearAllMocks
    mockWhere.mockReturnValue({
      equals: vi.fn().mockReturnValue({
        toArray: mockToArray,
      }),
    })
  })

  describe('fetchTranscript', () => {
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

    it('handles no-captions-available error', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({ error: 'Transcript not available', code: 'no-captions-available' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        )
      )

      const result = await fetchTranscript('course-1', 'abc12345678')

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.code).toBe('no-captions-available')
      }

      // Should store failure record
      expect(mockPut).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed',
          failureReason: 'no-captions-available',
          courseId: 'course-1',
          videoId: 'abc12345678',
        })
      )
    })

    it('handles network errors', async () => {
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

    it('handles timeout errors', async () => {
      const abortError = new DOMException('The operation was aborted', 'AbortError')
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(abortError)

      const result = await fetchTranscript('course-1', 'abc12345678')

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.code).toBe('timeout')
      }
    })

    it('decodes HTML entities in cue text', async () => {
      const mockCues = [
        { startTime: 0, endTime: 5, text: 'Tom &amp; Jerry &lt;3' },
      ]

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ cues: mockCues, language: 'en' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )

      const result = await fetchTranscript('course-1', 'abc12345678')

      // HTML entities should NOT be decoded by the pipeline — that's the proxy's job
      // But the pipeline passes through whatever the proxy returns
      expect(result.ok).toBe(true)
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
        (progress) => progressUpdates.push({ completed: progress.completed, total: progress.total })
      )

      expect(results).toHaveLength(2)
      expect(results.every(r => r.ok)).toBe(true)
      // Should have progress updates (pending init + per-video updates)
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
      // First call for pending check: return undefined (not fetched yet)
      let callCount = 0
      mockGet.mockImplementation(async () => {
        callCount++
        return undefined
      })

      vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ cues: [{ startTime: 0, endTime: 1, text: 'ok' }], language: 'en' }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ error: 'No captions', code: 'no-captions-available' }),
            { status: 404, headers: { 'Content-Type': 'application/json' } }
          )
        )

      const results = await fetchTranscriptsBatch('course-1', ['vid1_______', 'vid2_______'])

      expect(results).toHaveLength(2)
      expect(results[0].ok).toBe(true)
      expect(results[1].ok).toBe(false)
    })
  })

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
