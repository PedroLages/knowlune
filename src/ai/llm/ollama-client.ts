/**
 * Ollama LLM Client
 *
 * Connects to a local Ollama server using its OpenAI-compatible API at /v1/.
 * Supports two modes:
 *   - Proxy mode (default): Routes through the Express proxy to avoid CORS
 *   - Direct mode: Connects directly from browser to Ollama (requires CORS config)
 *
 * Uses the same SSE streaming format as OpenAI, so the BaseLLMClient's
 * parseSSEStream works without modification.
 */

import { BaseLLMClient } from './client'
import type { LLMMessage, LLMStreamChunk } from './types'
import { LLMError } from './types'

/** Default model for Ollama when none is specified */
const DEFAULT_OLLAMA_MODEL = 'llama3.2'

/** Ollama request timeout — longer than cloud providers since local inference is slower */
const OLLAMA_REQUEST_TIMEOUT = 120_000 // 2 minutes

/**
 * LLM client for Ollama servers.
 *
 * In proxy mode, routes through /api/ai/ollama on the Express proxy server.
 * In direct mode, connects directly to the Ollama server's OpenAI-compat endpoint.
 */
export class OllamaLLMClient extends BaseLLMClient {
  private serverUrl: string
  private directConnection: boolean
  private model: string

  constructor(serverUrl: string, directConnection: boolean = false, model?: string) {
    super()
    // Normalize URL: remove trailing slash
    this.serverUrl = serverUrl.replace(/\/+$/, '')
    this.directConnection = directConnection
    this.model = model || DEFAULT_OLLAMA_MODEL
  }

  getProviderId(): string {
    return 'ollama'
  }

  /**
   * Get the base URL for API requests based on connection mode
   */
  private getBaseUrl(): string {
    if (this.directConnection) {
      // Direct: browser → Ollama server (requires CORS)
      return `${this.serverUrl}/v1`
    }
    // Proxy: browser → Express proxy → Ollama server
    return '/api/ai/ollama'
  }

  async *streamCompletion(messages: LLMMessage[]): AsyncGenerator<LLMStreamChunk, void, unknown> {
    const baseUrl = this.getBaseUrl()

    try {
      const requestBody: Record<string, unknown> = {
        model: this.model,
        messages,
        temperature: 0.7,
      }

      // In direct mode, stream flag is required by Ollama's OpenAI-compat endpoint.
      // In proxy mode, the Express handler always uses streamText() so it's unnecessary.
      if (this.directConnection) {
        requestBody.stream = true
      } else {
        // Include the target server URL so the proxy knows where to forward
        requestBody.ollamaServerUrl = this.serverUrl
      }

      const response = await this.fetchWithTimeout(
        this.directConnection ? `${baseUrl}/chat/completions` : baseUrl,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // Ollama ignores auth but include for OpenAI-compat format
            ...(this.directConnection ? { Authorization: 'Bearer ollama' } : {}),
          },
          body: JSON.stringify(requestBody),
        },
        OLLAMA_REQUEST_TIMEOUT
      )

      if (!response.ok) {
        const errorCode = this.mapHttpStatusToErrorCode(response.status)
        const errorText = await response.text().catch(() => response.statusText)
        throw new LLMError(
          `Ollama API error (${response.status}): ${errorText}`,
          errorCode,
          'ollama'
        )
      }

      if (!response.body) {
        throw new LLMError('Response body is null', 'INVALID_RESPONSE', 'ollama')
      }

      const reader = response.body.getReader()

      for await (const data of this.parseSSEStream(reader)) {
        try {
          const parsed = JSON.parse(data)

          // Handle error events
          if (parsed.error) {
            throw new LLMError(parsed.error, 'UNKNOWN', 'ollama')
          }

          // OpenAI-compat format: choices[0].delta.content
          const delta = parsed.choices?.[0]?.delta
          const finishReason = parsed.choices?.[0]?.finish_reason || undefined

          if (delta?.content) {
            yield {
              content: delta.content,
              finishReason,
            }
          }

          // Proxy format fallback: { content: "..." }
          if (!delta && parsed.content) {
            yield { content: parsed.content }
          }

          // If finish reason with no content (final SSE frame), signal stop
          if (finishReason === 'stop' && !delta?.content) {
            yield { content: '', finishReason: 'stop' }
            break
          }
        } catch (parseError) {
          if (parseError instanceof LLMError) throw parseError
          // Skip malformed JSON chunks
          console.warn('[OllamaLLMClient] Failed to parse SSE chunk:', data, parseError)
        }
      }
    } catch (error) {
      if (error instanceof LLMError) throw error

      if ((error as Error).name === 'AbortError') {
        throw new LLMError('Ollama request timed out', 'TIMEOUT', 'ollama')
      }

      // Provide helpful error messages for common Ollama issues
      const message = (error as Error).message
      if (message.includes('Failed to fetch') || message.includes('NetworkError')) {
        throw new LLMError(
          `Cannot reach Ollama at ${this.serverUrl}. Is the server running?`,
          'NETWORK_ERROR',
          'ollama'
        )
      }

      throw new LLMError(`Ollama request failed: ${message}`, 'NETWORK_ERROR', 'ollama')
    }
  }

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
