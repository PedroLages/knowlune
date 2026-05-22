/**
 * ProxyLLMClient unit tests
 *
 * Covers: constructor, getProviderId, streamCompletion (happy path, error handling,
 * SSE parsing, edge cases), mapHttpStatusToErrorCode.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ProxyLLMClient } from '../proxy-client'
import { LLMError } from '../types'
import type { LLMMessage } from '../types'
import { apiUrl } from '@/lib/apiBaseUrl'

// Mock getAPIKeyHealth to return 'ok' by default (prevents pre-flight check from blocking)
const mockGetAPIKeyHealth = vi.fn().mockReturnValue('ok')
vi.mock('@/lib/aiConfiguration', () => ({
  getAPIKeyHealth: (...args: unknown[]) => mockGetAPIKeyHealth(...args),
}))

// Mock useAuthStore to provide access_token for Authorization header
vi.mock('@/stores/useAuthStore', () => ({
  useAuthStore: {
    getState: () => ({
      session: { access_token: 'test-jwt-token' },
    }),
  },
}))

// Mock global fetch
global.fetch = vi.fn()

/** Helper: create a ReadableStream from an array of string chunks */
function createSSEStream(chunks: string[]): ReadableStream<Uint8Array> {
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

/** Helper: collect all yielded chunks from streamCompletion */
async function collectChunks(
  gen: AsyncGenerator<{ content: string; finishReason?: string }>
): Promise<{ content: string; finishReason?: string }[]> {
  const results: { content: string; finishReason?: string }[] = []
  for await (const chunk of gen) {
    results.push(chunk)
  }
  return results
}

const defaultMessages: LLMMessage[] = [{ role: 'user', content: 'Hello' }]

describe('ProxyLLMClient', () => {
  let client: ProxyLLMClient

  beforeEach(() => {
    client = new ProxyLLMClient('openai', 'sk-test-key')
    vi.clearAllMocks()
  })

  // ===========================================================================
  // getProviderId
  // ===========================================================================

  describe('getProviderId', () => {
    it('should return the provider ID passed to constructor', () => {
      expect(client.getProviderId()).toBe('openai')
    })

    it('should return correct provider for anthropic', () => {
      const anthropicClient = new ProxyLLMClient('anthropic', 'sk-ant-key')
      expect(anthropicClient.getProviderId()).toBe('anthropic')
    })
  })

  // ===========================================================================
  // streamCompletion - happy path
  // ===========================================================================

  describe('streamCompletion - happy path', () => {
    it('should stream content chunks from proxy SSE response', async () => {
      const sseChunks = [
        'data: {"content":"Hello"}\n\n',
        'data: {"content":" world"}\n\n',
        'data: [DONE]\n\n',
      ]

      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        body: createSSEStream(sseChunks),
      })

      const chunks = await collectChunks(client.streamCompletion(defaultMessages))

      // Should yield content chunks + final stop signal
      expect(chunks).toEqual([
        { content: 'Hello' },
        { content: ' world' },
        { content: '', finishReason: 'stop' },
      ])
    })

    it('should send correct request to proxy endpoint', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        body: createSSEStream(['data: [DONE]\n\n']),
      })

      await collectChunks(client.streamCompletion(defaultMessages))

      expect(global.fetch).toHaveBeenCalledWith(
        apiUrl('ai-stream'),
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-jwt-token',
          },
          signal: expect.any(AbortSignal),
        })
      )

      const callArgs = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
      const body = JSON.parse(callArgs[1].body)
      expect(body).toEqual({
        provider: 'openai',
        apiKey: 'sk-test-key',
        messages: defaultMessages,
      })
    })

    it('should include model in request body when specified', async () => {
      const clientWithModel = new ProxyLLMClient('openai', 'sk-key', 'gpt-4o')

      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        body: createSSEStream(['data: [DONE]\n\n']),
      })

      await collectChunks(clientWithModel.streamCompletion(defaultMessages))

      const callArgs = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
      const body = JSON.parse(callArgs[1].body)
      expect(body.model).toBe('gpt-4o')
    })

    it('should yield final stop chunk after stream completes', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        body: createSSEStream(['data: {"content":"done"}\n\n']),
      })

      const chunks = await collectChunks(client.streamCompletion(defaultMessages))
      const lastChunk = chunks[chunks.length - 1]
      expect(lastChunk).toEqual({ content: '', finishReason: 'stop' })
    })
  })

  // ===========================================================================
  // streamCompletion - error handling
  // ===========================================================================

  describe('streamCompletion - error handling', () => {
    it('should throw LLMError with RATE_LIMITED for HTTP 429', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        json: async () => ({ error: 'Rate limit exceeded' }),
      })

      try {
        await collectChunks(client.streamCompletion(defaultMessages))
        expect.unreachable('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(LLMError)
        expect((error as LLMError).code).toBe('RATE_LIMITED')
        expect((error as LLMError).message).toBe(
          'Too many requests. Wait a moment and try again.'
        )
        expect((error as LLMError).providerId).toBe('openai')
      }
    })

    it('should throw LLMError with AUTH_REQUIRED for HTTP 401', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({ error: 'Invalid API key' }),
      })

      try {
        await collectChunks(client.streamCompletion(defaultMessages))
        expect.unreachable('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(LLMError)
        expect((error as LLMError).code).toBe('AUTH_REQUIRED')
        expect((error as LLMError).message).toBe(
          'Your API key was rejected by openai. Check that it\'s valid and has credits.'
        )
      }
    })

    it('should throw LLMError with ENTITLEMENT_ERROR for HTTP 403', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        json: async () => ({ error: 'Access denied' }),
      })

      try {
        await collectChunks(client.streamCompletion(defaultMessages))
        expect.unreachable('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(LLMError)
        expect((error as LLMError).code).toBe('ENTITLEMENT_ERROR')
      }
    })

    it('should throw LLMError with UNKNOWN for HTTP 500', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({ error: 'Server error' }),
      })

      try {
        await collectChunks(client.streamCompletion(defaultMessages))
        expect.unreachable('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(LLMError)
        expect((error as LLMError).code).toBe('UNKNOWN')
        expect((error as LLMError).message).toBe('AI error: Server error')
      }
    })

    it('should fallback to AI error prefix when JSON parse fails on error response', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 502,
        statusText: 'Bad Gateway',
        json: async () => {
          throw new Error('not JSON')
        },
      })

      try {
        await collectChunks(client.streamCompletion(defaultMessages))
        expect.unreachable('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(LLMError)
        expect((error as LLMError).message).toBe('AI error: Bad Gateway')
      }
    })

    it('should throw LLMError with INVALID_RESPONSE when body is null', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        body: null,
      })

      try {
        await collectChunks(client.streamCompletion(defaultMessages))
        expect.unreachable('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(LLMError)
        expect((error as LLMError).code).toBe('INVALID_RESPONSE')
        expect((error as LLMError).message).toBe('Response body is null')
      }
    })

    it('should throw LLMError with TIMEOUT for AbortError', async () => {
      const abortError = new Error('The operation was aborted')
      abortError.name = 'AbortError'
      ;(global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(abortError)

      try {
        await collectChunks(client.streamCompletion(defaultMessages))
        expect.unreachable('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(LLMError)
        expect((error as LLMError).code).toBe('TIMEOUT')
        expect((error as LLMError).message).toBe(
          'AI request timed out. The model may be overloaded. Try again.'
        )
      }
    })

    it('should throw LLMError with NETWORK_ERROR for generic fetch failures', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new TypeError('Failed to fetch')
      )

      try {
        await collectChunks(client.streamCompletion(defaultMessages))
        expect.unreachable('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(LLMError)
        expect((error as LLMError).code).toBe('NETWORK_ERROR')
        expect((error as LLMError).message).toBe(
          'Cannot reach the AI service. Check your internet connection.'
        )
      }
    })

    // =========================================================================
    // Categorized Edge Function errors (2026-05-22 fix)
    // =========================================================================

    it('pre-flight: throws categorized message when key health is undecryptable (no network request)', async () => {
      mockGetAPIKeyHealth.mockReturnValueOnce('undecryptable')

      try {
        await collectChunks(client.streamCompletion(defaultMessages))
        expect.unreachable('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(LLMError)
        expect((error as LLMError).code).toBe('AUTH_ERROR')
        expect((error as LLMError).message).toBe(
          'Your API key for openai was lost because the encryption key was reset. Go to Settings > Integrations & Data to re-enter it.'
        )
      }

      // fetch should NOT have been called — pre-flight prevents the network request
      expect(global.fetch).not.toHaveBeenCalled()
    })

    it('maps "No API key available" to user-facing message', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({ error: 'No API key available for provider: openai' }),
      })

      try {
        await collectChunks(client.streamCompletion(defaultMessages))
        expect.unreachable('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(LLMError)
        expect((error as LLMError).message).toBe(
          'No API key configured for openai. Add your API key in Settings → Integrations & Data.'
        )
      }
    })

    it('maps "Provider not configured" to user-facing message', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({ error: 'Provider not configured' }),
      })

      try {
        await collectChunks(client.streamCompletion(defaultMessages))
        expect.unreachable('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(LLMError)
        expect((error as LLMError).message).toBe(
          'The AI provider is not configured on the server. Contact support if this persists.'
        )
      }
    })

    it('maps "Model not found" to user-facing message mentioning the model name', async () => {
      const clientWithModel = new ProxyLLMClient('anthropic', 'sk-ant-key', 'claude-opus-4')
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({ error: 'Model not found' }),
      })

      try {
        await collectChunks(clientWithModel.streamCompletion(defaultMessages))
        expect.unreachable('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(LLMError)
        expect((error as LLMError).message).toBe(
          "The model 'claude-opus-4' is not available. Try a different model in Settings → Integrations & Data."
        )
      }
    })

    it('passes through unknown error with "AI error: " prefix', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
        json: async () => ({ error: 'Upstream provider timeout' }),
      })

      try {
        await collectChunks(client.streamCompletion(defaultMessages))
        expect.unreachable('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(LLMError)
        expect((error as LLMError).message).toBe('AI error: Upstream provider timeout')
      }
    })

    it('propagates LLMError from proxy error event in stream', async () => {
      const sseChunks = ['data: {"error":"Provider returned 500"}\n\n']

      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        body: createSSEStream(sseChunks),
      })

      try {
        await collectChunks(client.streamCompletion(defaultMessages))
        expect.unreachable('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(LLMError)
        expect((error as LLMError).message).toBe('Provider returned 500')
        expect((error as LLMError).code).toBe('UNKNOWN')
      }
    })
  })

  // ===========================================================================
  // streamCompletion - SSE parsing edge cases
  // ===========================================================================

  describe('streamCompletion - SSE parsing', () => {
    it('should skip malformed JSON chunks and continue streaming', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const sseChunks = [
        'data: NOT_VALID_JSON\n\n',
        'data: {"content":"valid"}\n\n',
        'data: [DONE]\n\n',
      ]

      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        body: createSSEStream(sseChunks),
      })

      const chunks = await collectChunks(client.streamCompletion(defaultMessages))

      expect(chunks).toEqual([{ content: 'valid' }, { content: '', finishReason: 'stop' }])
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[ProxyLLMClient] Failed to parse SSE chunk:',
        'NOT_VALID_JSON'
      )

      consoleWarnSpy.mockRestore()
    })

    it('should skip chunks without content field', async () => {
      const sseChunks = [
        'data: {"metadata":"some info"}\n\n',
        'data: {"content":"real content"}\n\n',
      ]

      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        body: createSSEStream(sseChunks),
      })

      const chunks = await collectChunks(client.streamCompletion(defaultMessages))
      const contentChunks = chunks.filter(c => c.content)
      expect(contentChunks).toEqual([{ content: 'real content' }])
    })

    it('should handle empty stream (no data events)', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        body: createSSEStream([]),
      })

      const chunks = await collectChunks(client.streamCompletion(defaultMessages))

      // Should only get the final stop signal
      expect(chunks).toEqual([{ content: '', finishReason: 'stop' }])
    })

    it('should handle multiple SSE events in a single chunk', async () => {
      const sseChunks = ['data: {"content":"a"}\ndata: {"content":"b"}\ndata: {"content":"c"}\n']

      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        body: createSSEStream(sseChunks),
      })

      const chunks = await collectChunks(client.streamCompletion(defaultMessages))

      expect(chunks).toEqual([
        { content: 'a' },
        { content: 'b' },
        { content: 'c' },
        { content: '', finishReason: 'stop' },
      ])
    })

    it('should handle SSE data split across multiple read chunks', async () => {
      // Split a single SSE event across two chunks
      const sseChunks = ['data: {"conte', 'nt":"split"}\n\n']

      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        body: createSSEStream(sseChunks),
      })

      const chunks = await collectChunks(client.streamCompletion(defaultMessages))

      expect(chunks).toEqual([{ content: 'split' }, { content: '', finishReason: 'stop' }])
    })

    it('should skip non-data SSE lines (comments, event types)', async () => {
      const sseChunks = [
        ': keep-alive comment\n',
        'event: message\n',
        'data: {"content":"actual"}\n\n',
      ]

      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        body: createSSEStream(sseChunks),
      })

      const chunks = await collectChunks(client.streamCompletion(defaultMessages))
      const contentChunks = chunks.filter(c => c.content)
      expect(contentChunks).toEqual([{ content: 'actual' }])
    })

    it('should handle [DONE] terminator within the stream', async () => {
      const sseChunks = [
        'data: {"content":"before"}\n',
        'data: [DONE]\n',
        'data: {"content":"after"}\n',
      ]

      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        body: createSSEStream(sseChunks),
      })

      const chunks = await collectChunks(client.streamCompletion(defaultMessages))
      // [DONE] is skipped by parseSSEStream, but "after" still gets yielded since it's valid data
      expect(chunks.some(c => c.content === 'before')).toBe(true)
    })
  })

  // ===========================================================================
  // streamCompletion - error response without error field
  // ===========================================================================

  describe('streamCompletion - error response fallback', () => {
    it('should use statusText when error field is missing from JSON response', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
        json: async () => ({ message: 'no error field here' }),
      })

      try {
        await collectChunks(client.streamCompletion(defaultMessages))
        expect.unreachable('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(LLMError)
        expect((error as LLMError).message).toBe('AI error: 503 Server error')
      }
    })
  })

  // ===========================================================================
  // Provider-specific constructor variations
  // ===========================================================================

  describe('constructor variations', () => {
    it('should work with all supported provider IDs', () => {
      const providers: Array<'openai' | 'anthropic' | 'groq' | 'gemini' | 'glm'> = [
        'openai',
        'anthropic',
        'groq',
        'gemini',
        'glm',
      ]

      for (const provider of providers) {
        const c = new ProxyLLMClient(provider, 'key-123', 'some-model')
        expect(c.getProviderId()).toBe(provider)
      }
    })

    it('should work without optional model parameter', async () => {
      const c = new ProxyLLMClient('groq', 'gsk-key')

      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        body: createSSEStream(['data: [DONE]\n\n']),
      })

      await collectChunks(c.streamCompletion(defaultMessages))

      const callArgs = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
      const body = JSON.parse(callArgs[1].body)
      expect(body.model).toBeUndefined()
      expect(body.provider).toBe('groq')
    })
  })
})
