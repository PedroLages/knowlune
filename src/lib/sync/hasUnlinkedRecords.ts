import { db } from '@/db'
import { SYNCABLE_TABLES } from './backfill'

/**
 * Returns `true` if any syncable Dexie table contains records that are not
 * linked to `newUserId` (i.e. records where `userId` is missing/null or
 * belongs to a different account).
 *
 * Checks P0 tables first (most likely to have data), then remaining tables.
 * Uses a shared `found` flag so Promise.all short-circuits logically the
 * moment the first unlinked record is discovered — ES2020-compatible
 * alternative to `Promise.any()` (which requires ES2021).
 *
 * Called before `syncEngine.start()` on sign-in to determine whether the
 * `LinkDataDialog` should be shown (E92-S08).
 *
 * @returns `true` if unlinked records exist across any syncable table,
 *          `false` otherwise (including when all tables are empty).
 */
export async function hasUnlinkedRecords(newUserId: string): Promise<boolean> {
  // P0 first, then all others in SYNCABLE_TABLES order.
  // Checking frequently-populated tables first maximises the chance of an
  // early flag-set, skipping subsequent async work.
  const P0_TABLES = ['contentProgress', 'studySessions', 'progress']
  const remaining = SYNCABLE_TABLES.filter(t => !P0_TABLES.includes(t))
  const orderedTables = [...P0_TABLES, ...remaining]

  // Shared flag: set to true as soon as any table has unlinked records.
  // ES2020-compatible alternative to Promise.any() (ES2021).
  let found = false

  await Promise.all(
    orderedTables.map(async tableName => {
      // Skip remaining async work once we know the answer.
      if (found) return
      try {
        const count = await db
          .table(tableName)
          .filter(
            (r: Record<string, unknown>) =>
              r.userId === null || r.userId === undefined || r.userId !== newUserId
          )
          .count()
        if (count > 0) {
          found = true
        }
      } catch (err) {
        // Table absent or query failed — treat as no records.
        // Intentional: a missing table is not an error condition; the migration
        // that creates it may not have run yet on this device.
        console.warn(`[hasUnlinkedRecords] Table "${tableName}" check failed:`, err)
      }
    })
  )

  return found
}
