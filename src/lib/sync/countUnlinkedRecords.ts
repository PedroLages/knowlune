import { db } from '@/db'
import { SYNCABLE_TABLES } from './backfill'

/**
 * Counts unlinked local records (those with `userId` missing, null, or
 * belonging to a different user) grouped by display category.
 *
 * Used by `LinkDataDialog` (E92-S08) to show the user what local data exists
 * before they decide whether to link it to their account or start fresh.
 *
 * All table queries run in parallel via `Promise.allSettled`. A failing
 * table query contributes 0 to its category (logged, never thrown).
 */

export interface UnlinkedCounts {
  courses: number
  notes: number
  books: number
  flashcards: number
  other: number
}

/** Dexie table names that map to the "courses" display category. */
const COURSE_TABLES = new Set(['importedCourses', 'importedVideos', 'importedPdfs'])
/** Dexie table names that map to the "notes" display category. */
const NOTE_TABLES = new Set(['notes'])
/** Dexie table names that map to the "books" display category. */
const BOOK_TABLES = new Set(['books'])
/** Dexie table names that map to the "flashcards" display category. */
const FLASHCARD_TABLES = new Set(['flashcards'])

function categoryFor(tableName: string): keyof UnlinkedCounts {
  if (COURSE_TABLES.has(tableName)) return 'courses'
  if (NOTE_TABLES.has(tableName)) return 'notes'
  if (BOOK_TABLES.has(tableName)) return 'books'
  if (FLASHCARD_TABLES.has(tableName)) return 'flashcards'
  return 'other'
}

/**
 * @param newUserId  The userId being signed in. Records not belonging to this
 *                   user (or with no userId) are counted as "unlinked".
 */
export async function countUnlinkedRecords(newUserId: string): Promise<UnlinkedCounts> {
  const totals: UnlinkedCounts = { courses: 0, notes: 0, books: 0, flashcards: 0, other: 0 }

  const results = await Promise.allSettled(
    SYNCABLE_TABLES.map(async (tableName) => {
      const count = await db
        .table(tableName)
        .filter(
          (r: Record<string, unknown>) =>
            r.userId === null || r.userId === undefined || r.userId !== newUserId,
        )
        .count()
      return { tableName, count }
    }),
  )

  for (const result of results) {
    if (result.status === 'fulfilled') {
      const { tableName, count } = result.value
      const category = categoryFor(tableName)
      totals[category] += count
    } else {
      // Per-table failure: log and treat as 0 contribution. The dialog still
      // shows counts for tables that succeeded.
      // silent-catch-ok: count display is best-effort; the dialog still shows
      // the resolution choices even if counts are incomplete.
      console.warn('[countUnlinkedRecords] Table count failed:', result.reason)
    }
  }

  return totals
}
