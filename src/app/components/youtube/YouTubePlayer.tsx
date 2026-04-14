/**
 * YouTubePlayer — iframe-based YouTube embed with resume-from-last-position
 * and fallback UI when the player fails to load.
 *
 * Loads saved position from Dexie `progress` table and passes it as `&start=`
 * parameter to the iframe embed URL.
 *
 * Note: Progress polling, auto-complete, and imperative seekTo were removed
 * when migrating from react-youtube to direct iframe (iframe doesn't expose
 * the YouTube IFrame API methods). These features will need the YouTube
 * IFrame API postMessage bridge if re-enabled in the future.
 *
 * @see E28-S09
 */
import { useEffect, useState, forwardRef } from 'react'
import { db } from '@/db'
import type { VideoProgress } from '@/data/types'

export interface YouTubePlayerProps {
  videoId: string
  courseId: string
  /** The Dexie ImportedVideo.id used as videoId in the progress table */
  lessonId: string
  /** Called every 1s with current playback time (currently unused — requires IFrame API bridge) */
  onTimeUpdate?: (currentTime: number) => void
  /** Called when video reaches >90% completion (currently unused — requires IFrame API bridge) */
  onAutoComplete?: () => void
  /** Called when player state changes (playing/paused) (currently unused — requires IFrame API bridge) */
  onPlayStateChange?: (isPlaying: boolean) => void
  /** Called when the video reaches the end (YT state 0) (currently unused — requires IFrame API bridge) */
  onEnded?: () => void
}

/** Imperative handle exposed via ref for external seek control */
export interface YouTubePlayerHandle {
  seekTo: (time: number) => void
}

export const YouTubePlayer = forwardRef<YouTubePlayerHandle, YouTubePlayerProps>(
  function YouTubePlayer({ videoId, courseId, lessonId }, ref) {
    const [initialPosition, setInitialPosition] = useState<number | null>(null)
    const [isReady, setIsReady] = useState(false)
    const [loadFailed, setLoadFailed] = useState(false)

    // ref is accepted for API compatibility but currently a no-op with iframe
    void ref

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

    // Timeout fallback: if iframe never fires onLoad (CSP block, extension blocking, network issue),
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
          <svg
            className="size-10 opacity-40"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
          </svg>
          <p className="text-sm font-medium">Video couldn't load</p>
          <p className="text-xs text-center max-w-xs px-4">
            The YouTube player failed to initialize. This may be caused by a browser extension or
            network setting.
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
