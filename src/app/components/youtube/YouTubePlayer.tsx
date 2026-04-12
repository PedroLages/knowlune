/**
 * YouTubePlayer — wrapper around react-youtube with progress polling,
 * resume-from-last-position, and auto-complete when >90% watched.
 *
 * Polls getCurrentTime() every 1s (matching ImportedLessonPlayer interval)
 * and persists to the Dexie `progress` table using compound key [courseId+videoId].
 *
 * @see E28-S09
 */
import { useEffect, useRef, useCallback, useState, useImperativeHandle, forwardRef } from 'react'
import YouTube from 'react-youtube'
import type { YouTubeEvent, YouTubePlayer as YTPlayer } from 'react-youtube'
import { db } from '@/db'
import type { VideoProgress } from '@/data/types'

export interface YouTubePlayerProps {
  videoId: string
  courseId: string
  /** The Dexie ImportedVideo.id used as videoId in the progress table */
  lessonId: string
  /** Called every 1s with current playback time */
  onTimeUpdate?: (currentTime: number) => void
  /** Called when video reaches >90% completion */
  onAutoComplete?: () => void
  /** Called when player state changes (playing/paused) */
  onPlayStateChange?: (isPlaying: boolean) => void
  /** Called when the video reaches the end (YT state 0) */
  onEnded?: () => void
}

/** Imperative handle exposed via ref for external seek control */
export interface YouTubePlayerHandle {
  seekTo: (time: number) => void
}

const POLL_INTERVAL_MS = 1000
const AUTO_COMPLETE_THRESHOLD = 0.9

