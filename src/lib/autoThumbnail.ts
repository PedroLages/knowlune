/**
 * Auto-generates a thumbnail from a video file handle during import.
 *
 * Extracts a frame at the 10% mark (avoids black screens/intros per AC1),
 * saves to IndexedDB as a JPEG blob, and updates the Zustand thumbnail cache.
 *
 * Failures are silent — the course card falls back to a placeholder icon (AC3).
 *
 * @module autoThumbnail
 * @story E1B-S04
 */

import {
  extractThumbnailFromVideo,
  saveCourseThumbnail,
  resizeImageToBlob,
} from '@/lib/thumbnailService'
import { useCourseImportStore } from '@/stores/useCourseImportStore'

/**
 * Generates and persists a thumbnail from a video file handle.
 * Updates the Zustand store so the card displays the thumbnail immediately.
 *
 * @param courseId - The course to attach the thumbnail to
 * @param videoHandle - FileSystemFileHandle for the first video in the course
 */
export async function autoGenerateThumbnail(
  courseId: string,
  videoHandle: FileSystemFileHandle
): Promise<void> {
  // Check if thumbnail already exists (idempotent — AC4: don't regenerate on refresh)
  const existing = useCourseImportStore.getState().thumbnailUrls[courseId]
  if (existing) return

  const blob = await extractThumbnailFromVideo(videoHandle)
  await saveCourseThumbnail(courseId, blob, 'auto')

  // Update Zustand store so card shows thumbnail without a page reload
  const url = URL.createObjectURL(blob)
  useCourseImportStore.setState(state => ({
    thumbnailUrls: { ...state.thumbnailUrls, [courseId]: url },
  }))
}

/**
 * Generates and persists a thumbnail from a server-hosted video URL.
 *
 * Creates a hidden <video> element, seeks to the 10% mark (or 3s max),
 * captures the frame via canvas, and persists as a JPEG blob.
 *
 * Silently fails on CORS errors or network issues — the course card falls
 * back to a gradient placeholder. Frame extraction uses HTTP Range requests
 * so the full video is never downloaded.
 *
 * @param courseId - The course to attach the thumbnail to
 * @param serverUrl - HTTP(S) URL of the first video in the course
 */
export async function autoGenerateThumbnailFromServer(
  courseId: string,
  serverUrl: string
): Promise<void> {
  // Check if thumbnail already exists (idempotent)
  const existing = useCourseImportStore.getState().thumbnailUrls[courseId]
  if (existing) return

  const blob = await extractFrameFromServerVideo(serverUrl)
  await saveCourseThumbnail(courseId, blob, 'auto')

  const url = URL.createObjectURL(blob)
  useCourseImportStore.setState(state => ({
    thumbnailUrls: { ...state.thumbnailUrls, [courseId]: url },
  }))
}

/** Seek targets to try in order (seconds from start). */
const SEEK_TARGETS = [3, 0.1, 0] as const

/**
 * Extracts a single frame from a server-hosted video via an offscreen <video> element.
 *
 * Uses `crossOrigin: 'anonymous'` so canvas access works when the server
 * returns appropriate CORS headers. Attempts multiple seek targets (retry
 * chain) with a 15-second timeout. Cleanup is idempotent — resources are
 * released exactly once regardless of which resolution path fires first.
 *
 * @param serverUrl - HTTP(S) URL of the video file
 * @returns JPEG blob at 1280×720
 */
export async function extractFrameFromServerVideo(serverUrl: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const abortController = new AbortController()
    const { signal } = abortController
    let settled = false

    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true
    video.crossOrigin = 'anonymous'
    video.src = serverUrl

    const cleanup = () => {
      if (settled) return
      settled = true
      abortController.abort()
      video.removeAttribute('src')
      video.load()
    }

    // 15-second timeout — thumbnail generation is fire-and-forget so a timeout
    // that falls back to the placeholder is acceptable.
    const timeoutId = setTimeout(() => {
      cleanup()
      reject(new Error('Thumbnail frame extraction timed out after 15 seconds'))
    }, 15_000)

    const safeResolve = (blob: Blob) => {
      clearTimeout(timeoutId)
      cleanup()
      resolve(blob)
    }

    const safeReject = (err: Error) => {
      clearTimeout(timeoutId)
      cleanup()
      reject(err)
    }

    let seekTargetIndex = 0
    let seeksAttempted = false

    const attemptCapture = async () => {
      // Pre-capture validation: video must have valid dimensions and enough data
      if (video.videoWidth <= 0 || video.videoHeight <= 0) {
        // Try next seek target
        if (seekTargetIndex < SEEK_TARGETS.length - 1) {
          seekTargetIndex++
          seeksAttempted = true
          video.currentTime = SEEK_TARGETS[seekTargetIndex]
          return
        }
        safeReject(
          new Error(
            `Failed to capture frame: video has invalid dimensions (${video.videoWidth}×${video.videoHeight})`
          )
        )
        return
      }

      if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        // Not enough data yet — wait for more events
        return
      }

      try {
        const blob = await resizeImageToBlob(video)
        safeResolve(blob)
      } catch (err) {
        safeReject(
          new Error(
            `Failed to capture frame from server video (CORS may block canvas access): ${err instanceof Error ? err.message : 'Unknown error'}`
          )
        )
      }
    }

    const onLoadedMetadata = () => {
      if (signal.aborted) return
      seeksAttempted = true
      // Compute initial seek target: 10% of duration, capped at 3s (avoids black intro frames)
      const seekTo = Math.min(video.duration * 0.1, SEEK_TARGETS[0])
      video.currentTime = Number.isFinite(seekTo) && seekTo > 0 ? seekTo : 0
    }

    const onLoadedData = () => {
      if (signal.aborted) return
      // Only attempt capture from loadeddata after a seek has been performed.
      // Before the first seek, loadeddata fires with the frame at time 0
      // (often a black intro frame).
      if (!seeksAttempted) return
      void attemptCapture()
    }

    const onSeeked = () => {
      if (signal.aborted) return
      void attemptCapture()
    }

    const onError = () => {
      if (signal.aborted) return
      const mediaError = video.error
      const detail =
        mediaError?.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED
          ? 'format not supported by browser'
          : (mediaError?.message ?? 'unknown error')
      safeReject(new Error(`Failed to load server video for thumbnail: ${detail}`))
    }

    // Use AbortController signal for automatic listener cleanup
    video.addEventListener('loadedmetadata', onLoadedMetadata, { signal })
    video.addEventListener('loadeddata', onLoadedData, { signal })
    video.addEventListener('seeked', onSeeked, { signal })
    video.addEventListener('error', onError, { signal })

    video.load()
  })
}
