/**
 * Learning Path cover image upload to Supabase Storage.
 *
 * Processes images to a stable format (JPEG, 1280x720, ~0.82 quality) and
 * uploads them to the Supabase Storage bucket `learning-path-covers/`.
 * Returns the public URL for persistence on the LearningPath record.
 */

import { supabase } from '@/lib/auth/supabase'

// Target dimensions: 16:9, matching course thumbnail aspect ratio
const COVER_W = 1280
const COVER_H = 720
const JPEG_QUALITY = 0.82
const BUCKET_NAME = 'learning-path-covers'

/** User-facing diagnostic messages keyed by failure category (never exposes internal schema/policy names) */
const DIAGNOSTIC = {
  AUTH_REQUIRED: 'Sign in required to upload covers',
  FORMAT_UNSUPPORTED: 'Unsupported image format. Use JPEG, PNG, or WebP.',
  IMAGE_PROCESSING: 'Could not process this image. Try a different file.',
  REPLACE_REMOVE_FAILED: 'Failed to replace existing cover. Please try again.',
  REPLACE_RETRY_FAILED: 'Cover upload failed after clearing old cover. Please try again.',
  STORAGE_ERROR: 'Cover upload failed. Check your connection and try again.',
  NETWORK_ERROR: 'Network error during upload. Check your connection.',
  CONFIG_ERROR: 'App configuration error. Check your connection and try again.',
} as const

/** Validates and loads an image file into an ImageBitmap */
async function loadImageFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('Failed to load image file'))
      img.src = reader.result as string
    }
    reader.onerror = () => reject(new Error('Failed to read image file'))
    reader.readAsDataURL(file)
  })
}

/** Resize and convert an image to a JPEG blob at target dimensions */
function resizeToJpegBlob(
  source: HTMLImageElement | ImageBitmap,
  width: number,
  height: number
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

    // Center-crop to 16:9
    const sourceAspect = source.width / source.height
    const targetAspect = width / height
    let sx = 0
    let sy = 0
    let sw = source.width
    let sh = source.height
    if (sourceAspect > targetAspect) {
      sw = source.height * targetAspect
      sx = (source.width - sw) / 2
    } else {
      sh = source.width / targetAspect
      sy = (source.height - sh) / 2
    }
    ctx.drawImage(source, sx, sy, sw, sh, 0, 0, width, height)
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

/**
 * Get the current user's ID from the authenticated Supabase session.
 * Throws if the user is not authenticated.
 */
async function getUserId(): Promise<string> {
  if (!supabase) {
    throw new Error(DIAGNOSTIC.CONFIG_ERROR)
  }
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) {
    throw new Error(DIAGNOSTIC.AUTH_REQUIRED)
  }
  return data.user.id
}

/**
 * Upload a cover image file to Supabase Storage and return the public URL.
 *
 * Processing steps:
 * 1. Load and decode the image
 * 2. Resize and convert to JPEG (1280x720, center-crop to 16:9)
 * 3. Upload to Supabase Storage bucket `learning-path-covers/`
 * 4. Return the public URL
 *
 * @param file - The image file to upload
 * @param pathId - The learning path ID (used as the storage object key)
 * @returns The public URL of the uploaded cover
 */
export async function uploadPathCover(file: File, pathId: string): Promise<string> {
  if (!supabase) {
    throw new Error(DIAGNOSTIC.CONFIG_ERROR)
  }

  // Get authenticated user ID for path-scoped storage key
  const userId = await getUserId()

  // Validate file type
  const supportedFormats = ['image/jpeg', 'image/png', 'image/webp']
  if (!supportedFormats.includes(file.type)) {
    throw new Error(DIAGNOSTIC.FORMAT_UNSUPPORTED)
  }

  // Process image — remap all internal processing errors to one diagnostic
  let blob: Blob
  try {
    const img = await loadImageFile(file)
    blob = await resizeToJpegBlob(img, COVER_W, COVER_H)
  } catch (err) {
    // All four failure modes (reader read, image decode, canvas context, toBlob null)
    // are remapped to IMAGE_PROCESSING. Original error logged for debugging.
    console.error(
      '[PathCoverUpload] Image processing failed:',
      err instanceof Error ? err.message : err
    )
    throw new Error(DIAGNOSTIC.IMAGE_PROCESSING)
  }

  // Upload to Supabase Storage under user-scoped path for RLS compatibility
  const key = `${userId}/${pathId}.jpg`
  const maskedKey = `${userId.slice(0, 8)}.../${pathId.slice(0, 8)}...`

  // Outer try/catch for thrown network/fetch errors (Supabase SDK may throw on connectivity failure)
  try {
    // Attempt pure INSERT (no upsert — explicit delete+insert on 409 Conflict)
    const { error } = await supabase.storage.from(BUCKET_NAME).upload(key, blob, {
      contentType: 'image/jpeg',
      cacheControl: '3600',
    })

    // 409 Conflict: object already exists — delete then re-insert
    // Supabase client may surface statusCode as string or number depending on version.
    if (Number(error?.statusCode) === 409) {
      const { error: removeError } = await supabase.storage.from(BUCKET_NAME).remove([key])
      if (removeError) {
        console.error(
          '[PathCoverUpload] Remove failed during 409 retry:',
          { bucket: BUCKET_NAME, key: maskedKey, statusCode: removeError.statusCode || 'unknown', message: removeError.message }
        )
        throw new Error(DIAGNOSTIC.REPLACE_REMOVE_FAILED)
      }

      const { error: retryError } = await supabase.storage.from(BUCKET_NAME).upload(key, blob, {
        contentType: 'image/jpeg',
        cacheControl: '3600',
      })

      if (retryError) {
        console.error(
          '[PathCoverUpload] Retry upload failed after 409:',
          { bucket: BUCKET_NAME, key: maskedKey, statusCode: retryError.statusCode || 'unknown', message: retryError.message }
        )
        throw new Error(DIAGNOSTIC.REPLACE_RETRY_FAILED)
      }
    } else if (error) {
      console.error(
        '[PathCoverUpload] Upload failed:',
        { bucket: BUCKET_NAME, key: maskedKey, statusCode: error.statusCode || 'unknown', message: error.message }
      )
      throw new Error(DIAGNOSTIC.STORAGE_ERROR)
    }
  } catch (err) {
    // Re-throw errors that already carry diagnostic messages (thrown above)
    if (err instanceof Error && Object.values(DIAGNOSTIC).includes(err.message as typeof DIAGNOSTIC[keyof typeof DIAGNOSTIC])) {
      throw err
    }
    // Catch thrown network/fetch errors that bypass the .error pathway
    console.error(
      '[PathCoverUpload] Network error during upload:',
      { bucket: BUCKET_NAME, key: maskedKey, error: err instanceof Error ? err.message : String(err) }
    )
    throw new Error(DIAGNOSTIC.NETWORK_ERROR)
  }

  // Get public URL
  const { data: urlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(key)
  return urlData.publicUrl
}

/**
 * Delete a cover image from Supabase Storage.
 */
export async function deletePathCover(pathId: string): Promise<void> {
  try {
    if (!supabase) return

    // Get authenticated user ID to resolve the user-scoped storage path
    const userId = await getUserId()

    const key = `${userId}/${pathId}.jpg`
    const { error } = await supabase.storage.from(BUCKET_NAME).remove([key])
    if (error) {
      console.warn('[PathCoverUpload] Delete failed (non-fatal):', error.message)
    }
  } catch (err) {
    console.warn('[PathCoverUpload] Delete failed (non-fatal):', err)
  }
}
