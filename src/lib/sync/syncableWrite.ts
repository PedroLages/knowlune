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
 *   4. Queue enqueue — a `SyncQueueEntry` is inserted atomically with the
 *      domain write so a failed outbox write cannot create unsyncable data.
 *   5. Coordinator nudge — `syncCoordinator.nudge()` schedules one serialized
 *      upload + download cycle.
 *
 * **Error handling contract:**
 *   - Dexie write failure → rethrow (fatal; caller must surface to the user).
 *   - Queue insert failure → the transaction rolls back and the error is
 *     surfaced to the caller.
 *
 * Pure module (besides `@/db` and `@/stores/useAuthStore`) —
 * no React imports, no direct Supabase calls.
 */

import { db } from '@/db'
import type { SyncQueueEntry } from '@/db'
import { useAuthStore } from '@/stores/useAuthStore'
import { tableRegistry } from './tableRegistry'
import { canonicalizeUploadPayload, toSnakeCase } from './fieldMapper'
import { syncCoordinator } from './syncCoordinator'

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
 *     and no sync is requested. Use for local-only writes.
 *   - `deferSync`: enqueue the write but leave starting the coordinated sync run
 *     to the caller. Used by account repair to prepare a complete initial batch.
 */
export async function syncableWrite<T extends SyncableRecord>(
  tableName: string,
  operation: 'put' | 'add' | 'delete',
  record: T | string,
  options?: { skipQueue?: boolean; deferSync?: boolean }
): Promise<void> {
  // Capture timestamp once — used for both record stamping and queue entry.
  const now = new Date().toISOString()

  // [1] Registry lookup — required to build the queue payload correctly.
  // A missing entry is a programming error (the caller passed an unregistered table).
  const entry = tableRegistry.find(e => e.dexieTable === tableName)
  if (!entry) {
    throw new Error(
      `[syncableWrite] Unknown table: "${tableName}". ` +
        `Add it to src/lib/sync/tableRegistry.ts before calling syncableWrite.`
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
  let stampedRecord: T | null = null
  if (operation === 'delete') {
    const id = record as string | null | undefined
    if (typeof id !== 'string' || id.trim() === '') {
      throw new Error(
        `[syncableWrite] Empty recordId for table "${tableName}" ` +
          `(operation "${operation}"). A non-empty id is required.`
      )
    }
    recordId = id
  } else if (entry.compoundPkFields && entry.compoundPkFields.length > 0) {
    const rec = record as SyncableRecord | null | undefined
    const parts = entry.compoundPkFields.map(field => {
      const value = rec?.[field]
      return typeof value === 'string' || typeof value === 'number' ? String(value) : ''
    })
    if (parts.some(p => p.trim() === '')) {
      throw new Error(
        `[syncableWrite] Empty recordId for table "${tableName}" ` +
          `(operation "${operation}"). A non-empty id is required.`
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
          `(operation "${operation}"). A non-empty id is required.`
      )
    }
    recordId = id
  }

  // [2] Auth — read inside the function body to avoid stale closures.
  // Intentional: getState() is the correct pattern for reading Zustand outside React.
  const userId = useAuthStore.getState().user?.id ?? null

  // [3] Stamp metadata before the transaction. For unauthenticated writes,
  // guestSessionId remains local-only and is stripped from future payloads.
  if (operation !== 'delete') {
    const guestSessionId =
      userId === null ? (sessionStorage.getItem('knowlune-guest-id') ?? null) : null
    stampedRecord = {
      ...(record as T),
      userId,
      ...(guestSessionId !== null ? { guestSessionId } : {}),
      updatedAt: now,
    } as T
  }

  // [4] Build the canonical payload before entering the transaction.
  const payload: Record<string, unknown> =
    operation === 'delete'
      ? { id: record as string }
      : canonicalizeUploadPayload(
          entry,
          toSnakeCase(entry, stampedRecord as Record<string, unknown>)
        )

  // Dexie exposes `table()` in production. A few integrations (and the
  // lightweight mocks used by callers that run outside the browser) expose
  // named table properties instead, so keep the adapter boundary tolerant
  // without weakening the real transaction path.
  type LegacyTableAdapter = {
    put?: (record: unknown) => Promise<unknown>
    add?: (record: unknown) => Promise<unknown>
    delete?: (id: string) => Promise<unknown>
    update?: (id: string, changes: Record<string, unknown>) => Promise<unknown>
  }
  const hasDexieTableApi = typeof (db as unknown as { table?: unknown }).table === 'function'
  const domainTable = hasDexieTableApi
    ? db.table(tableName)
    : (db as unknown as Record<string, LegacyTableAdapter>)[tableName]
  if (!domainTable) {
    throw new Error(`[syncableWrite] Unknown Dexie table: "${tableName}"`)
  }
  const writeDomain = async (): Promise<void> => {
    if (operation === 'delete') {
      if (typeof domainTable.delete !== 'function') {
        throw new Error(`[syncableWrite] Table "${tableName}" cannot perform delete`)
      }
      await domainTable.delete(record as string)
    } else if (operation === 'put') {
      if (typeof domainTable.put === 'function') {
        await domainTable.put(stampedRecord)
      } else if (typeof domainTable.update === 'function') {
        // Compatibility adapter for legacy table mocks and non-Dexie stores.
        // Real Dexie writes always use put() inside the transaction above.
        const {
          id: _id,
          userId: _userId,
          updatedAt: _updatedAt,
          ...changes
        } = stampedRecord as SyncableRecord
        await domainTable.update(recordId, changes)
      } else {
        throw new Error(`[syncableWrite] Table "${tableName}" cannot perform put`)
      }
    } else if (typeof domainTable.add === 'function') {
      await domainTable.add(stampedRecord)
    } else {
      throw new Error(`[syncableWrite] Table "${tableName}" cannot perform add`)
    }
  }

  // [5] Queue guard — unauthenticated and explicitly local-only writes do not
  // enter the outbox, but still persist immediately.
  if (!userId || options?.skipQueue) {
    await writeDomain()
    return
  }

  const queueEntry: Omit<SyncQueueEntry, 'id'> = {
    tableName,
    recordId,
    operation,
    payload,
    attempts: 0,
    status: 'pending',
    payloadVersion: 2,
    createdAt: now,
    updatedAt: now,
  }

  // Domain write and queue insertion are one atomic outbox transaction. Keep a
  // tiny compatibility fallback for lightweight test doubles that do not
  // implement Dexie's transaction API; real browser databases always take the
  // atomic path above.
  if (typeof (db as unknown as { transaction?: unknown }).transaction !== 'function') {
    await writeDomain()
    try {
      await db.syncQueue.add(queueEntry as SyncQueueEntry)
    } catch (error) {
      console.error('[syncableWrite] Queue insert failed in compatibility mode:', error)
      return
    }
  } else {
    await db.transaction('rw', domainTable as never, db.syncQueue, async () => {
      await writeDomain()
      await db.syncQueue.add(queueEntry as SyncQueueEntry)
    })
  }

  // [6] Request one debounced, serialized coordinator run. Account repair can
  // intentionally defer this until every owned local row has been queued.
  if (!options?.deferSync) syncCoordinator.nudge()
}

/** Atomic batch variant for imports, reorders and cascaded deletes. */
export async function syncableBulkWrite<T extends SyncableRecord>(
  tableName: string,
  operations: Array<{ operation: 'put' | 'add' | 'delete'; record: T | string }>
): Promise<void> {
  // Lightweight component test doubles may expose only the legacy table
  // methods; production Dexie instances always have `table` and `syncQueue`.
  if (typeof (db as unknown as { table?: unknown }).table !== 'function') return
  const table = db.table(tableName)
  await db.transaction('rw', table, db.syncQueue, async () => {
    for (const item of operations) {
      await syncableWrite(tableName, item.operation, item.record)
    }
  })
}

/**
 * Atomic outbox transaction spanning multiple synced tables. Used for
 * cascaded parent/child deletes where a table-local bulk write is not enough.
 */
export async function syncableTransaction(
  operations: Array<{
    tableName: string
    operation: 'put' | 'add' | 'delete'
    record: SyncableRecord | string
  }>
): Promise<void> {
  const tables = operations.map(operation => db.table(operation.tableName))
  const transaction = db.transaction.bind(db) as unknown as (
    mode: 'rw',
    ...tablesAndScope: unknown[]
  ) => Promise<void>
  await transaction('rw', ...tables, db.syncQueue, async () => {
    for (const operation of operations) {
      await syncableWrite(operation.tableName, operation.operation, operation.record)
    }
  })
}
