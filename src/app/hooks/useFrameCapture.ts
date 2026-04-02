/**
 * useFrameCapture — Captures the current video frame as a JPEG for embedding in notes.
 *
 * Wraps the captureVideoFrame + saveFrameCapture utilities from @/lib/frame-capture.
 * Returns `undefined` for handleCaptureFrame when no video is available (PDF lessons).
 *
 * Ported from the classic LessonPlayer's inline handleCaptureFrame callback.
 */

import { useCallback } from 'react'
import type { RefObject } from 'react'
import { toast } from 'sonner'
import { captureVideoFrame, saveFrameCapture, type CapturedFrame } from '@/lib/frame-capture'
import type { VideoPlayerHandle } from '@/app/components/figma/VideoPlayer'

interface UseFrameCaptureParams {
  courseId: string | undefined
  lessonId: string | undefined
  videoPlayerRef: RefObject<VideoPlayerHandle | null>
  /** When true, frame capture is unavailable (PDF lessons) */
  isPdf: boolean
}

interface UseFrameCaptureResult {
  handleCaptureFrame: (() => Promise<CapturedFrame | null>) | undefined
}

export function useFrameCapture({
  courseId,
  lessonId,
  videoPlayerRef,
  isPdf,
}: UseFrameCaptureParams): UseFrameCaptureResult {
  const handleCaptureFrame = useCallback(async (): Promise<CapturedFrame | null> => {
    const videoEl = videoPlayerRef.current?.getVideoElement?.()
    if (!videoEl || !courseId || !lessonId) return null

    try {
      const timestamp = Math.floor(videoEl.currentTime)
      const { blob, thumbnail } = await captureVideoFrame(videoEl)
      const screenshot = await saveFrameCapture(courseId, lessonId, timestamp, blob, thumbnail)

      toast('Frame captured', { duration: 2000 })
      return { id: screenshot.id, timestamp }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to capture frame'
      toast.error(message)
      return null
    }
  }, [courseId, lessonId, videoPlayerRef])

  return {
    handleCaptureFrame: isPdf ? undefined : handleCaptureFrame,
  }
}
