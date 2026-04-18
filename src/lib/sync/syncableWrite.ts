/**
 * syncableWrite — E92-S04
 *
 * The single, canonical write path for all Dexie tables that participate in
 * Supabase sync. Callers use this instead of calling `db.<table>.put/add/delete()`
 * directly. The wrapper handles:
 *
 *   1. Metadata stamping — `userId` and `updatedAt` applied to every write.
 *   2. Optimistic local write — Dexie is written immediately; no network wait.
 *   3. Field stripping — non-serializable handles and vault credentials are
 *      removed from the queue payload via `toSnakeCase()` from fieldMapper.ts.
 *   4. Queue enqueue — a `SyncQueueEntry` is inserted so the upload engine
 *      (E92-S05) can push the change to Supabase.
 *   5. Engine nudge — `syncEngine.nudge()` is called to trigger an immediate
 *      upload cycle (a no-op stub in S04; real in E92-S05).
 *
 * **Error handling contract:**
 *   - Dexie write failure → rethrow (fatal; caller must surface to the user).
 *   - Queue insert failure → log + swallow (non-fatal; the Dexie write already
 *     succeeded and the sync engine's next scan will re-enqueue stragglers).
 *
 * Pure module (besides `@/db` and `@/stores/useAuthStore`) —
 * no React imports, no direct Supabase calls.
 */

import { db } from '@/db'
import type { SyncQueueEntry } from '@/db'
import { useAuthStore } from '@/stores/useAuthStore'
import { tableRegistry } from './tableRegistry'
import { toSnakeCase } from './fieldMapper'
import { syncEngine } from './syncEngine'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Minimum type contract for records that can be written through `syncableWrite`.
 * Exported so that E92-S09 store wiring can use it as the type constraint
 * when calling `syncableWrite<T extends SyncableRecord>(...)`.
 */
export interface SyncableRecord {
  /** Primary key. Required for put/add; the string id is passed directly for delete. */
  id?: string
  /** Populated by syncableWrite — callers should not set this. */
  userId?: string | null
  /** Populated by syncableWrite — callers should not set this. */
  updatedAt?: string
  [key: string]: unknown
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

/**
 * Write a record to a synced Dexie table and enqueue it for Supabase upload.
 *
 * @param tableName - The Dexie table name (must be registered in tableRegistry).
 * @param operation - The write operation: 'put' (upsert), 'add' (insert), or 'delete'.
 * @param record    - The record to write. For 'delete', pass the string id directly.
 * @param options   - Optional flags:
 *   - `skipQueue`: if true, the Dexie write happens but no queue entry is created
 *     and `syncEngine.nudge()` is not called. Use for local-only writes.
 */
export async function syncableWrite<T extends SyncableRecord>(
  tableName: string,
  operation: 'put' | 'add' | 'delete',
  record: T | string,
  options?: { skipQueue?: boolean },
): Promise<void> {
  // Capture timestamp once — used for both record stamping and queue entry.
  const now = new Date().toISOString()

  // [1] Registry lookup — required to build the queue payload correctly.
  // A missing entry is a programming error (the caller passed an unregistered table).
  const entry = tableRegistry.find((e) => e.dexieTable === tableName)
  if (!entry) {
    throw new Error(
      `[syncableWrite] Unknown table: "${tableName}". ` +
        `Add it to src/lib/sync/tableRegistry.ts before calling syncableWrite.`,
    )
  }

  // [2] Auth — read inside the function body to avoid stale closures.
  // Intentional: getState() is the correct pattern for reading Zustand outside React.
  const userId = useAuthStore.getState().user?.id ?? null

  // [3] Stamp metadata and perform the Dexie write.
  // The Dexie write is always performed regardless of auth state — this ensures
  // local-only writes (unauthenticated) are still persisted immediately.
  try {
    if (operation === 'delete') {
      // For delete, `record` is the string id.
      await db.table(tableName).delete(record as string)
    } else {
      // For put/add, stamp the record before writing.
      const stampedRecord = {
        ...(record as T),
        userId,
        updatedAt: now,
      }
      if (operation === 'put') {
        await db.table(tableName).put(stampedRecord)
      } else {
        await db.table(tableName).add(stampedRecord)
      }
    }
  } catch (err) {
    // Intentional: Dexie write failure is fatal — rethrow so the caller can
    // surface the error to the user (e.g., via toast). No queue entry was
    // created, so there is no orphaned sync state to clean up.
    throw err
  }

  // [4] Queue guard — skip if unauthenticated or caller opted out.
  // Intentional: unauthenticated writes are queued once the user signs in
  // (backfill in E92-S08). skipQueue is for local-only writes that should
  // never reach Supabase.
  if (!userId || options?.skipQueue) {
    return
  }

  // [5] Build the queue payload and enqueue.
  try {
    // `recordId` is the primary key used by the upload engine to coalesce
    // duplicate queue entries for the same record.
    // TODO(E92-S05): the upload engine must validate that recordId is non-empty
    // before uploading — a missing `id` on the record is a caller bug.
    const recordId =
      operation === 'delete'
        ? (record as string)
        : ((record as SyncableRecord).id ?? '')

    // Build the Supabase-compatible payload.
    // `toSnakeCase` automatically strips both `stripFields` (non-serializable
    // browser handles) and `vaultFields` (credentials that must never reach
    // Postgres rows). For delete, the payload is just the id.
    let payload: Record<string, unknown>
    if (operation === 'delete') {
      payload = { id: record as string }
    } else {
      payload = toSnakeCase(entry, record as Record<string, unknown>)
    }

    const queueEntry: Omit<SyncQueueEntry, 'id'> = {
      tableName,
      recordId,
      operation,
      payload,
      attempts: 0,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    }

    await db.syncQueue.add(queueEntry as SyncQueueEntry)

    // Nudge the engine to process the queue soon (debounced in E92-S05).
    syncEngine.nudge()
  } catch (err) {
    // Intentional: queue insert failure is non-fatal. The Dexie write already
    // succeeded — optimistic local write is the source of truth. The sync
    // engine's next full scan (E92-S06 download) will detect and reconcile
    // any records that were written locally but not queued. Log for observability.
    console.error(
      '[syncableWrite] Queue insert failed — write succeeded, sync deferred:',
      err,
    )
  }
}
