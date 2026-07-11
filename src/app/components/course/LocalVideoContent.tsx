/**
 * LocalVideoContent — Local video playback with FileSystemAccess permission handling.
 *
 * Handles blob URL creation, permission re-grant flow, file-not-found errors,
 * and delegates to VideoPlayer for actual playback.
 *
 * @see E89-S05
 */

import { useState, useCallback, useEffect, useRef, forwardRef } from 'react'
import { Link } from 'react-router'
import { Camera, FileWarning, FolderSearch, RefreshCw, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'
import { db } from '@/db/schema'
import { useVideoFromHandle } from '@/hooks/useVideoFromHandle'
import { useDriveFileUrl } from '@/hooks/useDriveFileUrl'
import { useCaptionLoader } from '@/app/hooks/useCaptionLoader'
import { useVideoPositionSync } from '@/app/hooks/useVideoPositionSync'
import { VideoPlayer, type VideoPlayerHandle } from '@/app/components/figma/VideoPlayer'
import { Button } from '@/app/components/ui/button'
import { Skeleton } from '@/app/components/ui/skeleton'
import { DelayedFallback } from '@/app/components/DelayedFallback'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/app/components/ui/dialog'
import { addBookmark, getLessonBookmarks } from '@/lib/bookmarks'
import { formatTimestamp } from '@/lib/format'
import { syncableWrite } from '@/lib/sync/syncableWrite'
import { loadVideoStoryboard, generateStoryboard, saveVideoStoryboard } from '@/lib/videoStoryboard'
import type { StoryboardProp } from '@/app/components/figma/ScrubPreview'
import type { ImportedVideo, VideoBookmark, VideoSourceKind } from '@/data/types'

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
  /** Called when main video visibility changes (IntersectionObserver) */
  onVisibilityChange?: (isVisible: boolean) => void
  /** Called when play state changes */
  onPlayStateChange?: (isPlaying: boolean) => void
  /** Called when the blob URL is available (for mini-player) */
  onBlobUrlReady?: (url: string | null) => void
  /** Whether theater mode is active (for VideoPlayer internal styling) */
  theaterMode?: boolean
  /** Called when VideoPlayer's theater toggle is clicked */
  onTheaterModeToggle?: () => void
  /** Called when a bookmark marker on the timeline is clicked */
  onBookmarkSeek?: (timestamp: number) => void
  /** When true, the video player attempts auto-play on mount */
  autoplay?: boolean
}

