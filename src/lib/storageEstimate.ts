/**
 * Storage Estimation Service (E69-S01)
 *
 * Estimates per-category IndexedDB storage usage by sampling Dexie table rows
 * and multiplying average row size by count. Groups tables into 6 user-friendly
 * categories for the Storage Management dashboard card.
 *
 * Uses navigator.storage.estimate() (via storageQuotaMonitor) for total
 * usage/quota, and per-table sampling for category breakdowns.
 */

import { db } from '@/db'
import { getStorageEstimate } from '@/lib/storageQuotaMonitor'
import type { Table } from 'dexie'

// --- Types ---

export type StorageCategory =
  | 'courses'
  | 'notes'
  | 'flashcards'
  | 'embeddings'
  | 'thumbnails'
  | 'transcripts'

export interface CategoryEstimate {
  category: StorageCategory
  label: string
  sizeBytes: number
  tableBreakdown: Record<string, number>
}

export interface StorageOverview {
  totalUsage: number
  totalQuota: number
  usagePercent: number
  categories: CategoryEstimate[]
  categorizedTotal: number
  uncategorizedBytes: number
  apiAvailable: boolean
}

// --- Category Mapping ---

const CATEGORY_MAP: Record<StorageCategory, { label: string; tables: string[] }> = {
  courses: { label: 'Courses', tables: ['importedCourses', 'importedVideos', 'importedPdfs'] },
  notes: { label: 'Notes', tables: ['notes', 'screenshots'] },
  flashcards: { label: 'Flashcards', tables: ['flashcards', 'reviewRecords'] },
  embeddings: { label: 'AI Search Data', tables: ['embeddings'] },
  thumbnails: { label: 'Thumbnails', tables: ['courseThumbnails'] },
  transcripts: { label: 'Transcripts', tables: ['videoCaptions', 'youtubeTranscripts'] },
}

/** All category keys in display order */
export const STORAGE_CATEGORIES = Object.keys(CATEGORY_MAP) as StorageCategory[]

// --- Estimation Logic ---

/**
 * Estimate the storage size of a single Dexie table by sampling rows.
 * Returns 0 if the table is empty or the query fails.
 */
export async function estimateTableSize(tableName: string, sampleSize = 5): Promise<number> {
  try {
    const table = db.table(tableName)
    const count = await table.count()
    if (count === 0) return 0

    const sample = await table.limit(sampleSize).toArray()
    if (sample.length === 0) return 0

    const totalSampleBytes = sample.reduce((sum, row) => {
      let blobBytes = 0
      const nonBlobFields: Record<string, unknown> = {}
      for (const [key, val] of Object.entries(row as Record<string, unknown>)) {
        if (val instanceof Blob) {
          blobBytes += val.size
        } else if (val instanceof ArrayBuffer) {
          blobBytes += val.byteLength
        } else if (ArrayBuffer.isView(val)) {
          blobBytes += val.byteLength
        } else {
          nonBlobFields[key] = val
        }
      }
      if (blobBytes > 0) {
        // Include both Blob sizes and metadata size
        return sum + blobBytes + new Blob([JSON.stringify(nonBlobFields)]).size
      }
      return sum + new Blob([JSON.stringify(row)]).size
    }, 0)

    const avgRowBytes = totalSampleBytes / sample.length
    return Math.round(avgRowBytes * count)
  } catch {
    // silent-catch-ok — Individual table failure should not block the dashboard
    return 0
  }
}

/**
 * Estimate storage for a single category by summing all its mapped tables.
 */
async function estimateCategory(category: StorageCategory): Promise<CategoryEstimate> {
  const { label, tables } = CATEGORY_MAP[category]

  const results = await Promise.allSettled(
    tables.map(async tableName => ({
      tableName,
      size: await estimateTableSize(tableName),
    }))
  )

  const tableBreakdown: Record<string, number> = {}
  let sizeBytes = 0

  for (const result of results) {
    if (result.status === 'fulfilled') {
      tableBreakdown[result.value.tableName] = result.value.size
      sizeBytes += result.value.size
    }
  }

  return { category, label, sizeBytes, tableBreakdown }
}

