/**
 * OpenAI client unit tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OpenAIClient } from '../openai'
import { LLMError } from '../types'
import type { LLMMessage } from '../types'

// Mock global fetch
global.fetch = vi.fn()

describe('OpenAIClient', () => {
  let client: OpenAIClient
  const mockApiKey = 'sk-test-key-12345'

  beforeEach(() => {
    client = new OpenAIClient(mockApiKey)
    vi.clearAllMocks()
  })

  describe('streamCompletion', () => {
    it('should stream completion tokens', async () => {
      // Mock SSE stream response
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode('data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n')
          )
          controller.enqueue(
            new TextEncoder().encode('data: {"choices":[{"delta":{"content":" world"}}]}\n\n')
          )
          controller.enqueue(
            new TextEncoder().encode('data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n')
          )
          controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'))
          controller.close()
        },
      })

      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        body: mockStream,
      })

      const messages: LLMMessage[] = [{ role: 'user', content: 'Test query' }]
      const chunks: string[] = []

      for await (const chunk of client.streamCompletion(messages)) {
        if (chunk.content) {
          chunks.push(chunk.content)
        }
      }

      expect(chunks).toEqual(['Hello', ' world'])
    })

    it('should handle rate limit error (HTTP 429)', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 429,
        text: async () => 'Rate limit exceeded',
      })

      const messages: LLMMessage[] = [{ role: 'user', content: 'Test' }]

      try {
        for await (const _chunk of client.streamCompletion(messages)) {
          // Should throw
        }
        // If we reach here, test should fail
        expect(true).toBe(false)
      } catch (error) {
        expect(error).toBeInstanceOf(LLMError)
        expect((error as LLMError).code).toBe('RATE_LIMIT')
      }
    })

    it('should handle auth error (HTTP 401)', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Invalid API key',
      })

      const messages: LLMMessage[] = [{ role: 'user', content: 'Test' }]

      try {
        for await (const _chunk of client.streamCompletion(messages)) {
          // Should throw
        }
      } catch (error) {
        expect(error).toBeInstanceOf(LLMError)
        expect((error as LLMError).code).toBe('AUTH_ERROR')
      }
    })

    it('should handle network error', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Network failure')
      )

      const messages: LLMMessage[] = [{ role: 'user', content: 'Test' }]

      try {
        for await (const _chunk of client.streamCompletion(messages)) {
          // Should throw
        }
      } catch (error) {
        expect(error).toBeInstanceOf(LLMError)
        expect((error as LLMError).code).toBe('NETWORK_ERROR')
      }
    })

    it('should handle malformed SSE chunks gracefully', async () => {
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('data: INVALID_JSON\n\n'))
          controller.enqueue(
            new TextEncoder().encode('data: {"choices":[{"delta":{"content":"Valid"}}]}\n\n')
          )
          controller.enqueue(
            new TextEncoder().encode('data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n')
          )
          controller.close()
        },
      })

      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        body: mockStream,
      })

      const messages: LLMMessage[] = [{ role: 'user', content: 'Test' }]
      const chunks: string[] = []

      for await (const chunk of client.streamCompletion(messages)) {
        if (chunk.content) {
          chunks.push(chunk.content)
        }
      }

      // Should skip malformed chunk and process valid one
      expect(chunks).toEqual(['Valid'])
    })
  })

  describe('getProviderId', () => {
    it('should return openai provider ID', () => {
      expect(client.getProviderId()).toBe('openai')
    })
  })
})
