/**
 * Anthropic client unit tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AnthropicClient } from '../anthropic'
import { LLMError } from '../types'
import type { LLMMessage } from '../types'

// Mock global fetch
global.fetch = vi.fn()

describe('AnthropicClient', () => {
  let client: AnthropicClient
  const mockApiKey = 'sk-ant-test-key-12345'

  beforeEach(() => {
    client = new AnthropicClient(mockApiKey)
    vi.clearAllMocks()
  })

  describe('streamCompletion', () => {
    it('should stream completion tokens', async () => {
      // Mock Anthropic SSE stream format
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode(
              'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hello"}}\n\n'
            )
          )
          controller.enqueue(
            new TextEncoder().encode(
              'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":" Claude"}}\n\n'
            )
          )
          controller.enqueue(
            new TextEncoder().encode(
              'data: {"type":"message_delta","delta":{"stop_reason":"end_turn"}}\n\n'
            )
          )
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

      expect(chunks).toEqual(['Hello', ' Claude'])
    })

    it('should separate system message correctly', async () => {
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode(
              'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Response"}}\n\n'
            )
          )
          controller.enqueue(
            new TextEncoder().encode(
              'data: {"type":"message_delta","delta":{"stop_reason":"end_turn"}}\n\n'
            )
          )
          controller.close()
        },
      })

      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        body: mockStream,
      })

      const messages: LLMMessage[] = [
        { role: 'system', content: 'You are a helpful assistant' },
        { role: 'user', content: 'Hello' },
      ]

      const chunks: string[] = []
      for await (const chunk of client.streamCompletion(messages)) {
        if (chunk.content) {
          chunks.push(chunk.content)
        }
      }

      expect(chunks).toEqual(['Response'])

      // Verify fetch was called with system field
      const fetchCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
      const body = JSON.parse(fetchCall[1].body)
      expect(body.system).toBe('You are a helpful assistant')
      expect(body.messages).toHaveLength(1) // Only user message
    })

    it('should handle rate limit error (HTTP 429)', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => 'Rate limit exceeded',
      })

      const messages: LLMMessage[] = [{ role: 'user', content: 'Test' }]

      try {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for await (const _chunk of client.streamCompletion(messages)) {
          // Should throw
        }
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
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for await (const _chunk of client.streamCompletion(messages)) {
          // Should throw
        }
      } catch (error) {
        expect(error).toBeInstanceOf(LLMError)
        expect((error as LLMError).code).toBe('AUTH_ERROR')
      }
    })

    it('should handle streaming error event', async () => {
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode(
              'data: {"type":"error","error":{"message":"Streaming error"}}\n\n'
            )
          )
          controller.close()
        },
      })

      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        body: mockStream,
      })

      const messages: LLMMessage[] = [{ role: 'user', content: 'Test' }]

      try {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for await (const _chunk of client.streamCompletion(messages)) {
          // Should throw
        }
      } catch (error) {
        expect(error).toBeInstanceOf(LLMError)
        expect((error as Error).message).toContain('Streaming error')
      }
    })

    it('should map stop reasons correctly', async () => {
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode(
              'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Test"}}\n\n'
            )
          )
          controller.enqueue(
            new TextEncoder().encode(
              'data: {"type":"message_delta","delta":{"stop_reason":"max_tokens"}}\n\n'
            )
          )
          controller.close()
        },
      })

      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        body: mockStream,
      })

      const messages: LLMMessage[] = [{ role: 'user', content: 'Test' }]
      let finishReason: string | undefined

      for await (const chunk of client.streamCompletion(messages)) {
        if (chunk.finishReason) {
          finishReason = chunk.finishReason
        }
      }

      expect(finishReason).toBe('length')
    })
  })

  describe('getProviderId', () => {
    it('should return anthropic provider ID', () => {
      expect(client.getProviderId()).toBe('anthropic')
    })
  })
})
