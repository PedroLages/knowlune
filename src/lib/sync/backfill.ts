import { db } from '@/db'

import { tableRegistry } from './tableRegistry'

/**
 * Backfill `userId` (and `updatedAt` if missing) on existing records in every
 * syncable Dexie table. Invoked from the auth lifecycle after SIGNED_IN /
 * INITIAL_SESSION (see `useAuthLifecycle.ts`), NOT from inside the Dexie v52
 * upgrade callback — Zustand auth state hydrates asynchronously while Dexie
 * upgrades run synchronously during `db.open()`, so reading auth state inside
 * the upgrade would race.
 *
 * Idempotent: records that already have `userId` set are left alone. Calling
 * `backfillUserId()` repeatedly is safe and cheap in steady state.
 *
 * Cross-user device safety: records stamped with a previous user's id are NOT
 * re-stamped (filter only targets missing/empty userId). On SIGNED_OUT the
 * previous user's records remain in IndexedDB until a purge is added (tracked
 * for E92-S08); downstream queries in E92-S05/S06 MUST filter by userId.
 *
 * Scope: derived from `tableRegistry` (E92-S03). Every entry in the registry
 * participates in backfill regardless of its `skipSync` flag — partitioning
 * records by user is a local-data concern distinct from whether the table is
 * uploaded to Supabase. (For example, `reviewRecords` is `skipSync: true`
 * but still needs `userId` stamping.)
 */

export const SYNCABLE_TABLES: readonly string[] = Object.freeze(
  Object.keys(tableRegistry),
)

export interface BackfillUserIdResult {
  tablesProcessed: number
  recordsStamped: number
  tablesFailed: string[]
}

/**
 * Stamp `userId` on any records in syncable tables whose `userId` is missing
 * or empty. Also stamp `updatedAt` if it's still missing (the v52 upgrade
 * callback already does this at migration time, but new records added before
 * backfill runs may lack it too).
 *
 * @param userId  The authenticated Supabase user id. If falsy, returns without
 *                touching the database.
 * @returns Counts describing how much work was done.
 */
export async function backfillUserId(userId: string | null): Promise<BackfillUserIdResult> {
  if (!userId) {
    return { tablesProcessed: 0, recordsStamped: 0, tablesFailed: [] }
  }

  const now = new Date().toISOString()
  let tablesProcessed = 0
  let recordsStamped = 0
  const tablesFailed: string[] = []

  for (const tableName of SYNCABLE_TABLES) {
    try {
      // Use a filter (not where-equals) because a missing index value and
      // an explicit empty string both need to match. Dexie's `where().equals()`
      // matches only explicitly-indexed values and would miss `undefined`.
      const count = await db
        .table(tableName)
        .filter((record: Record<string, unknown>) => {
          const existing = record.userId
          return existing === undefined || existing === null || existing === ''
        })
        .modify((record: Record<string, unknown>) => {
          record.userId = userId
          if (!record.updatedAt) {
            record.updatedAt = now
          }
        })
      recordsStamped += count
      tablesProcessed += 1
    } catch (err) {
      // Per-table failure must not abort the aggregate backfill. Log and keep
      // going — the user is better served by partial progress than none.
      // Intentional: the sync engine will catch any stragglers on next sign-in
      // since backfill is idempotent.
      console.error(`[backfillUserId] Table "${tableName}" failed:`, err)
      tablesFailed.push(tableName)
    }
  }

  return { tablesProcessed, recordsStamped, tablesFailed }
}
