/**
 * TranscriptTab — Transcript viewing sub-panel for PlayerSidePanel.
 *
 * Includes VTT parser utilities (parseTime, parseTranscriptText) for local
 * transcript text conversion.
 *
 * Extracted from PlayerSidePanel.tsx to reduce god-component complexity.
 */

import { useState, useEffect, useCallback } from 'react'
import { TranscriptPanel } from '@/app/components/youtube/TranscriptPanel'
import type { TranscriptLoadingState } from '@/app/components/youtube/TranscriptPanel'
import type { CourseAdapter } from '@/lib/courseAdapter'
import type { TranscriptCue, CourseSource } from '@/data/types'
import { db } from '@/db/schema'

/** Source type constant to avoid magic strings when checking adapter source. */
const YOUTUBE_SOURCE: CourseSource = 'youtube'

// ---------------------------------------------------------------------------
// VTT parser (for local transcript text)
// ---------------------------------------------------------------------------

export function parseTime(t: string): number {
  const parts = t.replace(',', '.').split(':')
  if (parts.length === 3) {
    return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2])
  }
  return parseFloat(parts[0]) * 60 + parseFloat(parts[1])
}

export function parseTranscriptText(text: string): TranscriptCue[] {
  const blocks = text.trim().split(/\n\n+/)
  const cues: TranscriptCue[] = []

  for (const block of blocks) {
    const lines = block.trim().split('\n')
    const timestampLine = lines.find(l => l.includes('-->'))
    if (!timestampLine) continue

    const match = timestampLine.match(
      /(\d+:\d{2}(?::\d{2})?(?:[.,]\d+)?)\s*-->\s*(\d+:\d{2}(?::\d{2})?(?:[.,]\d+)?)/
    )
    if (!match) continue

    const startTime = parseTime(match[1])
    const endTime = parseTime(match[2])

    const tsIdx = lines.indexOf(timestampLine)
    const textLines = lines.slice(tsIdx + 1).filter(l => l.trim())
    if (!textLines.length) continue

    cues.push({ startTime, endTime, text: textLines.join(' ') })
  }

  return cues
}

// ---------------------------------------------------------------------------
// TranscriptTab component
// ---------------------------------------------------------------------------

export interface TranscriptTabProps {
  courseId: string
  lessonId: string
  adapter: CourseAdapter
  /** Current video playback time in seconds (for active cue highlighting) */
  currentTime?: number
  /** Callback when user clicks a cue to seek the video */
  onSeek?: (time: number) => void
}

export function TranscriptTab({
  courseId,
  lessonId,
  adapter,
  currentTime: externalTime,
  onSeek: externalSeek,
}: TranscriptTabProps) {
  const [cues, setCues] = useState<TranscriptCue[]>([])
  const [loadingState, setLoadingState] = useState<TranscriptLoadingState>('loading')

  const currentTime = externalTime ?? 0

  // Single effect for transcript loading. For YouTube sources, prefer Dexie
  // (richer cue data with timing) and fall back to adapter.getTranscript().
  // For local sources, use adapter.getTranscript() only.
  // Merging into one effect eliminates the race condition between two
  // independent effects that both call setCues/setLoadingState.
  useEffect(() => {
    let cancelled = false
    setLoadingState('loading')
    setCues([])

    const isYouTube = adapter.getSource() === YOUTUBE_SOURCE

    const loadTranscript = async () => {
      // YouTube: try Dexie first for richer cue data
      if (isYouTube) {
        try {
          const video = await db.importedVideos.get(lessonId)
          if (!cancelled && video?.youtubeVideoId) {
            const transcript = await db.youtubeTranscripts
              .where('[courseId+videoId]')
              .equals([courseId, video.youtubeVideoId])
              .first()

            if (!cancelled && transcript?.status === 'done' && transcript.cues?.length) {
              setCues(transcript.cues)
              setLoadingState('ready')
              return // Dexie had data — done
            }
          }
        } catch {
          // silent-catch-ok — fall through to adapter.getTranscript()
        }
      }

      // Fallback (all sources): use adapter.getTranscript()
      try {
        const transcriptText = await adapter.getTranscript(lessonId)
        if (cancelled) return

        if (!transcriptText) {
          setLoadingState('empty')
          return
        }

        const parsed = parseTranscriptText(transcriptText)
        if (parsed.length === 0) {
          setLoadingState('empty')
          return
        }

        setCues(parsed)
        setLoadingState('ready')
      } catch {
        // silent-catch-ok — error state handled by component
        if (!cancelled) setLoadingState('error')
      }
    }

    loadTranscript()

    return () => {
      cancelled = true
    }
  }, [adapter, courseId, lessonId])

  const handleSeek = useCallback(
    (time: number) => {
      if (externalSeek) {
        externalSeek(time)
      }
    },
    [externalSeek]
  )

  return (
    <div className="h-full">
      <TranscriptPanel
        cues={cues}
        currentTime={currentTime}
        onSeek={handleSeek}
        loadingState={loadingState}
      />
    </div>
  )
}
