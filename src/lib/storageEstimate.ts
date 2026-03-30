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
      // For rows containing Blob fields (thumbnails, screenshots), use .size directly
      for (const val of Object.values(row as Record<string, unknown>)) {
        if (val instanceof Blob) return sum + val.size
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
  const usagePercent = estimate?.usagePercent ?? 0

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
