/**
 * storageDownload.ts — Per-table Supabase Storage download orchestration.
 *
 * After `_doDownload` applies Postgres row metadata, `downloadStorageFilesForTable`
 * is called for tables that carry binary assets. Each table handler resolves
 * remote Supabase Storage URLs to local blobs stored in OPFS / Dexie.
 *
 * Design decisions:
 * - Non-fatal: each per-record handler is wrapped in try/catch; failures emit
 *   console.warn and do not throw. Storage download is best-effort.
 * - Signed URL fallback: 401/403 responses trigger createSignedUrl() and retry.
 * - Local-presence checks: existing local blobs are not re-fetched (idempotent).
 * - Structural peer to storageSync.ts — same module layout for predictability.
 *
 * @module storageDownload
 * @since E94-S05
 */

import { db } from '@/db'
import { supabase } from '@/lib/auth/supabase'
import { opfsStorageService } from '@/services/OpfsStorageService'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Tables that carry binary assets and need download-side blob hydration. */
export const STORAGE_DOWNLOAD_TABLES = new Set([
  'importedCourses',
  'authors',
  'importedPdfs',
  'books',
])

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Download binary assets for a single table after `_applyRecord` loop completes.
 *
 * Dispatches to per-table handlers for `importedCourses`, `authors`,
 * `importedPdfs`, and `books`. Non-target tables are silently ignored.
 * Each per-record download is independently try/caught — one failure does
 * not block the others.
 *
 * @param tableName - Dexie/sync table name.
 * @param records   - Camel-cased records that were just applied to Dexie.
 * @param userId    - Authenticated user ID.
 */
export async function downloadStorageFilesForTable(
  tableName: string,
  records: Record<string, unknown>[],
  userId: string,
): Promise<void> {
  if (!supabase) return
  if (!STORAGE_DOWNLOAD_TABLES.has(tableName)) return

  for (const record of records) {
    try {
      switch (tableName) {
        case 'importedCourses':
          await _downloadCourseThumbnail(record, userId)
          break
        case 'authors':
          await _downloadAuthorPhoto(record, userId)
          break
        case 'importedPdfs':
          await _downloadPdfFile(record, userId)
          break
        case 'books':
          await _downloadBookCover(record, userId)
          await _downloadBookFile(record, userId) // E94-S07
          break
      }
    } catch (err) {
      console.warn(
        `[storageDownload] Non-fatal download failure for table "${tableName}", recordId "${record['id']}":`,
        err,
      )
    }
  }
}

// ---------------------------------------------------------------------------
// Per-table handlers
// ---------------------------------------------------------------------------

/** Download course thumbnail and store in db.courseThumbnails. */
async function _downloadCourseThumbnail(
  record: Record<string, unknown>,
  _userId: string,
): Promise<void> {
  const thumbnailUrl = record['thumbnailUrl'] as string | undefined
  if (!thumbnailUrl || !_isSupabaseStorageUrl(thumbnailUrl)) return

  // Local-presence check — skip if local record is as fresh as server.
  const courseId = record['id'] as string
  const existing = await db.courseThumbnails.get(courseId)
  if (existing) {
    const serverTs = (record['updatedAt'] as string | undefined) ?? ''
    if (existing.createdAt >= serverTs) return
  }

  const pathInfo = _extractStoragePath(thumbnailUrl)
  if (!pathInfo) return

  const blob = await _fetchWithSignedFallback(thumbnailUrl, pathInfo.bucket, pathInfo.path)

  await db.courseThumbnails.put({
    courseId,
    blob,
    source: 'server',
    createdAt: (record['updatedAt'] as string | undefined) ?? new Date().toISOString(),
  })
}

/** Download author photo and store as `photoBlob` on the authors record. */
async function _downloadAuthorPhoto(
  record: Record<string, unknown>,
  _userId: string,
): Promise<void> {
  const photoUrl = record['photoUrl'] as string | undefined
  if (!photoUrl || !_isSupabaseStorageUrl(photoUrl)) return

  const authorId = record['id'] as string
  const author = await db.authors.get(authorId)
  // Local-presence check — skip if blob already stored.
  if (author?.photoBlob) return

  const pathInfo = _extractStoragePath(photoUrl)
  if (!pathInfo) return

  const blob = await _fetchWithSignedFallback(photoUrl, pathInfo.bucket, pathInfo.path)

  await db.authors.update(authorId, { photoBlob: blob })
}

/** Download PDF file blob and store as `fileBlob` on the importedPdfs record. */
async function _downloadPdfFile(
  record: Record<string, unknown>,
  _userId: string,
): Promise<void> {
  const fileUrl = record['fileUrl'] as string | undefined
  if (!fileUrl || !_isSupabaseStorageUrl(fileUrl)) return

  const pdfId = record['id'] as string
  const pdf = await db.importedPdfs.get(pdfId)
  // Local-presence check — skip if blob already stored.
  if (pdf?.fileBlob) return

  const pathInfo = _extractStoragePath(fileUrl)
  if (!pathInfo) return

  // No size cap — AC4 explicitly excludes a cap for PDFs.
  const blob = await _fetchWithSignedFallback(fileUrl, pathInfo.bucket, pathInfo.path)

  await db.importedPdfs.update(pdfId, { fileBlob: blob })
}

/**
 * Download book cover and store via opfsStorageService.
 * Updates `db.books.coverUrl` to `opfs-cover://{bookId}` after write.
 */
