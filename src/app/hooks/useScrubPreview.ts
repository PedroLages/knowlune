import { useRef, useCallback, useEffect, useState } from 'react'

interface ScrubPreviewAPI {
  /** Attach to an offscreen <video> element rendered by the consumer */
  videoRef: React.RefCallback<HTMLVideoElement>
  /** Attach to a <canvas> element rendered by the consumer */
  canvasRef: React.RefCallback<HTMLCanvasElement>
  /** Request a frame at the given time (seconds). Throttled: only the latest target wins. */
  requestFrameAt: (time: number) => void
  /** True when the most recent frame was successfully drawn to canvas */
  thumbnailAvailable: boolean
  /** True when canvas extraction failed due to CORS (tainted canvas). */
  corsFailed: boolean
}

/**
 * Manages an offscreen hidden <video> element that mirrors `src` so we can
 * seek it independently of the main playback video, then paint the current
 * frame to a <canvas> via drawImage.
 *
 * Throttling strategy (single in-flight, latest-target-wins):
 *  - If a seek is already in flight, store the new time as `pendingTarget`.
 *  - When a frame is drawn, immediately seek to `pendingTarget` (if set),
 *    consuming it.
 *  - If `requestFrameAt` is called while the video is seeking, the previous
 *    pending target is silently replaced — only the latest matters.
 *
 * Frame-draw hardening:
 *  - Uses `requestVideoFrameCallback` (where available) for a guaranteed
 *    drawable frame after seek, falling back to the `seeked` event.
 *  - Stores the last-requested time; re-issues it when `loadedmetadata`
 *    fires so a hover before metadata is ready is not silently lost.
 */
export function useScrubPreview(_src: string): ScrubPreviewAPI {
  const videoElRef = useRef<HTMLVideoElement | null>(null)
  const canvasElRef = useRef<HTMLCanvasElement | null>(null)
  const seekingRef = useRef(false)
  const pendingTargetRef = useRef<number | null>(null)
  const lastRequestedRef = useRef<number | null>(null)
  const [thumbnailAvailable, setThumbnailAvailable] = useState(false)
  const [corsFailed, setCorsFailed] = useState(false)

  // ---- ref callbacks (stable identity across renders) -------------------
  const videoRef = useCallback((el: HTMLVideoElement | null) => {
    videoElRef.current = el
  }, [])

  const canvasRef = useCallback((el: HTMLCanvasElement | null) => {
    canvasElRef.current = el
  }, [])

  // ---- paint current video frame to canvas ------------------------------
  const paintFrame = useCallback(() => {
    const video = videoElRef.current
    const canvas = canvasElRef.current
    if (!video || !canvas) return

    try {
      const ctx = canvas.getContext('2d')
      if (ctx && video.videoWidth > 0 && video.videoHeight > 0) {
        canvas.width = canvas.clientWidth || canvas.width
        canvas.height = canvas.clientHeight || canvas.height
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        setThumbnailAvailable(true)
        setCorsFailed(false)
      }
    } catch (err) {
      // tainted canvas (SecurityError from missing CORS headers)
      // or other draw failure — fallback to timestamp-only
      setThumbnailAvailable(false)
      if (err instanceof DOMException && err.name === 'SecurityError') {
        setCorsFailed(true)
      }
    }
  }, [])

  // ---- consume pending target (if any) after a frame is drawn -----------
  const consumePending = useCallback(() => {
    const video = videoElRef.current
    if (!video) return
    const pending = pendingTargetRef.current
    pendingTargetRef.current = null
    if (pending !== null) {
      seekingRef.current = true
      video.currentTime = Math.max(0, Math.min(pending, video.duration || 0))
    }
  }, [])

  // ---- seeked handler — paint frame (fallback path; rVFC is preferred) ---
  useEffect(() => {
    const video = videoElRef.current
    if (!video) return

    const onSeeked = () => {
      seekingRef.current = false
      // Only draw on seeked when rVFC is unavailable — otherwise rVFC handles it
      if (typeof (video as any).requestVideoFrameCallback !== 'function') {
        paintFrame()
      }
      consumePending()
    }

    video.addEventListener('seeked', onSeeked)
    return () => video.removeEventListener('seeked', onSeeked)
  }, [paintFrame, consumePending])

  // ---- requestVideoFrameCallback handler (reliable post-seek draw) ------
  useEffect(() => {
    const video = videoElRef.current
    if (!video) return
    if (typeof (video as any).requestVideoFrameCallback !== 'function') return

    let rvfcHandle: number | null = null

    const onSeekedForRvfc = () => {
      seekingRef.current = false
      // Schedule the draw at the next compositor frame — guaranteed drawable
      rvfcHandle = (video as any).requestVideoFrameCallback(() => {
        paintFrame()
        consumePending()
      })
    }

    video.addEventListener('seeked', onSeekedForRvfc)
    return () => {
      video.removeEventListener('seeked', onSeekedForRvfc)
      if (rvfcHandle !== null) {
        ;(video as any).cancelVideoFrameCallback(rvfcHandle)
      }
    }
  }, [paintFrame, consumePending])

  // ---- loadedmetadata retry — re-issue last request once metadata ready --
  useEffect(() => {
    const video = videoElRef.current
    if (!video) return

    const onMetadata = () => {
      const lastTime = lastRequestedRef.current
      if (lastTime !== null && video.duration > 0) {
        const clamped = Math.max(0, Math.min(lastTime, video.duration))
        if (seekingRef.current) {
          pendingTargetRef.current = clamped
        } else {
          seekingRef.current = true
          video.currentTime = clamped
        }
      }
    }

    video.addEventListener('loadedmetadata', onMetadata)
    return () => video.removeEventListener('loadedmetadata', onMetadata)
  }, [])

  // ---- reset corsFailed when source URL changes -------------------------
  useEffect(() => {
    setCorsFailed(false)
    setThumbnailAvailable(false)
  }, [_src])

  // ---- requestFrameAt ---------------------------------------------------
  const requestFrameAt = useCallback((time: number) => {
    const video = videoElRef.current
    if (!video) return

    // Always store the latest request so metadata-retry can re-issue it
    lastRequestedRef.current = time

    if (video.readyState < HTMLMediaElement.HAVE_METADATA || video.duration <= 0) {
      // Metadata not ready yet — the loadedmetadata listener will re-issue
      return
    }

    const clamped = Math.max(0, Math.min(time, video.duration))

    if (seekingRef.current) {
      // Seek in flight — store as pending (overwrites any previous pending)
      pendingTargetRef.current = clamped
      return
    }

    seekingRef.current = true
    video.currentTime = clamped
  }, [])

  return { videoRef, canvasRef, requestFrameAt, thumbnailAvailable, corsFailed }
}
