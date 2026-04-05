/**
 * React hook for audio transcription via the configured Whisper provider.
 *
 * Abstracts provider selection — components call transcribe() and get VTT
 * regardless of whether it runs in-browser, on Groq, or on Speaches.
 */

import { useState, useCallback, useRef } from 'react'
import type { WhisperTranscription, WhisperProgress, WhisperProviderId } from './types'
import { getWhisperConfig, getWhisperProvider } from './index'

interface UseWhisperTranscriptionReturn {
  /** Transcribe an audio blob. Returns VTT transcript. */
  transcribe: (audio: Blob, lang?: string) => Promise<WhisperTranscription>
  /** Whether a transcription is currently in progress */
  isTranscribing: boolean
  /** Current progress (model download, transcription) */
  progress: WhisperProgress | null
  /** Active provider ID */
  provider: WhisperProviderId
  /** Last error message, if any */
  error: string | null
}

export function useWhisperTranscription(): UseWhisperTranscriptionReturn {
  const config = getWhisperConfig()
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [progress, setProgress] = useState<WhisperProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef(false)
  const activeRef = useRef(false)

  const transcribe = useCallback(
    async (audio: Blob, lang?: string): Promise<WhisperTranscription> => {
      if (activeRef.current) {
        throw new Error('A transcription is already in progress')
      }

      activeRef.current = true
      setIsTranscribing(true)
      setProgress(null)
      setError(null)
      abortRef.current = false

      try {
        const provider = await getWhisperProvider()
        const result = await provider.transcribe(audio, lang, p => {
          if (!abortRef.current) setProgress(p)
        })
        return result
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Transcription failed'
        setError(message)
        throw err
      } finally {
        activeRef.current = false
        setIsTranscribing(false)
        setProgress(null)
      }
    },
    []
  )

  return {
    transcribe,
    isTranscribing,
    progress,
    provider: config.provider,
    error,
  }
}
