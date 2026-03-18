import { useState, useEffect, useCallback, useRef } from 'react'
import { Link, useParams } from 'react-router'
import { ArrowLeft, FileWarning, FolderSearch } from 'lucide-react'
import { db } from '@/db/schema'
import { useCourseImportStore } from '@/stores/useCourseImportStore'
import { useVideoFromHandle } from '@/hooks/useVideoFromHandle'
import { useIdleDetection } from '@/app/hooks/useIdleDetection'
import { useSessionStore } from '@/stores/useSessionStore'
import { VideoPlayer } from '@/app/components/figma/VideoPlayer'
import { Button } from '@/app/components/ui/button'
import { Skeleton } from '@/app/components/ui/skeleton'
import { DelayedFallback } from '@/app/components/DelayedFallback'
import type { ImportedVideo, CaptionTrack } from '@/data/types'
import { saveCaptionForVideo, getCaptionForVideo } from '@/lib/captions'
import { toast } from 'sonner'

export function ImportedLessonPlayer() {
  const { courseId, lessonId } = useParams<{ courseId: string; lessonId: string }>()

  const importedCourses = useCourseImportStore(state => state.importedCourses)
  const course = importedCourses.find(c => c.id === courseId)

  // Session tracking (AC1, AC2, AC3)
  const { startSession, updateLastActivity, pauseSession, resumeSession, endSession, heartbeat } =
    useSessionStore()

  // Idle detection (AC3)
  useIdleDetection({
    onIdle: () => pauseSession(),
    onActive: () => resumeSession(),
    onActivity: () => updateLastActivity(),
  })

  const [video, setVideo] = useState<ImportedVideo | null | undefined>(undefined)

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

  const { blobUrl, error, loading } = useVideoFromHandle(video?.fileHandle)

  // AC1: Start session when lesson player mounts
  useEffect(() => {
    if (!courseId || !lessonId) return

    // Start session (always 'video' type for ImportedLessonPlayer)
    startSession(courseId, lessonId, 'video')

    // Note: No cleanup needed - endSession handled by visibility/unload handlers
  }, [courseId, lessonId, startSession])

  // AC2: End session on navigation away / tab hidden
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

  // Periodic heartbeat: persist session state every 30s (ensures orphan recovery has recent data)
  useEffect(() => {
    const interval = setInterval(() => {
      heartbeat()
    }, 30000) // 30 seconds

    return () => clearInterval(interval)
  }, [heartbeat])

  // Caption state and persistence
  const [userCaptions, setUserCaptions] = useState<CaptionTrack | null>(null)
  const userCaptionBlobUrl = useRef<string | null>(null)

  // Load persisted user captions on mount / lesson change
  useEffect(() => {
    if (!courseId || !lessonId) return
    let cancelled = false

    getCaptionForVideo(courseId, lessonId).then(track => {
      if (cancelled) return
      if (track) {
        if (userCaptionBlobUrl.current) URL.revokeObjectURL(userCaptionBlobUrl.current)
        userCaptionBlobUrl.current = track.src
        setUserCaptions(track)
      }
    })

    return () => {
      cancelled = true
    }
  }, [courseId, lessonId])

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (userCaptionBlobUrl.current) URL.revokeObjectURL(userCaptionBlobUrl.current)
    }
  }, [])

  const handleLoadCaptions = useCallback(
    async (file: File) => {
      if (!courseId || !lessonId) return

      const result = await saveCaptionForVideo(courseId, lessonId, file)
      if (!result.captionTrack) {
        toast.error(result.error)
        return
      }

      if (userCaptionBlobUrl.current) URL.revokeObjectURL(userCaptionBlobUrl.current)
      userCaptionBlobUrl.current = result.captionTrack.src
      setUserCaptions(result.captionTrack)
      toast.success(`Captions loaded: ${file.name}`)
    },
    [courseId, lessonId]
  )

  async function handleLocateFile() {
    try {
      const [fileHandle] = await window.showOpenFilePicker({
        types: [
          {
            description: 'Video files',
            accept: { 'video/*': ['.mp4', '.mkv', '.avi', '.webm'] },
          },
        ],
        multiple: false,
      })
      if (lessonId) {
        await db.importedVideos.update(lessonId, { fileHandle })
        // Re-fetch the updated video record to trigger hook re-run
        const updated = await db.importedVideos.get(lessonId)
        setVideo(updated ?? null)
      }
    } catch {
      // User cancelled the picker — do nothing
    }
  }

  // Loading state (initial Dexie query in flight or blob URL loading)
  if (video === undefined || loading) {
    return (
      <DelayedFallback>
        <div
          data-testid="lesson-player-content"
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

  // Video record not found in Dexie
  if (video === null) {
    return (
      <div
        data-testid="lesson-player-content"
        className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground"
      >
        <p>Video not found.</p>
        <Link to={`/imported-courses/${courseId}`} className="text-sm text-brand hover:underline">
          Back to Course
        </Link>
      </div>
    )
  }

  return (
    <div data-testid="lesson-player-content" className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b shrink-0">
        <Link
          to={`/imported-courses/${courseId}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Back to course"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div className="flex flex-col min-w-0">
          <span data-testid="lesson-header-title" className="font-semibold text-sm truncate">
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
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {error ? (
          <div
            data-testid="lesson-error-state"
            className="flex flex-col items-center justify-center h-full gap-6 px-4"
          >
            <div className="flex flex-col items-center gap-3 text-center max-w-sm">
              <FileWarning className="size-12 text-muted-foreground" aria-hidden="true" />
              <h2 className="font-semibold text-lg">Video file not found</h2>
              <p className="text-sm text-muted-foreground">
                {error === 'permission-denied'
                  ? 'Permission was denied. Grant access to play this video.'
                  : 'Would you like to locate it?'}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button onClick={handleLocateFile} className="gap-2">
                <FolderSearch className="size-4" aria-hidden="true" />
                Locate File
              </Button>
              <Button variant="outline" asChild>
                <Link to={`/imported-courses/${courseId}`}>Back to Course</Link>
              </Button>
            </div>
          </div>
        ) : blobUrl ? (
          <VideoPlayer
            src={blobUrl}
            title={video.filename}
            courseId={courseId}
            lessonId={lessonId}
            captions={userCaptions ? [userCaptions] : undefined}
            onLoadCaptions={handleLoadCaptions}
          />
        ) : null}
      </div>
    </div>
  )
}
