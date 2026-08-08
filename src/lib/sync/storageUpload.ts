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

/** Supabase recommends TUS/resumable uploads for files above roughly 6 MiB. */
export const RESUMABLE_UPLOAD_THRESHOLD_BYTES = 6 * 1024 * 1024
const RESUMABLE_CHUNK_BYTES = 6 * 1024 * 1024

function encodeMetadata(value: string): string {
  // TUS metadata values are base64 encoded and must not contain line breaks.
  return btoa(unescape(encodeURIComponent(value)))
}

async function uploadResumable(
  bucket: string,
  path: string,
  blob: Blob,
  contentType: string
): Promise<void> {
  const client = supabase!
  const { data, error: sessionError } = await client.auth.getSession()
  const accessToken = data.session?.access_token
  if (sessionError || !accessToken) {
    throw new Error('[storageUpload] A signed-in session is required for resumable uploads')
  }

  const clientConfig = client as unknown as { supabaseUrl?: string; supabaseKey?: string }
  const baseUrl = clientConfig.supabaseUrl
  if (!baseUrl) throw new Error('[storageUpload] Supabase URL is unavailable')
  const authHeaders = {
    Authorization: `Bearer ${accessToken}`,
    ...(clientConfig.supabaseKey ? { apikey: clientConfig.supabaseKey } : {}),
  }
  const createResponse = await fetch(`${baseUrl}/storage/v1/upload/resumable`, {
    method: 'POST',
    headers: {
      ...authHeaders,
      'Tus-Resumable': '1.0.0',
      'Upload-Length': String(blob.size),
      'Upload-Metadata': [
        `bucketName ${encodeMetadata(bucket)}`,
        `objectName ${encodeMetadata(path)}`,
        `contentType ${encodeMetadata(contentType)}`,
      ].join(','),
      'x-upsert': 'true',
    },
  })
  if (!createResponse.ok) {
    throw new Error(
      `[storageUpload] Resumable session failed (${createResponse.status} ${createResponse.statusText})`
    )
  }

  const location = createResponse.headers.get('Location') ?? createResponse.headers.get('location')
  if (!location) throw new Error('[storageUpload] Resumable session did not return a location')

  let offset = 0
  while (offset < blob.size) {
    const chunk = blob.slice(offset, Math.min(offset + RESUMABLE_CHUNK_BYTES, blob.size))
    const patchResponse = await fetch(location, {
      method: 'PATCH',
      headers: {
        ...authHeaders,
        'Tus-Resumable': '1.0.0',
        'Upload-Offset': String(offset),
        'Content-Type': 'application/offset+octet-stream',
      },
      body: chunk,
    })
    if (!patchResponse.ok) {
      throw new Error(
        `[storageUpload] Resumable chunk failed (${patchResponse.status} ${patchResponse.statusText})`
      )
    }
    const nextOffset = Number(patchResponse.headers.get('Upload-Offset'))
    if (!Number.isFinite(nextOffset) || nextOffset <= offset) {
      throw new Error('[storageUpload] Resumable server returned an invalid upload offset')
    }
    offset = nextOffset
  }
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
  options?: UploadBlobOptions
): Promise<UploadBlobResult> {
  // Guard: Supabase singleton null when env vars missing.
  if (!supabase) {
    throw new Error(
      '[storageUpload] Supabase client is not initialised — check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
    )
  }

  // Size enforcement — checked before any network call (exclusive: > not >=).
  if (options?.maxSizeBytes !== undefined && blob.size > options.maxSizeBytes) {
    throw new RangeError(
      `[storageUpload] Blob size ${blob.size} bytes exceeds limit of ${options.maxSizeBytes} bytes for bucket "${bucket}" at path "${path}".`
    )
  }

  const contentType = blob.type || 'application/octet-stream'
  if (blob.size > RESUMABLE_UPLOAD_THRESHOLD_BYTES) {
    await uploadResumable(bucket, path, blob, contentType)
  }

  const { error } =
    blob.size > RESUMABLE_UPLOAD_THRESHOLD_BYTES
      ? { error: null }
      : await supabase.storage.from(bucket).upload(path, blob, {
          upsert: true,
          contentType,
        })

  if (error) {
    throw new Error(`[storageUpload] Upload failed for "${bucket}/${path}": ${error.message}`)
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path)

  return { url: data.publicUrl, path }
}
