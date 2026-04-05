/**
 * Whisper Provider Factory
 *
 * Reads WhisperConfig from localStorage and returns the configured provider.
 * No new encrypted storage — reuses existing keys from aiConfiguration and
 * whisperEndpointUrl from youtubeConfiguration.
 */

import type { WhisperConfig, WhisperProvider, WhisperProviderId } from './types'
import { WHISPER_STORAGE_KEY, WHISPER_DEFAULTS } from './types'

/** Get current Whisper configuration */
export function getWhisperConfig(): WhisperConfig {
  try {
    const raw = localStorage.getItem(WHISPER_STORAGE_KEY)
    if (!raw) return { ...WHISPER_DEFAULTS }
    return { ...WHISPER_DEFAULTS, ...JSON.parse(raw) }
  } catch {
    return { ...WHISPER_DEFAULTS }
  }
}

/** Save Whisper configuration */
export function saveWhisperConfig(config: Partial<WhisperConfig>): WhisperConfig {
  const current = getWhisperConfig()
  const updated = { ...current, ...config }
  localStorage.setItem(WHISPER_STORAGE_KEY, JSON.stringify(updated))
  window.dispatchEvent(new CustomEvent('whisper-configuration-updated'))
  return updated
}

/** Lazily resolve the active Whisper provider */
export async function getWhisperProvider(
  providerId?: WhisperProviderId,
): Promise<WhisperProvider> {
  const config = getWhisperConfig()
  const id = providerId ?? config.provider

  switch (id) {
    case 'browser': {
      const { BrowserWhisperProvider } = await import('./browserProvider')
      return new BrowserWhisperProvider(config.browserModel ?? 'tiny')
    }
    case 'groq': {
      const { CloudWhisperProvider } = await import('./cloudProvider')
      return new CloudWhisperProvider('groq')
    }
    case 'openai': {
      const { CloudWhisperProvider } = await import('./cloudProvider')
      return new CloudWhisperProvider('openai')
    }
    case 'self-hosted': {
      const { SelfHostedWhisperProvider } = await import('./selfHostedProvider')
      return new SelfHostedWhisperProvider()
    }
    default:
      throw new Error(`Unknown Whisper provider: ${id}`)
  }
}

// Re-export types for convenience
export type {
  WhisperConfig,
  WhisperProvider,
  WhisperProviderId,
  WhisperTranscription,
  WhisperProgress,
} from './types'
export { WHISPER_DEFAULTS, WHISPER_STORAGE_KEY } from './types'
