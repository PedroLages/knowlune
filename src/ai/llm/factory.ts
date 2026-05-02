/**
 * LLM Client Factory
 *
 * Creates LLM clients based on AI configuration.
 */

import type { AIProviderId, AIFeatureId, FeatureModelConfig } from '@/lib/aiConfiguration'
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
import { ConsentError } from '@/ai/lib/ConsentError'
import { ProviderReconsentError } from '@/ai/lib/ProviderReconsentError'
import { isGranted, isGrantedForProvider, CONSENT_PURPOSES } from '@/lib/compliance/consentService'
import { useAuthStore } from '@/stores/useAuthStore'

/**
 * Enforces AI Tutor consent and provider re-consent for a feature before any
 * feature content is prepared for an LLM request.
 *
 * When `resolved` is omitted, resolves the feature model once. Callers that
 * already resolved the model (e.g. before RAG) should pass it so consent and
 * the subsequent LLM client use the same provider snapshot.
 */
export async function assertAIFeatureConsent(
  feature: AIFeatureId,
  resolved?: FeatureModelConfig
): Promise<FeatureModelConfig> {
  const userId = useAuthStore.getState().user?.id
  if (!userId) {
    throw new ConsentError(CONSENT_PURPOSES.AI_TUTOR)
  }

  const granted = await isGranted(userId, CONSENT_PURPOSES.AI_TUTOR)
  if (!granted) {
    throw new ConsentError(CONSENT_PURPOSES.AI_TUTOR)
  }

  const resolvedModel = resolved ?? resolveFeatureModel(feature)
  const effectiveProvider = (
    import.meta.env.DEV &&
    typeof window !== 'undefined' &&
    (window as unknown as Record<string, unknown>).__testForceProvider
  )
    ? (window as unknown as Record<string, string>).__testForceProvider as typeof resolvedModel.provider
    : resolvedModel.provider

  const providerGranted = await isGrantedForProvider(userId, CONSENT_PURPOSES.AI_TUTOR, effectiveProvider)
  if (!providerGranted) {
    throw new ProviderReconsentError(CONSENT_PURPOSES.AI_TUTOR, effectiveProvider)
  }

  return resolvedModel
}

export type GetLLMClientOptions = {
  /** Use this resolved config for the client build (must match consent checks). */
  resolved?: FeatureModelConfig
}

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
export async function getLLMClient(
  feature?: AIFeatureId,
  options?: GetLLMClientOptions
): Promise<LLMClient> {
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
    const resolved = options?.resolved ?? resolveFeatureModel(feature)
    await assertAIFeatureConsent(feature, resolved)

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
  // Consent guard (E119-S08): all LLM features require ai_tutor consent.
  // Fail-closed: no userId → consentService returns false → throw ConsentError.
  const userId = useAuthStore.getState().user?.id
  if (userId) {
    const granted = await isGranted(userId, CONSENT_PURPOSES.AI_TUTOR)
    if (!granted) {
      throw new ConsentError(CONSENT_PURPOSES.AI_TUTOR)
    }
  } else {
    // Not signed in — no consent record can exist; fail closed.
    throw new ConsentError(CONSENT_PURPOSES.AI_TUTOR)
  }

  const config = getAIConfiguration()

  // Allow E2E tests to override the global provider too.
  const effectiveGlobalProvider = (
    import.meta.env.DEV &&
    typeof window !== 'undefined' &&
    (window as unknown as Record<string, unknown>).__testForceProvider
  )
    ? (window as unknown as Record<string, string>).__testForceProvider as typeof config.provider
    : config.provider

  // Provider re-consent guard (E119-S09): verify the global provider matches consent evidence.
  const globalProviderGranted = await isGrantedForProvider(userId, CONSENT_PURPOSES.AI_TUTOR, effectiveGlobalProvider)
  if (!globalProviderGranted) {
    throw new ProviderReconsentError(CONSENT_PURPOSES.AI_TUTOR, effectiveGlobalProvider)
  }

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
  const supported: AIProviderId[] = [
    'openai',
    'anthropic',
    'groq',
    'gemini',
    'ollama',
    'openrouter',
    'glm',
  ]
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
  messages: LLMMessage[],
  resolvedSnapshot?: FeatureModelConfig
): AsyncGenerator<string, void, undefined> {
  const resolvedOnce = resolvedSnapshot ?? resolveFeatureModel(feature)
  await assertAIFeatureConsent(feature, resolvedOnce)
  let client = await getLLMClient(feature, { resolved: resolvedOnce })

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
      const defaultModel = PROVIDER_DEFAULTS[resolvedOnce.provider]

      if (resolvedOnce.model !== defaultModel) {
        console.warn(
          `[${feature}] Model "${resolvedOnce.model}" unavailable, falling back to "${defaultModel}". ` +
            'If this persists, check your API key or select a different model in Settings → AI Configuration.'
        )

        const apiKey = await getDecryptedApiKeyForProvider(resolvedOnce.provider)
        if (!apiKey) {
          throw new LLMError(
            `No API key configured for ${resolvedOnce.provider}. Please add or check your API key in Settings → AI Configuration.`,
            'AUTH_ERROR',
            resolvedOnce.provider
          )
        }

        client = getLLMClientForProvider(resolvedOnce.provider, apiKey, defaultModel)

        for await (const chunk of client.streamCompletion(messages)) {
          if (chunk.content) {
            yield chunk.content
          }
        }
        return
      }

      // Model IS the default — the API key itself is likely bad
      throw new LLMError(
        `Authentication failed for ${resolvedOnce.provider}. Please check your API key in Settings → AI Configuration.`,
        firstError.code,
        resolvedOnce.provider
      )
    }
    throw firstError
  }
}
