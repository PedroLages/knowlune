/**
 * Basic tests for AI Summary functions
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dependencies before imports
vi.mock('@/lib/aiConfiguration')
vi.mock('@/ai/workers/coordinator')

// Import after mocking
import { fetchAndParseTranscript } from '../aiSummary'

describe('aiSummary', () => {
  describe('fetchAndParseTranscript', () => {
    beforeEach(() => {
      vi.clearAllMocks()
      global.fetch = vi.fn()
    })

    it('should throw error for failed fetch', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      })

      await expect(fetchAndParseTranscript('https://example.com/transcript.vtt')).rejects.toThrow(
        'Failed to fetch transcript: 404 Not Found'
      )
    })

    it('should parse VTT with valid content', async () => {
      const vttContent = `WEBVTT

1
00:00:00.000 --> 00:00:02.000
Hello world

2
00:00:02.000 --> 00:00:04.000
This is a test`

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => vttContent,
      })

      const result = await fetchAndParseTranscript('https://example.com/transcript.vtt')
      expect(result).toContain('Hello world')
      expect(result).toContain('This is a test')
    })

    it('should handle empty VTT file', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => 'WEBVTT\n\n',
      })

      const result = await fetchAndParseTranscript('https://example.com/transcript.vtt')
      expect(result).toBe('')
    })

    it('should respect abort signal', async () => {
      const controller = new AbortController()
      global.fetch = vi.fn().mockImplementation(() => {
        controller.abort()
        return Promise.reject(new DOMException('Aborted', 'AbortError'))
      })

      await expect(
        fetchAndParseTranscript('https://example.com/transcript.vtt', controller.signal)
      ).rejects.toThrow()
    })
  })
})
