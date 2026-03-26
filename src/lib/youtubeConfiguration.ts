/**
 * YouTube Configuration Management
 *
 * Manages YouTube-specific settings with encrypted API key storage:
 * - YouTube Data API v3 key (encrypted via Web Crypto AES-GCM)
 * - yt-dlp server URL (optional, for transcript extraction)
 * - Whisper endpoint URL (optional, for audio transcription)
 * - Metadata cache TTL (default 7 days)
 *
 * Follows the same encrypted storage pattern as `src/lib/aiConfiguration.ts`.
 * Keys are encrypted before persistence and never stored in plaintext.
 *
 * Security: API key encrypted with session-scoped AES-GCM key via `src/lib/crypto.ts`.
 * The key is never visible in source code, build output, or client-accessible storage (NFR72).
 */

import { encryptData, decryptData, type EncryptedData } from './crypto'

/** YouTube configuration state */
export interface YouTubeConfig {
  /** Encrypted YouTube Data API v3 key (never stored plaintext) */
  apiKeyEncrypted?: EncryptedData
  /** yt-dlp server URL for transcript extraction (optional) */
  ytDlpServerUrl?: string
  /** Whisper endpoint URL for audio transcription (optional) */
  whisperEndpointUrl?: string
  /** Metadata cache TTL in days (default: 7) */
  cacheTtlDays: number
  /**
   * E2E test-only plaintext API key bypass (DEV mode only)
   * @internal Only works when import.meta.env.DEV = true
   */
  _testApiKey?: string
}

/** localStorage key for YouTube configuration */
const STORAGE_KEY = 'youtube-configuration'

/** Default cache TTL in days */
export const DEFAULT_CACHE_TTL_DAYS = 7

/** Minimum cache TTL in days */
export const MIN_CACHE_TTL_DAYS = 1

/** Maximum cache TTL in days */
export const MAX_CACHE_TTL_DAYS = 30

/** Default YouTube configuration */
export const YOUTUBE_DEFAULTS: YouTubeConfig = {
  cacheTtlDays: DEFAULT_CACHE_TTL_DAYS,
}

/**
 * Validates YouTube Data API v3 key format
 *
 * YouTube API keys follow the pattern: AIza[A-Za-z0-9-_]{35}
 * Same format as Google Cloud API keys (39 characters total).
 *
 * @param key - API key string to validate
 * @returns True if the key matches the expected format
 */
export function validateYouTubeApiKey(key: string): boolean {
  // Google API keys: AIza followed by 35 alphanumeric/dash/underscore chars
  return /^AIza[A-Za-z0-9-_]{35}$/.test(key)
}

/**
 * Retrieves YouTube configuration from localStorage
 *
 * @returns Current YouTube configuration or defaults if not set
 */
export function getYouTubeConfiguration(): YouTubeConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...YOUTUBE_DEFAULTS }

    const stored = JSON.parse(raw) as Partial<YouTubeConfig>
    return {
      ...YOUTUBE_DEFAULTS,
      ...stored,
      // Clamp TTL to valid range
      cacheTtlDays: Math.max(
        MIN_CACHE_TTL_DAYS,
        Math.min(MAX_CACHE_TTL_DAYS, stored.cacheTtlDays ?? DEFAULT_CACHE_TTL_DAYS)
      ),
    }
  } catch (error) {
    console.warn('Failed to parse YouTube configuration from localStorage, using defaults:', error)
    return { ...YOUTUBE_DEFAULTS }
  }
}

/**
 * Saves YouTube configuration to localStorage with optional API key encryption
 *
 * Side effects:
 * - Persists to localStorage
 * - Dispatches 'youtube-configuration-updated' event for cross-tab sync
 *
 * @param settings - Partial configuration updates to merge with current settings
 * @param apiKey - Optional plaintext API key (will be encrypted before storage)
 * @returns Updated configuration state
 */
export async function saveYouTubeConfiguration(
  settings: Partial<YouTubeConfig>,
  apiKey?: string
): Promise<YouTubeConfig> {
  const current = getYouTubeConfiguration()
  let updated = { ...current, ...settings }

  // Encrypt API key if provided
  if (apiKey) {
    const encrypted = await encryptData(apiKey)
    updated = { ...updated, apiKeyEncrypted: encrypted }
  }

  // Clamp TTL to valid range before saving
  updated.cacheTtlDays = Math.max(
    MIN_CACHE_TTL_DAYS,
    Math.min(MAX_CACHE_TTL_DAYS, updated.cacheTtlDays)
  )

  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))

  // Dispatch custom event for same-tab + cross-tab synchronization
  window.dispatchEvent(new CustomEvent('youtube-configuration-updated'))

  return updated
}

/**
 * Decrypts and retrieves the stored YouTube API key
 *
 * @returns Decrypted API key or null if not configured/decryption fails
 *
 * Security note: Only call when preparing API requests. Never log or display.
 */
export async function getDecryptedYouTubeApiKey(): Promise<string | null> {
  const config = getYouTubeConfiguration()

  // E2E test escape hatch (DEV mode only)
  if (import.meta.env.DEV && config._testApiKey) {
    return config._testApiKey
  }

  if (!config.apiKeyEncrypted) return null

  try {
    return await decryptData(config.apiKeyEncrypted.iv, config.apiKeyEncrypted.encryptedData)
  } catch (error) {
    console.warn('Failed to decrypt YouTube API key - data may be corrupted:', error)
    return null
  }
}

/**
 * Checks if YouTube API is configured (has an encrypted key)
 *
 * @returns True if a YouTube API key has been saved
 */
export function isYouTubeConfigured(): boolean {
  const config = getYouTubeConfiguration()
  if (import.meta.env.DEV && config._testApiKey) return true
  return !!config.apiKeyEncrypted
}

/**
 * Clears the stored YouTube API key
 *
 * @returns Updated configuration without the API key
 */
export async function clearYouTubeApiKey(): Promise<YouTubeConfig> {
  const current = getYouTubeConfiguration()
  const updated = { ...current }
  delete updated.apiKeyEncrypted
  delete updated._testApiKey

  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  window.dispatchEvent(new CustomEvent('youtube-configuration-updated'))

  return updated
}

/**
 * Gets the cache TTL in milliseconds (for use with Date comparisons)
 *
 * @returns Cache TTL in milliseconds
 */
export function getCacheTtlMs(): number {
  const config = getYouTubeConfiguration()
  return config.cacheTtlDays * 24 * 60 * 60 * 1000
}
