/**
 * LLM Client Factory
 *
 * Creates LLM clients based on AI configuration.
 */

import type { AIProviderId, AIFeatureId } from '@/lib/aiConfiguration'
import {
  getAIConfiguration,
  getDecryptedApiKey,
  getDecryptedApiKeyForProvider,
  getOllamaServerUrl,
  getOllamaSelectedModel,
  isOllamaDirectConnection,
  resolveFeatureModel,
} from '@/lib/aiConfiguration'
import { PROVIDER_DEFAULTS } from '@/lib/modelDefaults'
import type { LLMClient } from './client'
import { ProxyLLMClient } from './proxy-client'
import { OllamaLLMClient } from './ollama-client'
import { LLMError } from './types'
import type { LLMMessage } from './types'

/**
 * Get LLM client for configured AI provider
 *
 * When `feature` is provided, uses the three-tier resolution cascade
 * (user override → feature default → global provider default) to select
 * the provider and model. When omitted, falls back to global provider default
 * (backward compatible).
 *
 * @param feature - Optional AI feature ID for feature-aware model resolution
 * @returns LLM client instance
 * @throws {LLMError} If provider is not configured or API key is missing
 *
 * @example
 * // Global provider default (backward compatible)
 * const client = await getLLMClient()
 *
 * @example
 * // Feature-aware resolution
 * const client = await getLLMClient('videoSummary')
 */
export async function getLLMClient(feature?: AIFeatureId): Promise<LLMClient> {
  // Allow test injection via window.__mockLLMClient
  // This enables E2E tests to inject deterministic mock clients
  if (
    typeof window !== 'undefined' &&
    (window as unknown as { __mockLLMClient?: LLMClient }).__mockLLMClient
  ) {
    return (window as unknown as { __mockLLMClient: LLMClient }).__mockLLMClient
  }

  // Feature-aware resolution: determine provider and model from cascade
  if (feature) {
    const resolved = resolveFeatureModel(feature)

    // Ollama uses server URL, not API key — model comes from OllamaModelPicker
    if (resolved.provider === 'ollama') {
      const serverUrl = getOllamaServerUrl()
      if (!serverUrl) {
        throw new LLMError(
          'No Ollama server URL configured. Please configure the Ollama URL in Settings.',
          'AUTH_ERROR',
          'ollama'
        )
      }
      const selectedModel = resolved.model || getOllamaSelectedModel() || undefined
      return new OllamaLLMClient(serverUrl, isOllamaDirectConnection(), selectedModel)
    }

    const apiKey = await getDecryptedApiKeyForProvider(resolved.provider)
    if (!apiKey) {
      throw new LLMError(
        `No API key configured for ${resolved.provider}. Please configure it in Settings.`,
        'AUTH_ERROR',
        resolved.provider
      )
    }

    return getLLMClientForProvider(resolved.provider, apiKey, resolved.model)
  }

  // Legacy path: no feature specified, use global provider
  const config = getAIConfiguration()

  // Ollama uses server URL, not API key
  if (config.provider === 'ollama') {
    const serverUrl = getOllamaServerUrl()
    if (!serverUrl) {
      throw new LLMError(
        'No Ollama server URL configured. Please configure the Ollama URL in Settings.',
        'AUTH_ERROR',
        'ollama'
      )
    }
    const selectedModel = getOllamaSelectedModel() || undefined
    return new OllamaLLMClient(serverUrl, isOllamaDirectConnection(), selectedModel)
  }

  const apiKey = await getDecryptedApiKey()

  if (!apiKey) {
    throw new LLMError(
      'No API key configured. Please configure an AI provider in Settings.',
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
export function getLLMClientForProvider(
  providerId: AIProviderId,
  apiKey: string,
  model?: string
): LLMClient {
  const supported: AIProviderId[] = ['openai', 'anthropic', 'groq', 'gemini', 'ollama']
  if (!supported.includes(providerId)) {
    throw new LLMError(`Unsupported AI provider: ${providerId}`, 'UNKNOWN', providerId)
  }

  if (providerId === 'ollama') {
    // For Ollama, apiKey is actually the server URL when called from proxy
    const serverUrl = getOllamaServerUrl() || 'http://localhost:11434'
    const selectedModel = getOllamaSelectedModel() || undefined
    return new OllamaLLMClient(serverUrl, isOllamaDirectConnection(), selectedModel)
  }

  return new ProxyLLMClient(providerId, apiKey, model)
}

/**
 * Wraps an LLM streaming call with automatic model fallback (AC8).
 *
 * If the initial call fails with AUTH_ERROR or ENTITLEMENT_ERROR and the
 * resolved model differs from the provider default, retries with the
 * provider's default model. Yields chunks from whichever call succeeds.
 *
 * @param feature - AI feature ID used for model resolution
 * @param messages - LLM messages to send
 * @yields Text content chunks from the successful call
 * @throws The original error if fallback is not applicable or also fails
 */
export async function* withModelFallback(
  feature: AIFeatureId,
  messages: LLMMessage[]
): AsyncGenerator<string, void, undefined> {
  let client = await getLLMClient(feature)

  try {
    for await (const chunk of client.streamCompletion(messages)) {
      if (chunk.content) {
        yield chunk.content
      }
    }
  } catch (firstError) {
    if (
      firstError instanceof LLMError &&
      (firstError.code === 'AUTH_ERROR' || firstError.code === 'ENTITLEMENT_ERROR')
    ) {
      const resolved = resolveFeatureModel(feature)
      const defaultModel = PROVIDER_DEFAULTS[resolved.provider]

      if (resolved.model !== defaultModel) {
        console.warn(
          `[${feature}] Model "${resolved.model}" unavailable, falling back to "${defaultModel}". ` +
            'If this persists, check your API key or select a different model in Settings → AI Configuration.'
        )

        const apiKey = await getDecryptedApiKeyForProvider(resolved.provider)
        if (!apiKey) {
          throw new LLMError(
            `No API key configured for ${resolved.provider}. Please add or check your API key in Settings → AI Configuration.`,
            'AUTH_ERROR',
            resolved.provider
          )
        }

        client = getLLMClientForProvider(resolved.provider, apiKey, defaultModel)

        for await (const chunk of client.streamCompletion(messages)) {
          if (chunk.content) {
            yield chunk.content
          }
        }
        return
      }

      // Model IS the default — the API key itself is likely bad
      throw new LLMError(
        `Authentication failed for ${resolved.provider}. Please check your API key in Settings → AI Configuration.`,
        firstError.code,
        resolved.provider
      )
    }
    throw firstError
  }
}
