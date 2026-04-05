/**
 * Self-Hosted Whisper Provider
 *
 * Wraps the existing Speaches/faster-whisper integration exposed via
 * the Vite dev server proxy endpoints:
 * - POST /api/whisper/health   -- server reachability check
 * - POST /api/audio/transcribe -- generic audio transcription
 *
 * The self-hosted server URL is read from youtubeConfiguration.ts
 * (whisperEndpointUrl field, configured in Settings).
 */

import type { WhisperProvider, WhisperTranscription, WhisperProgress } from './types'
import { getYouTubeConfiguration } from '@/lib/youtubeConfiguration'

export class SelfHostedWhisperProvider implements WhisperProvider {
  readonly id = 'self-hosted' as const
  readonly name = 'Self-Hosted (Speaches)'

  async isAvailable(): Promise<boolean> {
    const config = getYouTubeConfiguration()
    if (!config.whisperEndpointUrl) return false

    // Quick health check via model listing
    try {
      const response = await fetch('/api/whisper/health', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serverUrl: config.whisperEndpointUrl }),
        signal: AbortSignal.timeout(5_000),
      })
      return response.ok
    } catch {
      return false
    }
  }

  async transcribe(
    audio: Blob,
    lang?: string,
    onProgress?: (progress: WhisperProgress) => void
  ): Promise<WhisperTranscription> {
    const config = getYouTubeConfiguration()
    if (!config.whisperEndpointUrl) {
      throw new Error('No Whisper server URL configured. Add it in Settings > Whisper.')
    }

    onProgress?.({ stage: 'transcribing', percent: 0 })

    // Use the generic audio transcription endpoint
    const formData = new FormData()
    formData.append('file', audio, 'audio.webm')
    formData.append('serverUrl', config.whisperEndpointUrl)
    if (lang) {
      formData.append('lang', lang)
    }

    const response = await fetch('/api/audio/transcribe', {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(120_000),
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: response.statusText }))
      throw new Error(err.error || `Self-hosted transcription failed: ${response.status}`)
    }

    const data = await response.json()
    onProgress?.({ stage: 'transcribing', percent: 100 })

    return {
      vtt: data.vtt,
      language: data.language || lang || 'en',
    }
  }
}