/**
 * Get a full storage overview: total usage/quota from the browser API,
 * plus per-category estimates from Dexie table sampling.
 */
export async function getStorageOverview(): Promise<StorageOverview> {
  const estimate = await getStorageEstimate()
  const apiAvailable = estimate !== null
  const totalUsage = estimate?.usage ?? 0
  const totalQuota = estimate?.quota ?? 0
  const usagePercent = Math.min(1, Math.max(0, estimate?.usagePercent ?? 0))

  const categoryResults = await Promise.allSettled(
    STORAGE_CATEGORIES.map(cat => estimateCategory(cat))
  )

  const categories: CategoryEstimate[] = []
  let categorizedTotal = 0

  for (const result of categoryResults) {
    if (result.status === 'fulfilled') {
      categories.push(result.value)
      categorizedTotal += result.value.sizeBytes
    }
  }

  const uncategorizedBytes = Math.max(0, totalUsage - categorizedTotal)

  return {
    totalUsage,
    totalQuota,
    usagePercent,
    categories,
    categorizedTotal,
    uncategorizedBytes,
    apiAvailable,
  }
}

// --- Per-Course Storage (E69-S02) ---

export interface CourseStorageEntry {
  courseId: string
  courseName: string
  totalBytes: number
  mediaBytes: number
  notesBytes: number
  thumbnailBytes: number
}

/**
 * Get per-course storage breakdown sorted by totalBytes descending.
 */
export async function getPerCourseUsage(): Promise<CourseStorageEntry[]> {
  try {
    const courses = await db.importedCourses.toArray()
    if (courses.length === 0) return []

    const entries: CourseStorageEntry[] = await Promise.all(
      courses.map(async course => {
        let mediaBytes = 0
        let notesBytes = 0
        let thumbnailBytes = 0

        try {
          // Media: videos + pdfs
          const videos = await db.importedVideos.where('courseId').equals(course.id).toArray()
          for (const v of videos) {
            mediaBytes += new Blob([JSON.stringify(v)]).size
            for (const val of Object.values(v as unknown as Record<string, unknown>)) {
              if (val instanceof Blob) mediaBytes += val.size
              else if (val instanceof ArrayBuffer) mediaBytes += val.byteLength
              else if (ArrayBuffer.isView(val)) mediaBytes += val.byteLength
            }
          }

          const pdfs = await db.importedPdfs.where('courseId').equals(course.id).toArray()
          for (const p of pdfs) {
            mediaBytes += new Blob([JSON.stringify(p)]).size
            for (const val of Object.values(p as unknown as Record<string, unknown>)) {
              if (val instanceof Blob) mediaBytes += val.size
              else if (val instanceof ArrayBuffer) mediaBytes += val.byteLength
              else if (ArrayBuffer.isView(val)) mediaBytes += val.byteLength
            }
          }

          // Notes: notes + screenshots
          const notes = await db.notes.where('courseId').equals(course.id).toArray()
          for (const n of notes) {
            notesBytes += new Blob([JSON.stringify(n)]).size
          }

          const screenshots = await db.screenshots.where('courseId').equals(course.id).toArray()
          for (const s of screenshots) {
            notesBytes += new Blob([JSON.stringify(s)]).size
            for (const val of Object.values(s as unknown as Record<string, unknown>)) {
              if (val instanceof Blob) notesBytes += val.size
              else if (val instanceof ArrayBuffer) notesBytes += val.byteLength
              else if (ArrayBuffer.isView(val)) notesBytes += val.byteLength
            }
          }

          // Thumbnails
          const thumb = await db.courseThumbnails.get(course.id)
          if (thumb) {
            for (const val of Object.values(thumb as unknown as Record<string, unknown>)) {
              if (val instanceof Blob) thumbnailBytes += val.size
              else if (val instanceof ArrayBuffer) thumbnailBytes += val.byteLength
              else if (ArrayBuffer.isView(val)) thumbnailBytes += val.byteLength
              else thumbnailBytes += new Blob([JSON.stringify(val)]).size
            }
          }
        } catch {
          // silent-catch-ok — individual course estimation failure shouldn't block others
        }

        const totalBytes = mediaBytes + notesBytes + thumbnailBytes

        return {
          courseId: course.id,
          courseName: course.name ?? course.id,
          totalBytes,
          mediaBytes,
          notesBytes,
          thumbnailBytes,
        }
      })
    )

    return entries.sort((a, b) => b.totalBytes - a.totalBytes)
  } catch {
    // silent-catch-ok — per-course estimation failure renders empty table
    return []
  }
}

