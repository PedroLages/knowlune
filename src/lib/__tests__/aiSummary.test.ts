/**
 * Comprehensive tests for AI Summary functions
 *
 * Covers: fetchAndParseTranscript, generateVideoSummary (all providers),
 * VTT parsing (via fetchAndParseTranscript), streaming, timeouts, errors.
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

      await expect(
        fetchAndParseTranscript('https://example.com/transcript.vtt')
      ).rejects.toThrow('Transcript contains no parsable cues')
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
      await expect(collectGenerator(gen)).rejects.toThrow('Unsupported AI provider: invalid-provider')
    })

    it('should call sanitizeAIRequestPayload when building payload', async () => {
      const chunks = [
        'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
        'data: [DONE]\n\n',
      ]
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
      await expect(collectGenerator(gen)).rejects.toThrow('AI provider error (401): Invalid API key')
    })

    it('should throw on non-ok response when error body read fails', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        body: null,
        text: async () => { throw new Error('read failed') },
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
      await expect(collectGenerator(gen)).rejects.toThrow('Response body is null - streaming not supported')
    })

    // -----------------------------------------------------------------------
    // OpenAI provider
    // -----------------------------------------------------------------------

    describe('openai provider', () => {
      it('should stream chunks from OpenAI SSE format', async () => {
        const chunks = [
          'data: {"choices":[{"delta":{"content":"Hello"}}]}\n',
          'data: {"choices":[{"delta":{"content":" world"}}]}\n',
          'data: [DONE]\n',
        ]
        globalThis.fetch = vi.fn().mockResolvedValue(mockStreamResponse(chunks))

        const gen = generateVideoSummary('transcript', 'openai', 'sk-test')
        const results = await collectGenerator(gen)

        expect(results).toEqual(['Hello', ' world'])
      })

      it('should use correct endpoint and headers', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue(mockStreamResponse(['data: [DONE]\n']))

        const gen = generateVideoSummary('transcript', 'openai', 'sk-test')
        await collectGenerator(gen)

        expect(globalThis.fetch).toHaveBeenCalledWith(
          'https://api.openai.com/v1/chat/completions',
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              'Content-Type': 'application/json',
              Authorization: 'Bearer sk-test',
            }),
          })
        )
      })

      it('should include correct model in payload', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue(mockStreamResponse(['data: [DONE]\n']))

        const gen = generateVideoSummary('transcript', 'openai', 'sk-test')
        await collectGenerator(gen)

        const callArgs = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
        const body = JSON.parse(callArgs[1].body)
        expect(body.model).toBe('gpt-4o-mini')
        expect(body.stream).toBe(true)
        expect(body.max_tokens).toBe(500)
      })

      it('should skip non-data lines', async () => {
        const chunks = [
          ': keep-alive\n',
          'data: {"choices":[{"delta":{"content":"content"}}]}\n',
          '\n',
          'data: [DONE]\n',
        ]
        globalThis.fetch = vi.fn().mockResolvedValue(mockStreamResponse(chunks))

        const gen = generateVideoSummary('transcript', 'openai', 'key')
        const results = await collectGenerator(gen)
        expect(results).toEqual(['content'])
      })

      it('should handle malformed JSON in stream gracefully', async () => {
        const chunks = [
          'data: {invalid json}\n',
          'data: {"choices":[{"delta":{"content":"valid"}}]}\n',
          'data: [DONE]\n',
        ]
        globalThis.fetch = vi.fn().mockResolvedValue(mockStreamResponse(chunks))

        const gen = generateVideoSummary('transcript', 'openai', 'key')
        const results = await collectGenerator(gen)
        expect(results).toEqual(['valid'])
      })

      it('should handle delta with no content field', async () => {
        const chunks = [
          'data: {"choices":[{"delta":{}}]}\n',
          'data: {"choices":[{"delta":{"content":"real"}}]}\n',
          'data: [DONE]\n',
        ]
        globalThis.fetch = vi.fn().mockResolvedValue(mockStreamResponse(chunks))

        const gen = generateVideoSummary('transcript', 'openai', 'key')
        const results = await collectGenerator(gen)
        expect(results).toEqual(['real'])
      })
    })

    // -----------------------------------------------------------------------
    // Anthropic provider
    // -----------------------------------------------------------------------

    describe('anthropic provider', () => {
      it('should stream chunks from Anthropic SSE format', async () => {
        const chunks = [
          'data: {"type":"content_block_delta","delta":{"text":"Hello"}}\n',
          'data: {"type":"content_block_delta","delta":{"text":" from Claude"}}\n',
          'data: {"type":"message_stop"}\n',
        ]
        globalThis.fetch = vi.fn().mockResolvedValue(mockStreamResponse(chunks))

        const gen = generateVideoSummary('transcript', 'anthropic', 'sk-ant-test')
        const results = await collectGenerator(gen)

        expect(results).toEqual(['Hello', ' from Claude'])
      })

      it('should use correct endpoint and headers', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue(
          mockStreamResponse(['data: {"type":"message_stop"}\n'])
        )

        const gen = generateVideoSummary('transcript', 'anthropic', 'sk-ant-test')
        await collectGenerator(gen)

        expect(globalThis.fetch).toHaveBeenCalledWith(
          'https://api.anthropic.com/v1/messages',
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              'Content-Type': 'application/json',
              'x-api-key': 'sk-ant-test',
              'anthropic-version': '2023-06-01',
            }),
          })
        )
      })

      it('should include correct model in payload', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue(
          mockStreamResponse(['data: {"type":"message_stop"}\n'])
        )

        const gen = generateVideoSummary('transcript', 'anthropic', 'key')
        await collectGenerator(gen)

        const callArgs = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
        const body = JSON.parse(callArgs[1].body)
        expect(body.model).toBe('claude-3-5-haiku-20241022')
        expect(body.stream).toBe(true)
      })

      it('should ignore non-content_block_delta events', async () => {
        const chunks = [
          'data: {"type":"message_start","message":{"id":"msg_123"}}\n',
          'data: {"type":"content_block_start","content_block":{"type":"text"}}\n',
          'data: {"type":"content_block_delta","delta":{"text":"actual content"}}\n',
          'data: {"type":"content_block_stop"}\n',
          'data: {"type":"message_stop"}\n',
        ]
        globalThis.fetch = vi.fn().mockResolvedValue(mockStreamResponse(chunks))

        const gen = generateVideoSummary('transcript', 'anthropic', 'key')
        const results = await collectGenerator(gen)
        expect(results).toEqual(['actual content'])
      })

      it('should handle malformed JSON in Anthropic stream', async () => {
        const chunks = [
          'data: not-json\n',
          'data: {"type":"content_block_delta","delta":{"text":"ok"}}\n',
        ]
        globalThis.fetch = vi.fn().mockResolvedValue(mockStreamResponse(chunks))

        const gen = generateVideoSummary('transcript', 'anthropic', 'key')
        const results = await collectGenerator(gen)
        expect(results).toEqual(['ok'])
      })
    })

    // -----------------------------------------------------------------------
    // Groq provider
    // -----------------------------------------------------------------------

    describe('groq provider', () => {
      it('should stream chunks from Groq SSE format', async () => {
        const chunks = [
          'data: {"choices":[{"delta":{"content":"Fast"}}]}\n',
          'data: {"choices":[{"delta":{"content":" response"}}]}\n',
          'data: [DONE]\n',
        ]
        globalThis.fetch = vi.fn().mockResolvedValue(mockStreamResponse(chunks))

        const gen = generateVideoSummary('transcript', 'groq', 'gsk-test')
        const results = await collectGenerator(gen)
        expect(results).toEqual(['Fast', ' response'])
      })

      it('should use correct endpoint', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue(mockStreamResponse(['data: [DONE]\n']))

        const gen = generateVideoSummary('transcript', 'groq', 'gsk-test')
        await collectGenerator(gen)

        expect(globalThis.fetch).toHaveBeenCalledWith(
          'https://api.groq.com/openai/v1/chat/completions',
          expect.objectContaining({ method: 'POST' })
        )
      })

      it('should use llama model in payload', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue(mockStreamResponse(['data: [DONE]\n']))

        const gen = generateVideoSummary('transcript', 'groq', 'key')
        await collectGenerator(gen)

        const callArgs = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
        const body = JSON.parse(callArgs[1].body)
        expect(body.model).toBe('llama-3.3-70b-versatile')
      })
    })

    // -----------------------------------------------------------------------
    // GLM provider
    // -----------------------------------------------------------------------

    describe('glm provider', () => {
      it('should stream chunks from GLM SSE format', async () => {
        const chunks = [
          'data: {"choices":[{"delta":{"content":"GLM"}}]}\n',
          'data: {"choices":[{"delta":{"content":" output"}}]}\n',
          'data: [DONE]\n',
        ]
        globalThis.fetch = vi.fn().mockResolvedValue(mockStreamResponse(chunks))

        const gen = generateVideoSummary('transcript', 'glm', 'glm-key')
        const results = await collectGenerator(gen)
        expect(results).toEqual(['GLM', ' output'])
      })

      it('should use correct endpoint', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue(mockStreamResponse(['data: [DONE]\n']))

        const gen = generateVideoSummary('transcript', 'glm', 'glm-key')
        await collectGenerator(gen)

        expect(globalThis.fetch).toHaveBeenCalledWith(
          'https://open.bigmodel.cn/api/paas/v4/chat/completions',
          expect.objectContaining({ method: 'POST' })
        )
      })

      it('should use glm-4-flash model', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue(mockStreamResponse(['data: [DONE]\n']))

        const gen = generateVideoSummary('transcript', 'glm', 'key')
        await collectGenerator(gen)

        const callArgs = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
        const body = JSON.parse(callArgs[1].body)
        expect(body.model).toBe('glm-4-flash')
      })
    })

    // -----------------------------------------------------------------------
    // Gemini provider
    // -----------------------------------------------------------------------

    describe('gemini provider', () => {
      it('should stream chunks from Gemini JSON format', async () => {
        const chunks = [
          JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Gemini' }] } }] }) + '\n',
          JSON.stringify({ candidates: [{ content: { parts: [{ text: ' says hi' }] } }] }) + '\n',
        ]
        globalThis.fetch = vi.fn().mockResolvedValue(mockStreamResponse(chunks))

        const gen = generateVideoSummary('transcript', 'gemini', 'gemini-key')
        const results = await collectGenerator(gen)
        expect(results).toEqual(['Gemini', ' says hi'])
      })

      it('should append API key as query parameter', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue(mockStreamResponse([]))

        const gen = generateVideoSummary('transcript', 'gemini', 'my-gemini-key')
        await collectGenerator(gen)

        const calledUrl = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0]
        expect(calledUrl).toContain('key=my-gemini-key')
        expect(calledUrl).toContain('generativelanguage.googleapis.com')
      })

      it('should not include Authorization header', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue(mockStreamResponse([]))

        const gen = generateVideoSummary('transcript', 'gemini', 'key')
        await collectGenerator(gen)

        const callArgs = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
        const headers = callArgs[1].headers
        expect(headers).not.toHaveProperty('Authorization')
      })

      it('should handle malformed JSON lines gracefully', async () => {
        const chunks = [
          'not json at all\n',
          JSON.stringify({ candidates: [{ content: { parts: [{ text: 'valid' }] } }] }) + '\n',
        ]
        globalThis.fetch = vi.fn().mockResolvedValue(mockStreamResponse(chunks))

        const gen = generateVideoSummary('transcript', 'gemini', 'key')
        const results = await collectGenerator(gen)
        expect(results).toEqual(['valid'])
      })

      it('should skip candidates with no text', async () => {
        const chunks = [
          JSON.stringify({ candidates: [{ content: { parts: [] } }] }) + '\n',
          JSON.stringify({ candidates: [{ content: { parts: [{ text: 'real' }] } }] }) + '\n',
        ]
        globalThis.fetch = vi.fn().mockResolvedValue(mockStreamResponse(chunks))

        const gen = generateVideoSummary('transcript', 'gemini', 'key')
        const results = await collectGenerator(gen)
        expect(results).toEqual(['real'])
      })

      it('should use gemini-1.5-flash model in payload', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue(mockStreamResponse([]))

        const gen = generateVideoSummary('transcript', 'gemini', 'key')
        await collectGenerator(gen)

        const callArgs = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
        const body = JSON.parse(callArgs[1].body)
        expect(body.contents).toBeDefined()
        expect(body.generationConfig.maxOutputTokens).toBe(500)
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
        const chunks = ['data: {"choices":[{"delta":{"content":"done"}}]}\n', 'data: [DONE]\n']
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
        const chunks = [
          'data: {"choices":[{"delta":{"con',
          'tent":"split"}}]}\ndata: [DONE]\n',
        ]
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
        const chunks = [
          'data: {"choices":[{"delta":{"content":"a"}}]}\ndata: {"choices":[{"delta":{"content":"b"}}]}\ndata: [DONE]\n',
        ]
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
