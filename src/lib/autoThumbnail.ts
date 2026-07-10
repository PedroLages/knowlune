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

import { extractThumbnailFromVideo, saveCourseThumbnail, resizeImageToBlob } from '@/lib/thumbnailService'
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

/**
 * Extracts a single frame from a server-hosted video via an offscreen <video> element.
 *
 * Uses `crossOrigin: 'anonymous'` so canvas access works when the server
 * returns appropriate CORS headers. The seek target is the earlier of 10%
 * of duration or 3 seconds (avoids black intro frames).
 *
 * @param serverUrl - HTTP(S) URL of the video file
 * @returns JPEG blob at 1280×720
 */
export async function extractFrameFromServerVideo(serverUrl: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true
    video.crossOrigin = 'anonymous'
    video.src = serverUrl

    video.addEventListener('loadedmetadata', () => {
      const seekTo = Math.min(video.duration * 0.1, 3)
      video.currentTime = Number.isFinite(seekTo) && seekTo > 0 ? seekTo : 0
    })

    video.addEventListener('seeked', async () => {
      try {
        const blob = await resizeImageToBlob(video)
        resolve(blob)
      } catch (err) {
        reject(
          new Error(
            `Failed to capture frame from server video (CORS may block canvas access): ${err instanceof Error ? err.message : 'Unknown error'}`
          )
        )
      } finally {
        // Clean up the offscreen element
        video.removeAttribute('src')
        video.load()
      }
    })

    video.addEventListener('error', () => {
      const mediaError = video.error
      const detail =
        mediaError?.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED
          ? 'format not supported by browser'
          : mediaError?.message ?? 'unknown error'
      reject(new Error(`Failed to load server video for thumbnail: ${detail}`))
    })

    video.load()
  })
}
