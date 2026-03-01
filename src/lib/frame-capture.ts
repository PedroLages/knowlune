import { db } from '@/db'
import type { Screenshot } from '@/data/types'
import { formatTimestamp } from '@/lib/format'

const THUMBNAIL_WIDTH = 200
const JPEG_QUALITY = 0.92
const THUMBNAIL_QUALITY = 0.8

export interface CapturedFrame {
  id: string
  timestamp: number
}

/**
 * Capture the current video frame as a JPEG blob + 200px thumbnail.
 * Draws the video onto an offscreen canvas, then exports both sizes.
 */
export function captureVideoFrame(
  video: HTMLVideoElement
): Promise<{ blob: Blob; thumbnail: Blob }> {
  return new Promise((resolve, reject) => {
    const { videoWidth, videoHeight } = video
    if (videoWidth === 0 || videoHeight === 0) {
      reject(new Error('Video has no dimensions — cannot capture frame'))
      return
    }

    // Full-resolution capture
    const canvas = document.createElement('canvas')
    canvas.width = videoWidth
    canvas.height = videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      reject(new Error('Cannot create canvas context'))
      return
    }
    ctx.drawImage(video, 0, 0, videoWidth, videoHeight)

    canvas.toBlob(
      fullBlob => {
        if (!fullBlob) {
          reject(new Error('Canvas toBlob returned null'))
          return
        }

        // Thumbnail capture (200px wide, proportional height)
        const thumbCanvas = document.createElement('canvas')
        const scale = THUMBNAIL_WIDTH / videoWidth
        thumbCanvas.width = THUMBNAIL_WIDTH
        thumbCanvas.height = Math.round(videoHeight * scale)
        const thumbCtx = thumbCanvas.getContext('2d')
        if (!thumbCtx) {
          reject(new Error('Cannot create thumbnail canvas context'))
          return
        }
        thumbCtx.drawImage(video, 0, 0, thumbCanvas.width, thumbCanvas.height)

        thumbCanvas.toBlob(
          thumbBlob => {
            if (!thumbBlob) {
              reject(new Error('Thumbnail toBlob returned null'))
              return
            }
            resolve({ blob: fullBlob, thumbnail: thumbBlob })
          },
          'image/jpeg',
          THUMBNAIL_QUALITY
        )
      },
      'image/jpeg',
      JPEG_QUALITY
    )
  })
}

/**
 * Save a captured frame to IndexedDB. Handles QuotaExceededError gracefully.
 * Returns the screenshot record on success, or throws with a user-friendly message.
 */
export async function saveFrameCapture(
  courseId: string,
  lessonId: string,
  timestamp: number,
  blob: Blob,
  thumbnail: Blob
): Promise<Screenshot> {
  const id = crypto.randomUUID()
  const screenshot: Screenshot = {
    id,
    courseId,
    lessonId,
    timestamp,
    blob,
    thumbnail,
    createdAt: new Date().toISOString(),
  }

  try {
    await db.screenshots.add(screenshot)
    return screenshot
  } catch (error) {
    if (
      error instanceof DOMException &&
      (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED')
    ) {
      throw new Error(
        'Storage full — delete old frame captures to free space. Your note was not affected.'
      )
    }
    throw error
  }
}

/**
 * Load a screenshot's thumbnail blob from IndexedDB and create an object URL.
 */
export async function getFrameThumbnailUrl(screenshotId: string): Promise<string | null> {
  const screenshot = await db.screenshots.get(screenshotId)
  if (!screenshot) return null
  return URL.createObjectURL(screenshot.thumbnail)
}

/**
 * Load a screenshot record from IndexedDB.
 */
export async function getScreenshot(screenshotId: string): Promise<Screenshot | undefined> {
  return db.screenshots.get(screenshotId)
}

/**
 * Format seconds as "Frame at M:SS" (or "Frame at H:MM:SS") caption text.
 */
export function formatFrameTimestamp(seconds: number): string {
  return `Frame at ${formatTimestamp(seconds)}`
}
