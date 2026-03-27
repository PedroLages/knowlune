/**
 * LLM Client interface and base implementation
 *
 * Provides streaming completion interface for AI providers.
 */

import type { LLMMessage, LLMStreamChunk, LLMErrorCode } from './types'

/**
 * LLM client interface for streaming completions
 *
 * Implementations must handle provider-specific APIs and SSE parsing.
 */
export interface LLMClient {
  /**
   * Stream chat completion tokens
   *
   * @param messages - Conversation messages
   * @returns Async generator yielding text chunks
   *
   * @throws {LLMError} On timeout, rate limit, auth failure, or network error
   *
   * @example
   * for await (const chunk of client.streamCompletion(messages)) {
   *   console.log(chunk.content)
   * }
   */
  streamCompletion(messages: LLMMessage[]): AsyncGenerator<LLMStreamChunk, void, unknown>

  /**
   * Get provider ID
   */
  getProviderId(): string
}

/**
 * Base LLM client with common functionality
 */
export abstract class BaseLLMClient implements LLMClient {
  abstract streamCompletion(messages: LLMMessage[]): AsyncGenerator<LLMStreamChunk, void, unknown>
  abstract getProviderId(): string

  /**
   * Create fetch request with timeout
   *
   * @param url - API endpoint
   * @param options - Fetch options
   * @param timeoutMs - Request timeout in milliseconds
   * @returns Response promise with timeout
   */
  protected async fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeoutMs: number
  ): Promise<Response> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
      return response
    } catch (error) {
      clearTimeout(timeoutId)
      throw error
    }
  }

  /**
   * Map HTTP status codes to LLM error codes.
   *
   * Handles server-side middleware responses:
   * - 401 -> AUTH_REQUIRED (missing/invalid/expired JWT)
   * - 403 -> ENTITLEMENT_ERROR (premium subscription required)
   * - 429 -> RATE_LIMITED (server-side rate limit exceeded)
   *
   * @param status - HTTP status code
   * @returns Corresponding LLM error code
   */
  protected mapHttpStatusToLLMErrorCode(status: number): LLMErrorCode {
    switch (status) {
      case 401:
        return 'AUTH_REQUIRED'
      case 403:
        return 'ENTITLEMENT_ERROR'
      case 429:
        return 'RATE_LIMITED'
      default:
        return 'UNKNOWN'
    }
  }

  /**
   * Parse SSE (Server-Sent Events) stream
   *
   * @param reader - ReadableStreamDefaultReader from response body
   * @returns Async generator yielding parsed data lines
   */
  protected async *parseSSEStream(
    reader: ReadableStreamDefaultReader<Uint8Array>
  ): AsyncGenerator<string, void, unknown> {
    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')

        // Keep incomplete line in buffer
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (trimmed.startsWith('data: ')) {
            const data = trimmed.slice(6) // Remove "data: " prefix
            if (data === '[DONE]') continue // OpenAI stream terminator
            yield data
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }
}
