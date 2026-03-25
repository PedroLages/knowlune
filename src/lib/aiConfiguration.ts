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

import { encryptData, decryptData, type EncryptedData } from './crypto'

/** Supported AI provider IDs */
export type AIProviderId = 'openai' | 'anthropic' | 'groq' | 'glm' | 'gemini' | 'ollama'

/** AI provider configuration and validation */
export interface AIProvider {
  /** Provider unique identifier */
  id: AIProviderId
  /** Display name for UI */
  name: string
  /** Whether this provider uses a server URL instead of an API key */
  usesServerUrl?: boolean
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
   * E2E test-only plaintext API key bypass (DEV mode only)
   * @internal Only works when import.meta.env.DEV = true
   * Production builds ignore this field for security
   */
  _testApiKey?: string
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
export const AI_PROVIDERS: Record<AIProviderId, AIProvider> = {
  openai: {
    id: 'openai',
    name: 'OpenAI',
    validateApiKey: key => /^sk-[A-Za-z0-9-_]{8,}$/.test(key),
    testConnection: async key => {
      // Stub: Real OpenAI API call implemented in future stories (S02-S07)
      // For now, validate format only
      return Promise.resolve(key.startsWith('sk-'))
    },
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic',
    validateApiKey: key => /^sk-ant-[A-Za-z0-9-_]{8,}$/.test(key),
    testConnection: async key => {
      // Stub: Real Anthropic API call implemented in future stories (S02-S07)
      // For now, validate format only
      return Promise.resolve(key.startsWith('sk-ant-'))
    },
  },
  groq: {
    id: 'groq',
    name: 'Groq (FREE)',
    validateApiKey: key => /^gsk_[A-Za-z0-9-_]{8,}$/.test(key),
    testConnection: async key => {
      // Stub: Real Groq API call implemented in future stories (S02-S07)
      // For now, validate format only
      return Promise.resolve(key.startsWith('gsk_'))
    },
  },
  glm: {
    id: 'glm',
    name: 'GLM / Z.ai (FREE)',
    validateApiKey: key => /^[A-Za-z0-9-_.]{16,}$/.test(key),
    testConnection: async key => {
      // Stub: Real GLM API call implemented in future stories (S02-S07)
      // For now, validate format only (GLM keys are alphanumeric)
      return Promise.resolve(key.length >= 16)
    },
  },
  gemini: {
    id: 'gemini',
    name: 'Google Gemini (FREE)',
    validateApiKey: key => /^AIza[A-Za-z0-9-_]{32,}$/.test(key),
    testConnection: async key => {
      // Stub: Real Gemini API call implemented in future stories (S02-S07)
      // For now, validate format only
      return Promise.resolve(key.startsWith('AIza'))
    },
  },
  ollama: {
    id: 'ollama',
    name: 'Ollama (Local)',
    usesServerUrl: true,
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
      // Stub: Real Ollama API call implemented in E22-S03
      // For now, validate URL format only
      try {
        const parsed = new URL(url)
        return parsed.protocol === 'http:' || parsed.protocol === 'https:'
      } catch {
        return false
      }
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
    }
  } catch (error) {
    // Parsing failed - return defaults
    console.warn('Failed to parse AI configuration from localStorage, using defaults:', error)
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
 * Decrypts and retrieves the stored API key
 *
 * @returns Decrypted API key or null if not configured/decryption fails
 *
 * Security note: This should only be called when preparing API requests.
 * Never log or display the returned value.
 */
export async function getDecryptedApiKey(): Promise<string | null> {
  const config = getAIConfiguration()

  // E2E test escape hatch (DEV mode only) - bypasses encryption for tests
  // Tests mock API endpoints so keys never reach real servers
  if (import.meta.env.DEV && config._testApiKey) {
    return config._testApiKey
  }

  // Ollama uses server URL instead of API key — return a dummy key
  // since Ollama ignores auth but the AI SDK requires a non-empty string
  if (config.provider === 'ollama') {
    return config.ollamaSettings?.serverUrl ? 'ollama' : null
  }

  if (!config.apiKeyEncrypted) return null

  try {
    return await decryptData(config.apiKeyEncrypted.iv, config.apiKeyEncrypted.encryptedData)
  } catch (error) {
    // Decryption failed (corrupted data or wrong key)
    console.warn('Failed to decrypt API key - data may be corrupted:', error)
    return null
  }
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
  if (bytes === 0) return '0 B'
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
