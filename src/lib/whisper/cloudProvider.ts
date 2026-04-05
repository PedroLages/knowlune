import type { WhisperProvider, WhisperTranscription, WhisperProgress } from './types'
import { getDecryptedApiKeyForProvider } from '@/lib/aiConfiguration'

/** Cloud API endpoints and models */
const CLOUD_CONFIG = {
  groq: {
    url: 'https://api.groq.com/openai/v1/audio/transcriptions',
    model: 'whisper-large-v3-turbo',
    name: 'Groq Cloud',
  },
  openai: {
    url: 'https://api.openai.com/v1/audio/transcriptions',
    model: 'whisper-1',
    name: 'OpenAI Cloud',
  },
} as const

type CloudProviderId = 'groq' | 'openai'

export class CloudWhisperProvider implements WhisperProvider {
  readonly id: 'groq' | 'openai'
  readonly name: string
  private providerId: CloudProviderId

  constructor(providerId: CloudProviderId) {
    this.providerId = providerId
    this.id = providerId
    this.name = CLOUD_CONFIG[providerId].name
  }

  async isAvailable(): Promise<boolean> {
    const key = await getDecryptedApiKeyForProvider(this.providerId)
    return !!key
  }

  async transcribe(
    audio: Blob,
    lang?: string,
    onProgress?: (progress: WhisperProgress) => void
  ): Promise<WhisperTranscription> {
    const apiKey = await getDecryptedApiKeyForProvider(this.providerId)
    if (!apiKey) {
      throw new Error(`No ${this.name} API key configured. Add it in Settings > AI Configuration.`)
    }

    onProgress?.({ stage: 'transcribing', percent: 0 })

    const config = CLOUD_CONFIG[this.providerId]

    // Send through server proxy to bypass CORS
    const formData = new FormData()
    formData.append('file', audio, 'audio.webm')
    formData.append('provider', this.providerId)
    formData.append('apiKey', apiKey)
    formData.append('model', config.model)
    formData.append('response_format', 'vtt')
    if (lang) {
      formData.append('language', lang)
    }

    const response = await fetch('/api/whisper/transcribe', {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(120_000),
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: response.statusText }))
      throw new Error(err.error || `Cloud transcription failed: ${response.status}`)
    }

    const data = await response.json()
    onProgress?.({ stage: 'transcribing', percent: 100 })

    return {
      vtt: data.vtt,
      language: data.language || lang || 'en',
    }
  }
}
