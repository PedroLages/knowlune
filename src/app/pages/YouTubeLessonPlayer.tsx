/**
 * YouTubeLessonPlayer — full lesson page with YouTube IFrame player + notes panel.
 * Matches ImportedLessonPlayer layout: video left/top, notes right/bottom.
 *
 * Features:
 * - Progress polling at 1s via YouTubePlayer component
 * - Resume from last position
 * - Auto-complete when >90% watched
 * - Manual completion toggle (Not Started / In Progress / Completed)
 * - Study session logging
 * - Offline placeholder with WifiOff icon
 * - Synchronized transcript panel with search & click-to-seek
 *
 * @see E28-S09, E28-S10
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { Link, useParams } from 'react-router'
import {
  ArrowLeft,
  WifiOff,
  CheckCircle2,
  Circle,
  Clock,
} from 'lucide-react'
import { toast } from 'sonner'
import { db } from '@/db'
import { useCourseImportStore } from '@/stores/useCourseImportStore'
import { useSessionStore } from '@/stores/useSessionStore'
import { useIdleDetection } from '@/app/hooks/useIdleDetection'
import { useOnlineStatus } from '@/app/hooks/useOnlineStatus'
import { useContentProgressStore } from '@/stores/useContentProgressStore'
import { YouTubePlayer } from '@/app/components/youtube/YouTubePlayer'
import type { YouTubePlayerHandle } from '@/app/components/youtube/YouTubePlayer'
import { TranscriptPanel } from '@/app/components/youtube/TranscriptPanel'
import { useYouTubeTranscript } from '@/app/hooks/useYouTubeTranscript'
import { useYouTubeTranscriptStore } from '@/stores/useYouTubeTranscriptStore'
import { Button } from '@/app/components/ui/button'
import { Badge } from '@/app/components/ui/badge'
import { Skeleton } from '@/app/components/ui/skeleton'
import { DelayedFallback } from '@/app/components/DelayedFallback'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu'
import type { ImportedVideo } from '@/data/types'
import type { CompletionStatus } from '@/data/types'

const STATUS_LABELS: Record<CompletionStatus, string> = {
  'not-started': 'Not Started',
  'in-progress': 'In Progress',
  completed: 'Completed',
}

const STATUS_ICONS: Record<CompletionStatus, React.ComponentType<{ className?: string }>> = {
  'not-started': Circle,
  'in-progress': Clock,
  completed: CheckCircle2,
}

export function YouTubeLessonPlayer() {
  const { courseId, lessonId } = useParams<{ courseId: string; lessonId: string }>()
  const isOnline = useOnlineStatus()

  const importedCourses = useCourseImportStore(state => state.importedCourses)
  const course = importedCourses.find(c => c.id === courseId)

  // Session tracking (matches ImportedLessonPlayer pattern)
  const { startSession, updateLastActivity, pauseSession, resumeSession, endSession, heartbeat } =
    useSessionStore()

  // Idle detection
  useIdleDetection({
    onIdle: () => pauseSession(),
    onActive: () => resumeSession(),
    onActivity: () => updateLastActivity(),
  })

  const [video, setVideo] = useState<ImportedVideo | null | undefined>(undefined)

  // Load video record from Dexie
  useEffect(() => {
    if (!lessonId) {
      setVideo(null)
      return
    }
    let ignore = false
    db.importedVideos.get(lessonId).then(v => {
      if (!ignore) setVideo(v ?? null)
    })
    return () => {
      ignore = true
    }
  }, [lessonId])

  // Start session when lesson player mounts
  useEffect(() => {
    if (!courseId || !lessonId) return
    startSession(courseId, lessonId, 'video')
  }, [courseId, lessonId, startSession])

  // End session on navigation away / tab hidden
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        endSession()
      }
    }
    const handleBeforeUnload = () => {
      endSession()
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('beforeunload', handleBeforeUnload)
    window.addEventListener('pagehide', handleBeforeUnload)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('pagehide', handleBeforeUnload)
    }
  }, [endSession])

  // Periodic heartbeat
  useEffect(() => {
    const interval = setInterval(() => {
      heartbeat()
    }, 30000)
    return () => clearInterval(interval)
  }, [heartbeat])

  // Content progress for manual completion toggle
  const getItemStatus = useContentProgressStore(s => s.getItemStatus)
  const setItemStatus = useContentProgressStore(s => s.setItemStatus)
  const loadCourseProgress = useContentProgressStore(s => s.loadCourseProgress)

  useEffect(() => {
    if (courseId) {
      loadCourseProgress(courseId)
    }
  }, [courseId, loadCourseProgress])

  const currentStatus = courseId && lessonId ? getItemStatus(courseId, lessonId) : 'not-started'

  const handleStatusChange = useCallback(
    async (status: CompletionStatus) => {
      if (!courseId || !lessonId) return
      try {
        await setItemStatus(courseId, lessonId, status, [])
        toast.success(`Marked as ${STATUS_LABELS[status]}`)
      } catch {
        toast.error('Failed to update completion status')
      }
    },
    [courseId, lessonId, setItemStatus]
  )

  const handleAutoComplete = useCallback(() => {
    if (!courseId || !lessonId) return
    if (currentStatus !== 'completed') {
      setItemStatus(courseId, lessonId, 'completed', [])
      toast.success('Lesson auto-completed (>90% watched)')
    }
  }, [courseId, lessonId, currentStatus, setItemStatus])

  // Transcript state (E28-S10)
  const [currentTime, setCurrentTime] = useState(0)
  const playerRef = useRef<YouTubePlayerHandle>(null)
  const { cues: transcriptCues, loadingState: transcriptLoadingState } =
    useYouTubeTranscript(courseId, video?.youtubeVideoId)

  // Load transcript store states for this course
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

  // Loading state
  if (video === undefined) {
    return (
      <DelayedFallback>
        <div
          data-testid="youtube-lesson-player-content"
          className="flex flex-col h-full"
          aria-busy="true"
          aria-label="Loading video"
        >
          <div className="flex items-center gap-3 px-4 py-3 border-b shrink-0">
            <Skeleton className="size-4" />
            <div className="flex flex-col gap-1 flex-1">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
          <Skeleton className="flex-1 m-4 rounded-xl" />
        </div>
      </DelayedFallback>
    )
  }

  // Video record not found
  if (video === null) {
    return (
      <div
        data-testid="youtube-lesson-player-content"
        className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground"
      >
        <p>Video not found.</p>
        <Link
          to={`/youtube-courses/${courseId}`}
          className="text-sm text-brand hover:underline"
        >
          Back to Course
        </Link>
      </div>
    )
  }

  const youtubeVideoId = video.youtubeVideoId

  const StatusIcon = STATUS_ICONS[currentStatus]

  return (
    <div data-testid="youtube-lesson-player-content" className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b shrink-0">
        <Link
          to={`/youtube-courses/${courseId}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Back to course"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div className="flex flex-col min-w-0 flex-1">
          <span
            data-testid="lesson-header-title"
            className="font-semibold text-sm truncate"
          >
            {video.filename}
          </span>
          {course && (
            <span
              data-testid="lesson-header-course"
              className="text-xs text-muted-foreground truncate"
            >
              {course.name}
            </span>
          )}
        </div>

        {/* Manual completion toggle */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              data-testid="completion-toggle"
              aria-label={`Completion status: ${STATUS_LABELS[currentStatus]}`}
            >
              <StatusIcon className="size-4" aria-hidden="true" />
              <span className="hidden sm:inline">{STATUS_LABELS[currentStatus]}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {(Object.keys(STATUS_LABELS) as CompletionStatus[]).map(status => {
              const Icon = STATUS_ICONS[status]
              return (
                <DropdownMenuItem
                  key={status}
                  onSelect={() => handleStatusChange(status)}
                  data-testid={`status-option-${status}`}
                >
                  <Icon className="size-4 mr-2" aria-hidden="true" />
                  {STATUS_LABELS[status]}
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {!isOnline ? (
          /* Offline placeholder (AC11) */
          <div
            data-testid="youtube-offline-placeholder"
            className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground"
            role="status"
            aria-live="polite"
          >
            <WifiOff className="size-16 text-muted-foreground/50" aria-hidden="true" />
            <p className="text-lg font-medium text-foreground">No internet connection</p>
            <p className="text-sm text-center max-w-sm">
              Connect to the internet to watch this YouTube video. Your progress will be saved
              when you resume.
            </p>
          </div>
        ) : youtubeVideoId ? (
          <div className="flex flex-col lg:flex-row gap-4 h-full">
            {/* Video player (left/top) */}
            <div className="flex-1 min-w-0">
              <YouTubePlayer
                videoId={youtubeVideoId}
                courseId={courseId!}
                lessonId={lessonId!}
                onAutoComplete={handleAutoComplete}
                onTimeUpdate={handleTimeUpdate}
                ref={playerRef}
              />

              {/* Video info below player */}
              <div className="mt-3 space-y-2">
                <h1 className="text-lg font-semibold">{video.filename}</h1>
                {video.description && (
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {video.description}
                  </p>
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

            {/* Transcript panel (right/bottom) */}
            <aside className="lg:w-80 xl:w-96 shrink-0 lg:max-h-[calc(100vh-10rem)] max-h-80" aria-label="Video transcript">
              <TranscriptPanel
                cues={transcriptCues}
                currentTime={currentTime}
                onSeek={handleTranscriptSeek}
                loadingState={transcriptLoadingState}
              />
            </aside>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
            <p>No YouTube video ID found for this lesson.</p>
            <Link
              to={`/youtube-courses/${courseId}`}
              className="text-sm text-brand hover:underline"
            >
              Back to Course
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
