/**
 * YouTubeVideoContent — YouTube video playback with progress tracking and transcript.
 *
 * Handles YouTube iframe player, auto-complete on >90% watched,
 * offline placeholder, and synchronized transcript panel.
 *
 * @see E89-S05
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import { Link } from 'react-router'
import { WifiOff, CheckCircle2, FileWarning, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { db } from '@/db'
import { useOnlineStatus } from '@/app/hooks/useOnlineStatus'
import { useContentProgressStore } from '@/stores/useContentProgressStore'
import { YouTubePlayer } from '@/app/components/youtube/YouTubePlayer'
import type { YouTubePlayerHandle } from '@/app/components/youtube/YouTubePlayer'
import { TranscriptPanel } from '@/app/components/youtube/TranscriptPanel'
import { useYouTubeTranscript } from '@/app/hooks/useYouTubeTranscript'
import { useYouTubeTranscriptStore } from '@/stores/useYouTubeTranscriptStore'
import { Badge } from '@/app/components/ui/badge'
import { Button } from '@/app/components/ui/button'
import { Skeleton } from '@/app/components/ui/skeleton'
import { DelayedFallback } from '@/app/components/DelayedFallback'
import type { ImportedVideo } from '@/data/types'

interface YouTubeVideoContentProps {
  courseId: string
  lessonId: string
  /** Called when the YouTube video reaches the end (state 0) */
  onEnded?: () => void
}

export function YouTubeVideoContent({ courseId, lessonId, onEnded }: YouTubeVideoContentProps) {
  const isOnline = useOnlineStatus()

  // NOTE: Video loading from Dexie is duplicated between YouTubeVideoContent and
  // LocalVideoContent. This is intentional for now — will be extracted into a
  // shared hook in S07 when both components are consolidated.
  const [video, setVideo] = useState<ImportedVideo | null | undefined>(undefined)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [dexieLoading, setDexieLoading] = useState(false)

  // Load video record from Dexie
  const loadVideo = useCallback(() => {
    if (!lessonId) {
      setVideo(null)
      return
    }
    setLoadError(null)
    setVideo(undefined)
    setDexieLoading(true)
    let ignore = false
    db.importedVideos
      .get(lessonId)
      .then(v => {
        if (!ignore) {
          setVideo(v ?? null)
          setDexieLoading(false)
        }
      })
      .catch((err: unknown) => {
        if (!ignore) {
          const message = err instanceof Error ? err.message : 'Failed to load lesson data'
          setLoadError(message)
          setDexieLoading(false)
          toast.error('Failed to load lesson data')
        }
      })
    return () => {
      ignore = true
    }
  }, [lessonId])

  useEffect(() => {
    return loadVideo()
  }, [loadVideo])

  // Content progress for auto-complete
  const getItemStatus = useContentProgressStore(s => s.getItemStatus)
  const setItemStatus = useContentProgressStore(s => s.setItemStatus)

  const currentStatus = getItemStatus(courseId, lessonId)

  const handleAutoComplete = useCallback(async () => {
    if (currentStatus !== 'completed') {
      try {
        await setItemStatus(courseId, lessonId, 'completed', [])
        toast.success('Lesson auto-completed (>90% watched)')
      } catch {
        toast.error('Failed to update completion status')
      }
    }
  }, [courseId, lessonId, currentStatus, setItemStatus])

  // Transcript state
  const [currentTime, setCurrentTime] = useState(0)
  const playerRef = useRef<YouTubePlayerHandle>(null)
  const { cues: transcriptCues, loadingState: transcriptLoadingState } = useYouTubeTranscript(
    courseId,
    video?.youtubeVideoId
  )

  const loadCourseStates = useYouTubeTranscriptStore(s => s.loadCourseStates)
  useEffect(() => {
    if (courseId) {
      loadCourseStates(courseId)
    }
  }, [courseId, loadCourseStates])

  const handleTimeUpdate = useCallback((time: number) => {
    setCurrentTime(time)
  }, [])

  const handleTranscriptSeek = useCallback((time: number) => {
    if (playerRef.current) {
      playerRef.current.seekTo(time)
    }
  }, [])

  // Dexie read failed
  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
        <FileWarning className="size-12 text-destructive" aria-hidden="true" />
        <p className="text-sm">{loadError}</p>
        <Button onClick={loadVideo} variant="outline" className="gap-2" disabled={dexieLoading}>
          <RefreshCw className="size-4" aria-hidden="true" />
          Retry
        </Button>
      </div>
    )
  }

  // Loading state
  if (video === undefined) {
    return (
      <DelayedFallback>
        <div aria-busy="true" aria-label="Loading video">
          <Skeleton className="w-full aspect-video rounded-xl" />
        </div>
      </DelayedFallback>
    )
  }

  // Video record not found
  if (video === null) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
        <p>Video not found.</p>
        <Link to={`/courses/${courseId}`} className="text-sm text-brand hover:underline">
          Back to Course
        </Link>
      </div>
    )
  }

  const youtubeVideoId = video.youtubeVideoId

  // Offline placeholder
  if (!isOnline) {
    return (
      <div
        data-testid="youtube-offline-placeholder"
        className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground"
        role="status"
        aria-live="polite"
      >
        <WifiOff className="size-16 text-muted-foreground/50" aria-hidden="true" />
        <p className="text-lg font-medium text-foreground">No internet connection</p>
        <p className="text-sm text-center max-w-sm">
          Connect to the internet to watch this YouTube video. Your progress will be saved when you
          resume.
        </p>
      </div>
    )
  }

  // No YouTube video ID
  if (!youtubeVideoId) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
        <p>No YouTube video ID found for this lesson.</p>
        <Link to={`/courses/${courseId}`} className="text-sm text-brand hover:underline">
          Back to Course
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-full">
      {/* Video player */}
      <div className="flex-1 min-w-0">
        <YouTubePlayer
          videoId={youtubeVideoId}
          courseId={courseId}
          lessonId={lessonId}
          onAutoComplete={handleAutoComplete}
          onTimeUpdate={handleTimeUpdate}
          onEnded={onEnded}
          ref={playerRef}
        />

        {/* Video info below player */}
        <div className="mt-3 space-y-2">
          <h1 className="text-lg font-semibold">{video.filename}</h1>
          {video.description && (
            <p className="text-sm text-muted-foreground line-clamp-3">{video.description}</p>
          )}
          {currentStatus === 'completed' && (
            <Badge
              variant="secondary"
              className="bg-success/10 text-success border-success/20"
              data-testid="completion-badge"
            >
              <CheckCircle2 className="size-3 mr-1" aria-hidden="true" />
              Completed
            </Badge>
          )}
        </div>
      </div>

      {/* Transcript panel — nested inside YouTubeVideoContent for now.
          Will be lifted to the UnifiedLessonPlayer side panel in S07. */}
      <aside
        className="lg:w-80 xl:w-96 shrink-0 lg:max-h-[calc(100vh-10rem)] max-h-80"
        aria-label="Video transcript"
      >
        <TranscriptPanel
          cues={transcriptCues}
          currentTime={currentTime}
          onSeek={handleTranscriptSeek}
          loadingState={transcriptLoadingState}
        />
      </aside>
    </div>
  )
}
