/**
 * Comprehensive tests for AI Summary functions
 *
 * Covers: fetchAndParseTranscript, generateVideoSummary (streaming via LLM client),
 * VTT parsing (via fetchAndParseTranscript), timeouts, errors, and fallback behavior.
 *
 * After E90-S08, generateVideoSummary uses getLLMClient('videoSummary') instead of
 * direct proxy fetch, so we mock the LLM factory layer.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock dependencies before imports
vi.mock('@/lib/aiConfiguration', () => ({
  sanitizeAIRequestPayload: vi.fn((content: string) => ({ content })),
  resolveFeatureModel: vi.fn(() => ({
    provider: 'anthropic',
    model: 'claude-haiku-4-5',
  })),
  getDecryptedApiKeyForProvider: vi.fn(async () => 'mock-api-key'),
}))
vi.mock('@/ai/workers/coordinator')

// Mock LLM factory
const mockStreamCompletion = vi.fn()
const mockLLMClient = {
  streamCompletion: mockStreamCompletion,
  getProviderId: () => 'anthropic',
}

vi.mock('@/ai/llm/factory', () => ({
  getLLMClient: vi.fn(async () => mockLLMClient),
  getLLMClientForProvider: vi.fn(() => mockLLMClient),
  withModelFallback: vi.fn(async function* (_feature: string, messages: unknown) {
    for await (const chunk of mockLLMClient.streamCompletion(messages)) {
      if (chunk.content) {
        yield chunk.content
      }
    }
  }),
}))

// Import after mocking
import { fetchAndParseTranscript, generateVideoSummary } from '../aiSummary'
import { sanitizeAIRequestPayload } from '@/lib/aiConfiguration'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Creates an async generator that yields chunks */
async function* createMockStream(
  chunks: string[]
): AsyncGenerator<{ content: string; finishReason?: string }, void, unknown> {
  for (const content of chunks) {
    yield { content }
  }
}

