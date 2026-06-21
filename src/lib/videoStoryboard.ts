/**
 * Video storyboard sprite-sheet generation for instant scrub previews.
 *
 * Generates a grid of thumbnail frames from a local video file, mirrors
 * YouTube's storyboard mechanism: pre-generate a sprite sheet, then on
 * hover use CSS background-position to show the correct tile instantly.
 *
 * Two-tier strategy (per the plan):
 *   Storyboard present → CSS sprite tile (instant)
 *   Storyboard absent  → live offscreen seek + canvas draw (useScrubPreview)
 *
 * Generation is sequential with idle-yielding between frames so the UI
 * stays responsive. WebCodecs/worker acceleration is deferred.
 *
 * @module videoStoryboard
 */

import { db } from '@/db'
import type { VideoStoryboard } from '@/data/types'

// ---- tunable constants ----------------------------------------------------

/** Maximum frames per sheet (limits storage and generation time) */
const MAX_FRAMES = 180

/** Minimum interval between frames in seconds */
const MIN_INTERVAL = 1

/** Tile dimensions in pixels (16:9) */
const TILE_W = 160
const TILE_H = 90

/** Maximum sheet dimension in either axis (~4096px GPU texture limit) */
const MAX_SHEET_DIM = 4096

/** JPEG quality (0–1) */
const JPEG_QUALITY = 0.8

// ---- helpers --------------------------------------------------------------

/** Clamp value between min and max */
function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(val, max))
}

/** Compute grid layout that fits within the dimension cap */
function computeGrid(
  frameCount: number,
  tileW: number,
  tileH: number,
  maxDim: number
): { columns: number; rows: number } {
  // Max tiles per row/col given the dimension cap
  const maxCols = Math.floor(maxDim / tileW)
  const maxRows = Math.floor(maxDim / tileH)

  // Start with a roughly square grid, then adjust
  let columns = Math.ceil(Math.sqrt(frameCount))
  let rows = Math.ceil(frameCount / columns)

  // If either dimension exceeds the cap, grow the other axis
  if (columns > maxCols) {
    columns = maxCols
    rows = Math.ceil(frameCount / columns)
  }
  if (rows > maxRows) {
    rows = maxRows
    columns = Math.ceil(frameCount / rows)
  }

  return { columns, rows }
}

// ---- generation -----------------------------------------------------------

export interface StoryboardResult {
  blob: Blob
  columns: number
  rows: number
  tileWidth: number
  tileHeight: number
  interval: number
  frameCount: number
  duration: number
}

/**
 * Generate a storyboard sprite sheet from a video file handle.
 *
 * Opens a hidden <video>, seeks sequentially at the computed interval,
 * draws each frame into a grid canvas, and returns the resulting blob.
 *
 * Returns `null` on any failure (never throws) — callers should fall back
 * to live extraction.
 */
