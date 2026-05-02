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
import { formatModelSize, type OllamaModel } from '@/lib/aiConfiguration'
import { apiUrl } from '@/lib/apiBaseUrl'
import { useAuthStore } from '@/stores/useAuthStore'

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
    return apiUrl('ai-ollama')
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

      // Build headers: include JWT for proxy mode, placeholder for direct mode
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (this.directConnection) {
        // Ollama ignores auth but include for OpenAI-compat format
        headers['Authorization'] = 'Bearer ollama'
      } else {
        // Proxy mode: include JWT from auth store for server-side middleware validation
        const accessToken = useAuthStore.getState().session?.access_token
        if (accessToken) {
          headers['Authorization'] = `Bearer ${accessToken}`
        }
      }

      const response = await this.fetchWithTimeout(
        this.directConnection ? `${baseUrl}/chat/completions` : baseUrl,
        {
          method: 'POST',
          headers,
          body: JSON.stringify(requestBody),
        },
        OLLAMA_REQUEST_TIMEOUT
      )

      if (!response.ok) {
        const errorCode = this.mapHttpStatusToLLMErrorCode(response.status)
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

  /**
   * List available models from the Ollama server.
   *
   * Calls GET /api/tags (Ollama native endpoint) to retrieve all downloaded models.
   * In proxy mode, routes through the Express proxy at /api/ai/ollama/tags.
   *
   * @returns Array of available models with name and size metadata
   * @throws {LLMError} If the server is unreachable or returns an error
   */
  async listModels(): Promise<OllamaModel[]> {
    return OllamaLLMClient.fetchModels(this.serverUrl, this.directConnection)
  }

  /**
   * Static method to fetch models from an Ollama server without needing a full client instance.
   * Used by the UI to discover models before a client is fully configured.
   *
   * @param serverUrl - Ollama server URL (e.g., "http://192.168.2.200:11434")
   * @param directConnection - If true, connects directly to Ollama (requires CORS)
   * @returns Array of available models
   * @throws {LLMError} If the server is unreachable or returns an error
   */
  static async fetchModels(
    serverUrl: string,
    directConnection: boolean = false
  ): Promise<OllamaModel[]> {
    const normalizedUrl = serverUrl.replace(/\/+$/, '')

    try {
      let response: Response

      if (directConnection) {
        // Direct: browser -> Ollama /api/tags
        response = await fetch(`${normalizedUrl}/api/tags`, {
          method: 'GET',
          signal: AbortSignal.timeout(15_000),
        })
      } else {
        // Proxy: browser -> Express /api/ai/ollama/tags
        // Include JWT for server-side middleware validation
        const accessToken = useAuthStore.getState().session?.access_token
        const headers: Record<string, string> = {}
        if (accessToken) {
          headers['Authorization'] = `Bearer ${accessToken}`
        }
        response = await fetch(
          apiUrl('ai-ollama/tags', { serverUrl: normalizedUrl }),
          {
            method: 'GET',
            headers,
            signal: AbortSignal.timeout(15_000),
          }
        )
      }

      if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText)
        throw new LLMError(
          `Failed to list models (${response.status}): ${errorText}`,
          'UNKNOWN',
          'ollama'
        )
      }

      const data = (await response.json()) as {
        models?: Array<{
          name: string
          size: number
          modified_at: string
          details?: { parameter_size?: string; quantization_level?: string }
        }>
      }

      if (!data.models || !Array.isArray(data.models)) {
        return []
      }

      return data.models.map(model => ({
        name: model.name,
        size: formatModelSize(model.size),
        sizeBytes: model.size,
        modifiedAt: model.modified_at,
      }))
    } catch (error) {
      if (error instanceof LLMError) throw error

      const message = (error as Error).message
      if (message.includes('Failed to fetch') || message.includes('NetworkError')) {
        throw new LLMError(
          `Cannot reach Ollama at ${normalizedUrl}. Is the server running?`,
          'NETWORK_ERROR',
          'ollama'
        )
      }
      if ((error as Error).name === 'AbortError' || (error as Error).name === 'TimeoutError') {
        throw new LLMError(
          `Ollama server at ${normalizedUrl} timed out. Check if the server is responsive.`,
          'TIMEOUT',
          'ollama'
        )
      }

      throw new LLMError(`Failed to list models: ${message}`, 'NETWORK_ERROR', 'ollama')
    }
  }
}
