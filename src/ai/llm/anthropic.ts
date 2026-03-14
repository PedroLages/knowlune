/**
 * Anthropic LLM client with streaming support
 *
 * Implements Anthropic Messages API with SSE streaming.
 * API Docs: https://docs.anthropic.com/claude/reference/messages_post
 */

import { BaseLLMClient } from './client'
import type { LLMMessage, LLMStreamChunk } from './types'
import { LLMError, LLM_REQUEST_TIMEOUT } from './types'

/** Anthropic API endpoint */
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'

/** API version header */
const ANTHROPIC_VERSION = '2023-06-01'

/** Default model for messages */
const DEFAULT_MODEL = 'claude-haiku-4-5'

/**
 * Anthropic client for streaming chat completions
 */
export class AnthropicClient extends BaseLLMClient {
  private apiKey: string
  private model: string

  constructor(apiKey: string, model: string = DEFAULT_MODEL) {
    super()
    this.apiKey = apiKey
    this.model = model
  }

  getProviderId(): string {
    return 'anthropic'
  }

  async *streamCompletion(messages: LLMMessage[]): AsyncGenerator<LLMStreamChunk, void, unknown> {
    try {
      // 1. Separate system message from conversation messages
      // Anthropic requires system prompt as separate field
      const systemMessage = messages.find(m => m.role === 'system')
      const conversationMessages = messages.filter(m => m.role !== 'system')

      // 2. Make API request with streaming enabled
      const response = await this.fetchWithTimeout(
        ANTHROPIC_API_URL,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey,
            'anthropic-version': ANTHROPIC_VERSION,
          },
          body: JSON.stringify({
            model: this.model,
            max_tokens: 4096,
            system: systemMessage?.content || undefined,
            messages: conversationMessages,
            stream: true,
            temperature: 0.7,
          }),
        },
        LLM_REQUEST_TIMEOUT
      )

      // 3. Handle HTTP errors
      if (!response.ok) {
        const errorCode = this.mapHttpStatusToErrorCode(response.status)
        const errorText = await response.text()
        throw new LLMError(`Anthropic API error: ${errorText}`, errorCode, 'anthropic')
      }

      // 4. Parse SSE stream
      if (!response.body) {
        throw new LLMError('Response body is null', 'INVALID_RESPONSE', 'anthropic')
      }

      const reader = response.body.getReader()

      for await (const data of this.parseSSEStream(reader)) {
        try {
          const parsed = JSON.parse(data)

          // Anthropic SSE format has different event types
          if (parsed.type === 'content_block_delta') {
            const delta = parsed.delta
            if (delta?.type === 'text_delta' && delta.text) {
              yield {
                content: delta.text,
              }
            }
          } else if (parsed.type === 'message_delta') {
            const finishReason = parsed.delta?.stop_reason
            if (finishReason) {
              yield {
                content: '',
                finishReason: this.mapStopReason(finishReason),
              }
              break
            }
          } else if (parsed.type === 'error') {
            throw new LLMError(
              `Anthropic streaming error: ${parsed.error?.message || 'Unknown error'}`,
              'UNKNOWN',
              'anthropic'
            )
          }
        } catch (parseError) {
          // Re-throw LLMError (from error events), only swallow JSON parse failures
          if (parseError instanceof LLMError) {
            throw parseError
          }
          // Skip malformed JSON chunks
          console.warn('[Anthropic] Failed to parse SSE chunk:', data, parseError)
        }
      }
    } catch (error) {
      // Handle timeout and network errors
      if (error instanceof LLMError) {
        throw error
      }

      if ((error as Error).name === 'AbortError') {
        throw new LLMError('Request timed out', 'TIMEOUT', 'anthropic')
      }

      throw new LLMError(
        `Anthropic request failed: ${(error as Error).message}`,
        'NETWORK_ERROR',
        'anthropic'
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

  /**
   * Map Anthropic stop reasons to standard finish reasons
   */
  private mapStopReason(stopReason: string): 'stop' | 'length' | 'error' {
    switch (stopReason) {
      case 'end_turn':
      case 'stop_sequence':
        return 'stop'
      case 'max_tokens':
        return 'length'
      default:
        return 'error'
    }
  }
}