export async function generateStoryboard(
  fileHandle: FileSystemFileHandle,
  opts?: { signal?: AbortSignal }
): Promise<StoryboardResult | null> {
  const file = await fileHandle.getFile()
  const url = URL.createObjectURL(file)

  try {
    return await new Promise<StoryboardResult | null>((resolve, _reject) => {
      const video = document.createElement('video')
      video.preload = 'metadata'
      video.muted = true
      video.crossOrigin = 'anonymous'
      video.src = url

      // Abort if signalled
      const onAbort = () => {
        cleanup()
        resolve(null)
      }
      opts?.signal?.addEventListener('abort', onAbort, { once: true })

      const cleanup = () => {
        URL.revokeObjectURL(url)
        video.removeEventListener('loadedmetadata', onMetadata)
        video.removeEventListener('error', onError)
        opts?.signal?.removeEventListener('abort', onAbort)
        video.pause()
        video.removeAttribute('src')
      }

      const onError = () => {
        cleanup()
        resolve(null)
      }

      video.addEventListener('error', onError)

      const onMetadata = async () => {
        const duration = video.duration
        if (!isFinite(duration) || duration <= 0) {
          cleanup()
          resolve(null)
          return
        }

        // Compute adaptive interval
        const interval = clamp(duration / MAX_FRAMES, MIN_INTERVAL, duration)
        const frameCount = Math.max(1, Math.floor(duration / interval))
        const { columns, rows } = computeGrid(frameCount, TILE_W, TILE_H, MAX_SHEET_DIM)

        // Allocate grid canvas
        const canvas = document.createElement('canvas')
        canvas.width = columns * TILE_W
        canvas.height = rows * TILE_H
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          cleanup()
          resolve(null)
          return
        }
        ctx.imageSmoothingEnabled = true

        // Seek-and-draw loop
        const rvfcAvailable = typeof (video as any).requestVideoFrameCallback === 'function'

        for (let i = 0; i < frameCount; i++) {
          // Check abort between frames
          if (opts?.signal?.aborted) {
            cleanup()
            resolve(null)
            return
          }

          const targetTime = i * interval
          const drawn = await seekAndDraw(video, targetTime, rvfcAvailable)
          if (drawn && video.videoWidth > 0) {
            const col = i % columns
            const row = Math.floor(i / columns)
            ctx.drawImage(video, col * TILE_W, row * TILE_H, TILE_W, TILE_H)
          }

          // Yield to the browser so the UI stays responsive
          await new Promise<void>(r => setTimeout(r, 0))
        }

        // Export to blob
        canvas.toBlob(
          blob => {
            cleanup()
            if (blob) {
              resolve({
                blob,
                columns,
                rows,
                tileWidth: TILE_W,
                tileHeight: TILE_H,
                interval,
                frameCount,
                duration,
              })
            } else {
              resolve(null)
            }
          },
          'image/jpeg',
          JPEG_QUALITY
        )
      }

      video.addEventListener('loadedmetadata', onMetadata)
      video.load()
    })
  } catch {
    URL.revokeObjectURL(url)
    return null
  }
}

/**
 * Seek to a time and wait for a drawable frame.
 * Uses requestVideoFrameCallback when available (Chrome/Safari),
 * falling back to the seeked event otherwise.
 */
function seekAndDraw(
  video: HTMLVideoElement,
  time: number,
  rvfcAvailable: boolean
): Promise<boolean> {
  return new Promise(resolve => {
    const clamped = Math.max(0, Math.min(time, video.duration || 0))

    const onSeeked = () => {
      if (rvfcAvailable) {
        ;(video as any).requestVideoFrameCallback(() => resolve(true))
      } else {
        resolve(true)
      }
    }

    const onError = () => {
      video.removeEventListener('seeked', onSeeked)
      resolve(false)
    }

    video.addEventListener('seeked', onSeeked, { once: true })
    video.addEventListener('error', onError, { once: true })

    video.currentTime = clamped
  })
}

// ---- persistence ----------------------------------------------------------

/** Save a generated storyboard to IndexedDB */
export async function saveVideoStoryboard(
  videoId: string,
  courseId: string,
  result: StoryboardResult
): Promise<void> {
  const record: VideoStoryboard = {
    videoId,
    courseId,
    blob: result.blob,
    columns: result.columns,
    rows: result.rows,
    tileWidth: result.tileWidth,
    tileHeight: result.tileHeight,
    interval: result.interval,
    frameCount: result.frameCount,
    duration: result.duration,
    createdAt: new Date().toISOString(),
  }
  await db.videoStoryboards.put(record)
}

/** Load a storyboard record and return an object URL for the sprite sheet */
export async function loadVideoStoryboard(
  videoId: string
): Promise<{
  url: string
  columns: number
  rows: number
  tileWidth: number
  tileHeight: number
  interval: number
  frameCount: number
} | null> {
  const record = await db.videoStoryboards.get(videoId)
  if (!record) return null
  return {
    url: URL.createObjectURL(record.blob),
    columns: record.columns,
    rows: record.rows,
    tileWidth: record.tileWidth,
    tileHeight: record.tileHeight,
    interval: record.interval,
    frameCount: record.frameCount,
  }
}

/** Delete a single video's storyboard */
export async function deleteVideoStoryboard(videoId: string): Promise<void> {
  await db.videoStoryboards.delete(videoId)
}

/** Delete all storyboards for a course (bulk cleanup on course delete) */
export async function deleteVideoStoryboardsForCourse(courseId: string): Promise<void> {
  await db.videoStoryboards.where('courseId').equals(courseId).delete()
}
