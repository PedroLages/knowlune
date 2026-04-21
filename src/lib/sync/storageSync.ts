/**
 * storageSync.ts — Per-table Supabase Storage upload orchestration.
 *
 * After a successful sync queue batch write, `uploadStorageFilesForTable`
 * is called for tables that carry binary assets. Each table handler reads
 * binary data from Dexie (FileSystemFileHandles, blobs, OPFS) and uploads
 * to the appropriate Supabase Storage bucket.
 *
 * Design decisions:
 * - Non-fatal: each handler is wrapped in try/catch; failures emit
 *   console.warn and do not throw. Storage upload is best-effort.
 * - Direct Supabase update after upload: URL writeback uses
 *   supabase.from(...).update(...) — not syncableWrite — so no new
 *   sync queue entry is generated for the URL column itself.
 * - FileSystemFileHandle stale detection: DOMException on .getFile() is
 *   caught and silently skipped (expected after page reload).
 * - OPFS object URL lifecycle: URL.revokeObjectURL called immediately
 *   after fetch() completes to prevent memory leaks.
 *
 * @module storageSync
 * @since E94-S04
 */

import { db } from '@/db'
import type { SyncQueueEntry } from '@/db/schema'
import { supabase } from '@/lib/auth/supabase'
import { opfsStorageService } from '@/services/OpfsStorageService'
import { uploadBlob } from './storageUpload'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Tables that carry binary assets — used as a set guard in syncEngine.ts. */
export const STORAGE_TABLES = new Set(['importedCourses', 'authors', 'importedPdfs', 'books'])

// Size limits mirror the bucket definitions in supabase/storage-setup.sql.
const SIZE_LIMITS = {
  'course-thumbnails': 500_000, // 500 KB
  avatars: 1_000_000, // 1 MB
  pdfs: 100_000_000, // 100 MB
  'book-covers': 2_000_000, // 2 MB
  'book-files': 209_715_200, // 200 MB
} as const

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Upload binary assets for a single table after a successful sync batch.
 *
 * Dispatches to per-table handlers for `importedCourses`, `authors`,
 * `importedPdfs`, and `books`. Non-target tables are silently ignored.
 * Each per-entry upload is independently try/caught — one failure does
 * not block the others.
 *
 * @param tableName - Dexie/sync table name.
 * @param entries   - Sync queue entries from the completed batch.
 * @param userId    - Authenticated user ID (used as storage path prefix).
 */
export async function uploadStorageFilesForTable(
  tableName: string,
  entries: SyncQueueEntry[],
  userId: string
): Promise<void> {
  if (!STORAGE_TABLES.has(tableName)) return

  for (const entry of entries) {
    try {
      switch (tableName) {
        case 'importedCourses':
          await _uploadCourseThumbnail(entry, userId)
          break
        case 'authors':
          await _uploadAuthorPhoto(entry, userId)
          break
        case 'importedPdfs':
          await _uploadPdfFile(entry, userId)
          break
        case 'books':
          // E94-S07: cover and file uploads are independent — one failing must not
          // prevent the other from running. Each has its own try/catch.
          try {
            await _uploadBookCover(entry, userId)
          } catch (err) {
            console.warn('[storageSync] Cover upload failed', entry.recordId, err)
          }
          try {
            await _uploadBookFile(entry, userId)
          } catch (err) {
            console.warn('[storageSync] File upload failed', entry.recordId, err)
          }
          break
      }
    } catch (err) {
      console.warn(
        `[storageSync] Non-fatal upload failure for table "${tableName}", recordId "${entry.recordId}":`,
        err
      )
    }
  }
}

// ---------------------------------------------------------------------------
// Per-table handlers
// ---------------------------------------------------------------------------

/** Upload course thumbnail blob from db.courseThumbnails. */
async function _uploadCourseThumbnail(entry: SyncQueueEntry, userId: string): Promise<void> {
  const courseId = entry.recordId
  const thumbnailRecord = await db.courseThumbnails.get(courseId)
  if (!thumbnailRecord?.blob) return // No thumbnail available — skip silently.

  const path = `${userId}/${courseId}/thumbnail.jpg`
  const { url } = await uploadBlob('course-thumbnails', path, thumbnailRecord.blob, {
    maxSizeBytes: SIZE_LIMITS['course-thumbnails'],
  })

  await supabase!
    .from('imported_courses')
    .update({ thumbnail_url: url })
    .eq('id', courseId)
    .eq('user_id', userId)
}

