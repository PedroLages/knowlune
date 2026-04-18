import { db } from '@/db'
import { SYNCABLE_TABLES } from './backfill'

/**
 * Returns `true` if any syncable Dexie table contains records that are not
 * linked to `newUserId` (i.e. records where `userId` is missing/null or
 * belongs to a different account).
 *
 * Uses `Promise.any()` for fast short-circuit — resolves as soon as the first
 * table with unlinked records is found. P0 tables are checked first because
 * they are most likely to have records in normal usage.
 *
 * Called before `syncEngine.start()` on sign-in to determine whether the
 * `LinkDataDialog` should be shown (E92-S08).
 *
 * @returns `true` if unlinked records exist across any syncable table,
 *          `false` otherwise (including when all tables are empty).
 */
export async function hasUnlinkedRecords(newUserId: string): Promise<boolean> {
  // P0 first, then all others in SYNCABLE_TABLES order.
  // Ordering matters: Promise.any short-circuits on the first resolve, so
  // checking frequently-populated tables first gives the fastest answer.
  const P0_TABLES = ['contentProgress', 'studySessions', 'progress']
  const remaining = SYNCABLE_TABLES.filter((t) => !P0_TABLES.includes(t))
  const orderedTables = [...P0_TABLES, ...remaining]

  async function checkTable(tableName: string): Promise<void> {
    try {
      const count = await db
        .table(tableName)
        .filter(
          (r: Record<string, unknown>) =>
            r.userId === null || r.userId === undefined || r.userId !== newUserId,
        )
        .count()
      if (count > 0) {
        // Resolve this promise → Promise.any will resolve with void and return true.
        return
      }
    } catch (err) {
      // Table absent or query failed — treat as no records.
      // Intentional: a missing table is not an error condition; the migration
      // that creates it may not have run yet on this device.
      console.warn(`[hasUnlinkedRecords] Table "${tableName}" check failed:`, err)
    }
    // No unlinked records in this table — reject so Promise.any can try others.
    throw new Error(`no-unlinked:${tableName}`)
  }

  try {
    // Promise.any resolves as soon as any checkTable promise resolves (i.e.
    // a table has unlinked records). If all reject, AggregateError is thrown.
    await Promise.any(orderedTables.map(checkTable))
    return true
  } catch {
    // AggregateError — all tables had no unlinked records or were empty.
    return false
  }
}
