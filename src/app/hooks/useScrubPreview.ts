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
}

/**
 * Manages an offscreen hidden <video> element that mirrors `src` so we can
 * seek it independently of the main playback video, then paint the current
 * frame to a <canvas> via drawImage.
 *
 * Throttling strategy (single in-flight, latest-target-wins):
 *  - If a seek is already in flight, store the new time as `pendingTarget`.
 *  - When `seeked` fires, paint the frame, then immediately seek to
 *    `pendingTarget` (if set), consuming it.
 *  - If `requestFrameAt` is called while the video is seeking, the previous
 *    pending target is silently replaced — only the latest matters.
 */
export function useScrubPreview(src: string): ScrubPreviewAPI {
  const videoElRef = useRef<HTMLVideoElement | null>(null)
  const canvasElRef = useRef<HTMLCanvasElement | null>(null)
  const seekingRef = useRef(false)
  const pendingTargetRef = useRef<number | null>(null)
  const [thumbnailAvailable, setThumbnailAvailable] = useState(false)

  // ---- ref callbacks (stable identity across renders) -------------------
  const videoRef = useCallback((el: HTMLVideoElement | null) => {
    videoElRef.current = el
  }, [])

  const canvasRef = useCallback((el: HTMLCanvasElement | null) => {
    canvasElRef.current = el
  }, [])

  // ---- seeked handler — paint frame, then consume pending target --------
  useEffect(() => {
    const video = videoElRef.current
    if (!video) return

    const onSeeked = () => {
      seekingRef.current = false
      const canvas = canvasElRef.current
      if (!canvas) {
        // consume pending anyway so we don't loop forever
        const pending = pendingTargetRef.current
        pendingTargetRef.current = null
        if (pending !== null) {
          seekingRef.current = true
          video.currentTime = Math.max(0, Math.min(pending, video.duration || 0))
        }
        return
      }

      // Paint current frame
      try {
        const ctx = canvas.getContext('2d')
        if (ctx && video.videoWidth > 0 && video.videoHeight > 0) {
          canvas.width = canvas.clientWidth || canvas.width
          canvas.height = canvas.clientHeight || canvas.height
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          setThumbnailAvailable(true)
        }
      } catch {
        // tainted canvas or other draw failure — fallback to timestamp-only
        setThumbnailAvailable(false)
      }

      // Consume pending target if any
      const pending = pendingTargetRef.current
      pendingTargetRef.current = null
      if (pending !== null) {
        seekingRef.current = true
        video.currentTime = Math.max(0, Math.min(pending, video.duration || 0))
      }
    }

    video.addEventListener('seeked', onSeeked)
    return () => video.removeEventListener('seeked', onSeeked)
  }, [])

  // ---- requestFrameAt ---------------------------------------------------
  const requestFrameAt = useCallback(
    (time: number) => {
      const video = videoElRef.current
      if (!video) return
      if (video.readyState < HTMLMediaElement.HAVE_METADATA || video.duration <= 0) return

      const clamped = Math.max(0, Math.min(time, video.duration))

      if (seekingRef.current) {
        // Seek in flight — store as pending (overwrites any previous pending)
        pendingTargetRef.current = clamped
        return
      }

      seekingRef.current = true
      video.currentTime = clamped
    },
    []
  )

  return { videoRef, canvasRef, requestFrameAt, thumbnailAvailable }
}