/**
 * Clear the thumbnail for a specific course. Returns bytes freed.
 */
export async function clearCourseThumbnail(courseId: string): Promise<number> {
  const thumb = await db.courseThumbnails.get(courseId)
  if (!thumb) return 0

  let bytes = 0
  for (const val of Object.values(thumb as unknown as Record<string, unknown>)) {
    if (val instanceof Blob) bytes += val.size
    else if (val instanceof ArrayBuffer) bytes += val.byteLength
    else if (ArrayBuffer.isView(val)) bytes += val.byteLength
    else bytes += new Blob([JSON.stringify(val)]).size
  }

  await db.courseThumbnails.delete(courseId)
  return bytes
}

/**
 * Delete all data for the given course IDs across all related tables.
 * Uses a transaction for atomicity. Returns estimated bytes freed.
 */
export async function deleteCourseData(courseIds: string[]): Promise<number> {
  if (courseIds.length === 0) return 0

  let bytesFreed = 0

  await db.transaction(
    'rw',
    [
      db.importedCourses,
      db.importedVideos,
      db.importedPdfs,
      db.notes,
      db.screenshots,
      db.flashcards,
      db.courseThumbnails,
      db.embeddings,
      db.videoCaptions,
      db.youtubeTranscripts,
      db.studySessions,
      db.contentProgress,
      db.bookmarks,
      db.quizzes,
      db.quizAttempts,
      db.reviewRecords,
    ],
    async () => {
      for (const courseId of courseIds) {
        // Direct courseId-indexed tables
        const deleteByIndex = async (table: Table<unknown, unknown>, indexName: string) => {
          const items = await table.where(indexName).equals(courseId).toArray()
          for (const item of items) {
            for (const val of Object.values(item as Record<string, unknown>)) {
              if (val instanceof Blob) bytesFreed += val.size
              else if (val instanceof ArrayBuffer) bytesFreed += val.byteLength
              else if (ArrayBuffer.isView(val)) bytesFreed += val.byteLength
            }
            bytesFreed += new Blob([JSON.stringify(item)]).size
          }
          await table.where(indexName).equals(courseId).delete()
        }

        await deleteByIndex(db.importedVideos as unknown as Table<unknown, unknown>, 'courseId')
        await deleteByIndex(db.importedPdfs as unknown as Table<unknown, unknown>, 'courseId')
        await deleteByIndex(db.bookmarks as unknown as Table<unknown, unknown>, 'courseId')
        await deleteByIndex(db.studySessions as unknown as Table<unknown, unknown>, 'courseId')
        await deleteByIndex(db.flashcards as unknown as Table<unknown, unknown>, 'courseId')

        // Notes and related (screenshots, embeddings linked via noteId)
        const notes = await db.notes.where('courseId').equals(courseId).toArray()
        for (const note of notes) {
          // Delete screenshots linked to this note's course+lesson
          await db.screenshots.where('courseId').equals(courseId).delete()
          // Delete embeddings linked to noteId
          if (note.id) {
            await db.embeddings.where('noteId').equals(note.id).delete()
            // Delete review records linked to flashcards (handled via flashcard deletion above)
          }
        }
        bytesFreed += notes.reduce((sum, n) => sum + new Blob([JSON.stringify(n)]).size, 0)
        await db.notes.where('courseId').equals(courseId).delete()

        // Compound PK tables
        await db.videoCaptions.where('courseId').equals(courseId).delete()
        await db.youtubeTranscripts.where('courseId').equals(courseId).delete()
        await db.contentProgress.where('courseId').equals(courseId).delete()

        // Quizzes and quiz attempts (linked via quizId)
        const quizzes = await db.quizzes.where('id').above('').toArray()
        const courseQuizzes = quizzes.filter(
          q => (q as Record<string, unknown>).courseId === courseId
        )
        for (const quiz of courseQuizzes) {
          await db.quizAttempts.where('quizId').equals(quiz.id).delete()
        }
        // Delete quizzes for this course
        const quizIds = courseQuizzes.map(q => q.id)
        if (quizIds.length > 0) {
          await db.quizzes.bulkDelete(quizIds)
        }

        // Thumbnail
        await db.courseThumbnails.delete(courseId)

        // The course itself
        await db.importedCourses.delete(courseId)
      }
    }
  )

  return bytesFreed
}

