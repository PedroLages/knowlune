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
    throw new Error('Supabase client is not available. Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
  }
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) {
    throw new Error('Authentication required to upload covers')
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
    throw new Error('Supabase client is not available. Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
  }

  // Get authenticated user ID for path-scoped storage key
  const userId = await getUserId()

  // Validate file type
  const supportedFormats = ['image/jpeg', 'image/png', 'image/webp']
  if (!supportedFormats.includes(file.type)) {
    throw new Error('Unsupported image format. Use JPEG, PNG, or WebP.')
  }

  // Process image
  const img = await loadImageFile(file)
  const blob = await resizeToJpegBlob(img, COVER_W, COVER_H)

  // Upload to Supabase Storage under user-scoped path for RLS compatibility
  const key = `${userId}/${pathId}.jpg`

  // Attempt pure INSERT (no upsert — explicit delete+insert on 409 Conflict)
  const { error } = await supabase.storage.from(BUCKET_NAME).upload(key, blob, {
    contentType: 'image/jpeg',
    cacheControl: '3600',
  })

  // 409 Conflict: object already exists — delete then re-insert
  if (error?.statusCode === '409') {
    const { error: removeError } = await supabase.storage.from(BUCKET_NAME).remove([key])
    if (removeError) {
      console.error('[PathCoverUpload] Remove failed during 409 retry:', removeError)
      throw new Error('Failed to upload cover image. Please try again.')
    }

    const { error: retryError } = await supabase.storage.from(BUCKET_NAME).upload(key, blob, {
      contentType: 'image/jpeg',
      cacheControl: '3600',
    })

    if (retryError) {
      console.error('[PathCoverUpload] Retry upload failed after 409:', retryError)
      throw new Error('Failed to upload cover image. Please try again.')
    }
  } else if (error) {
    console.error('[PathCoverUpload] Upload failed:', error)
    throw new Error('Failed to upload cover image. Please try again.')
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
