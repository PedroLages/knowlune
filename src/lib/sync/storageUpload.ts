/**
 * storageUpload.ts — Core Supabase Storage upload utility.
 *
 * Provides `uploadBlob()`: a size-checked, upsert-enabled blob upload
 * returning a stable public URL and the storage path.
 *
 * Callers are responsible for non-fatal error handling (catch + warn).
 * This function throws on any failure so callers can decide severity.
 *
 * @module storageUpload
 * @since E94-S04
 */

import { supabase } from '@/lib/auth/supabase'

export interface UploadBlobOptions {
  /** Maximum allowed blob size in bytes. Throws RangeError if exceeded (exclusive: > not >=). */
  maxSizeBytes?: number
}

export interface UploadBlobResult {
  /** Public URL returned by getPublicUrl() — stable reference, requires auth for private buckets. */
  url: string
  /** Storage path used for the upload (e.g. `{userId}/{recordId}/filename.jpg`). */
  path: string
}

/**
 * Upload a Blob to a Supabase Storage bucket with upsert semantics.
 *
 * @param bucket  - Storage bucket name (e.g. 'course-thumbnails').
 * @param path    - Object path within the bucket (e.g. '{userId}/{recordId}/thumbnail.jpg').
 * @param blob    - Blob to upload.
 * @param options - Optional constraints (maxSizeBytes).
 * @returns       Upload result with url and path.
 * @throws        RangeError if blob exceeds maxSizeBytes.
 * @throws        Error if Supabase client is unavailable or upload fails.
 */
export async function uploadBlob(
  bucket: string,
  path: string,
  blob: Blob,
  options?: UploadBlobOptions,
): Promise<UploadBlobResult> {
  // Guard: Supabase singleton null when env vars missing.
  if (!supabase) {
    throw new Error('[storageUpload] Supabase client is not initialised — check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
  }

  // Size enforcement — checked before any network call (exclusive: > not >=).
  if (options?.maxSizeBytes !== undefined && blob.size > options.maxSizeBytes) {
    throw new RangeError(
      `[storageUpload] Blob size ${blob.size} bytes exceeds limit of ${options.maxSizeBytes} bytes for bucket "${bucket}" at path "${path}".`,
    )
  }

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, blob, { upsert: true, contentType: blob.type || undefined })

  if (error) {
    throw new Error(`[storageUpload] Upload failed for "${bucket}/${path}": ${error.message}`)
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path)

  return { url: data.publicUrl, path }
}
