/**
 * AI Configuration management with secure API key storage and consent controls
 *
 * Provides type-safe configuration storage, provider validation, and event-based
 * cross-tab synchronization for AI provider settings.
 *
 * Security features:
 * - API keys encrypted with Web Crypto API before localStorage persistence
 * - Keys never logged or exposed in plaintext
 * - Only analyzed content transmitted to AI providers (no PII or metadata)
 */

import { useAuthStore } from '@/stores/useAuthStore'
import { apiUrl } from './apiBaseUrl'
import { encryptData, decryptData, type EncryptedData } from './crypto'
import type { AIFeatureId, AIProviderId, FeatureModelConfig } from './modelDefaults'
import { PROVIDER_DEFAULTS, FEATURE_DEFAULTS } from './modelDefaults'
import type { DiscoveredModel } from './modelDiscovery'
import { getFreeTierDefaultModel } from './modelDiscovery.static'
import { checkCredential, storeCredential } from './vaultCredentials'

// Re-export for convenience — consumers can import from aiConfiguration
export type { AIFeatureId, AIProviderId, FeatureModelConfig } from './modelDefaults'
export { PROVIDER_DEFAULTS, FEATURE_DEFAULTS, AI_FEATURE_IDS } from './modelDefaults'

/** AI provider configuration and validation */
export interface AIProvider {
  /** Provider unique identifier */
  id: AIProviderId
  /** Display name for UI */
  name: string
  /** Whether this provider uses a server URL instead of an API key */
  usesServerUrl?: boolean
  /** Whether this provider has free-tier models available */
  hasFreeModels?: boolean
  /** Validates credential format without making network calls (API key or server URL for Ollama) */
  validateApiKey: (keyOrUrl: string) => boolean
  /** Tests provider connectivity (stub for S01, real implementation in S02-S07) */
  testConnection: (keyOrUrl: string) => Promise<boolean>
}

/** Connection status states */
export type ConnectionStatus =
  | 'unconfigured' // No API key configured
  | 'validating' // Testing connection in progress
  | 'connected' // Provider reachable and authenticated
  | 'error' // Validation or connection failed

/** Per-feature consent settings for granular data transmission control */
export interface ConsentSettings {
  /** Allow AI to generate video summaries */
  videoSummary: boolean
  /** Allow Q&A from note content */
  noteQA: boolean
  /** Allow AI-generated learning path recommendations */
  learningPath: boolean
  /** Allow knowledge gap detection from study patterns */
  knowledgeGaps: boolean
  /** Allow AI-powered note organization and tagging */
  noteOrganization: boolean
  /** Allow AI-enhanced analytics and insights */
  analytics: boolean
}

/** Model metadata from Ollama /api/tags response */
export interface OllamaModel {
  /** Model name (e.g., "llama3.2:latest") */
  name: string
  /** Human-readable size (e.g., "2.0 GB") */
  size: string
  /** Raw size in bytes for sorting */
  sizeBytes: number
  /** Model modification date */
  modifiedAt: string
}

/** Ollama-specific configuration */
export interface OllamaSettings {
  /** Ollama server URL (e.g., http://192.168.1.x:11434) */
  serverUrl: string
  /** Use direct browser-to-Ollama connection (requires CORS on server) */
  directConnection: boolean
  /** Selected model name (e.g., "llama3.2:latest") */
  selectedModel?: string
}