/** Upload author photo from a FileSystemFileHandle stored in Dexie. */
async function _uploadAuthorPhoto(entry: SyncQueueEntry, userId: string): Promise<void> {
  const authorId = entry.recordId
  const author = await db.authors.get(authorId)
  if (!author?.photoHandle) return // No file handle — skip silently.

  let blob: Blob
  try {
    blob = await author.photoHandle.getFile()
  } catch {
    // Stale handle (DOMException after page reload) — expected, not an error.
    return
  }

  const path = `${userId}/${authorId}/photo.jpg`
  const { url } = await uploadBlob('avatars', path, blob, {
    maxSizeBytes: SIZE_LIMITS.avatars,
  })

  await supabase!
    .from('authors')
    .update({ photo_url: url })
    .eq('id', authorId)
    .eq('user_id', userId)
}

/** Upload PDF file from a FileSystemFileHandle stored in Dexie. */
async function _uploadPdfFile(entry: SyncQueueEntry, userId: string): Promise<void> {
  const pdfId = entry.recordId
  const pdf = await db.importedPdfs.get(pdfId)
  if (!pdf?.fileHandle) return // No file handle — skip silently.

  let blob: Blob
  try {
    blob = await pdf.fileHandle.getFile()
  } catch {
    // Stale handle (DOMException after page reload) — expected, not an error.
    return
  }

  const path = `${userId}/${pdfId}/file.pdf`
  const { url } = await uploadBlob('pdfs', path, blob, {
    maxSizeBytes: SIZE_LIMITS.pdfs,
  })

  await supabase!
    .from('imported_pdfs')
    .update({ file_url: url })
    .eq('id', pdfId)
    .eq('user_id', userId)
}

/**
 * Upload the primary book binary file (EPUB, PDF, audiobook) to the `book-files` bucket.
 *
 * Source dispatch:
 *   - 'local'      → reads from OPFS via opfsStorageService (internally falls back to IDB)
 *   - 'fileHandle' → calls source.handle.getFile(); stale handle (DOMException) → return silently
 *   - 'remote'     → no uploadable local binary; return early
 *
 * Idempotency: if book.fileUrl already starts with 'https://', the file was already
 * uploaded from this or another device — skip. The 'indexeddb' sentinel (set by
 * storeBookFile) does NOT start with 'https://' so upload proceeds correctly.
 *
 * @since E94-S07
 */
async function _uploadBookFile(entry: SyncQueueEntry, userId: string): Promise<void> {
  const bookId = entry.recordId
  const book = await db.books.get(bookId)
  if (!book || !book.source) return

  // Idempotency: already uploaded from this or another device.
  if (book.fileUrl?.startsWith('https://')) return

  let file: File | null = null

  if (book.source.type === 'local') {
    file = await opfsStorageService.readBookFile(book.source.opfsPath, bookId)
  } else if (book.source.type === 'fileHandle') {
    try {
      file = await book.source.handle.getFile()
    } catch {
      // Stale handle (DOMException after page reload) — expected, not an error.
      return
    }
  } else {
    // 'remote' — no uploadable local binary.
    return
  }

  if (!file) return

  const filename = file.name || 'book.epub'
  const path = `${userId}/${bookId}/${filename}`
  const { url } = await uploadBlob('book-files', path, file, {
    maxSizeBytes: SIZE_LIMITS['book-files'],
  })

  await db.books.update(bookId, { fileUrl: url })
  await supabase!.from('books').update({ file_url: url }).eq('id', bookId).eq('user_id', userId)
}

/** Upload book cover from OPFS if the coverUrl uses an opfs:// or opfs-cover:// prefix. */
async function _uploadBookCover(entry: SyncQueueEntry, userId: string): Promise<void> {
  const bookId = entry.recordId
  const book = await db.books.get(bookId)
  if (!book?.coverUrl) return

  // Already a public https URL — no upload needed.
  if (book.coverUrl.startsWith('https://') || book.coverUrl.startsWith('http://')) return

  // Only handle OPFS-backed covers.
  if (!book.coverUrl.startsWith('opfs-cover://') && !book.coverUrl.startsWith('opfs://')) return

  // Resolve OPFS path to a temporary object URL.
  const objectUrl = await opfsStorageService.getCoverUrl(bookId)
  if (!objectUrl) return // OPFS read failed — skip silently.

  let blob: Blob
  try {
    const response = await fetch(objectUrl)
    blob = await response.blob()
  } finally {
    // Always revoke to prevent memory leaks (pattern from useBookCoverUrl.ts).
    URL.revokeObjectURL(objectUrl)
  }

  const path = `${userId}/${bookId}/cover.jpg`
  const { url } = await uploadBlob('book-covers', path, blob, {
    maxSizeBytes: SIZE_LIMITS['book-covers'],
  })

  await supabase!.from('books').update({ cover_url: url }).eq('id', bookId).eq('user_id', userId)
}