async function _downloadBookCover(
  record: Record<string, unknown>,
  _userId: string,
): Promise<void> {
  const coverUrl = record['coverUrl'] as string | undefined
  if (!coverUrl || !_isSupabaseStorageUrl(coverUrl)) return

  const bookId = record['id'] as string

  // Local-presence check — skip if cover is already locally stored.
  const book = await db.books.get(bookId)
  if (
    book?.coverUrl?.startsWith('opfs-cover://') ||
    book?.coverUrl?.startsWith('opfs://')
  )
    return

  const pathInfo = _extractStoragePath(coverUrl)
  if (!pathInfo) return

  const blob = await _fetchWithSignedFallback(coverUrl, pathInfo.bucket, pathInfo.path)

  // storeCoverFile takes a Blob directly (confirmed from OpfsStorageService.ts line 133).
  await opfsStorageService.storeCoverFile(bookId, blob)

  // Update the local record so useBookCoverUrl renders from OPFS on next mount.
  await db.books.update(bookId, { coverUrl: `opfs-cover://${bookId}` })
}

/**
 * Download the primary book binary file from Supabase Storage and store it
 * locally via opfsStorageService (OPFS with automatic IDB fallback).
 *
 * Local-presence checks (two-stage):
 *   A. db.bookFiles IDB rows (bookId) — file stored as IDB fallback blob
 *   B. opfsStorageService.readBookFile — file stored in OPFS
 * Either hit → return early (idempotent; no re-fetch).
 *
 * Does NOT update db.books.fileUrl — the fieldMap: { fileUrl: 'file_url' }
 * from tableRegistry already set it to the remote HTTPS URL via the table-row
 * sync path. Overwriting with an OPFS path would break the remote URL reference.
 *
 * @since E94-S07
 */
async function _downloadBookFile(
  record: Record<string, unknown>,
  _userId: string,
): Promise<void> {
  const fileUrl = record['fileUrl'] as string | undefined
  if (!fileUrl || !_isSupabaseStorageUrl(fileUrl)) return

  const bookId = record['id'] as string

  // Local-presence check A: IDB fallback rows.
  const idbRows = await db.bookFiles.where('bookId').equals(bookId).toArray()
  if (idbRows.length > 0) return

  // Local-presence check B: OPFS.
  const opfsFile = await opfsStorageService.readBookFile(`/knowlune/books/${bookId}`, bookId)
  if (opfsFile) return

  const pathInfo = _extractStoragePath(fileUrl)
  if (!pathInfo) return

  const blob = await _fetchWithSignedFallback(fileUrl, pathInfo.bucket, pathInfo.path)

  const filename = decodeURIComponent(fileUrl.split('/').pop() ?? 'book.epub')
  await opfsStorageService.storeBookFile(bookId, new File([blob], filename, { type: blob.type }))

  // Do NOT update db.books.fileUrl — fieldMap writeback already set it to the remote URL.
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/**
 * Returns true if the URL points to a Supabase Storage endpoint.
 * Tolerates both Supabase Cloud and self-hosted deployments.
 * Guards against missing `import.meta.env` in Vitest environments.
 */
function _isSupabaseStorageUrl(url: string): boolean {
  if (!url.startsWith('https://')) return false

  // Supabase Cloud pattern.
  if (url.includes('supabase.co/storage')) return true

  // Self-hosted: match against VITE_SUPABASE_URL if available.
  const projectUrl: string =
    (typeof import.meta !== 'undefined' &&
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (import.meta as any).env?.VITE_SUPABASE_URL) ??
    ''

  if (projectUrl !== '' && url.startsWith(projectUrl) && url.includes('/storage/')) {
    return true
  }

  return false
}

/**
 * Extracts `{ bucket, path }` from a Supabase Storage public URL.
 *
 * Expected format:
 *   https://{host}/storage/v1/object/public/{bucket}/{path...}
 *
 * Returns null if the URL does not match the expected pattern.
 */
function _extractStoragePath(publicUrl: string): { bucket: string; path: string } | null {
  const MARKER = '/storage/v1/object/public/'
  const markerIdx = publicUrl.indexOf(MARKER)
  if (markerIdx === -1) return null

  const remainder = publicUrl.slice(markerIdx + MARKER.length)
  const slashIdx = remainder.indexOf('/')
  if (slashIdx === -1) return null

  const bucket = remainder.slice(0, slashIdx)
  const path = remainder.slice(slashIdx + 1)

  if (!bucket || !path) return null

  return { bucket, path }
}

/**
 * Fetches a URL and returns the response blob.
 * On 401/403, falls back to a Supabase signed URL and retries once.
 * Other HTTP errors or network failures are thrown (caller's try/catch handles).
 */
async function _fetchWithSignedFallback(
  url: string,
  bucket: string,
  storagePath: string,
): Promise<Blob> {
  const response = await fetch(url)

  if (response.ok) {
    return response.blob()
  }

  if (response.status === 401 || response.status === 403) {
    // Guard: supabase null check — should not reach here if caller guards, but
    // be defensive in case the function is called directly in tests.
    if (!supabase) {
      throw new Error('[storageDownload] Supabase client is null — cannot create signed URL.')
    }

    const { data } = await supabase.storage.from(bucket).createSignedUrl(storagePath, 3600)

    if (!data?.signedUrl) {
      throw new Error(
        `[storageDownload] createSignedUrl returned no URL for bucket "${bucket}" path "${storagePath}".`,
      )
    }

    const r2 = await fetch(data.signedUrl)
    if (r2.ok) return r2.blob()

    throw new Error(
      `[storageDownload] Signed URL fetch failed with status ${r2.status} for "${storagePath}".`,
    )
  }

  throw new Error(
    `[storageDownload] Fetch failed with status ${response.status} for "${url}".`,
  )
}