export const LocalVideoContent = forwardRef<VideoPlayerHandle, LocalVideoContentProps>(
  function LocalVideoContent(
    {
      courseId,
      lessonId,
      onEnded,
      onTimeUpdate,
      seekToTime,
      onSeekComplete,
      onFocusNotes,
      onVisibilityChange,
      onPlayStateChange,
      onBlobUrlReady,
      theaterMode,
      onTheaterModeToggle,
      onBookmarkSeek,
      autoplay,
    },
    ref
  ) {
    // NOTE: Video loading from Dexie is duplicated between LocalVideoContent and
    // YouTubeVideoContent. This is intentional for now — will be extracted into a
    // shared hook in S07 when both components are consolidated.
    const [video, setVideo] = useState<ImportedVideo | null | undefined>(undefined)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [dexieLoading, setDexieLoading] = useState(false)
    const [permissionPending, setPermissionPending] = useState(false)
    const [storyboard, setStoryboard] = useState<StoryboardProp | undefined>(undefined)
    const storyboardUrlRef = useRef<string | null>(null)
    // Tracks per-session storyboard generation failures to avoid repeated
    // retries on every mouse move for the same lesson.
    const [storyboardFailed, setStoryboardFailed] = useState(false)
    // True while a storyboard is being generated (used for loading spinner in scrub preview).
    const [storyboardLoading, _setStoryboardLoading] = useState(false)
    // Tracks the last known-good playback position from timeupdate events.
    // Used during error recovery to avoid losing the position when the browser
    // resets currentTime to 0 during a decode error (Chromium behavior).
    const lastKnownTimeRef = useRef(0)

    // Smart error recovery: retryKey forces blob URL regeneration
    const [retryKey, setRetryKey] = useState(0)
    const recoveryPositionRef = useRef<number | undefined>(undefined)
    // F008: Recovery overlay state persists across VideoPlayer mount/unmount during retry.
    // Set when handleRecoveryNeeded fires, cleared when blob URL loading completes.
    const [showRecoveryOverlay, setShowRecoveryOverlay] = useState(false)
    // Server URL retry counter: limits reloads to 1 attempt per error episode.
    // Reset when lesson changes.
    const serverRetryCountRef = useRef(0)

    // Position sync: local tracking for useVideoPositionSync
    const [currentTime, setCurrentTime] = useState(0)
    const [isPlaying, setIsPlaying] = useState(false)
    const [duration, setDuration] = useState(0)
    useVideoPositionSync({ courseId, lessonId, currentTime, duration, isPlaying, autoplay })

    // Resume dialog state
    const [isLoadingPosition, setIsLoadingPosition] = useState(true)
    const [resumeDialogOpen, setResumeDialogOpen] = useState(false)
    const [savedRecord, setSavedRecord] = useState<{
      currentTime: number
      completionPercentage: number
    } | null>(null)
    const [resolvedInitialPosition, setResolvedInitialPosition] = useState<number | undefined>(
      undefined
    )
    const hasShownResumeDialog = useRef(false)

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

    // ── Drive vs. local source resolution ───────────────────────────
    // Drive-sourced lessons (driveFileRef set) use Drive streaming + OPFS caching.
    // Locally sourced lessons use FileSystemFileHandle blob URL creation.
    const isDriveSource = !!video?.driveFileRef
    const isServerSource = !!video?.serverUrl

    // ── Video source kind — drives recovery strategy ────────────────────
    const sourceKind: VideoSourceKind = video?.youtubeVideoId
      ? 'youtube'
      : isServerSource
        ? 'server-url'
        : isDriveSource
          ? 'drive'
          : video?.fileHandle
            ? 'local-file'
            : 'local-file' // default for unknown sources

    const {
      blobUrl: localBlobUrl,
      error: localError,
      loading: localLoading,
    } = useVideoFromHandle(
      isDriveSource || isServerSource ? undefined : video?.fileHandle,
      retryKey
    )
    const {
      blobUrl: driveBlobUrl,
      error: driveError,
      loading: driveLoading,
    } = useDriveFileUrl(isDriveSource ? (video?.driveFileRef ?? null) : null, retryKey)

    const blobUrl = isDriveSource ? driveBlobUrl : isServerSource ? null : localBlobUrl
    const error = isDriveSource ? driveError : isServerSource ? null : localError

    // ── Server source resolution (E133-S01) ──────────────────────────
    // Server-sourced videos use the server URL directly as <video src>.
    // On network error, fall back to fileHandle blob URL if available.
    const [serverError, setServerError] = useState(false)
    // Cache-busting retry key: incremented on server recovery to force a fresh fetch.
    const [serverRetryKey, setServerRetryKey] = useState(0)

    // Build effective server URL with optional cache-busting query param
    const effectiveServerUrl = (() => {
      if (!isServerSource || !video?.serverUrl) return null
      if (serverRetryKey <= 0) return video.serverUrl
      const sep = video.serverUrl.includes('?') ? '&' : '?'
      return `${video.serverUrl}${sep}_retry=${serverRetryKey}`
    })()

    const effectiveSrc = isServerSource && !serverError ? (effectiveServerUrl ?? null) : blobUrl
    const loading = isDriveSource ? driveLoading : isServerSource ? false : localLoading

    // F008: Clear recovery overlay once blob URL loading completes (URL arrived or error).
    // Prevents the spinner from showing indefinitely if blob generation fails.
    useEffect(() => {
      if (!loading && showRecoveryOverlay) {
        setShowRecoveryOverlay(false)
      }
    }, [loading, showRecoveryOverlay])

    // Storyboard: load existing sprite sheet, lazily generate if missing
    useEffect(() => {
      let ignore = false

      async function loadOrGenerate() {
        if (!video) return

        // Try loading an existing storyboard first
        const existing = await loadVideoStoryboard(video.id)
        if (ignore) {
          // Clean up the object URL we just created
          if (existing?.url) URL.revokeObjectURL(existing.url)
          return
        }

        if (existing) {
          setStoryboard(existing)
          storyboardUrlRef.current = existing.url
          return
        }

        // No existing storyboard — generate lazily in the background.
        // Live extraction (Phase 1) serves previews until it completes.
        if (video.fileHandle) {
          generateStoryboard(video.fileHandle)
            .then(result => {
              if (ignore || !result) return
              return saveVideoStoryboard(video.id, video.courseId, result).then(() => result)
            })
            .then(result => {
              if (ignore || !result) return
              const url = URL.createObjectURL(result.blob)
              const sb: StoryboardProp = {
                url,
                columns: result.columns,
                rows: result.rows,
                tileWidth: result.tileWidth,
                tileHeight: result.tileHeight,
                interval: result.interval,
                frameCount: result.frameCount,
              }
              if (!ignore) {
                setStoryboard(sb)
                storyboardUrlRef.current = url
              } else {
                URL.revokeObjectURL(url)
              }
            })
            .catch(() => {
              // silent-catch-ok: generation failure is non-fatal — live extraction fallback
            })
        }
        // Server-URL videos without a cached storyboard show timestamp-only
        // scrub feedback. Auto-generation on mount is disabled intentionally:
        // downloading/seeking/capturing 20-30 remote frames is expensive and
        // may hang if the server is slow. Cached/pre-generated thumbnails can
        // be loaded (handled above) but no new generation runs automatically.
      }

      loadOrGenerate()

      return () => {
        ignore = true
        // Revoke previous storyboard URL on cleanup
        if (storyboardUrlRef.current) {
          URL.revokeObjectURL(storyboardUrlRef.current)
          storyboardUrlRef.current = null
        }
      }
    }, [video])
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
      return () => {
        ignore = true
      }
    }, [courseId, lessonId])

    // Resume position: load saved playback position from Dexie progress table.
    // Determines whether to show a resume dialog or skip directly to playback.
    useEffect(() => {
      recoveryPositionRef.current = undefined
      hasShownResumeDialog.current = false
      serverRetryCountRef.current = 0
      setServerRetryKey(0)
      setStoryboardFailed(false)
      setIsLoadingPosition(true)
      setResumeDialogOpen(false)
      setSavedRecord(null)
      setResolvedInitialPosition(undefined)
      let ignore = false
      const timeoutId = setTimeout(() => {
        if (!ignore) {
          ignore = true
          setIsLoadingPosition(false)
        }
      }, 10_000)

      db.progress
        .where('[courseId+videoId]')
        .equals([courseId, lessonId])
        .first()
        .then(record => {
          clearTimeout(timeoutId)
          if (ignore) return
          setIsLoadingPosition(false)

          if (record && record.currentTime > 5 && record.completionPercentage < 95 && !autoplay) {
            setSavedRecord(record)
            setResumeDialogOpen(true)
          }
        })
        .catch(() => {
          clearTimeout(timeoutId)
          // silent-catch-ok — resume is non-critical; proceed without dialog
          if (!ignore) {
            setIsLoadingPosition(false)
          }
        })

      return () => {
        clearTimeout(timeoutId)
        ignore = true
      }
    }, [courseId, lessonId, autoplay])

    // Handle resume dialog choice: "Resume from X:XX"
    const handleResume = useCallback(() => {
      if (savedRecord) {
        setResolvedInitialPosition(savedRecord.currentTime)
      }
      setResumeDialogOpen(false)
      hasShownResumeDialog.current = true
    }, [savedRecord])

    // Handle resume dialog choice: "Start from Beginning" — writes tombstone
    const handleStartOver = useCallback(async () => {
      // Write tombstone record with currentTime=0 so the dialog won't reappear
      try {
        // F003: Read existing record and spread it so currentPage, durationSeconds,
        // and updatedAt are preserved from the previous session (same pattern as
        // PdfContent.tsx lines 214-224).
        const existing = await db.progress
          .where('[courseId+videoId]')
          .equals([courseId, lessonId])
          .first()

        await syncableWrite('progress', 'put', {
          ...(existing ?? { currentTime: 0, completionPercentage: 0 }),
          durationSeconds: existing?.durationSeconds ?? duration,
          courseId,
          videoId: lessonId,
          currentTime: 0,
          completionPercentage: 0,
        })
      } catch {
        toast.error('Failed to save video position reset')
      }
      setResolvedInitialPosition(undefined)
      setResumeDialogOpen(false)
      hasShownResumeDialog.current = true
    }, [courseId, lessonId, duration])

    // Handle dialog dismiss (Escape/outside click) — preserves position
    const handleDismissDialog = useCallback(() => {
      setResolvedInitialPosition(undefined)
      setResumeDialogOpen(false)
      hasShownResumeDialog.current = true
    }, [])

    // Local play state and time tracking for position sync
    const handleLocalTimeUpdate = useCallback(
      (time: number) => {
        setCurrentTime(time)
        // Track last known-good position for robust error recovery.
        // During a MEDIA_ERR_DECODE Chromium may reset video.currentTime to 0
        // before the error handler fires — this ref preserves the true position.
        if (isFinite(time) && time > 0) {
          lastKnownTimeRef.current = time
        }
        onTimeUpdate?.(time)
      },
      [onTimeUpdate]
    )

    const handleLocalPlayStateChange = useCallback(
      (playing: boolean) => {
        setIsPlaying(playing)
        onPlayStateChange?.(playing)
      },
      [onPlayStateChange]
    )

    // setDuration is reference-stable from useState, so no wrapper needed

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

    // Smart error recovery: when VideoPlayer detects a network error,
    // it calls onRecoveryNeeded with the current playback position.
    // We store that position and increment retryKey to force blob URL
    // regeneration via the hook's dependency change.
    //
    // Uses lastKnownTimeRef as a safety net: Chromium may reset
    // video.currentTime to 0 during a MEDIA_ERR_DECODE before the error
    // handler fires, so the error-time position from VideoPlayer can be
    // stale/zero. The last-known-good position from timeupdate events
    // always reflects the true playback position.
    const handleRecoveryNeeded = useCallback(
      (currentTime: number) => {
        // Prefer the last known-good position over the error-time position,
        // since the browser may reset currentTime during decode errors.
        const lastGood = lastKnownTimeRef.current
        const recoveryPos =
          isFinite(lastGood) && lastGood > 0 && (lastGood > currentTime || currentTime === 0)
            ? lastGood
            : currentTime

        if (!isFinite(recoveryPos)) {
          console.warn('[LocalVideoContent] Invalid recovery position:', recoveryPos)
          return
        }

        console.warn(
          `[LocalVideoContent] Recovery triggered | sourceKind=${sourceKind} | ` +
            `errorTime=${currentTime.toFixed(1)}s lastGood=${lastGood.toFixed(1)}s ` +
            `→ recoveryPos=${recoveryPos.toFixed(1)}s`
        )

        switch (sourceKind) {
          case 'server-url': {
            // Server URL recovery: retry the same URL at most once.
            // Do NOT run blob URL regeneration — there is no fileHandle.
            // Do NOT show recovery overlay — URL change is synchronous.
            if (serverRetryCountRef.current >= 1) {
              console.warn('[LocalVideoContent] Server retry exhausted')
              return
            }
            serverRetryCountRef.current++
            recoveryPositionRef.current = recoveryPos
            // Increment the server retry key to append _retry=N cache-busting param.
            // This changes effectiveSrc, forcing VideoPlayer to remount with a fresh URL.
            setServerRetryKey(k => k + 1)
            console.warn(
              `[LocalVideoContent] Server retry ${serverRetryCountRef.current}/1 | ` +
                `recoveryPos=${recoveryPos.toFixed(1)}s`
            )
            return
          }

          case 'local-file':
          case 'drive': {
            // E133-S01: If we have a serverUrl AND a local fileHandle, prefer local fallback.
            if (isServerSource && !serverError && video?.fileHandle) {
              setServerError(true)
              return
            }
            // Standard blob URL regeneration
            recoveryPositionRef.current = recoveryPos
            setShowRecoveryOverlay(true)
            setRetryKey(k => k + 1)
            return
          }

          case 'youtube':
            // YouTube errors are handled by the iframe API — no recovery needed here.
            return

          default:
            // Unknown source kind — attempt standard blob regeneration as a best effort.
            recoveryPositionRef.current = recoveryPos
            setShowRecoveryOverlay(true)
            setRetryKey(k => k + 1)
        }
      },
      [sourceKind, isServerSource, serverError, video?.fileHandle, video?.serverUrl]
    )

    // Notify parent when blob URL is ready (E91-S04 mini-player)
    useEffect(() => {
      onBlobUrlReady?.(blobUrl ?? null)
    }, [blobUrl, onBlobUrlReady])

    // IntersectionObserver: track whether the video is visible in the viewport (E91-S04)
    const videoWrapperRef = useRef<HTMLDivElement>(null)
    useEffect(() => {
      const el = videoWrapperRef.current
      if (!el || !onVisibilityChange) return
      const observer = new IntersectionObserver(
        ([entry]) => {
          onVisibilityChange(entry.isIntersecting)
        },
        { threshold: 0.3 }
      )
      observer.observe(el)
      return () => observer.disconnect()
    }, [onVisibilityChange])

    // Capture current video frame as JPEG and trigger download
    const handleCaptureFrame = useCallback(() => {
      const videoEl = (ref as React.RefObject<VideoPlayerHandle>)?.current?.getVideoElement?.()
      if (!videoEl) {
        toast.error('Video not available for capture')
        return
      }
      const canvas = document.createElement('canvas')
      canvas.width = videoEl.videoWidth
      canvas.height = videoEl.videoHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        toast.error('Canvas not supported')
        return
      }
      ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(
        blob => {
          if (!blob) {
            toast.error('Failed to capture frame')
            return
          }
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `frame-${Date.now()}.jpg`
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          URL.revokeObjectURL(url)
          toast.success('Frame saved to downloads')
        },
        'image/jpeg',
        0.92
      )
    }, [ref])

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

        // Verify the handle is usable before persisting — catches OS-level
        // issues (e.g. broken SMB mount with d--------- permissions) at
        // selection time rather than silently storing a dead handle.
        try {
          await fileHandle.getFile()
        } catch (verifyErr) {
          const vname =
            verifyErr instanceof DOMException
              ? `DOMException(${verifyErr.name})`
              : String(verifyErr)
          console.warn(
            `[handleLocateFile] New handle for "${fileHandle.name}" cannot be read: ${vname}`,
            verifyErr
          )
          toast.error(
            'Cannot access the selected file. The network share may have a permissions issue. Check that the SMB mount is accessible in Finder.'
          )
          return
        }

        const updatedCount = await db.importedVideos.update(lessonId, { fileHandle })
        if (updatedCount === 0) {
          console.warn(
            `[handleLocateFile] Dexie update returned 0 — no record found for lessonId "${lessonId}"`
          )
          toast.error('Could not save file location. The lesson record was not found.')
          return
        }

        const updated = await db.importedVideos.get(lessonId)
        setVideo(updated ?? null)
        toast.success(`Located: ${fileHandle.name}`)
      } catch {
        // silent-catch-ok: User cancelled the picker (AbortError) or unsupported browser
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

    // F009: Recovery overlay takes precedence over loading skeleton during blob URL regeneration
    if (showRecoveryOverlay && loading) {
      return (
        <div ref={videoWrapperRef} data-testid="local-video-wrapper" className="relative h-full">
          <div
            className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white gap-3 z-10"
            role="status"
            aria-live="polite"
          >
            <div className="size-10 rounded-full border-4 border-white/30 border-t-white animate-spin" />
            <p className="text-sm">Recovering...</p>
          </div>
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

    // Error state: permission denied, file not found, or Drive error
    if (error) {
      // Drive errors have a string message (not 'permission-denied' or 'file-not-found').
      // Show a Drive-specific error UI with a retry button.
      const isDriveError = isDriveSource

      return (
        <div
          data-testid="lesson-error-state"
          className="flex flex-col items-center justify-center h-full gap-6 px-4"
        >
          <div className="flex flex-col items-center gap-3 text-center max-w-sm">
            {isDriveError ? (
              <>
                <FileWarning className="size-12 text-destructive" aria-hidden="true" />
                <h2 className="font-semibold text-lg">Playback Error</h2>
                <p className="text-sm text-muted-foreground">{error}</p>
              </>
            ) : error === 'permission-denied' ? (
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
            {isDriveError ? (
              <Button
                onClick={() => handleRecoveryNeeded(lastKnownTimeRef.current)}
                variant="brand"
                className="gap-2"
              >
                <RefreshCw className="size-4" aria-hidden="true" />
                Retry
              </Button>
            ) : error === 'permission-denied' ? (
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
    if (!effectiveSrc) {
      // F008: During recovery, render the spinner here so it persists across
      // VideoPlayer mount/unmount while the new blob URL is being generated.
      if (showRecoveryOverlay) {
        return (
          <div ref={videoWrapperRef} data-testid="local-video-wrapper" className="relative h-full">
            <div
              className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white gap-3 z-10"
              role="status"
              aria-live="polite"
            >
              <div className="size-10 rounded-full border-4 border-white/30 border-t-white animate-spin" />
              <p className="text-sm">Recovering...</p>
            </div>
          </div>
        )
      }
      return null
    }

    // Map bookmarks to the shape VideoPlayer expects for timeline markers
    const bookmarkMarkers = bookmarks.map(b => ({
      id: b.id,
      timestamp: b.timestamp,
      label: b.label || '',
    }))

    // Show spinner while position is being fetched (gates VideoPlayer mount)
    if (isLoadingPosition) {
      return (
        <div ref={videoWrapperRef} data-testid="local-video-wrapper" className="relative h-full">
          <div
            className="absolute inset-0 flex items-center justify-center bg-black/5 rounded-xl"
            role="status"
            aria-live="polite"
          >
            <div className="size-10 rounded-full border-4 border-brand/30 border-t-brand animate-spin" />
          </div>
        </div>
      )
    }

    // The resume dialog gates VideoPlayer mounting so initialPosition is settled
    // before the <video> element mounts, preventing the timing race where
    // hasRestoredPosition is set to true with undefined initialPosition.
    const shouldShowDialog = resumeDialogOpen && !hasShownResumeDialog.current
    const showVideoPlayer = !shouldShowDialog

    return (
      <div
        ref={videoWrapperRef}
        data-testid="local-video-wrapper"
        className="relative h-full group/video"
      >
        {/* Resume dialog — shown on mount when saved position exists */}
        <Dialog
          open={shouldShowDialog}
          onOpenChange={open => {
            if (!open) handleDismissDialog()
          }}
        >
          <DialogContent
            className="sm:max-w-md"
            role="alertdialog"
            aria-labelledby="resume-dialog-title"
            aria-describedby="resume-dialog-description"
          >
            <DialogHeader>
              <DialogTitle id="resume-dialog-title">Resume video?</DialogTitle>
              <DialogDescription id="resume-dialog-description">
                You were watching this video at{' '}
                {savedRecord && formatTimestamp(Math.floor(savedRecord.currentTime))}. Would you
                like to resume or start from the beginning?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex gap-2 sm:gap-0">
              <Button variant="brand" onClick={handleResume}>
                Resume from {savedRecord && formatTimestamp(Math.floor(savedRecord.currentTime))}
              </Button>
              <Button
                variant="outline"
                onClick={handleStartOver}
                aria-description="Clears saved progress and restarts the video"
              >
                Start from Beginning
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Button
          variant="ghost"
          size="icon"
          className="absolute top-3 right-3 z-10 bg-black/50 hover:bg-black/70 text-white opacity-0 group-hover/video:opacity-100 focus-visible:opacity-100 transition-opacity"
          onClick={handleCaptureFrame}
          aria-label="Capture video frame"
          data-testid="capture-frame-button"
        >
          <Camera className="size-4" aria-hidden="true" />
        </Button>

        {showVideoPlayer && (
          <VideoPlayer
            ref={ref}
            src={effectiveSrc!}
            title={video.filename}
            initialPosition={
              autoplay ? undefined : (recoveryPositionRef.current ?? resolvedInitialPosition)
            }
            captions={userCaptions ? [userCaptions] : undefined}
            chapters={video.chapters}
            onLoadCaptions={handleLoadCaptions}
            onEnded={onEnded}
            onTimeUpdate={handleLocalTimeUpdate}
            seekToTime={seekToTime}
            onSeekComplete={onSeekComplete}
            onBookmarkAdd={handleBookmarkAdd}
            onBookmarkSeek={onBookmarkSeek}
            bookmarks={bookmarkMarkers}
            onFocusNotes={onFocusNotes}
            onRecoveryNeeded={handleRecoveryNeeded}
            onPlayStateChange={handleLocalPlayStateChange}
            onDurationChange={setDuration}
            theaterMode={theaterMode}
            onTheaterModeToggle={onTheaterModeToggle}
            autoplay={autoplay}
            storyboard={storyboard}
            showRecoveryOverlay={showRecoveryOverlay}
            storyboardLoading={storyboardLoading}
            storyboardFailed={storyboardFailed}
          />
        )}
      </div>
    )
  }
)