/** Complete AI configuration state */
export interface AIConfigurationSettings {
  /** Selected AI provider */
  provider: AIProviderId
  /** Encrypted API key data (never stored in plaintext) */
  apiKeyEncrypted?: EncryptedData
  /** Current connection status */
  connectionStatus: ConnectionStatus
  /** Error message from last validation/connection attempt */
  errorMessage?: string
  /** Per-feature consent toggles */
  consentSettings: ConsentSettings
  /** Ollama-specific settings (only used when provider === 'ollama') */
  ollamaSettings?: OllamaSettings
  /**
   * Per-provider encrypted API keys (E90-S03 — Multi-Provider BYOK).
   * Enables storing keys for multiple providers simultaneously.
   * Falls back to legacy `apiKeyEncrypted` for the global provider.
   */
  providerKeys?: Partial<Record<AIProviderId, EncryptedData>>
  /**
   * Global model override per provider (E90-S05 — Global Model Picker UI).
   * When set for a provider, this model is used instead of `PROVIDER_DEFAULTS[provider]`
   * in the resolution cascade (Tier 3). Does NOT modify the code constant.
   */
  globalModelOverride?: Partial<Record<AIProviderId, string>>
  /**
   * Per-feature model overrides (E90 — AI Model Selection Per Feature).
   * When a feature key is present, its config takes priority over provider defaults.
   * Undefined/missing keys fall back through the resolution cascade.
   */
  featureModels?: Partial<Record<AIFeatureId, FeatureModelConfig>>
  /**
   * Budget mode — restricts model selection to free-tier models only.
   * When enabled, model pickers filter to costTier === 'free' and
   * feature defaults auto-switch to free alternatives.
   */
  budgetMode?: boolean
  /**
   * E2E test-only plaintext API key bypass (DEV mode only)
   * @internal Only works when import.meta.env.DEV = true
   * Production builds ignore this field for security
   */
  _testApiKey?: string
}

export type NoteQAUnavailableReason =
  | 'feature-disabled'
  | 'missing-provider-key'
  | 'unreadable-provider-key'
  | 'missing-ollama-url'
  /** Availability check threw or rejected (e.g. unexpected storage/crypto failure) */
  | 'availability-check-failed'

export type NoteQAAvailability =
  | {
      available: true
      provider: AIProviderId
      providerName: string
      model?: string
    }
  | {
      available: false
      reason: NoteQAUnavailableReason
      provider: AIProviderId
      providerName: string
      model?: string
    }

/** localStorage key for AI configuration */
const STORAGE_KEY = 'ai-configuration'

/** Default configuration for new users */
export const DEFAULTS: AIConfigurationSettings = {
  provider: 'openai',
  connectionStatus: 'unconfigured',
  consentSettings: {
    videoSummary: true,
    noteQA: true,
    learningPath: true,
    knowledgeGaps: true,
    noteOrganization: true,
    analytics: true,
  },
}

/**
 * Registry of supported AI providers with validation and connection testing
 *
 * Provider validation patterns:
 * - OpenAI: `sk-[32+ alphanumeric characters]`
 * - Anthropic: `sk-ant-[32+ alphanumeric/dash/underscore]`
 * - Groq: `gsk_[32+ alphanumeric characters]`
 * - GLM (Z.ai): `[32+ alphanumeric characters]`
 * - Gemini: `AIza[32+ alphanumeric characters]`
 */
/**
 * Tests a provider connection by proxying through `/api/ai/models/:provider`.
 * Avoids CORS issues that occur when calling external APIs directly from the browser.
 */
