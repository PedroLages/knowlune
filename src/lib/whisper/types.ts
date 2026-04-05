/**
 * Whisper Transcription Provider Types
 *
 * Multi-tier Whisper integration supporting:
 * - Browser: @xenova/transformers WASM (zero config, free)
 * - Cloud: Groq/OpenAI API (BYOK, fast)
 * - Self-hosted: Speaches/faster-whisper (Docker, free)
 */

/** Supported Whisper provider backends */
export type WhisperProviderId = 'browser' | 'groq' | 'openai' | 'self-hosted'

/** Result of a transcription operation */
export interface WhisperTranscription {
  /** WebVTT format transcript with timestamps */
  vtt: string
  /** Detected or specified language code (e.g., 'en') */
  language: string
  /** Audio duration in seconds (if available) */
  duration?: number
}

/** Progress info during transcription */
export interface WhisperProgress {
  stage: 'downloading-model' | 'loading-model' | 'transcribing'
  percent: number
}

/** Whisper provider configuration stored in localStorage */
export interface WhisperConfig {
  /** Active provider */
  provider: WhisperProviderId
  /** Browser model size (default: 'tiny') */
  browserModel?: 'tiny' | 'base'
  // Cloud providers reuse API keys from aiConfiguration.ts (Groq/OpenAI)
  // Self-hosted reuses whisperEndpointUrl from youtubeConfiguration.ts
}

/** Provider interface that all backends implement */
export interface WhisperProvider {
  readonly id: WhisperProviderId
  readonly name: string
  /** Check if this provider is usable (e.g., API key configured, server reachable) */
  isAvailable(): Promise<boolean>
  /** Transcribe audio blob to VTT */
  transcribe(
    audio: Blob,
    lang?: string,
    onProgress?: (progress: WhisperProgress) => void
  ): Promise<WhisperTranscription>
}

/** localStorage key for Whisper configuration */
export const WHISPER_STORAGE_KEY = 'whisper-configuration'

/** Default Whisper configuration */
export const WHISPER_DEFAULTS: WhisperConfig = {
  provider: 'browser',
  browserModel: 'tiny',
}
