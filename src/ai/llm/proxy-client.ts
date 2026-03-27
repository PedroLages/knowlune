/**
 * Proxy LLM Client
 *
 * Routes all LLM requests through the local Express proxy server.
 * This solves CORS restrictions (Anthropic, Groq, Gemini block browser-direct calls)
 * and provides a unified interface for all AI providers.
 *
 * The proxy server uses the Vercel AI SDK to call the appropriate provider API.
 */

import { BaseLLMClient } from './client'
import type { LLMMessage, LLMStreamChunk } from './types'
import { LLMError, LLM_REQUEST_TIMEOUT } from './types'
import type { AIProviderId } from '@/lib/aiConfiguration'
import { useAuthStore } from '@/stores/useAuthStore'

/** Local proxy endpoint for streaming completions */
const PROXY_STREAM_URL = '/api/ai/stream'

/**
 * LLM client that proxies requests through the local Express server.
 * Works with all supported providers (OpenAI, Anthropic, Groq, Gemini).
 */
export class ProxyLLMClient extends BaseLLMClient {
  private providerId: AIProviderId
  private apiKey: string
  private model?: string

  constructor(providerId: AIProviderId, apiKey: string, model?: string) {
    super()
    this.providerId = providerId
    this.apiKey = apiKey
    this.model = model
  }

  getProviderId(): string {
    return this.providerId
  }

  async *streamCompletion(messages: LLMMessage[]): AsyncGenerator<LLMStreamChunk, void, unknown> {
    try {
      // Include JWT from auth store for server-side middleware validation
      const accessToken = useAuthStore.getState().session?.access_token
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`
      }

      const response = await this.fetchWithTimeout(
        PROXY_STREAM_URL,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            provider: this.providerId,
            apiKey: this.apiKey,
            messages,
            model: this.model,
          }),
        },
        LLM_REQUEST_TIMEOUT
      )

      if (!response.ok) {
        const errorCode = this.mapHttpStatusToLLMErrorCode(response.status)
        const errorData = await response.json().catch(() => ({ error: response.statusText }))
        throw new LLMError(
          `AI proxy error: ${errorData.error || response.statusText}`,
          errorCode,
          this.providerId
        )
      }

      if (!response.body) {
        throw new LLMError('Response body is null', 'INVALID_RESPONSE', this.providerId)
      }

      const reader = response.body.getReader()

      for await (const data of this.parseSSEStream(reader)) {
        try {
          const parsed = JSON.parse(data)

          // Handle error events from proxy
          if (parsed.error) {
            throw new LLMError(parsed.error, 'UNKNOWN', this.providerId)
          }

          if (parsed.content) {
            yield { content: parsed.content }
          }
        } catch (parseError) {
          if (parseError instanceof LLMError) throw parseError
          // Skip malformed chunks
          console.warn('[ProxyLLMClient] Failed to parse SSE chunk:', data)
        }
      }

      // Signal completion
      yield { content: '', finishReason: 'stop' }
    } catch (error) {
      if (error instanceof LLMError) throw error

      if ((error as Error).name === 'AbortError') {
        throw new LLMError('Request timed out', 'TIMEOUT', this.providerId)
      }

      throw new LLMError(
        `Proxy request failed: ${(error as Error).message}`,
        'NETWORK_ERROR',
        this.providerId
      )
    }
  }

}
