/**
 * useYouTubeTranscript — hook for fetching and subscribing to YouTube transcript data.
 *
 * Integrates with useYouTubeTranscriptStore for reactive updates.
 * Returns transcript cues and loading state for the TranscriptPanel.
 *
 * @see E28-S10
 */
import { useState, useEffect } from 'react'
import { useYouTubeTranscriptStore } from '@/stores/useYouTubeTranscriptStore'
import type { TranscriptCue } from '@/data/types'
import type { TranscriptLoadingState } from '@/app/components/youtube/TranscriptPanel'

interface UseYouTubeTranscriptResult {
  cues: TranscriptCue[]
  loadingState: TranscriptLoadingState
  fullText: string
}

export function useYouTubeTranscript(
  courseId: string | undefined,
  videoId: string | undefined
): UseYouTubeTranscriptResult {
  const [cues, setCues] = useState<TranscriptCue[]>([])
  const [fullText, setFullText] = useState('')
  const [loadingState, setLoadingState] = useState<TranscriptLoadingState>('loading')

  const getVideoStatus = useYouTubeTranscriptStore(s => s.getVideoStatus)
  const getTranscript = useYouTubeTranscriptStore(s => s.getTranscript)
  const videoStates = useYouTubeTranscriptStore(s => s.videoStates)

  useEffect(() => {
    if (!courseId || !videoId) {
      setLoadingState('empty')
      setCues([])
      setFullText('')
      return
    }

    let ignore = false

    async function loadTranscript() {
      setLoadingState('loading')

      try {
        const status = getVideoStatus(courseId!, videoId!)

        if (status === 'pending' || status === 'fetching') {
          setLoadingState('loading')
          return
        }

        if (status === 'failed') {
          setLoadingState('empty')
          setCues([])
          setFullText('')
          return
        }

        const record = await getTranscript(courseId!, videoId!)

        if (ignore) return

        if (record && record.cues.length > 0) {
          setCues(record.cues)
          setFullText(record.fullText)
          setLoadingState('ready')
        } else {
          setCues([])
          setFullText('')
          setLoadingState('empty')
        }
      } catch {
        // silent-catch-ok — error state displayed in UI
        if (!ignore) {
          setLoadingState('error')
          setCues([])
          setFullText('')
        }
      }
    }

    loadTranscript()

    return () => {
      ignore = true
    }
  }, [courseId, videoId, getVideoStatus, getTranscript, videoStates])

  return { cues, loadingState, fullText }
}
