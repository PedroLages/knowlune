/**
 * Ollama Direct LLM Client
 *
 * Calls Ollama's OpenAI-compatible API directly from the browser.
 * Used when the user enables "Direct Connection" mode in settings.
 *
 * Requires CORS configured on the Ollama server:
 *   OLLAMA_ORIGINS=* (or the app's origin)
 *
 * For proxy mode, use ProxyLLMClient with provider='ollama' instead.
 */

import { BaseLLMClient } from './client'
import type { LLMMessage, LLMStreamChunk } from './types'
import { LLMError, LLM_REQUEST_TIMEOUT } from './types'

/**
 * LLM client that connects directly to an Ollama server (bypasses Express proxy).
 *
 * Uses Ollama's OpenAI-compatible streaming endpoint:
 *   POST {baseUrl}/v1/chat/completions
 *
 * No Authorization header is sent — Ollama ignores auth by default.
 */
export class OllamaDirectClient extends BaseLLMClient {
  constructor(
    private readonly baseUrl: string,
    private readonly model: string
  ) {
    super()
  }

  getProviderId(): string {
    return 'ollama'
  }

  async *streamCompletion(messages: LLMMessage[]): AsyncGenerator<LLMStreamChunk, void, unknown> {
    const url = `${this.baseUrl.replace(/\/$/, '')}/v1/chat/completions`

    let response: Response
    try {
      response = await this.fetchWithTimeout(
        url,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          // No Authorization header — Ollama ignores auth
          body: JSON.stringify({
            model: this.model,
            messages,
            stream: true,
          }),
        },
        LLM_REQUEST_TIMEOUT
      )
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        throw new LLMError('Request timed out', 'TIMEOUT', 'ollama')
      }
      throw new LLMError(
        `Ollama connection failed: ${(error as Error).message}`,
        'NETWORK_ERROR',
        'ollama'
      )
    }

    if (!response.ok) {
      const code =
        response.status === 401 || response.status === 403
          ? 'AUTH_ERROR'
          : response.status === 429
            ? 'RATE_LIMIT'
            : 'NETWORK_ERROR'
      throw new LLMError(`Ollama error ${response.status}: ${response.statusText}`, code, 'ollama')
    }

    if (!response.body) {
      throw new LLMError('Response body is null', 'INVALID_RESPONSE', 'ollama')
    }

    const reader = response.body.getReader()

    for await (const data of this.parseSSEStream(reader)) {
      try {
        const parsed = JSON.parse(data) as {
          choices: [{ delta: { content?: string }; finish_reason?: string | null }]
        }
        const content = parsed.choices[0]?.delta?.content ?? ''
        const finishReason = parsed.choices[0]?.finish_reason
        if (content) yield { content }
        if (finishReason === 'stop') yield { content: '', finishReason: 'stop' }
      } catch {
        // Skip malformed chunks
        console.warn('[OllamaDirectClient] Failed to parse SSE chunk:', data)
      }
    }
  }
}
