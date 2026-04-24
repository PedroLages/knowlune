/**
 * OllamaLLMClient unit tests
 *
 * Covers: constructor, getProviderId, streamCompletion (proxy mode, direct mode,
 * error handling, SSE parsing), URL normalization.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OllamaLLMClient } from '../ollama-client'
import { LLMError } from '../types'
import type { LLMMessage } from '../types'
import { apiUrl } from '@/lib/apiBaseUrl'

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

describe('OllamaLLMClient', () => {
  let client: OllamaLLMClient

  beforeEach(() => {
    client = new OllamaLLMClient('http://192.168.2.200:11434')
    vi.clearAllMocks()
  })

  // ===========================================================================
  // Constructor & getProviderId
  // ===========================================================================

  describe('constructor', () => {
    it('should return ollama as provider ID', () => {
      expect(client.getProviderId()).toBe('ollama')
    })

    it('should normalize trailing slashes in server URL', () => {
      const clientWithSlash = new OllamaLLMClient('http://localhost:11434/')
      // Verify by checking fetch URL in proxy mode
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        body: createSSEStream(['data: [DONE]\n\n']),
      })

      // Should not error — the trailing slash should be stripped
      void collectChunks(clientWithSlash.streamCompletion(defaultMessages))

      const callArgs = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
      // In proxy mode, URL is /api/ai/ollama
      expect(callArgs[0]).toBe(apiUrl('ai-ollama'))
      // Body should have the clean URL
      const body = JSON.parse(callArgs[1].body)
      expect(body.ollamaServerUrl).toBe('http://localhost:11434')
    })
  })

  // ===========================================================================
  // Proxy mode (default)
  // ===========================================================================

  describe('proxy mode (default)', () => {
    it('should send requests to /api/ai/ollama proxy endpoint', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        body: createSSEStream(['data: {"content":"Hello"}\n\n', 'data: [DONE]\n\n']),
      })

      await collectChunks(client.streamCompletion(defaultMessages))

      expect(global.fetch).toHaveBeenCalledWith(
        apiUrl('ai-ollama'),
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-jwt-token',
          },
        })
      )
    })

    it('should include ollamaServerUrl in proxy request body', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        body: createSSEStream(['data: [DONE]\n\n']),
      })

      await collectChunks(client.streamCompletion(defaultMessages))

      const callArgs = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
      const body = JSON.parse(callArgs[1].body)
      expect(body.ollamaServerUrl).toBe('http://192.168.2.200:11434')
      expect(body.model).toBe('llama3.2')
      expect(body.messages).toEqual(defaultMessages)
      expect(body.stream).toBeUndefined()
    })

    it('should stream content chunks from proxy SSE response', async () => {
      const sseChunks = [
        'data: {"content":"Hello"}\n\n',
        'data: {"content":" from Ollama"}\n\n',
        'data: [DONE]\n\n',
      ]

      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        body: createSSEStream(sseChunks),
      })

      const chunks = await collectChunks(client.streamCompletion(defaultMessages))
      const contentChunks = chunks.filter(c => c.content)
      expect(contentChunks).toEqual([{ content: 'Hello' }, { content: ' from Ollama' }])
    })
  })

  // ===========================================================================
  // Direct mode
  // ===========================================================================

  describe('direct mode', () => {
    let directClient: OllamaLLMClient

    beforeEach(() => {
      directClient = new OllamaLLMClient('http://192.168.2.200:11434', true)
    })

    it('should send requests to Ollama OpenAI-compat endpoint', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        body: createSSEStream(['data: [DONE]\n\n']),
      })

      await collectChunks(directClient.streamCompletion(defaultMessages))

      expect(global.fetch).toHaveBeenCalledWith(
        'http://192.168.2.200:11434/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer ollama',
          }),
        })
      )
    })

    it('should NOT include ollamaServerUrl in direct mode body', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        body: createSSEStream(['data: [DONE]\n\n']),
      })

      await collectChunks(directClient.streamCompletion(defaultMessages))

      const callArgs = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
      const body = JSON.parse(callArgs[1].body)
      expect(body.ollamaServerUrl).toBeUndefined()
    })

    it('should parse OpenAI-compat streaming format', async () => {
      const sseChunks = [
        'data: {"choices":[{"delta":{"content":"Hello"},"finish_reason":null}]}\n\n',
        'data: {"choices":[{"delta":{"content":" world"},"finish_reason":null}]}\n\n',
        'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n',
      ]

      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        body: createSSEStream(sseChunks),
      })

      const chunks = await collectChunks(directClient.streamCompletion(defaultMessages))

      expect(chunks).toEqual([
        { content: 'Hello', finishReason: undefined },
        { content: ' world', finishReason: undefined },
        { content: '', finishReason: 'stop' },
      ])
    })
  })

  // ===========================================================================
  // Custom model
  // ===========================================================================

  describe('custom model', () => {
    it('should use specified model in request body', async () => {
      const customClient = new OllamaLLMClient('http://192.168.2.200:11434', false, 'qwen3:8b')

      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        body: createSSEStream(['data: [DONE]\n\n']),
      })

      await collectChunks(customClient.streamCompletion(defaultMessages))

      const callArgs = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
      const body = JSON.parse(callArgs[1].body)
      expect(body.model).toBe('qwen3:8b')
    })
  })

  // ===========================================================================
  // Error handling
  // ===========================================================================

  describe('error handling', () => {
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
        expect((error as LLMError).providerId).toBe('ollama')
      }
    })

    it('should throw NETWORK_ERROR with helpful message for fetch failures', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new TypeError('Failed to fetch')
      )

      try {
        await collectChunks(client.streamCompletion(defaultMessages))
        expect.unreachable('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(LLMError)
        expect((error as LLMError).code).toBe('NETWORK_ERROR')
        expect((error as LLMError).message).toContain('Cannot reach Ollama')
        expect((error as LLMError).message).toContain('192.168.2.200:11434')
      }
    })

    it('should throw LLMError for HTTP error responses', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => 'Model not found',
      })

      try {
        await collectChunks(client.streamCompletion(defaultMessages))
        expect.unreachable('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(LLMError)
        expect((error as LLMError).message).toContain('500')
        expect((error as LLMError).message).toContain('Model not found')
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
      }
    })

    it('should propagate error events from stream', async () => {
      const sseChunks = ['data: {"error":"model not loaded"}\n\n']

      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        body: createSSEStream(sseChunks),
      })

      try {
        await collectChunks(client.streamCompletion(defaultMessages))
        expect.unreachable('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(LLMError)
        expect((error as LLMError).message).toBe('model not loaded')
      }
    })

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
      const contentChunks = chunks.filter(c => c.content)
      expect(contentChunks).toEqual([{ content: 'valid' }])
      expect(consoleWarnSpy).toHaveBeenCalled()

      consoleWarnSpy.mockRestore()
    })
  })

  // ===========================================================================
  // URL validation edge cases
  // ===========================================================================

  describe('URL edge cases', () => {
    it('should work with HTTPS URLs', async () => {
      const httpsClient = new OllamaLLMClient('https://ollama.example.com:11434', true)

      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        body: createSSEStream(['data: [DONE]\n\n']),
      })

      await collectChunks(httpsClient.streamCompletion(defaultMessages))

      expect(global.fetch).toHaveBeenCalledWith(
        'https://ollama.example.com:11434/v1/chat/completions',
        expect.any(Object)
      )
    })

    it('should work with non-standard ports', async () => {
      const customPortClient = new OllamaLLMClient('http://localhost:8080', true)

      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        body: createSSEStream(['data: [DONE]\n\n']),
      })

      await collectChunks(customPortClient.streamCompletion(defaultMessages))

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8080/v1/chat/completions',
        expect.any(Object)
      )
    })
  })
})