// --- Cleanup Estimation Functions (E69-S03) ---

/**
 * Estimate the total size of the thumbnail cache (courseThumbnails table).
 */
export async function estimateThumbnailCacheSize(): Promise<number> {
  return estimateTableSize('courseThumbnails')
}

/**
 * Find orphaned embeddings (noteId not in notes table) and estimate their size.
 * Returns count and estimated bytes.
 */
export async function estimateOrphanedEmbeddingsSize(): Promise<{
  count: number
  bytes: number
}> {
  try {
    const allEmbeddings = await db.embeddings.toArray()
    if (allEmbeddings.length === 0) return { count: 0, bytes: 0 }

    const noteIds = new Set(await db.notes.toCollection().primaryKeys())
    const orphans = allEmbeddings.filter(e => !noteIds.has(e.noteId))

    if (orphans.length === 0) return { count: 0, bytes: 0 }

    const bytes = orphans.reduce(
      (sum, e) => sum + new Blob([JSON.stringify(e)]).size,
      0
    )

    return { count: orphans.length, bytes }
  } catch {
    // silent-catch-ok — estimation failure returns zero
    return { count: 0, bytes: 0 }
  }
}

// --- Cleanup Action Functions (E69-S03) ---

/**
 * Clear the entire thumbnail cache. Returns bytes freed.
 */
export async function clearThumbnailCache(): Promise<{ bytesFreed: number }> {
  const bytesFreed = await estimateThumbnailCacheSize()
  await db.transaction('rw', [db.courseThumbnails], async () => {
    await db.courseThumbnails.clear()
  })
  return { bytesFreed }
}

/**
 * Remove orphaned embeddings (noteId not found in notes table).
 * Returns count of removed items and estimated bytes freed.
 */
export async function removeOrphanedEmbeddings(): Promise<{
  count: number
  bytesFreed: number
}> {
  const allEmbeddings = await db.embeddings.toArray()
  if (allEmbeddings.length === 0) return { count: 0, bytesFreed: 0 }

  const noteIds = new Set(await db.notes.toCollection().primaryKeys())
  const orphans = allEmbeddings.filter(e => !noteIds.has(e.noteId))

  if (orphans.length === 0) return { count: 0, bytesFreed: 0 }

  const bytesFreed = orphans.reduce(
    (sum, e) => sum + new Blob([JSON.stringify(e)]).size,
    0
  )

  const orphanIds = orphans.map(e => e.noteId).filter((id): id is string => id !== undefined)

  await db.transaction('rw', [db.embeddings], async () => {
    await db.embeddings.bulkDelete(orphanIds)
  })

  return { count: orphans.length, bytesFreed }
}

/**
 * Delete all data for selected courses. Returns count and bytes freed.
 * Wraps the existing deleteCourseData with count info.
 */
export async function deleteCourseDataWithCount(
  courseIds: string[]
): Promise<{ count: number; bytesFreed: number }> {
  const bytesFreed = await deleteCourseData(courseIds)
  return { count: courseIds.length, bytesFreed }
}
