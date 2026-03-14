/**
 * OpenAI LLM client with streaming support
 *
 * Implements OpenAI Chat Completions API with SSE streaming.
 * API Docs: https://platform.openai.com/docs/api-reference/chat/create
 */

import { BaseLLMClient } from './client'
import type { LLMMessage, LLMStreamChunk } from './types'
import { LLMError, LLM_REQUEST_TIMEOUT } from './types'

/** OpenAI API endpoint */
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions'

/** Default model for chat completions */
const DEFAULT_MODEL = 'gpt-3.5-turbo'

/**
 * OpenAI client for streaming chat completions
 */
export class OpenAIClient extends BaseLLMClient {
  private apiKey: string
  private model: string

  constructor(apiKey: string, model: string = DEFAULT_MODEL) {
    super()
    this.apiKey = apiKey
    this.model = model
  }

  getProviderId(): string {
    return 'openai'
  }

  async *streamCompletion(messages: LLMMessage[]): AsyncGenerator<LLMStreamChunk, void, unknown> {
    try {
      // 1. Make API request with streaming enabled
      const response = await this.fetchWithTimeout(
        OPENAI_API_URL,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model: this.model,
            messages,
            stream: true,
            temperature: 0.7,
          }),
        },
        LLM_REQUEST_TIMEOUT
      )

      // 2. Handle HTTP errors
      if (!response.ok) {
        const errorCode = this.mapHttpStatusToErrorCode(response.status)
        const errorText = await response.text()
        throw new LLMError(`OpenAI API error: ${errorText}`, errorCode, 'openai')
      }

      // 3. Parse SSE stream
      if (!response.body) {
        throw new LLMError('Response body is null', 'INVALID_RESPONSE', 'openai')
      }

      const reader = response.body.getReader()

      for await (const data of this.parseSSEStream(reader)) {
        try {
          const parsed = JSON.parse(data)

          // Extract content delta from OpenAI response format
          const delta = parsed.choices?.[0]?.delta
          if (delta?.content) {
            yield {
              content: delta.content,
              finishReason: parsed.choices?.[0]?.finish_reason || undefined,
            }
          }

          // Check for finish reason
          const finishReason = parsed.choices?.[0]?.finish_reason
          if (finishReason) {
            yield {
              content: '',
              finishReason: finishReason as 'stop' | 'length',
            }
            break
          }
        } catch (parseError) {
          // Re-throw LLMError (from error events), only swallow JSON parse failures
          if (parseError instanceof LLMError) {
            throw parseError
          }
          // Skip malformed JSON chunks
          console.warn('[OpenAI] Failed to parse SSE chunk:', data, parseError)
        }
      }
    } catch (error) {
      // Handle timeout and network errors
      if (error instanceof LLMError) {
        throw error
      }

      if ((error as Error).name === 'AbortError') {
        throw new LLMError('Request timed out', 'TIMEOUT', 'openai')
      }

      throw new LLMError(
        `OpenAI request failed: ${(error as Error).message}`,
        'NETWORK_ERROR',
        'openai'
      )
    }
  }

  /**
   * Map HTTP status codes to error codes
   */
  private mapHttpStatusToErrorCode(status: number): 'RATE_LIMIT' | 'AUTH_ERROR' | 'UNKNOWN' {
    switch (status) {
      case 429:
        return 'RATE_LIMIT'
      case 401:
      case 403:
        return 'AUTH_ERROR'
      default:
        return 'UNKNOWN'
    }
  }
}
