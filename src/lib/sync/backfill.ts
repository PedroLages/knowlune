import { db } from '@/db'
import { tableRegistry } from './tableRegistry'
import { synthesizeRecordId } from './syncableWrite'
import { toSnakeCase } from './fieldMapper'
import { syncEngine } from './syncEngine'

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
 * Scope: the 38-table syncable list is derived from the table registry (E92-S03)
 * to ensure a single source of truth. The registry is ordered by priority tier
 * (P0 first, P4 last) — backfill processes all tables regardless of priority.
 */

/**
 * Derived from tableRegistry (E92-S03) — single source of truth for all
 * syncable Dexie table names. Previously an inline literal; now a computed
 * view over the registry so additions to tableRegistry automatically propagate.
 */
export const SYNCABLE_TABLES: readonly string[] = tableRegistry.map(e => e.dexieTable)

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
 * @param userId         The authenticated Supabase user id. If falsy, returns without
 *                       touching the database.
 * @param guestSessionId When provided, only records from this specific guest session
 *                       are backfilled. Prevents zombie-session orphan rows from
 *                       being accidentally stamped with a new user's id.
 * @returns Counts describing how much work was done.
 */
export async function backfillUserId(
  userId: string | null,
  guestSessionId?: string | null
): Promise<BackfillUserIdResult> {
  if (!userId) {
    return { tablesProcessed: 0, recordsStamped: 0, tablesFailed: [] }
  }

  const now = new Date().toISOString()
  let tablesProcessed = 0
  let recordsStamped = 0
  const tablesFailed: string[] = []

  for (const tableName of SYNCABLE_TABLES) {
    try {
      const entry = tableRegistry.find(e => e.dexieTable === tableName)
      if (!entry) continue

      // Collect matching records (same filter as before — Dexie's
      // where().equals() misses undefined, so filter() is required).
      const records = await db
        .table(tableName)
        .filter((record: Record<string, unknown>) => {
          if (guestSessionId) {
            // Guest session: only backfill rows from this specific session
            return record.userId === null && record.guestSessionId === guestSessionId
          }
          const existing = record.userId
          return existing === undefined || existing === null || existing === ''
        })
        .toArray()

      tablesProcessed += 1

      if (records.length === 0) continue

      // Stamp userId, preserve existing updatedAt if already set
      const stampedRecords = records.map(r => ({
        ...r,
        userId,
        updatedAt: r.updatedAt ? r.updatedAt : now,
      }))
      await db.table(tableName).bulkPut(stampedRecords)

      // Enqueue each stamped record for Supabase upload
      for (const record of stampedRecords) {
        try {
          const recordId = synthesizeRecordId(record, entry)
          const payload = toSnakeCase(entry, record)
          await db.syncQueue.add({
            tableName,
            recordId,
            operation: 'put',
            payload,
            attempts: 0,
            status: 'pending',
            createdAt: now,
            updatedAt: now,
          })
        } catch (err) {
          // Non-fatal per-record failure — same posture as syncableWrite:205-210.
          // The Dexie write (bulkPut) already succeeded, so the record has userId
          // stamped. The queue insert failing means this specific record won't be
          // uploaded on this backfill cycle — the sync engine may re-enqueue on
          // next sign-in via a full scan (E92-S06 download).
          console.error(`[backfillUserId] Queue insert failed for "${tableName}":`, err)
        }
      }

      recordsStamped += records.length
    } catch (err) {
      console.error(`[backfillUserId] Table "${tableName}" failed:`, err)
      tablesFailed.push(tableName)
    }
  }

  // Trigger the upload engine to process the newly enqueued entries.
  syncEngine.nudge()

  return { tablesProcessed, recordsStamped, tablesFailed }
}
