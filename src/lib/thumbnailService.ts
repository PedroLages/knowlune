/**
 * Thumbnail service for course card images.
 *
 * Provides four sources for course thumbnails:
 *   'auto'  — extract a frame from the first video via Canvas API
 *   'local' — resize a user-selected image File
 *   'url'   — fetch an image from a URL and resize
 *   'ai'    — generate an image via Google Gemini API
 *
 * All sources produce a 1280×720px JPEG Blob (16:9, ~0.8 quality).
 */

import { db } from '@/db'
import type { CourseThumbnail, ThumbnailSource } from '@/data/types'
import { resolveFeatureModel } from './aiConfiguration'

// Target dimensions: 1280×720, 16:9
const THUMB_W = 1280
const THUMB_H = 720
const JPEG_QUALITY = 0.82

// ---------------------------------------------------------------------------
// Core resize utility (shared by all sources)
// ---------------------------------------------------------------------------

function resizeImageToBlob(
  source: HTMLVideoElement | HTMLImageElement | ImageBitmap,
  width = THUMB_W,
  height = THUMB_H
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      reject(new Error('Canvas context unavailable'))
      return
    }
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'

    const sourceWidth =
      'videoWidth' in source && source.videoWidth > 0
        ? source.videoWidth
        : 'naturalWidth' in source && source.naturalWidth > 0
          ? source.naturalWidth
          : source.width
    const sourceHeight =
      'videoHeight' in source && source.videoHeight > 0
        ? source.videoHeight
        : 'naturalHeight' in source && source.naturalHeight > 0
          ? source.naturalHeight
          : source.height

    if (sourceWidth > 0 && sourceHeight > 0) {
      const sourceRatio = sourceWidth / sourceHeight
      const targetRatio = width / height
      let cropX = 0
      let cropY = 0
      let cropWidth = sourceWidth
      let cropHeight = sourceHeight

      if (sourceRatio > targetRatio) {
        cropWidth = sourceHeight * targetRatio
        cropX = (sourceWidth - cropWidth) / 2
      } else if (sourceRatio < targetRatio) {
        cropHeight = sourceWidth / targetRatio
        cropY = (sourceHeight - cropHeight) / 2
      }

      ctx.drawImage(source, cropX, cropY, cropWidth, cropHeight, 0, 0, width, height)
    } else {
      // Defensive fallback for browser/test doubles that do not expose dimensions.
      ctx.drawImage(source, 0, 0, width, height)
    }
    canvas.toBlob(
      blob => {
        if (blob) resolve(blob)
        else reject(new Error('Canvas toBlob returned null'))
      },
      'image/jpeg',
      JPEG_QUALITY
    )
  })
}

// ---------------------------------------------------------------------------
// Source 1: Auto-extract frame from video FileSystemFileHandle
// ---------------------------------------------------------------------------

export async function extractThumbnailFromVideo(videoHandle: FileSystemFileHandle): Promise<Blob> {
  const file = await videoHandle.getFile()
  const url = URL.createObjectURL(file)

  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true
    video.src = url

    const cleanup = () => URL.revokeObjectURL(url)

    video.addEventListener('loadedmetadata', () => {
      // Seek to 10% of duration (or 3s, whichever is smaller)
      const seekTo = Math.min(video.duration * 0.1, 3)
      video.currentTime = isFinite(seekTo) && seekTo > 0 ? seekTo : 0
    })

    video.addEventListener('seeked', async () => {
      try {
        const blob = await resizeImageToBlob(video)
        cleanup()
        resolve(blob)
      } catch (err) {
        cleanup()
        reject(err)
      }
    })

    video.addEventListener('error', () => {
      cleanup()
      reject(new Error('Failed to load video for thumbnail extraction'))
    })

    // Trigger load
    video.load()
  })
}

// ---------------------------------------------------------------------------
// Source 2: Local image File upload
// ---------------------------------------------------------------------------

export async function loadThumbnailFromFile(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  try {
    return await resizeImageToBlob(bitmap)
  } finally {
    bitmap.close()
  }
}

// ---------------------------------------------------------------------------
// Source 3: Fetch image from URL
// ---------------------------------------------------------------------------

const GENERIC_BINARY_CONTENT_TYPE = 'application/octet-stream'
const RASTER_MIME_BY_EXTENSION: Readonly<Record<string, string>> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
}

export type ThumbnailFetchFailure = 'network' | 'http' | 'content-type' | 'decode'

