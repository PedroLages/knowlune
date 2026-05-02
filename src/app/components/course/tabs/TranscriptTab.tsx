/**
 * TranscriptTab — Transcript viewing sub-panel for PlayerSidePanel.
 *
 * Includes VTT parser utilities (parseTime, parseTranscriptText) for local
 * transcript text conversion and on-demand Whisper transcription for local
 * video lessons.
 *
 * Extracted from PlayerSidePanel.tsx to reduce god-component complexity.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { TranscriptPanel } from '@/app/components/youtube/TranscriptPanel'
import type { TranscriptLoadingState } from '@/app/components/youtube/TranscriptPanel'
import type { CourseAdapter } from '@/lib/courseAdapter'
import type { TranscriptCue } from '@/data/types'
import { db } from '@/db/schema'
import { Button } from '@/app/components/ui/button'
import { useWhisperTranscription } from '@/lib/whisper/useWhisperTranscription'
import { consentService } from '@/lib/compliance/consentService'
import { useAuthStore } from '@/stores/useAuthStore'
import { Sparkles, Loader2, AlertCircle, RotateCcw, Lock, FileText } from 'lucide-react'

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
// Generation state machine
// ---------------------------------------------------------------------------

type GenerationState = 'idle' | 'generating' | 'completed' | 'error' | 'consent-required'

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
  /** Whether the current lesson is a PDF (hides generate button) */
  isPdf?: boolean
  /** Called after transcript generation completes successfully */
  onTranscriptGenerated?: () => void
}

