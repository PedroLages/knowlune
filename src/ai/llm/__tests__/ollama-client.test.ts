/**
 * OllamaDirectClient unit tests (AC6)
 *
 * Tests streaming completion with Ollama's OpenAI-compatible SSE format.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OllamaDirectClient } from '../ollama-client'
import { LLMError } from '../types'
import type { LLMMessage } from '../types'

// Mock global fetch
global.fetch = vi.fn()

describe('OllamaDirectClient', () => {
  let client: OllamaDirectClient
  const baseUrl = 'http://192.168.1.100:11434'
  const model = 'llama3.2'

  beforeEach(() => {
    client = new OllamaDirectClient(baseUrl, model)
    vi.clearAllMocks()
  })

  describe('getProviderId', () => {
    it('returns ollama', () => {
      expect(client.getProviderId()).toBe('ollama')
    })
  })

  describe('streamCompletion', () => {
    it('streams tokens from OpenAI-compatible SSE chunks', async () => {
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode(
              'data: {"choices":[{"delta":{"content":"Hello"},"finish_reason":null}]}\n\n'
            )
          )
          controller.enqueue(
            new TextEncoder().encode(
              'data: {"choices":[{"delta":{"content":" world"},"finish_reason":null}]}\n\n'
            )
          )
          controller.enqueue(
            new TextEncoder().encode(
              'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n'
            )
          )
          controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'))
          controller.close()
        },
      })

      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        body: mockStream,
      })

      const messages: LLMMessage[] = [{ role: 'user', content: 'Hi' }]
      const chunks: LLMStreamChunk[] = []

      for await (const chunk of client.streamCompletion(messages)) {
        chunks.push(chunk)
      }

      const contentChunks = chunks.filter(c => c.content)
      expect(contentChunks.map(c => c.content)).toEqual(['Hello', ' world'])
      const finalChunk = chunks.find(c => c.finishReason === 'stop')
      expect(finalChunk).toBeDefined()
    })

    it('sends request to correct URL with no Authorization header', async () => {
      const mockStream = new ReadableStream({
        start(c) {
          c.enqueue(
            new TextEncoder().encode(
              'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n'
            )
          )
          c.close()
        },
      })
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        body: mockStream,
      })

      const messages: LLMMessage[] = [{ role: 'user', content: 'Test' }]
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _chunk of client.streamCompletion(messages)) {
        // consume
      }

      const [url, opts] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
        string,
        RequestInit,
      ]
      expect(url).toBe(`${baseUrl}/v1/chat/completions`)
      const headers = opts.headers as Record<string, string>
      expect(headers['Authorization']).toBeUndefined()
      expect(headers['Content-Type']).toBe('application/json')
    })

    it('normalizes trailing slash in base URL', async () => {
      const clientWithSlash = new OllamaDirectClient('http://localhost:11434/', model)
      const mockStream = new ReadableStream({
        start(c) {
          c.enqueue(
            new TextEncoder().encode(
              'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n'
            )
          )
          c.close()
        },
      })
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        body: mockStream,
      })

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _chunk of clientWithSlash.streamCompletion([{ role: 'user', content: 'x' }])) {
        // consume
      }

      const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string]
      expect(url).toBe('http://localhost:11434/v1/chat/completions')
    })

    it('maps HTTP 401 to AUTH_ERROR', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      })

      const messages: LLMMessage[] = [{ role: 'user', content: 'Test' }]
      let caughtError: unknown
      try {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for await (const _chunk of client.streamCompletion(messages)) {
          // empty
        }
      } catch (e) {
        caughtError = e
      }
      expect(caughtError).toBeInstanceOf(LLMError)
      expect((caughtError as LLMError).code).toBe('AUTH_ERROR')
      expect((caughtError as LLMError).providerId).toBe('ollama')
    })

    it('maps HTTP 429 to RATE_LIMIT', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
      })

      const messages: LLMMessage[] = [{ role: 'user', content: 'Test' }]
      try {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for await (const _chunk of client.streamCompletion(messages)) {
          // empty
        }
      } catch (e) {
        expect((e as LLMError).code).toBe('RATE_LIMIT')
      }
    })

    it('maps network failure to NETWORK_ERROR', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Failed to fetch')
      )

      const messages: LLMMessage[] = [{ role: 'user', content: 'Test' }]
      try {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for await (const _chunk of client.streamCompletion(messages)) {
          // empty
        }
      } catch (e) {
        expect((e as LLMError).code).toBe('NETWORK_ERROR')
        expect((e as LLMError).providerId).toBe('ollama')
      }
    })

    it('skips malformed SSE chunks and continues', async () => {
      const mockStream = new ReadableStream({
        start(c) {
          c.enqueue(new TextEncoder().encode('data: INVALID_JSON\n\n'))
          c.enqueue(
            new TextEncoder().encode(
              'data: {"choices":[{"delta":{"content":"Valid"},"finish_reason":null}]}\n\n'
            )
          )
          c.enqueue(
            new TextEncoder().encode(
              'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n'
            )
          )
          c.close()
        },
      })
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        body: mockStream,
      })

      const chunks: string[] = []
      for await (const chunk of client.streamCompletion([{ role: 'user', content: 'x' }])) {
        if (chunk.content) chunks.push(chunk.content)
      }
      expect(chunks).toEqual(['Valid'])
    })
  })
})

// Re-export type for use in test assertions
import type { LLMStreamChunk } from '../types'