export class ThumbnailFetchError extends Error {
  constructor(
    message: string,
    public readonly failure: ThumbnailFetchFailure
  ) {
    super(message)
    this.name = 'ThumbnailFetchError'
  }
}

function inferRasterMimeType(filename: string | undefined): string | null {
  if (!filename) return null
  const lower = filename.toLowerCase()
  const extension = Object.keys(RASTER_MIME_BY_EXTENSION).find(ext => lower.endsWith(ext))
  return extension ? RASTER_MIME_BY_EXTENSION[extension] : null
}

export async function fetchThumbnailFromUrl(
  url: string,
  options: { expectedFilename?: string } = {}
): Promise<Blob> {
  let response: Response
  try {
    response = await fetch(url, { mode: 'cors' })
  } catch {
    throw new ThumbnailFetchError(
      'Could not fetch this URL because the server blocked browser access.',
      'network'
    )
  }

  if (!response.ok) {
    throw new ThumbnailFetchError(`Fetch failed: ${response.status} ${response.statusText}`, 'http')
  }

  const responseContentType = (response.headers.get('content-type') ?? '')
    .split(';', 1)[0]
    .trim()
    .toLowerCase()
  const inferredContentType = inferRasterMimeType(options.expectedFilename)
  const contentType = responseContentType.startsWith('image/')
    ? responseContentType
    : responseContentType === GENERIC_BINARY_CONTENT_TYPE
      ? inferredContentType
      : null

  if (!contentType) {
    throw new ThumbnailFetchError(
      'URL did not return an image or supported raster file.',
      'content-type'
    )
  }

  const arrayBuffer = await response.arrayBuffer()
  const srcBlob = new Blob([arrayBuffer], { type: contentType })
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(srcBlob)
  } catch {
    throw new ThumbnailFetchError('The selected image could not be decoded.', 'decode')
  }

  try {
    return await resizeImageToBlob(bitmap)
  } finally {
    bitmap.close()
  }
}

// ---------------------------------------------------------------------------
// Source 4: AI generation via Google Gemini
// ---------------------------------------------------------------------------

export async function generateThumbnailWithGemini(
  courseName: string,
  apiKey: string
): Promise<Blob> {
  const prompt =
    `Create a professional, visually engaging course thumbnail for: "${courseName}". ` +
    'Style: clean, modern, educational. Minimal text. Bold visual metaphor for the subject.'

  // Use per-feature model resolution (user override → feature default → provider default)
  const resolved = resolveFeatureModel('thumbnailGeneration')
  const modelId = resolved.model

  const endpoint =
    'https://generativelanguage.googleapis.com/v1beta/models/' +
    `${modelId}:generateContent?key=${apiKey}`

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
  }

  let response: Response
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    throw new Error('Network error — check your internet connection and try again.')
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    if (response.status === 403 || response.status === 401) {
      throw new Error('Invalid Gemini API key. Update it in Settings → AI Configuration.')
    }
    throw new Error(`Gemini API error ${response.status}: ${detail.slice(0, 120)}`)
  }

  type GeminiPart = { text?: string; inlineData?: { mimeType: string; data: string } }
  type GeminiResponse = { candidates?: Array<{ content: { parts: GeminiPart[] } }> }
  const data: GeminiResponse = await response.json()

  const parts = data.candidates?.[0]?.content?.parts ?? []
  const imagePart = parts.find(p => p.inlineData?.mimeType.startsWith('image/'))
  if (!imagePart?.inlineData) {
    throw new Error('Gemini did not return an image. Try a different prompt.')
  }

  const { mimeType, data: base64 } = imagePart.inlineData
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  const srcBlob = new Blob([bytes], { type: mimeType })

  const bitmap = await createImageBitmap(srcBlob)
  try {
    return await resizeImageToBlob(bitmap)
  } finally {
    bitmap.close()
  }
}

// ---------------------------------------------------------------------------
// Persistence helpers
// ---------------------------------------------------------------------------

export async function saveCourseThumbnail(
  courseId: string,
  blob: Blob,
  source: ThumbnailSource
): Promise<void> {
  const record: CourseThumbnail = {
    courseId,
    blob,
    source,
    createdAt: new Date().toISOString(),
  }
  await db.courseThumbnails.put(record)
}

export async function loadCourseThumbnailUrl(courseId: string): Promise<string | null> {
  const record = await db.courseThumbnails.get(courseId)
  if (!record) return null
  if (record.blob) return URL.createObjectURL(record.blob)
  return record.remoteUrl
}

export async function deleteCourseThumbnail(courseId: string): Promise<void> {
  await db.courseThumbnails.delete(courseId)
}
