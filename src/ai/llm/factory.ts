/**
 * LLM Client Factory
 *
 * Creates LLM clients based on AI configuration.
 */

import type { AIProviderId } from '@/lib/aiConfiguration'
import { getAIConfiguration, getDecryptedApiKey } from '@/lib/aiConfiguration'
import type { LLMClient } from './client'
import { OllamaDirectClient } from './ollama-client'
import { ProxyLLMClient } from './proxy-client'
import { LLMError } from './types'

/**
 * Get LLM client for configured AI provider
 *
 * @returns LLM client instance
 * @throws {LLMError} If provider is not configured or API key is missing
 *
 * @example
 * const client = await getLLMClient()
 * for await (const chunk of client.streamCompletion(messages)) {
 *   console.log(chunk.content)
 * }
 */
export async function getLLMClient(): Promise<LLMClient> {
  // Allow test injection via window.__mockLLMClient
  // This enables E2E tests to inject deterministic mock clients
  if (
    typeof window !== 'undefined' &&
    (window as unknown as { __mockLLMClient?: LLMClient }).__mockLLMClient
  ) {
    return (window as unknown as { __mockLLMClient: LLMClient }).__mockLLMClient
  }

  const config = getAIConfiguration()
  const apiKey = await getDecryptedApiKey()

  // Ollama uses a URL as its "credential" — already handled in getDecryptedApiKey
  if (!apiKey) {
    throw new LLMError(
      config.provider === 'ollama'
        ? 'No Ollama URL configured. Please enter your Ollama server URL in Settings.'
        : 'No API key configured. Please configure an AI provider in Settings.',
      'AUTH_ERROR',
      config.provider
    )
  }

  return getLLMClientForProvider(config.provider, apiKey)
}

/**
 * Get LLM client for specific provider with API key
 *
 * @param providerId - AI provider ID
 * @param apiKey - Decrypted API key
 * @returns LLM client instance
 * @throws {LLMError} If provider is not supported
 *
 * @example
 * const client = getLLMClientForProvider('openai', 'sk-...')
 */
export function getLLMClientForProvider(providerId: AIProviderId, apiKey: string): LLMClient {
  if (providerId === 'ollama') {
    const config = getAIConfiguration()
    const baseUrl = apiKey // URL is required — getLLMClient() validates before calling here
    const model = config.ollamaModel || 'llama3.2'
    if (config.ollamaDirectConnection) {
      return new OllamaDirectClient(baseUrl, model)
    }
    // Proxy mode: pass Ollama base URL in the apiKey field (server interprets it as baseURL)
    return new ProxyLLMClient('ollama', baseUrl, model)
  }

  const supported: AIProviderId[] = ['openai', 'anthropic', 'groq', 'gemini']
  if (!supported.includes(providerId)) {
    throw new LLMError(`Unsupported AI provider: ${providerId}`, 'UNKNOWN', providerId)
  }
  return new ProxyLLMClient(providerId, apiKey)
}
