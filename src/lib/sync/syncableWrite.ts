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

  // [1a] recordId guard — validate before any Dexie write so the
  // "throw = zero partial state" invariant holds. For 'delete' the `record`
  // argument is the id string; for 'put' / 'add' it is the record's `id`
  // property. A missing / empty / whitespace-only id is a caller bug — same
  // severity as an unknown table — and would otherwise enqueue an
  // undeliverable upload job. Mirrors the unknown-table message shape so
  // downstream log scrapers can match on the `[syncableWrite]` prefix.
  //
  // Compound-PK tables (e.g. contentProgress, audioCueAlignments) have no
  // single `id` field — the upload engine identifies rows by the compound
  // key values inside the payload. For those, synthesize a stable recordId
  // from the compound fields so syncQueue.recordId is still meaningful, and
  // skip the empty-id throw for put/add (delete is not currently used for
  // compound-PK tables — the synthesized recordId would not be available
  // from the bare string the caller passes).
  let recordId: string
  if (operation === 'delete') {
    const id = record as string | null | undefined
    if (typeof id !== 'string' || id.trim() === '') {
      throw new Error(
        `[syncableWrite] Empty recordId for table "${tableName}" ` +
          `(operation "${operation}"). A non-empty id is required.`,
      )
    }
    recordId = id
  } else if (entry.compoundPkFields && entry.compoundPkFields.length > 0) {
    const rec = record as SyncableRecord | null | undefined
    const parts = entry.compoundPkFields.map((field) => {
      const value = rec?.[field]
      return typeof value === 'string' || typeof value === 'number'
        ? String(value)
        : ''
    })
    if (parts.some((p) => p.trim() === '')) {
      throw new Error(
        `[syncableWrite] Empty recordId for table "${tableName}" ` +
          `(operation "${operation}"). A non-empty id is required.`,
      )
    }
    // Unit separator (U+001F) — guaranteed not to appear in user-supplied IDs
    // (URIs, slugs, UUIDs). Joining on ':' would let `urn:isbn:123` collide
    // with split-elsewhere variants (ADV-04 from R1 review).
    recordId = parts.join('\u001f')
  } else {
    const id = (record as SyncableRecord | null | undefined)?.id
    if (typeof id !== 'string' || id.trim() === '') {
      throw new Error(
        `[syncableWrite] Empty recordId for table "${tableName}" ` +
          `(operation "${operation}"). A non-empty id is required.`,
      )
    }
    recordId = id
  }

  // [2] Auth — read inside the function body to avoid stale closures.
  // Intentional: getState() is the correct pattern for reading Zustand outside React.
  const userId = useAuthStore.getState().user?.id ?? null

  // [3] Stamp metadata and perform the Dexie write.
  // The Dexie write is always performed regardless of auth state — this ensures
  // local-only writes (unauthenticated) are still persisted immediately.
  // Intentional: Dexie write failures propagate to the caller (fatal). No queue
  // entry is created on failure, so there is no orphaned sync state to clean up.
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

  // [4] Queue guard — skip if unauthenticated or caller opted out.
  // Intentional: unauthenticated writes are queued once the user signs in
  // (backfill in E92-S08). skipQueue is for local-only writes that should
  // never reach Supabase.
  if (!userId || options?.skipQueue) {
    return
  }

  // [5] Build the queue payload and enqueue. `recordId` was derived and
  // validated above (step [1a]) — reuse here so the two paths cannot drift.
  try {
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