/** Collects all yielded values from an async generator */
async function collectGenerator(gen: AsyncGenerator<string>): Promise<string[]> {
  const results: string[] = []
  for await (const chunk of gen) {
    results.push(chunk)
  }
  return results
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('aiSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    globalThis.fetch = vi.fn()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // =========================================================================
  // fetchAndParseTranscript
  // =========================================================================

  describe('fetchAndParseTranscript', () => {
    it('should throw error for failed fetch', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
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

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => vttContent,
      })

      const result = await fetchAndParseTranscript('https://example.com/transcript.vtt')
      expect(result).toContain('Hello world')
      expect(result).toContain('This is a test')
    })

    it('should handle empty VTT file', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => 'WEBVTT\n\n',
      })

      await expect(fetchAndParseTranscript('https://example.com/transcript.vtt')).rejects.toThrow(
        'Transcript contains no parsable cues'
      )
    })

    it('should respect abort signal', async () => {
      const controller = new AbortController()
      globalThis.fetch = vi.fn().mockImplementation(() => {
        controller.abort()
        return Promise.reject(new DOMException('Aborted', 'AbortError'))
      })

      await expect(
        fetchAndParseTranscript('https://example.com/transcript.vtt', controller.signal)
      ).rejects.toThrow()
    })

    it('should pass abort signal to fetch', async () => {
      const controller = new AbortController()
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => `WEBVTT

00:00:00.000 --> 00:00:01.000
Content`,
      })

      await fetchAndParseTranscript('https://example.com/transcript.vtt', controller.signal)
      expect(globalThis.fetch).toHaveBeenCalledWith('https://example.com/transcript.vtt', {
        signal: controller.signal,
      })
    })

    it('should join multiple cue texts with spaces', async () => {
      const vttContent = `WEBVTT

00:00:00.000 --> 00:00:01.000
First

00:00:01.000 --> 00:00:02.000
Second

00:00:02.000 --> 00:00:03.000
Third`

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => vttContent,
      })

      const result = await fetchAndParseTranscript('https://example.com/test.vtt')
      expect(result).toBe('First Second Third')
    })

    it('should parse VTT with MM:SS timestamp format', async () => {
      const vttContent = `WEBVTT

00:00 --> 00:05
Short format cue`

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => vttContent,
      })

      const result = await fetchAndParseTranscript('https://example.com/test.vtt')
      expect(result).toBe('Short format cue')
    })

    it('should parse VTT with comma decimal separator', async () => {
      const vttContent = `WEBVTT

00:00:00,000 --> 00:00:02,500
Comma separated`

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => vttContent,
      })

      const result = await fetchAndParseTranscript('https://example.com/test.vtt')
      expect(result).toBe('Comma separated')
    })

    it('should handle multi-line cue text', async () => {
      const vttContent = `WEBVTT

00:00:00.000 --> 00:00:02.000
Line one
Line two`

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => vttContent,
      })

      const result = await fetchAndParseTranscript('https://example.com/test.vtt')
      expect(result).toBe('Line one Line two')
    })

    it('should skip blocks without timestamp lines', async () => {
      const vttContent = `WEBVTT

NOTE This is a comment block
with no timestamp

00:00:00.000 --> 00:00:02.000
Actual content`

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => vttContent,
      })

      const result = await fetchAndParseTranscript('https://example.com/test.vtt')
      expect(result).toBe('Actual content')
    })

    it('should skip blocks with timestamp but no text after it', async () => {
      const vttContent = `WEBVTT

00:00:00.000 --> 00:00:02.000

00:00:02.000 --> 00:00:04.000
Real content`

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => vttContent,
      })

      const result = await fetchAndParseTranscript('https://example.com/test.vtt')
      expect(result).toBe('Real content')
    })

    it('should handle server error status codes', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      })

      await expect(fetchAndParseTranscript('https://example.com/test.vtt')).rejects.toThrow(
        'Failed to fetch transcript: 500 Internal Server Error'
      )
    })
  })

  // =========================================================================
  // generateVideoSummary
  // =========================================================================

  describe('generateVideoSummary', () => {
    it('should call sanitizeAIRequestPayload when building messages', async () => {
      mockStreamCompletion.mockImplementation(() => createMockStream(['Hello']))

      const gen = generateVideoSummary('my transcript')
      await collectGenerator(gen)

      expect(sanitizeAIRequestPayload).toHaveBeenCalledWith('my transcript')
    })

    it('should stream chunks from LLM client', async () => {
      mockStreamCompletion.mockImplementation(() => createMockStream(['Hello', ' world']))

      const gen = generateVideoSummary('transcript')
      const results = await collectGenerator(gen)

      expect(results).toEqual(['Hello', ' world'])
    })

    it('should skip empty content chunks', async () => {
      mockStreamCompletion.mockImplementation(() => createMockStream(['Hello', '', ' world']))

      const gen = generateVideoSummary('transcript')
      const results = await collectGenerator(gen)

      expect(results).toEqual(['Hello', ' world'])
    })

    it('should use withModelFallback with videoSummary feature', async () => {
      const { withModelFallback } = await import('@/ai/llm/factory')
      mockStreamCompletion.mockImplementation(() => createMockStream(['done']))

      const gen = generateVideoSummary('transcript')
      await collectGenerator(gen)

      expect(withModelFallback).toHaveBeenCalledWith('videoSummary', expect.any(Array))
    })

    // -----------------------------------------------------------------------
    // Timeout & cancellation
    // -----------------------------------------------------------------------

    describe('timeout and cancellation', () => {
      it('should wrap AbortError from internal timeout as user-friendly message', async () => {
        const abortError = Object.assign(new Error('The operation was aborted.'), {
          name: 'AbortError',
        })
        mockStreamCompletion.mockImplementation(async function* () {
          throw abortError
        })

        const gen = generateVideoSummary('transcript')
        await expect(collectGenerator(gen)).rejects.toThrow(
          'Summary generation timed out. Please try again.'
        )
      })

      it('should propagate AbortError when external signal is aborted', async () => {
        const externalController = new AbortController()
        externalController.abort()

        const abortError = Object.assign(new Error('The operation was aborted.'), {
          name: 'AbortError',
        })
        mockStreamCompletion.mockImplementation(async function* () {
          throw abortError
        })

        const gen = generateVideoSummary('transcript', externalController.signal)
        await expect(collectGenerator(gen)).rejects.toThrow('The operation was aborted.')
      })

      it('should clear timeout after successful completion', async () => {
        const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout')
        mockStreamCompletion.mockImplementation(() => createMockStream(['done']))

        const gen = generateVideoSummary('transcript')
        await collectGenerator(gen)

        expect(clearTimeoutSpy).toHaveBeenCalled()
        clearTimeoutSpy.mockRestore()
      })
    })

    // -----------------------------------------------------------------------
    // Error handling
    // -----------------------------------------------------------------------

    describe('error handling', () => {
      it('should rethrow non-AbortError exceptions', async () => {
        mockStreamCompletion.mockImplementation(async function* () {
          throw new TypeError('Network failure')
        })

        const gen = generateVideoSummary('transcript')
        await expect(collectGenerator(gen)).rejects.toThrow('Network failure')
      })

      it('should handle empty stream', async () => {
        mockStreamCompletion.mockImplementation(() => createMockStream([]))

        const gen = generateVideoSummary('transcript')
        const results = await collectGenerator(gen)
        expect(results).toEqual([])
      })
    })
  })
})