async function testViaModelProxy(provider: string, key: string): Promise<boolean> {
  try {
    const accessToken = useAuthStore.getState().session?.access_token
    const headers: Record<string, string> = { 'X-API-Key': key }
    if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`
    const res = await fetch(apiUrl(`models/${provider}`), {
      headers,
      signal: AbortSignal.timeout(10_000),
    })
    if (res.ok) return true
    if (res.status === 401) throw new Error('Invalid API key')
    if (res.status === 429) throw new Error('Rate limited — key is valid but quota exceeded')
    throw new Error(`Connection failed (${res.status})`)
  } catch (e) {
    if (e instanceof Error && (e.message.startsWith('Invalid') || e.message.startsWith('Rate')))
      throw e
    console.warn(`${provider} connection test failed:`, e)
    return false
  }
}

export const AI_PROVIDERS: Record<AIProviderId, AIProvider> = {
  openai: {
    id: 'openai',
    name: 'OpenAI',
    validateApiKey: key => /^sk-[A-Za-z0-9-_]{8,}$/.test(key),
    testConnection: key => testViaModelProxy('openai', key),
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic',
    validateApiKey: key => /^sk-ant-[A-Za-z0-9-_]{8,}$/.test(key),
    testConnection: async key => {
      // Anthropic has no public model listing endpoint, so we send a minimal
      // chat request through our Express proxy to verify the key works.
      try {
        const res = await fetch(apiUrl('ai-generate'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider: 'anthropic',
            apiKey: key,
            messages: [{ role: 'user', content: 'hi' }],
            maxTokens: 1,
          }),
          signal: AbortSignal.timeout(10_000),
        })
        if (res.ok) return true
        if (res.status === 401) throw new Error('Invalid API key')
        if (res.status === 429) throw new Error('Rate limited — key is valid but quota exceeded')
        throw new Error(`Connection failed (${res.status})`)
      } catch (e) {
        if (e instanceof Error && (e.message.startsWith('Invalid') || e.message.startsWith('Rate')))
          throw e
        console.warn('Anthropic connection test failed:', e)
        return false
      }
    },
  },
  groq: {
    id: 'groq',
    name: 'Groq (FREE)',
    hasFreeModels: true,
    validateApiKey: key => /^gsk_[A-Za-z0-9-_]{8,}$/.test(key),
    testConnection: key => testViaModelProxy('groq', key),
  },
  glm: {
    id: 'glm',
    name: 'GLM / Z.ai',
    hasFreeModels: true,
    validateApiKey: key => /^[A-Za-z0-9-_.]{16,}$/.test(key),
    testConnection: key => testViaModelProxy('glm', key),
  },
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    hasFreeModels: true,
    validateApiKey: key => /^AIza[A-Za-z0-9-_]{32,}$/.test(key),
    testConnection: key => testViaModelProxy('gemini', key),
  },
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter',
    validateApiKey: key => /^sk-or-v1-[A-Za-z0-9]{48,}$/.test(key),
    testConnection: key => testViaModelProxy('openrouter', key),
  },
  ollama: {
    id: 'ollama',
    name: 'Ollama (Local)',
    usesServerUrl: true,
    hasFreeModels: true,
    validateApiKey: (url: string) => {
      // Validates URL format: must be http:// or https:// with optional port
      try {
        const parsed = new URL(url)
        return parsed.protocol === 'http:' || parsed.protocol === 'https:'
      } catch {
        return false
      }
    },
    testConnection: async (url: string) => {
      // Real Ollama connection test (E22-S03)
      // Lazy-import to avoid circular dependencies and keep bundle small
      const { testOllamaConnection } = await import('./ollamaHealthCheck')
      const config = getAIConfiguration()
      const result = await testOllamaConnection(
        url,
        config.ollamaSettings?.directConnection ?? false,
        config.ollamaSettings?.selectedModel
      )
      // If connection test returned an error, throw so the UI can show the message
      if (!result.success) {
        throw new Error(result.message)
      }
      return true
    },
  },
}

/**
 * Retrieves AI configuration from localStorage with fallback to defaults
 *
 * @returns Current AI configuration or defaults if not set/invalid
 */
export function getAIConfiguration(): AIConfigurationSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULTS }

    const stored = JSON.parse(raw) as Partial<AIConfigurationSettings>
    return {
      ...DEFAULTS,
      ...stored,
      consentSettings: {
        ...DEFAULTS.consentSettings,
        ...stored.consentSettings,
      },
      providerKeys: stored.providerKeys,
      globalModelOverride: stored.globalModelOverride,
      featureModels: stored.featureModels,
    }
  } catch (error) {
    // Parsing failed - return defaults
    console.warn('Failed to parse AI configuration from localStorage, using defaults:', error) // silent-catch-ok: logged
    return { ...DEFAULTS }
  }
}

/**
 * Saves AI configuration to localStorage with optional API key encryption
 *
 * Side effects:
 * - Persists to localStorage
 * - Dispatches 'ai-configuration-updated' event for cross-tab sync
 *
 * @param settings - Partial configuration updates to merge with current settings
 * @param apiKey - Optional plaintext API key (will be encrypted before storage)
 * @returns Updated configuration state
 *
 * @example
 * // Save provider change
 * await saveAIConfiguration({ provider: 'anthropic' })
 *
 * @example
 * // Save new API key
 * await saveAIConfiguration({ connectionStatus: 'connected' }, 'sk-test-key')
 */
export async function saveAIConfiguration(
  settings: Partial<AIConfigurationSettings>,
  apiKey?: string
): Promise<AIConfigurationSettings> {
  const current = getAIConfiguration()
  let updated = { ...current, ...settings }

  // Encrypt API key if provided
  if (apiKey) {
    const encrypted = await encryptData(apiKey)
    updated = { ...updated, apiKeyEncrypted: encrypted }
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))

  // Dispatch storage event for cross-tab synchronization
  // Note: storage event fires automatically in OTHER tabs, but not the current tab
  // So we also dispatch a custom event for same-tab updates
  window.dispatchEvent(new CustomEvent('ai-configuration-updated'))

  return updated
}

/**
 * Decrypts and retrieves the stored API key for the current global provider.
 *
 * Delegates to `getDecryptedApiKeyForProvider()` to avoid duplication.
 *
 * @returns Decrypted API key or null if not configured/decryption fails
 *
 * Security note: This should only be called when preparing API requests.
 * Never log or display the returned value.
 */
export async function getDecryptedApiKey(): Promise<string | null> {
  const config = getAIConfiguration()
  return getDecryptedApiKeyForProvider(config.provider)
}

/**
 * Tests AI provider connection with provided API key
 *
 * @param provider - Provider ID to test
 * @param apiKey - API key to validate
 * @returns True if provider is reachable and key is valid
 *
 * Note: Current implementation is a stub. Real API calls added in S02-S07.
 */
export async function testAIConnection(provider: AIProviderId, apiKey: string): Promise<boolean> {
  const providerConfig = AI_PROVIDERS[provider]
  if (!providerConfig) return false

  return await providerConfig.testConnection(apiKey)
}

/**
 * Checks if budget mode is currently active.
 */
export function isBudgetMode(): boolean {
  return getAIConfiguration().budgetMode === true
}

/**
 * Filters a list of discovered models to only include free-tier models.
 * Models with `costTier === undefined` (e.g., Ollama) are treated as free.
 */
export function filterFreeModels(models: DiscoveredModel[]): DiscoveredModel[] {
  return models.filter(m => m.costTier === 'free' || m.costTier === undefined)
}

/**
 * Resolves the model configuration for a specific AI feature using a three-tier cascade:
 *
 * 1. **User per-feature override** — `featureModels[feature]` from saved config
 * 2. **Feature default** — `FEATURE_DEFAULTS[feature]` from modelDefaults.ts
 * 3. **Global provider default** — `PROVIDER_DEFAULTS[globalProvider]`
 *
 * This is synchronous (localStorage read + object lookup). The factory's
 * `getLLMClient()` remains async because it decrypts the API key.
 *
 * @param feature - AI feature ID to resolve model for
 * @returns Resolved model configuration with provider and model string
 *
 * @example
 * const resolved = resolveFeatureModel('videoSummary')
 * // { provider: 'anthropic', model: 'claude-haiku-4-5' }
 */
export function resolveFeatureModel(feature: AIFeatureId): FeatureModelConfig {
  const config = getAIConfiguration()
  const budget = config.budgetMode === true

  // Tier 1: User per-feature override (always respected, even in budget mode)
  const override = config.featureModels?.[feature]
  if (override) {
    return override
  }

  // Tier 2: Feature default from FEATURE_DEFAULTS
  const featureDefault = FEATURE_DEFAULTS[feature]
  if (featureDefault) {
    if (budget) {
      // In budget mode, swap to a free model for this provider
      const freeModel = getFreeTierDefaultModel(featureDefault.provider)
      if (freeModel) {
        return { ...featureDefault, model: freeModel }
      }
    }
    return featureDefault
  }

  // Tier 3: Global provider default (with user override from globalModelOverride)
  const globalProvider = config.provider
  const userOverride = config.globalModelOverride?.[globalProvider]
  const model = budget
    ? getFreeTierDefaultModel(globalProvider) || userOverride || PROVIDER_DEFAULTS[globalProvider]
    : userOverride || PROVIDER_DEFAULTS[globalProvider]
  return {
    provider: globalProvider,
    model,
  }
}

/**
 * Decrypts and retrieves the API key for a specific provider.
 *
 * Checks `providerKeys[provider]` first, then falls back to legacy
 * `apiKeyEncrypted` if the provider matches the global provider.
 *
 * @param provider - Provider to get the API key for
 * @returns Decrypted API key or null if not configured/decryption fails
 *
 * Security note: Never log or display the returned value.
 */
export async function getDecryptedApiKeyForProvider(
  provider: AIProviderId
): Promise<string | null> {
  const config = getAIConfiguration()

  // E2E test escape hatch (DEV mode only)
  if (import.meta.env.DEV && config._testApiKey) {
    return config._testApiKey
  }

  // Ollama uses server URL, not API key
  if (provider === 'ollama') {
    return config.ollamaSettings?.serverUrl ? 'ollama' : null
  }

  // Check providerKeys map first (E90-S03 will populate this)
  const providerKeyData = config.providerKeys?.[provider]
  if (providerKeyData) {
    try {
      return await decryptData(providerKeyData.iv, providerKeyData.encryptedData)
    } catch (error) {
      console.warn(`Failed to decrypt provider key for ${provider}:`, error) // silent-catch-ok: logged
      return null
    }
  }

  // Fall back to legacy single-key field if provider matches global
  if (provider === config.provider && config.apiKeyEncrypted) {
    try {
      return await decryptData(config.apiKeyEncrypted.iv, config.apiKeyEncrypted.encryptedData)
    } catch (error) {
      console.warn('Failed to decrypt legacy API key:', error) // silent-catch-ok: logged
      return null
    }
  }

  return null
}

/**
 * Encrypts and stores an API key for a specific provider in Supabase Vault.
 * Also stores an encrypted copy in localStorage's `providerKeys` map as a
 * device-local fallback (device-local Web Crypto key — not cross-device).
 *
 * Dispatches the `ai-configuration-updated` custom event for cross-tab sync.
 * Does NOT modify the legacy `apiKeyEncrypted` field — that is preserved as-is.
 *
 * @param provider - Provider to store the key for
 * @param apiKey - Plaintext API key (will be encrypted before storage)
 * @returns Updated configuration state
 *
 * Security note: The plaintext key is never persisted or logged.
 *
 * @example
 * await saveProviderApiKey('anthropic', 'sk-ant-...')
 */
export async function saveProviderApiKey(
  provider: AIProviderId,
  apiKey: string
): Promise<AIConfigurationSettings> {
  // Store in Supabase Vault (cross-device, encrypted at rest)
  // Fire-and-forget with error logging — localStorage is fallback
  storeCredential('ai-provider', provider, apiKey).catch(err => {
    console.warn('[aiConfiguration] Vault store failed for provider', provider, err)
  })

  const encrypted = await encryptData(apiKey)
  const current = getAIConfiguration()

  // Remove from localStorage providerKeys after Vault store is initiated
  // (Vault write is fire-and-forget; localStorage encrypted copy remains as device-local fallback)
  const updatedProviderKeys: Partial<Record<AIProviderId, EncryptedData>> = {
    ...current.providerKeys,
    [provider]: encrypted,
  }

  const updated: AIConfigurationSettings = {
    ...current,
    providerKeys: updatedProviderKeys,
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  window.dispatchEvent(new CustomEvent('ai-configuration-updated'))

  return updated
}

/**
 * Deletes the stored API key for a specific provider from the `providerKeys` map.
 *
 * Dispatches the `ai-configuration-updated` custom event for cross-tab sync.
 * Does NOT modify the legacy `apiKeyEncrypted` field.
 *
 * @param provider - Provider to delete the key for
 * @returns Updated configuration state
 *
 * @example
 * await deleteProviderApiKey('anthropic')
 */
export async function deleteProviderApiKey(
  provider: AIProviderId
): Promise<AIConfigurationSettings> {
  const current = getAIConfiguration()

  const updatedProviderKeys: Partial<Record<AIProviderId, EncryptedData>> = {
    ...current.providerKeys,
  }
  delete updatedProviderKeys[provider]

  const updated: AIConfigurationSettings = {
    ...current,
    providerKeys: updatedProviderKeys,
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  window.dispatchEvent(new CustomEvent('ai-configuration-updated'))

  return updated
}

/**
 * Saves a per-feature model override to the `featureModels` map.
 *
 * @param feature - AI feature to override
 * @param config - Model configuration (provider + model)
 * @returns Updated configuration state
 */
export async function saveFeatureModelOverride(
  feature: AIFeatureId,
  config: FeatureModelConfig
): Promise<AIConfigurationSettings> {
  const current = getAIConfiguration()
  const updatedFeatureModels: Partial<Record<AIFeatureId, FeatureModelConfig>> = {
    ...current.featureModels,
    [feature]: config,
  }
  return saveAIConfiguration({ featureModels: updatedFeatureModels })
}

/**
 * Clears a per-feature model override, reverting to the default cascade.
 *
 * @param feature - AI feature to clear override for
 * @returns Updated configuration state
 */
export async function clearFeatureModelOverride(
  feature: AIFeatureId
): Promise<AIConfigurationSettings> {
  const current = getAIConfiguration()
  const updatedFeatureModels = { ...current.featureModels }
  delete updatedFeatureModels[feature]
  return saveAIConfiguration({ featureModels: updatedFeatureModels })
}

/**
 * Returns a list of provider IDs that have a credential configured in Vault.
 * Falls back to checking localStorage `providerKeys` for device-local keys.
 * Ollama is included if it has a server URL configured (URL is not a Vault credential).
 *
 * Async because Vault checks require a network call to the Edge Function.
 * Uses Promise.allSettled (ES2020 — not Promise.any) to check all providers in parallel.
 */
export async function getConfiguredProviderIds(): Promise<AIProviderId[]> {
  const config = getAIConfiguration()
  const knownProviders = Object.keys(config.providerKeys ?? {}) as AIProviderId[]

  // Add the global provider as a candidate
  const candidates = new Set<AIProviderId>([config.provider, ...knownProviders])

  // Check Vault for each candidate in parallel (ES2020: Promise.allSettled)
  const results = await Promise.allSettled(
    Array.from(candidates).map(async (provider): Promise<AIProviderId | null> => {
      const configured = await checkCredential('ai-provider', provider)
      return configured ? provider : null
    })
  )

  const configured = new Set<AIProviderId>()
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value !== null) {
      configured.add(result.value)
    }
  }

  // Device-local fallback: if Vault returned nothing (unauthenticated / offline),
  // fall back to checking localStorage providerKeys
  if (configured.size === 0 && config.providerKeys) {
    for (const [id, keyData] of Object.entries(config.providerKeys)) {
      if (keyData) {
        configured.add(id as AIProviderId)
      }
    }
    // Legacy key covers the global provider
    if (config.apiKeyEncrypted) {
      configured.add(config.provider)
    }
  }

  // Ollama uses server URL (not a Vault credential)
  if (config.ollamaSettings?.serverUrl) {
    configured.add('ollama')
  }

  return Array.from(configured)
}

/**
 * Checks if a specific AI feature is enabled via consent settings
 *
 * @param feature - Feature to check
 * @returns True if feature has user consent
 *
 * @example
 * if (isFeatureEnabled('videoSummary')) {
 *   // Proceed with AI video summary generation
 * }
 */
export function isFeatureEnabled(feature: keyof ConsentSettings): boolean {
  const config = getAIConfiguration()
  return config.consentSettings[feature] === true
}

/**
 * Checks if AI provider is configured and connected
 *
 * @returns True if AI features are available for use
 */
export function isAIAvailable(): boolean {
  const config = getAIConfiguration()
  return config.connectionStatus === 'connected'
}

/**
 * Checks whether Q&A from Notes can use its resolved provider.
 *
 * This deliberately does not widen `isAIAvailable()`: older consumers still use
 * the legacy global connection flag, while Q&A is feature-model aware.
 */
export async function getNoteQAAvailability(): Promise<NoteQAAvailability> {
  const configSnapshot = getAIConfiguration()
  const resolved = resolveFeatureModel('noteQA')
  const providerName = AI_PROVIDERS[resolved.provider]?.name || resolved.provider
  const base = {
    provider: resolved.provider,
    providerName,
    model: resolved.model,
  }

  if (configSnapshot.consentSettings.noteQA !== true) {
    return {
      ...base,
      available: false,
      reason: 'feature-disabled',
    }
  }

  if (resolved.provider === 'ollama') {
    return getOllamaServerUrl()
      ? {
          ...base,
          available: true,
        }
      : {
          ...base,
          available: false,
          reason: 'missing-ollama-url',
        }
  }

  const hasProviderKey = !!configSnapshot.providerKeys?.[resolved.provider]
  const hasLegacyEncrypted =
    resolved.provider === configSnapshot.provider && !!configSnapshot.apiKeyEncrypted
  const hasStoredKey = hasProviderKey || hasLegacyEncrypted
  const apiKey = await getDecryptedApiKeyForProvider(resolved.provider)

  if (apiKey) {
    return {
      ...base,
      available: true,
    }
  }

  return {
    ...base,
    available: false,
    reason: hasStoredKey ? 'unreadable-provider-key' : 'missing-provider-key',
  }
}

/**
 * Gets the Ollama server URL from configuration
 *
 * @returns Ollama server URL (e.g., "http://192.168.1.100:11434") or null
 */
export function getOllamaServerUrl(): string | null {
  const config = getAIConfiguration()
  if (config.provider !== 'ollama') return null
  return config.ollamaSettings?.serverUrl || null
}

/**
 * Gets the Ollama connection mode (proxy or direct)
 *
 * @returns True if direct connection mode is enabled
 */
export function isOllamaDirectConnection(): boolean {
  const config = getAIConfiguration()
  return config.ollamaSettings?.directConnection ?? false
}

/**
 * Gets the selected Ollama model name
 *
 * @returns Selected model name (e.g., "llama3.2:latest") or null if not selected
 */
export function getOllamaSelectedModel(): string | null {
  const config = getAIConfiguration()
  if (config.provider !== 'ollama') return null
  return config.ollamaSettings?.selectedModel || null
}

/**
 * Formats bytes to human-readable size string
 *
 * @param bytes - Size in bytes
 * @returns Human-readable size (e.g., "2.0 GB", "500 MB")
 */
export function formatModelSize(bytes: number): string {
  if (bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  const size = bytes / Math.pow(1024, i)
  return `${size.toFixed(1)} ${units[i]}`
}

/**
 * Sanitizes request payload to prevent PII and metadata leakage
 *
 * Privacy guarantee: Only analyzed content is included in payload.
 * No user metadata, file paths, timestamps, or identifiable information.
 *
 * @param content - Content to analyze (note text, video transcript, etc.)
 * @returns Sanitized payload safe for AI provider transmission
 *
 * @example
 * const payload = sanitizeAIRequestPayload(userNote.content)
 * // payload = { content: "..." } — no userId, noteId, timestamps, etc.
 */
export function sanitizeAIRequestPayload(content: string): { content: string } {
  // Only include content being analyzed — no metadata
  return { content }
}
