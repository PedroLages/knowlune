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
import { getAPIKeyHealth } from '@/lib/aiConfiguration'
import { apiUrl } from '@/lib/apiBaseUrl'
import { useAuthStore } from '@/stores/useAuthStore'

/** Local proxy endpoint for streaming completions */
const PROXY_STREAM_URL = apiUrl('ai-stream')

/**
 * Categorizes an Edge Function error into a user-facing message.
 *
 * Maps structured error responses from the `ai-stream` Edge Function into
 * actionable messages the user can act on (re-enter key, change model, etc.).
 */
function categorizeProxyError(
  status: number,
  body: { error?: string } | null,
  providerId: AIProviderId,
  model?: string
): string {
  const msg = body?.error ?? ''
  const modelName = model || 'selected'

  // HTTP status-based
  if (status === 401 || /invalid.*api.?key/i.test(msg)) {
    return `Your API key was rejected by ${providerId}. Check that it's valid and has credits.`
  }
  if (status === 429 || /rate.?.?limit/i.test(msg)) {
    return 'Too many requests. Wait a moment and try again.'
  }

  // Content-based
  if (/no api key available/i.test(msg)) {
    return `No API key configured for ${providerId}. Add your API key in Settings → Integrations & Data.`
  }
  if (/provider not configured/i.test(msg)) {
    return 'The AI provider is not configured on the server. Contact support if this persists.'
  }
  if (/model not found/i.test(msg)) {
    return `The model '${modelName}' is not available. Try a different model in Settings → Integrations & Data.`
  }
  if (/fetch failed|econnrefused|networkerror/i.test(msg)) {
    return 'Cannot reach the AI service. Check your internet connection.'
  }

  // Fallthrough
  return msg
    ? `AI error: ${msg}`
    : `AI error: ${status} ${status >= 500 ? 'Server error' : 'Request failed'}`
}

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
      // Pre-flight check: if the local encryption key was lost, the stored API key
      // is undecryptable. Surface this immediately without a network round-trip.
      const keyHealth = getAPIKeyHealth(this.providerId)
      if (keyHealth === 'undecryptable') {
        throw new LLMError(
          `Your API key for ${this.providerId} was lost because the encryption key was reset. Go to Settings > Integrations & Data to re-enter it.`,
          'AUTH_ERROR',
          this.providerId
        )
      }

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
        const userMessage = categorizeProxyError(
          response.status,
          errorData,
          this.providerId,
          this.model
        )
        throw new LLMError(userMessage, errorCode, this.providerId)
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
        throw new LLMError(
          'AI request timed out. The model may be overloaded. Try again.',
          'TIMEOUT',
          this.providerId
        )
      }

      const fetchMessage = (error as Error).message
      if (/fetch failed|econnrefused|networkerror|failed to fetch/i.test(fetchMessage)) {
        throw new LLMError(
          'Cannot reach the AI service. Check your internet connection.',
          'NETWORK_ERROR',
          this.providerId
        )
      }

      throw new LLMError(
        `AI error: ${fetchMessage || 'Unknown error'}`,
        'NETWORK_ERROR',
        this.providerId
      )
    }
  }
}