export const YouTubePlayer = forwardRef<YouTubePlayerHandle, YouTubePlayerProps>(
  function YouTubePlayer(
    { videoId, courseId, lessonId, onTimeUpdate, onAutoComplete, onPlayStateChange, onEnded },
    ref
  ) {
    const playerRef = useRef<YTPlayer | null>(null)
    const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const durationRef = useRef(0)
    const hasAutoCompletedRef = useRef(false)
    const [initialPosition, setInitialPosition] = useState<number | null>(null)
    const [isReady, setIsReady] = useState(false)
    const [loadFailed, setLoadFailed] = useState(false)

    // Expose seekTo to parent via ref (E28-S10: transcript click-to-seek)
    useImperativeHandle(
      ref,
      () => ({
        seekTo: (time: number) => {
          const player = playerRef.current
          if (player) {
            try {
              player.seekTo(time, true)
              onTimeUpdate?.(time)
            } catch {
              // silent-catch-ok — player may not be ready
            }
          }
        },
      }),
      [onTimeUpdate]
    )

    // Load saved position from Dexie on mount
    useEffect(() => {
      let ignore = false
      // silent-catch-ok: error logged to console
      db.progress
        .get({ courseId, videoId: lessonId })
        .then((record: VideoProgress | undefined) => {
          if (!ignore && record && record.currentTime > 0) {
            setInitialPosition(record.currentTime)
          } else if (!ignore) {
            setInitialPosition(0)
          }
        })
        // silent-catch-ok — fallback to position 0 if progress read fails
        .catch(() => {
          if (!ignore) setInitialPosition(0)
        })
      return () => {
        ignore = true
      }
    }, [courseId, lessonId])

    // Persist current position to Dexie
    const persistProgress = useCallback(
      async (currentTime: number, duration: number) => {
        if (duration <= 0) return
        const completionPercentage = Math.min(100, Math.round((currentTime / duration) * 100))
        const record: VideoProgress = {
          courseId,
          videoId: lessonId,
          currentTime,
          completionPercentage,
          ...(completionPercentage >= 90 ? { completedAt: new Date().toISOString() } : {}),
        }
        try {
          await db.progress.put(record)
        } catch (error) {
          // silent-catch-ok: error logged to console
          console.error('[YouTubePlayer] Failed to persist progress:', error)
        }
      },
      [courseId, lessonId]
    )

    // Progress polling — runs while video is playing
    const startPolling = useCallback(() => {
      if (pollTimerRef.current) return
      pollTimerRef.current = setInterval(async () => {
        const player = playerRef.current
        if (!player) return
        try {
          const currentTime = player.getCurrentTime()
          const duration = player.getDuration()
          if (duration > 0) {
            durationRef.current = duration
            onTimeUpdate?.(currentTime)
            await persistProgress(currentTime, duration)

            // Auto-complete check
            if (!hasAutoCompletedRef.current && currentTime / duration >= AUTO_COMPLETE_THRESHOLD) {
              hasAutoCompletedRef.current = true
              onAutoComplete?.()
            }
          }
        } catch {
          // silent-catch-ok — player may have been destroyed during teardown
        }
      }, POLL_INTERVAL_MS)
    }, [onTimeUpdate, onAutoComplete, persistProgress])

    const stopPolling = useCallback(() => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current)
        pollTimerRef.current = null
      }
    }, [])

    // Cleanup on unmount
    useEffect(() => {
      return () => {
        stopPolling()
      }
    }, [stopPolling])

    // Timeout fallback: if onReady never fires (CSP block, extension blocking, network issue),
    // clear the spinner and show a fallback link to watch on YouTube directly.
    useEffect(() => {
      if (isReady) return
      const timeout = setTimeout(() => {
        console.warn('[YouTubePlayer] onReady timeout — player failed to initialize')
        setLoadFailed(true)
        setIsReady(true)
      }, 10_000)
      return () => clearTimeout(timeout)
    }, [isReady])

    const handleReady = useCallback(
      (event: YouTubeEvent) => {
        playerRef.current = event.target
        setIsReady(true)
        // Seek to saved position if we have one
        if (initialPosition && initialPosition > 0) {
          event.target.seekTo(initialPosition, true)
        }
      },
      [initialPosition]
    )

    const handleError = useCallback(
      (event: YouTubeEvent<number>) => {
        console.error('[YouTubePlayer] YouTube error code:', event.data)
        // Error codes 100/101/150 = video not embeddable; others = network/config errors
        setLoadFailed(true)
        setIsReady(true)
      },
      []
    )

    const handleStateChange = useCallback(
      (event: YouTubeEvent) => {
        const state = event.data
        // YT.PlayerState: PLAYING=1, PAUSED=2, ENDED=0, BUFFERING=3
        if (state === 1) {
          // Playing
          onPlayStateChange?.(true)
          startPolling()
        } else if (state === 2) {
          // Paused
          onPlayStateChange?.(false)
          stopPolling()
          // Persist final position on pause
          const player = playerRef.current
          if (player) {
            try {
              const currentTime = player.getCurrentTime()
              const duration = player.getDuration()
              if (duration > 0) {
                persistProgress(currentTime, duration)
              }
            } catch {
              // silent-catch-ok — player may have been destroyed
            }
          }
        } else if (state === 0) {
          // Ended
          onPlayStateChange?.(false)
          stopPolling()
          // Mark as 100% complete
          if (durationRef.current > 0) {
            persistProgress(durationRef.current, durationRef.current)
          }
          if (!hasAutoCompletedRef.current) {
            hasAutoCompletedRef.current = true
            onAutoComplete?.()
          }
          onEnded?.()
        }
      },
      [onPlayStateChange, startPolling, stopPolling, onAutoComplete, onEnded, persistProgress]
    )

    // Don't render until we know the initial position
    if (initialPosition === null) {
      return (
        <div
          className="aspect-video w-full bg-muted animate-pulse rounded-xl"
          aria-busy="true"
          aria-label="Loading video player"
        />
      )
    }

    if (loadFailed) {
      return (
        <div
          className="aspect-video w-full flex flex-col items-center justify-center bg-muted rounded-xl gap-3 text-muted-foreground"
          data-testid="youtube-player-fallback"
        >
          <svg className="size-10 opacity-40" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
          </svg>
          <p className="text-sm font-medium">Video couldn't load</p>
          <p className="text-xs text-center max-w-xs px-4">
            The YouTube player failed to initialize. This may be caused by a browser extension or network setting.
          </p>
          <a
            href={`https://www.youtube.com/watch?v=${videoId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-brand hover:underline"
          >
            Watch on YouTube ↗
          </a>
        </div>
      )
    }

    // DEBUG: Direct iframe test — bypasses react-youtube to isolate the issue
    const startParam = initialPosition > 0 ? `&start=${Math.floor(initialPosition)}` : ''
    const iframeSrc = `https://www.youtube.com/embed/${videoId}?enablejsapi=1&modestbranding=1&rel=0${startParam}&origin=${encodeURIComponent(window.location.origin)}`

    return (
      <div className="aspect-video w-full relative" data-testid="youtube-player-container">
        <iframe
          src={iframeSrc}
          className="w-full h-full rounded-xl"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          onLoad={() => {
            console.log('[YouTubePlayer] Direct iframe loaded successfully')
            setIsReady(true)
          }}
          onError={() => {
            console.error('[YouTubePlayer] Direct iframe failed to load')
            setLoadFailed(true)
            setIsReady(true)
          }}
        />
        {!isReady && (
          <div
            className="absolute inset-0 flex items-center justify-center bg-muted rounded-xl"
            aria-busy="true"
            aria-label="Loading YouTube player"
          >
            <div className="size-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
    )
  }
)