export function TranscriptTab({
  courseId,
  lessonId,
  adapter,
  currentTime: externalTime,
  onSeek: externalSeek,
  isPdf = false,
  onTranscriptGenerated,
}: TranscriptTabProps) {
  const [cues, setCues] = useState<TranscriptCue[]>([])
  const [loadingState, setLoadingState] = useState<TranscriptLoadingState>('loading')

  // Generation state machine
  const [generationState, setGenerationState] = useState<GenerationState>('idle')
  const [generationError, setGenerationError] = useState<string | null>(null)

  const currentTime = externalTime ?? 0

  const capabilities = adapter.getCapabilities()
  const isLocalVideo = !capabilities.requiresNetwork && !isPdf

  const { transcribe, isTranscribing, progress, provider: whisperProvider } =
    useWhisperTranscription()

  const userId = useAuthStore(s => s.user?.id)

  const abortControllerRef = useRef<AbortController | null>(null)

  // Single effect for transcript loading. For YouTube sources, prefer Dexie
  // (richer cue data with timing) and fall back to adapter.getTranscript().
  // For local sources, use adapter.getTranscript() only.
  useEffect(() => {
    let cancelled = false
    setLoadingState('loading')
    setCues([])

    const loadTranscript = async () => {
      // Network sources (YouTube): try Dexie first for richer cue data
      if (capabilities.requiresNetwork) {
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
              return
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
      if (externalSeek) externalSeek(time)
    },
    [externalSeek]
  )

  // Cancel in-flight generation on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  // ---------------------------------------------------------------------------
  // Generate transcript handler
  // ---------------------------------------------------------------------------

  const handleGenerate = useCallback(async () => {
    if (!userId) {
      setGenerationState('consent-required')
      return
    }

    const purposeConsented = await consentService.isGranted(userId, 'voice_transcription')
    if (!purposeConsented) {
      setGenerationState('consent-required')
      return
    }

    const providerConsented = await consentService.isGrantedForProvider(
      userId,
      'voice_transcription',
      whisperProvider
    )
    if (!providerConsented) {
      setGenerationState('consent-required')
      return
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    const controller = new AbortController()
    abortControllerRef.current = controller

    setGenerationState('generating')
    setGenerationError(null)

    try {
      const video = await db.importedVideos.get(lessonId)
      if (controller.signal.aborted) return

      if (!video?.fileHandle) {
        setGenerationError('File access lost — re-import the video to enable transcription.')
        setGenerationState('error')
        return
      }

      let file: File
      try {
        file = await video.fileHandle.getFile()
      } catch {
        setGenerationError('File access lost — re-import the video to enable transcription.')
        setGenerationState('error')
        return
      }

      if (controller.signal.aborted) return

      const result = await transcribe(file)
      if (controller.signal.aborted) return

      const parsedCues = parseTranscriptText(result.vtt)
      const fullText = parsedCues.map(c => c.text).join(' ')
      const now = new Date().toISOString()

      await db.videoCaptions.put({
        courseId,
        videoId: lessonId,
        filename: `${lessonId}.vtt`,
        content: result.vtt,
        format: 'vtt',
        createdAt: now,
      })

      await db.youtubeTranscripts.put({
        courseId,
        videoId: lessonId,
        language: result.language,
        cues: parsedCues,
        fullText,
        source: 'whisper',
        status: 'done',
        fetchedAt: now,
      })

      setCues(parsedCues)
      setLoadingState('ready')
      setGenerationState('completed')
      onTranscriptGenerated?.()
    } catch (err) {
      if (controller.signal.aborted) return
      const message = err instanceof Error ? err.message : 'Transcription failed'
      setGenerationError(message)
      setGenerationState('error')
    }
  }, [userId, whisperProvider, lessonId, courseId, transcribe, onTranscriptGenerated])

  // ---------------------------------------------------------------------------
  // Render: local video empty state with generate button
  // ---------------------------------------------------------------------------

  if (loadingState === 'empty' && isLocalVideo) {
    return (
      <div className="h-full">
        {/* Idle state */}
        {generationState === 'idle' && (
          <div
            className="rounded-xl border bg-card p-4 h-full flex flex-col items-center justify-center gap-4"
            data-testid="transcript-panel"
            role="region"
            aria-label="Transcript"
          >
            <FileText className="size-10 text-muted-foreground/50" aria-hidden="true" />
            <p className="text-sm text-muted-foreground text-center">
              No transcript available for this video
            </p>
            <p className="text-xs text-muted-foreground/70 text-center max-w-xs">
              Generate a transcript using on-device Whisper transcription. This
              processes the audio locally and stores the transcript for this lesson.
            </p>
            <Button
              onClick={handleGenerate}
              variant="brand"
              className="gap-2"
              disabled={isTranscribing}
              data-testid="generate-transcript-button"
            >
              <Sparkles className="size-4" aria-hidden="true" />
              Generate Transcript
            </Button>
          </div>
        )}

        {/* Generating state */}
        {generationState === 'generating' && (
          <div
            className="rounded-xl border bg-card p-4 h-full flex flex-col items-center justify-center gap-4"
            data-testid="transcript-panel"
            role="region"
            aria-label="Transcript"
            aria-busy="true"
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Loader2 className="size-4 animate-spin text-brand" aria-hidden="true" />
              Generating transcript...
            </div>
            {progress && (
              <div className="w-full max-w-xs space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>
                    {progress.stage === 'downloading-model'
                      ? 'Downloading model...'
                      : progress.stage === 'loading-model'
                        ? 'Loading model...'
                        : 'Transcribing audio...'}
                  </span>
                  <span>{Math.round(progress.percent)}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-brand h-full rounded-full transition-all duration-300"
                    style={{ width: `${Math.round(progress.percent)}%` }}
                    role="progressbar"
                    aria-valuenow={Math.round(progress.percent)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Error state */}
        {generationState === 'error' && (
          <div
            className="rounded-xl border bg-card p-4 h-full flex flex-col items-center justify-center gap-4"
            data-testid="transcript-panel"
            role="region"
            aria-label="Transcript"
          >
            <div
              className="flex items-start gap-2 p-3 rounded-xl bg-destructive/10 text-destructive border border-destructive w-full max-w-sm"
              role="alert"
              data-testid="transcript-generation-error"
            >
              <AlertCircle className="size-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <p className="text-sm">{generationError}</p>
            </div>
            <Button
              onClick={() => {
                setGenerationState('idle')
                setGenerationError(null)
              }}
              variant="outline"
              className="gap-2"
              data-testid="retry-transcript-generate"
            >
              <RotateCcw className="size-4" aria-hidden="true" />
              Retry
            </Button>
          </div>
        )}

        {/* Consent-required state */}
        {generationState === 'consent-required' && (
          <div className="h-full">
            <TranscriptPanel
              cues={cues}
              currentTime={currentTime}
              onSeek={handleSeek}
              loadingState={loadingState}
            />
            <div
              className="flex items-start gap-3 p-4 mx-4 mb-4 rounded-xl bg-muted/50 border border-border"
              role="status"
              data-testid="transcript-consent-required"
            >
              <Lock
                className="size-4 flex-shrink-0 mt-0.5 text-muted-foreground"
                aria-hidden="true"
              />
              <p className="text-sm text-muted-foreground">
                Transcription requires your consent. Enable{' '}
                <strong>Voice Transcription</strong> in{' '}
                <a
                  href="/settings?section=privacy"
                  className="text-brand underline underline-offset-2 hover:text-brand-hover"
                >
                  Settings → Privacy &amp; Consent
                </a>
                .
              </p>
            </div>
          </div>
        )}

        {/* Completed: TranscriptPanel renders the transcript */}
        {generationState === 'completed' && (
          <TranscriptPanel
            cues={cues}
            currentTime={currentTime}
            onSeek={handleSeek}
            loadingState={loadingState}
          />
        )}
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Default: use TranscriptPanel (handles loading, ready, empty, error states)
  // ---------------------------------------------------------------------------

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
