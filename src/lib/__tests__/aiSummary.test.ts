/**
 * Comprehensive tests for AI Summary functions
 *
 * Covers: fetchAndParseTranscript, generateVideoSummary (all providers),
 * VTT parsing (via fetchAndParseTranscript), streaming, timeouts, errors.
 *
 * The source module routes ALL requests through `/api/ai/stream` (local proxy),
 * which returns unified SSE: `data: {"content":"chunk"}\n\n` and `data: [DONE]\n\n`.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock dependencies before imports
vi.mock('@/lib/aiConfiguration', () => ({
  sanitizeAIRequestPayload: vi.fn((content: string) => ({ content })),
}))
vi.mock('@/ai/workers/coordinator')

// Import after mocking
import { fetchAndParseTranscript, generateVideoSummary } from '../aiSummary'
import { sanitizeAIRequestPayload } from '@/lib/aiConfiguration'
import type { AIProviderId } from '@/lib/aiConfiguration'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Creates a minimal ReadableStream from an array of string chunks */
function createReadableStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  let index = 0
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(encoder.encode(chunks[index]))
        index++
      } else {
        controller.close()
      }
    },
  })
}

/** Builds a mock Response with a streaming body */
function mockStreamResponse(chunks: string[], status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    body: createReadableStream(chunks),
    text: async () => chunks.join(''),
    headers: new Headers(),
  } as unknown as Response
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
    it('should throw for unsupported provider', async () => {
      const gen = generateVideoSummary('transcript', 'invalid-provider' as AIProviderId, 'key')
      await expect(collectGenerator(gen)).rejects.toThrow(
        'Unsupported AI provider: invalid-provider'
      )
    })

    it('should call sanitizeAIRequestPayload when building payload', async () => {
      const chunks = ['data: {"content":"Hello"}\n\n', 'data: [DONE]\n\n']
      globalThis.fetch = vi.fn().mockResolvedValue(mockStreamResponse(chunks))

      const gen = generateVideoSummary('my transcript', 'openai', 'test-key')
      await collectGenerator(gen)

      expect(sanitizeAIRequestPayload).toHaveBeenCalledWith('my transcript')
    })

    it('should throw on non-ok response with error body', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        body: null,
        text: async () => 'Invalid API key',
      } as unknown as Response)

      const gen = generateVideoSummary('transcript', 'openai', 'bad-key')
      await expect(collectGenerator(gen)).rejects.toThrow(
        'AI provider error (401): Invalid API key'
      )
    })

    it('should throw on non-ok response when error body read fails', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        body: null,
        text: async () => {
          throw new Error('read failed')
        },
      } as unknown as Response)

      const gen = generateVideoSummary('transcript', 'openai', 'key')
      await expect(collectGenerator(gen)).rejects.toThrow('AI provider error (500): Unknown error')
    })

    it('should throw when response body is null', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        body: null,
        text: async () => '',
      } as unknown as Response)

      const gen = generateVideoSummary('transcript', 'openai', 'key')
      await expect(collectGenerator(gen)).rejects.toThrow(
        'Response body is null - streaming not supported'
      )
    })

    // -----------------------------------------------------------------------
    // Proxy-based streaming (unified format for all providers)
    // -----------------------------------------------------------------------

    describe('proxy streaming (unified format)', () => {
      it('should stream chunks from proxy SSE format', async () => {
        const chunks = [
          'data: {"content":"Hello"}\n',
          'data: {"content":" world"}\n',
          'data: [DONE]\n',
        ]
        globalThis.fetch = vi.fn().mockResolvedValue(mockStreamResponse(chunks))

        const gen = generateVideoSummary('transcript', 'openai', 'sk-test')
        const results = await collectGenerator(gen)

        expect(results).toEqual(['Hello', ' world'])
      })

      it('should use proxy endpoint /api/ai/stream with correct headers', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue(mockStreamResponse(['data: [DONE]\n']))

        const gen = generateVideoSummary('transcript', 'openai', 'sk-test')
        await collectGenerator(gen)

        expect(globalThis.fetch).toHaveBeenCalledWith(
          '/api/ai/stream',
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          })
        )
      })

      it('should include provider, apiKey, model, and maxTokens in payload', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue(mockStreamResponse(['data: [DONE]\n']))

        const gen = generateVideoSummary('transcript', 'openai', 'sk-test')
        await collectGenerator(gen)

        const callArgs = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
        const body = JSON.parse(callArgs[1].body)
        expect(body.provider).toBe('openai')
        expect(body.apiKey).toBe('sk-test')
        expect(body.model).toBe('gpt-4o-mini')
        expect(body.maxTokens).toBe(500)
        expect(body.messages).toBeDefined()
      })

      it('should skip non-data lines', async () => {
        const chunks = [': keep-alive\n', 'data: {"content":"content"}\n', '\n', 'data: [DONE]\n']
        globalThis.fetch = vi.fn().mockResolvedValue(mockStreamResponse(chunks))

        const gen = generateVideoSummary('transcript', 'openai', 'key')
        const results = await collectGenerator(gen)
        expect(results).toEqual(['content'])
      })

      it('should handle malformed JSON in stream gracefully', async () => {
        const chunks = ['data: {invalid json}\n', 'data: {"content":"valid"}\n', 'data: [DONE]\n']
        globalThis.fetch = vi.fn().mockResolvedValue(mockStreamResponse(chunks))

        const gen = generateVideoSummary('transcript', 'openai', 'key')
        const results = await collectGenerator(gen)
        expect(results).toEqual(['valid'])
      })

      it('should handle chunks with no content field', async () => {
        const chunks = ['data: {}\n', 'data: {"content":"real"}\n', 'data: [DONE]\n']
        globalThis.fetch = vi.fn().mockResolvedValue(mockStreamResponse(chunks))

        const gen = generateVideoSummary('transcript', 'openai', 'key')
        const results = await collectGenerator(gen)
        expect(results).toEqual(['real'])
      })

      it('should propagate AI proxy error from stream', async () => {
        const chunks = ['data: {"error":"Rate limit exceeded"}\n']
        globalThis.fetch = vi.fn().mockResolvedValue(mockStreamResponse(chunks))

        const gen = generateVideoSummary('transcript', 'openai', 'key')
        await expect(collectGenerator(gen)).rejects.toThrow('AI proxy error: Rate limit exceeded')
      })
    })

    // -----------------------------------------------------------------------
    // Provider-specific model selection (via proxy body)
    // -----------------------------------------------------------------------

    describe('provider model selection', () => {
      it('should use gpt-4o-mini for openai', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue(mockStreamResponse(['data: [DONE]\n']))
        const gen = generateVideoSummary('transcript', 'openai', 'key')
        await collectGenerator(gen)
        const body = JSON.parse(
          (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body
        )
        expect(body.model).toBe('gpt-4o-mini')
      })

      it('should use claude-3-5-haiku for anthropic', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue(mockStreamResponse(['data: [DONE]\n']))
        const gen = generateVideoSummary('transcript', 'anthropic', 'key')
        await collectGenerator(gen)
        const body = JSON.parse(
          (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body
        )
        expect(body.model).toBe('claude-3-5-haiku-20241022')
      })

      it('should use llama-3.3-70b-versatile for groq', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue(mockStreamResponse(['data: [DONE]\n']))
        const gen = generateVideoSummary('transcript', 'groq', 'key')
        await collectGenerator(gen)
        const body = JSON.parse(
          (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body
        )
        expect(body.model).toBe('llama-3.3-70b-versatile')
      })

      it('should use glm-4-flash for glm', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue(mockStreamResponse(['data: [DONE]\n']))
        const gen = generateVideoSummary('transcript', 'glm', 'key')
        await collectGenerator(gen)
        const body = JSON.parse(
          (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body
        )
        expect(body.model).toBe('glm-4-flash')
      })

      it('should use gemini-1.5-flash for gemini', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue(mockStreamResponse(['data: [DONE]\n']))
        const gen = generateVideoSummary('transcript', 'gemini', 'key')
        await collectGenerator(gen)
        const body = JSON.parse(
          (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body
        )
        expect(body.model).toBe('gemini-1.5-flash')
      })

      it('should always send to /api/ai/stream regardless of provider', async () => {
        for (const provider of ['openai', 'anthropic', 'groq', 'glm', 'gemini'] as AIProviderId[]) {
          globalThis.fetch = vi.fn().mockResolvedValue(mockStreamResponse(['data: [DONE]\n']))
          const gen = generateVideoSummary('transcript', provider, 'key')
          await collectGenerator(gen)
          expect(globalThis.fetch).toHaveBeenCalledWith('/api/ai/stream', expect.any(Object))
        }
      })
    })

    // -----------------------------------------------------------------------
    // Timeout & cancellation
    // -----------------------------------------------------------------------

    describe('timeout and cancellation', () => {
      it('should throw timeout error when request exceeds 30s', async () => {
        vi.useRealTimers()

        // Set a very short timeout via the test-only global
        // @ts-expect-error - Test-only global variable
        window.__AI_SUMMARY_TIMEOUT__ = 10

        // Use the real AbortSignal.throwIfAborted / signal.reason to produce
        // a genuine AbortError that passes `instanceof Error` checks
        globalThis.fetch = vi.fn().mockImplementation((_url: string, init: RequestInit) => {
          return new Promise((_resolve, reject) => {
            init.signal?.addEventListener('abort', () => {
              // Create an error that mirrors what real fetch produces
              const err = Object.assign(new Error('The operation was aborted.'), {
                name: 'AbortError',
              })
              reject(err)
            })
          })
        })

        const gen = generateVideoSummary('transcript', 'openai', 'key')

        await expect(collectGenerator(gen)).rejects.toThrow(
          'Summary generation timed out. Please try again.'
        )

        // @ts-expect-error - cleanup test-only global
        delete window.__AI_SUMMARY_TIMEOUT__
      })

      it('should propagate AbortError when external signal is aborted', async () => {
        vi.useRealTimers()
        const externalController = new AbortController()

        globalThis.fetch = vi.fn().mockImplementation((_url: string, init: RequestInit) => {
          return new Promise((_resolve, reject) => {
            init.signal?.addEventListener('abort', () => {
              const err = Object.assign(new Error('The operation was aborted.'), {
                name: 'AbortError',
              })
              reject(err)
            })
          })
        })

        const gen = generateVideoSummary('transcript', 'openai', 'key', externalController.signal)
        const promise = collectGenerator(gen)

        // Abort externally (simulating component unmount)
        externalController.abort()

        // Should re-throw original AbortError (not "timed out" message)
        // because externalSignal.aborted is true
        await expect(promise).rejects.toThrow('The operation was aborted.')
      })

      it('should clear timeout after successful completion', async () => {
        const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout')
        const chunks = ['data: {"content":"done"}\n', 'data: [DONE]\n']
        globalThis.fetch = vi.fn().mockResolvedValue(mockStreamResponse(chunks))

        const gen = generateVideoSummary('transcript', 'openai', 'key')
        await collectGenerator(gen)

        expect(clearTimeoutSpy).toHaveBeenCalled()
        clearTimeoutSpy.mockRestore()
      })

      it('should clear timeout after error', async () => {
        const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout')
        globalThis.fetch = vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
          body: null,
          text: async () => 'error',
        } as unknown as Response)

        const gen = generateVideoSummary('transcript', 'openai', 'key')
        try {
          await collectGenerator(gen)
        } catch {
          // expected
        }

        expect(clearTimeoutSpy).toHaveBeenCalled()
        clearTimeoutSpy.mockRestore()
      })
    })

    // -----------------------------------------------------------------------
    // Streaming edge cases
    // -----------------------------------------------------------------------

    describe('streaming edge cases', () => {
      it('should handle chunks split across multiple reads', async () => {
        // A single SSE message split across two chunks
        const chunks = ['data: {"con', 'tent":"split"}\ndata: [DONE]\n']
        globalThis.fetch = vi.fn().mockResolvedValue(mockStreamResponse(chunks))

        const gen = generateVideoSummary('transcript', 'openai', 'key')
        const results = await collectGenerator(gen)
        expect(results).toEqual(['split'])
      })

      it('should handle empty stream', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue(mockStreamResponse([]))

        const gen = generateVideoSummary('transcript', 'openai', 'key')
        const results = await collectGenerator(gen)
        expect(results).toEqual([])
      })

      it('should handle multiple SSE lines in a single chunk', async () => {
        const chunks = ['data: {"content":"a"}\ndata: {"content":"b"}\ndata: [DONE]\n']
        globalThis.fetch = vi.fn().mockResolvedValue(mockStreamResponse(chunks))

        const gen = generateVideoSummary('transcript', 'openai', 'key')
        const results = await collectGenerator(gen)
        expect(results).toEqual(['a', 'b'])
      })

      it('should rethrow non-AbortError exceptions', async () => {
        globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Network failure'))

        const gen = generateVideoSummary('transcript', 'openai', 'key')
        await expect(collectGenerator(gen)).rejects.toThrow('Network failure')
      })
    })
  })
})
