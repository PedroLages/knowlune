/**
 * LocalVideoContent — Local video playback with FileSystemAccess permission handling.
 *
 * Handles blob URL creation, permission re-grant flow, file-not-found errors,
 * and delegates to VideoPlayer for actual playback.
 *
 * @see E89-S05
 */

import { useState, useCallback, useEffect } from 'react'
import { Link } from 'react-router'
import { FileWarning, FolderSearch, RefreshCw, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'
import { db } from '@/db/schema'
import { useVideoFromHandle } from '@/hooks/useVideoFromHandle'
import { useCaptionLoader } from '@/app/hooks/useCaptionLoader'
import { VideoPlayer } from '@/app/components/figma/VideoPlayer'
import { Button } from '@/app/components/ui/button'
import { Skeleton } from '@/app/components/ui/skeleton'
import { DelayedFallback } from '@/app/components/DelayedFallback'
import { addBookmark, getLessonBookmarks } from '@/lib/bookmarks'
import type { ImportedVideo, VideoBookmark } from '@/data/types'

interface LocalVideoContentProps {
  courseId: string
  lessonId: string
  /** Called when the video playback ends (HTML5 ended event) */
  onEnded?: () => void
  /** Called on each video timeupdate with the current playback time in seconds */
  onTimeUpdate?: (currentTime: number) => void
  /** External seek target — when changed, the video seeks to this time */
  seekToTime?: number
  /** Called when the seek completes so the parent can clear the target */
  onSeekComplete?: () => void
  /** Called when the user presses N to switch to the Notes tab */
  onFocusNotes?: () => void
}

export function LocalVideoContent({
  courseId,
  lessonId,
  onEnded,
  onTimeUpdate,
  seekToTime,
  onSeekComplete,
  onFocusNotes,
}: LocalVideoContentProps) {
  // NOTE: Video loading from Dexie is duplicated between LocalVideoContent and
  // YouTubeVideoContent. This is intentional for now — will be extracted into a
  // shared hook in S07 when both components are consolidated.
  const [video, setVideo] = useState<ImportedVideo | null | undefined>(undefined)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [dexieLoading, setDexieLoading] = useState(false)
  const [permissionPending, setPermissionPending] = useState(false)

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

  const { blobUrl, error, loading } = useVideoFromHandle(video?.fileHandle)

  // Caption loading and persistence
  const { userCaptions, handleLoadCaptions } = useCaptionLoader(courseId, lessonId)

  // Bookmarks: load from Dexie and provide add callback for VideoPlayer's B key shortcut
  const [bookmarks, setBookmarks] = useState<VideoBookmark[]>([])

  useEffect(() => {
    let ignore = false
    getLessonBookmarks(courseId, lessonId)
      .then(bm => {
        if (!ignore) setBookmarks(bm)
      })
      .catch(() => {
        // silent-catch-ok — bookmarks are non-critical
      })
    return () => { ignore = true }
  }, [courseId, lessonId])

  const handleBookmarkAdd = useCallback(
    async (timestamp: number) => {
      try {
        await addBookmark(courseId, lessonId, timestamp)
        const updated = await getLessonBookmarks(courseId, lessonId)
        setBookmarks(updated)
        toast.success('Bookmark added')
      } catch {
        toast.error('Failed to add bookmark')
      }
    },
    [courseId, lessonId]
  )

  // Re-grant permission flow (AC8)
  const handleReGrantPermission = useCallback(async () => {
    if (!video?.fileHandle) return
    setPermissionPending(true)
    try {
      const result = await video.fileHandle.requestPermission({ mode: 'read' })
      if (result === 'granted') {
        // Re-load video to trigger useVideoFromHandle
        const updated = await db.importedVideos.get(lessonId)
        setVideo(updated ?? null)
        toast.success('Permission granted')
      } else {
        toast.error('Permission was denied')
      }
    } catch {
      toast.error('Failed to request permission')
    } finally {
      setPermissionPending(false)
    }
  }, [video, lessonId])

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
      await db.importedVideos.update(lessonId, { fileHandle })
      const updated = await db.importedVideos.get(lessonId)
      setVideo(updated ?? null)
    } catch {
      // silent-catch-ok: User cancelled the picker
    }
  }

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
  if (video === undefined || loading) {
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

  // Error state: permission denied or file not found
  if (error) {
    return (
      <div
        data-testid="lesson-error-state"
        className="flex flex-col items-center justify-center h-full gap-6 px-4"
      >
        <div className="flex flex-col items-center gap-3 text-center max-w-sm">
          {error === 'permission-denied' ? (
            <>
              <ShieldAlert className="size-12 text-warning" aria-hidden="true" />
              <h2 className="font-semibold text-lg">Permission required</h2>
              <p className="text-sm text-muted-foreground">
                File access was revoked. Grant permission to play this video.
              </p>
            </>
          ) : (
            <>
              <FileWarning className="size-12 text-muted-foreground" aria-hidden="true" />
              <h2 className="font-semibold text-lg">Video file not found</h2>
              <p className="text-sm text-muted-foreground">Would you like to locate it?</p>
            </>
          )}
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          {error === 'permission-denied' ? (
            <Button
              onClick={handleReGrantPermission}
              variant="brand"
              className="gap-2"
              disabled={permissionPending}
            >
              <ShieldAlert className="size-4" aria-hidden="true" />
              {permissionPending ? 'Requesting...' : 'Grant Permission'}
            </Button>
          ) : (
            <Button onClick={handleLocateFile} className="gap-2">
              <FolderSearch className="size-4" aria-hidden="true" />
              Locate File
            </Button>
          )}
          <Button variant="outline" asChild>
            <Link to={`/courses/${courseId}`}>Back to Course</Link>
          </Button>
        </div>
      </div>
    )
  }

  // Video playback
  if (!blobUrl) return null

  // Map bookmarks to the shape VideoPlayer expects for timeline markers
  const bookmarkMarkers = bookmarks.map(b => ({
    id: b.id,
    timestamp: b.timestamp,
    label: b.label || '',
  }))

  return (
    <VideoPlayer
      src={blobUrl}
      title={video.filename}
      courseId={courseId}
      lessonId={lessonId}
      captions={userCaptions ? [userCaptions] : undefined}
      onLoadCaptions={handleLoadCaptions}
      onEnded={onEnded}
      onTimeUpdate={onTimeUpdate}
      seekToTime={seekToTime}
      onSeekComplete={onSeekComplete}
      onBookmarkAdd={handleBookmarkAdd}
      bookmarks={bookmarkMarkers}
      onFocusNotes={onFocusNotes}
    />
  )
}
