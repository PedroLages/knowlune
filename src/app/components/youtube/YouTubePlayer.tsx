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
import { useEffect, useRef, useState, forwardRef } from 'react'
import { db } from '@/db'
import type { VideoProgress, UnembeddableReason } from '@/data/types'
import { YouTubeUnembeddableFallback } from '@/app/components/youtube/YouTubeUnembeddableFallback'
import { probeEmbeddability } from '@/lib/youtubeEmbeddability'

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
  /**
   * Known embeddability state from the parent `ImportedVideo`. When `true`, the
   * Data API or import-time probe has confirmed the video is embeddable, so we
   * skip the runtime probe. When `undefined` (legacy records), we schedule a
   * post-load probe as a safety net. `false` should never reach this component
   * — `YouTubeVideoContent` branches to the fallback first.
   */
  lessonEmbeddableState?: boolean
  /**
   * Called when the runtime probe definitively detects the video is not
   * embeddable. Parent is expected to persist the flag to Dexie so subsequent
   * loads skip the iframe entirely.
   */
  onUnembeddableDetected?: (reason: UnembeddableReason) => void
}

/** Imperative handle exposed via ref for external seek control */
export interface YouTubePlayerHandle {
  seekTo: (time: number) => void
}

export const YouTubePlayer = forwardRef<YouTubePlayerHandle, YouTubePlayerProps>(
  function YouTubePlayer(
    { videoId, courseId, lessonId, lessonEmbeddableState, onUnembeddableDetected },
    ref
  ) {
    const [initialPosition, setInitialPosition] = useState<number | null>(null)
    const [isReady, setIsReady] = useState(false)
    const [loadFailed, setLoadFailed] = useState(false)
    const [runtimeReason, setRuntimeReason] = useState<UnembeddableReason | undefined>(undefined)
    const probedRef = useRef(false)

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

    // Runtime embeddability safety net: for legacy imports (where the parent
    // has no persisted `embeddable` flag), the iframe may load a 200-OK
    // "content blocked" error page without firing `onError`. Once the iframe
    // has loaded, run a delayed oEmbed probe — if it returns a *definite*
    // non-embeddable signal, flip to the fallback and notify the parent so it
    // can persist the flag for next time. Only act on definite signals
    // (`embedding-disabled`, `deleted-or-private`, etc) — a `'unknown'` result
    // is usually a transient network hiccup and would cause false positives.
    useEffect(() => {
      if (!isReady) return
      if (loadFailed) return
      if (lessonEmbeddableState === true) return
      if (probedRef.current) return

      let ignore = false
      const timeoutId = setTimeout(() => {
        probedRef.current = true
        probeEmbeddability(videoId)
          .then(result => {
            if (ignore) return
            if (result.embeddable) return
            if (result.reason === 'unknown') return
            setRuntimeReason(result.reason)
            setLoadFailed(true)
            onUnembeddableDetected?.(result.reason)
          })
          // silent-catch-ok — probe failures fall back to current iframe render
          .catch(() => {})
      }, 500)

      return () => {
        ignore = true
        clearTimeout(timeoutId)
      }
    }, [isReady, loadFailed, lessonEmbeddableState, videoId, onUnembeddableDetected])

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
      return <YouTubeUnembeddableFallback videoId={videoId} reason={runtimeReason} />
    }

    const startParam = initialPosition > 0 ? `&start=${Math.floor(initialPosition)}` : ''
    const iframeSrc = `https://www.youtube-nocookie.com/embed/${videoId}?enablejsapi=1&modestbranding=1&rel=0${startParam}&origin=${encodeURIComponent(window.location.origin)}`

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
