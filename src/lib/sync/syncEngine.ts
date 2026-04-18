/**
 * Sync Engine — E92-S05 (upload phase) + E92-S06 (download phase)
 *
 * Upload phase (E92-S05): Reads from `syncQueue` (Dexie), coalesces duplicates,
 * batches to Supabase, retries transient failures with exponential back-off, and
 * dead-letters permanent ones. Concurrent upload cycles are serialized via
 * `navigator.locks`; a module-level boolean is the fallback for Safari ≤15.3.
 *
 * Download phase (E92-S06): Per-table incremental fetch from Supabase using
 * `syncMetadata.lastSyncTimestamp` as a cursor. Downloaded rows are converted
 * from snake_case to camelCase via `fieldMapper.toCamelCase()` and applied to
 * Dexie using the conflict strategy declared in `tableRegistry.ts`:
 *   - `lww`          — last-write-wins on `updatedAt`
 *   - `monotonic`    — `Math.max()` on monotonic fields, LWW on others
 *   - `insert-only`  — add if absent, never overwrite
 *   - `conflict-copy`— inline-field: remote wins, local saved as conflictCopy snapshot (E93-S03)
 *
 * **Public API:**
 *   - `syncEngine.nudge(): void`                                  — debounced upload trigger
 *   - `syncEngine.start(userId: string): Promise<void>`           — begin sync lifecycle
 *   - `syncEngine.stop(): void`                                   — halt sync
 *   - `syncEngine.fullSync(): Promise<void>`                      — upload then download
 *   - `syncEngine.registerStoreRefresh(table, cb): void`          — register Zustand refresh
 *   - `syncEngine.isRunning: boolean`
 *
 * Pure module — no React or Zustand imports. Safe to import in any non-React context.
 *
 * @module syncEngine
 * @since E92-S05 (upload), E92-S06 (download)
 */

import type { Table } from 'dexie'
import { db } from '@/db'
import type { SyncQueueEntry } from '@/db/schema'
import { supabase } from '@/lib/auth/supabase'
import { toCamelCase } from './fieldMapper'
import { getTableEntry, tableRegistry } from './tableRegistry'
import { applyConflictCopy } from './conflictResolvers'
import { replayFlashcardReviews } from './flashcardReplayService'
import type { Note } from '@/data/types'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum number of failed attempts before an entry is dead-lettered. */
const MAX_ATTEMPTS = 5

/** Batch size for Supabase upsert / insert calls. */
const BATCH_SIZE = 100

/** Debounce delay in milliseconds. */
const DEBOUNCE_MS = 200

// ---------------------------------------------------------------------------
// Monotonic RPC map — P0 tables with dedicated Postgres functions (E92-S01)
// For P2+ monotonic tables that lack an RPC, the engine logs a warning and
// falls back to a generic upsert.
// ---------------------------------------------------------------------------

interface MonotonicRpc {
  rpcName: string
  /** Maps snake_case payload keys to the RPC's named parameter names. */
  paramMap: Record<string, string>
}

const MONOTONIC_RPC: Record<string, MonotonicRpc> = {
  content_progress: {
    rpcName: 'upsert_content_progress',
    paramMap: {
      user_id: 'p_user_id',
      content_id: 'p_content_id',
      content_type: 'p_content_type',
      status: 'p_status',
      progress_pct: 'p_progress_pct',
      updated_at: 'p_updated_at',
    },
  },
  video_progress: {
    rpcName: 'upsert_video_progress',
    paramMap: {
      user_id: 'p_user_id',
      video_id: 'p_video_id',
      watched_seconds: 'p_watched_seconds',
      duration_seconds: 'p_duration_seconds',
      updated_at: 'p_updated_at',
    },
  },
}

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------

let _isRunning = false

/** Debounce timer handle. */
let _debounceTimer: ReturnType<typeof setTimeout> | null = null

/**
 * Fallback concurrency guard for environments without `navigator.locks`
 * (Safari ≤15.3). When navigator.locks IS available this flag is not used —
 * the lock API provides the same guarantee.
 * Intentional: two-path guard to handle the safari edge case.
 */
let _uploadInFlight = false

// ---------------------------------------------------------------------------
// E92-S06: Lifecycle state
// ---------------------------------------------------------------------------

/**
 * Whether the sync engine is active. Defaults to `true` for backward
 * compatibility with E92-S05 upload tests that call `nudge()` without
 * first calling `start()`. Set to `false` by `stop()`; restored to `true`
 * by `start()`.
 */
let _started = true

/**
 * Current authenticated user ID — set by `syncEngine.start()`.
 * Exposed via `syncEngine.currentUserId` for E92-S08 (backfill and
 * per-user query filtering).
 */
let _userId: string | null = null

// ---------------------------------------------------------------------------
// E92-S06: Store refresh registry
//
// Maps Dexie table names to callbacks registered by Zustand stores (or hooks).
// The download phase calls the registered callback after applying records for a
// table, so stores can invalidate their in-memory state. Registration happens in
// E92-S07 (`useSyncLifecycle.ts`).
//
// Intentional: kept as a Map (not a Zustand import) to keep syncEngine.ts a
// pure module — importing Zustand stores here would trigger Dexie.open() in the
// Vitest jsdom environment and create circular dependency risks.
// ---------------------------------------------------------------------------

const _storeRefreshRegistry = new Map<string, () => Promise<void>>()

// ---------------------------------------------------------------------------
// Helper — chunk array into fixed-size batches
// ---------------------------------------------------------------------------

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size))
  }
  return chunks
}

// ---------------------------------------------------------------------------
// Helper — coalesce duplicate queue entries
// ---------------------------------------------------------------------------

/**
 * Reads all `pending` entries from `syncQueue`, keeps only the latest entry
 * per `(tableName, recordId)` pair (oldest-to-newest iteration means each
 * overwrite keeps the newest), bulk-deletes the superseded entries, and
 * returns the winning entries.
 *
 * Intentional: sortBy returns Promise<T[]> in Dexie 4 — not a Collection.
 * We use `toArray()` + sort in JS as the reliable path.
 */
async function _coalesceQueue(): Promise<SyncQueueEntry[]> {
  // toArray() then sort in JS — Dexie 4: sortBy on WhereClause returns Promise<T[]>,
  // but using toArray() + manual sort is the safe, Dexie-4-compatible path.
  const entries = await db.syncQueue.where('status').equals('pending').toArray()
  entries.sort((a, b) => a.createdAt.localeCompare(b.createdAt))

  const latest = new Map<string, SyncQueueEntry>()
  const supersededIds: number[] = []

  for (const entry of entries) {
    const key = `${entry.tableName}:${entry.recordId}`
    const existing = latest.get(key)
    if (existing) {
      // The existing entry is older (we iterate oldest-first) — supersede it.
      supersededIds.push(existing.id!)
    }
    latest.set(key, entry)
  }

  if (supersededIds.length > 0) {
    await db.syncQueue.bulkDelete(supersededIds)
  }

  return [...latest.values()]
}

// ---------------------------------------------------------------------------
// Helper — error classification
// ---------------------------------------------------------------------------

type ErrorClass = 'retry' | 'dead-letter' | 'refresh-auth'

function _classifyError(status: number | undefined, isNetworkError: boolean): ErrorClass {
  if (isNetworkError || status === undefined || status >= 500) return 'retry'
  if (status === 401) return 'refresh-auth'
  // 4xx (except 401) → immediate dead-letter
  return 'dead-letter'
}

// ---------------------------------------------------------------------------
// Helper — handle batch upload error
// ---------------------------------------------------------------------------

async function _handleBatchError(
  entries: SyncQueueEntry[],
  supabaseError: { status?: number; message?: string } | null,
  isNetworkError: boolean,
  retryCallback: () => Promise<boolean>,
): Promise<void> {
  const errStatus = supabaseError?.status
  const errMsg = supabaseError?.message ?? (isNetworkError ? 'Network error' : 'Unknown error')
  const errorClass = _classifyError(errStatus, isNetworkError)
  const now = new Date().toISOString()

  if (errorClass === 'refresh-auth') {
    // Intentional: 401 → refresh session, then retry the batch once.
    // If the supabase client is null we can't refresh — treat as dead-letter.
    if (supabase) {
      await supabase.auth.refreshSession()
      const retrySucceeded = await retryCallback()
      if (retrySucceeded) return
      // Retry failed — fall through to retry-class handling with current attempts.
    }
    // Fall through to retry handling if refresh unavailable or retry failed.
    await _retryOrDeadLetter(entries, errMsg, now)
    return
  }

  if (errorClass === 'dead-letter') {
    // 4xx (non-401) → immediate dead-letter.
    for (const entry of entries) {
      await db.syncQueue.update(entry.id!, {
        status: 'dead-letter',
        lastError: errMsg,
        updatedAt: now,
      })
    }
    return
  }

  // 'retry' — 5xx or network error.
  await _retryOrDeadLetter(entries, errMsg, now)
}

async function _retryOrDeadLetter(
  entries: SyncQueueEntry[],
  errMsg: string,
  now: string,
): Promise<void> {
  for (const entry of entries) {
    const newAttempts = entry.attempts + 1
    if (newAttempts >= MAX_ATTEMPTS) {
      await db.syncQueue.update(entry.id!, {
        status: 'dead-letter',
        attempts: newAttempts,
        lastError: errMsg,
        updatedAt: now,
      })
    } else {
      await db.syncQueue.update(entry.id!, {
        attempts: newAttempts,
        lastError: errMsg,
        updatedAt: now,
      })
      // Schedule retry via nudge — leverages debounce + coalescing.
      // backoffMs = min(1000 * 2^attempts, 16000): 1s, 2s, 4s, 8s, 16s.
      const backoffMs = Math.min(1000 * (1 << entry.attempts), 16000)
      setTimeout(() => syncEngine.nudge(), backoffMs)
    }
  }
}

// ---------------------------------------------------------------------------
// Helper — upload a single batch for a table
// Returns true on success, false on error.
// ---------------------------------------------------------------------------

async function _uploadBatch(
  entries: SyncQueueEntry[],
  tableEntry: NonNullable<ReturnType<typeof getTableEntry>>,
): Promise<boolean> {
  // Intentional: supabase null-guard — will be null when env vars missing.
  if (!supabase) return false

  const payloads = entries.map((e) => e.payload)

  try {
    if (tableEntry.insertOnly || tableEntry.conflictStrategy === 'insert-only') {
      // INSERT ... ON CONFLICT DO NOTHING
      const { error } = await supabase.from(tableEntry.supabaseTable).insert(payloads)
      if (error) {
        const isNetworkError = false
        await _handleBatchError(entries, error, isNetworkError, async () => {
          const { error: retryError } = await supabase!.from(tableEntry.supabaseTable).insert(payloads)
          if (!retryError) {
            await db.syncQueue.bulkDelete(entries.map((e) => e.id!))
            return true
          }
          return false
        })
        return false
      }
    } else if (tableEntry.conflictStrategy === 'monotonic') {
      const rpc = MONOTONIC_RPC[tableEntry.supabaseTable]
      if (rpc) {
        // P0 monotonic table with dedicated RPC — call per record.
        for (let i = 0; i < entries.length; i++) {
          const entry = entries[i]
          const payload = payloads[i] as Record<string, unknown>
          // Map snake_case payload keys to RPC parameter names.
          const params: Record<string, unknown> = {}
          for (const [payloadKey, rpcParam] of Object.entries(rpc.paramMap)) {
            if (payloadKey in payload) {
              params[rpcParam] = payload[payloadKey]
            }
          }
          const { error } = await supabase.rpc(rpc.rpcName, params)
          if (error) {
            const isNetworkError = false
            await _handleBatchError([entry], error, isNetworkError, async () => {
              const { error: retryError } = await supabase!.rpc(rpc.rpcName, params)
              if (!retryError) {
                await db.syncQueue.bulkDelete([entry.id!])
                return true
              }
              return false
            })
            // Continue processing remaining entries in this batch.
            continue
          }
          await db.syncQueue.bulkDelete([entry.id!])
        }
        return true
      } else {
        // P2+ monotonic table without dedicated RPC — warn and fall back to upsert.
        // Intentional: correct behavior deferred to dedicated migration stories (E93–E96).
        console.warn(
          `[syncEngine] No monotonic RPC for table "${tableEntry.supabaseTable}" — falling back to generic upsert. Implement dedicated RPC in E93–E96.`,
        )
        const { error } = await supabase
          .from(tableEntry.supabaseTable)
          .upsert(payloads, { onConflict: 'id' })
        if (error) {
          const isNetworkError = false
          await _handleBatchError(entries, error, isNetworkError, async () => {
            const { error: retryError } = await supabase!
              .from(tableEntry.supabaseTable)
              .upsert(payloads, { onConflict: 'id' })
            if (!retryError) {
              await db.syncQueue.bulkDelete(entries.map((e) => e.id!))
              return true
            }
            return false
          })
          return false
        }
      }
    } else {
      // Default: LWW, conflict-copy, or any other — upsert with conflict on 'id'.
      const { error } = await supabase
        .from(tableEntry.supabaseTable)
        .upsert(payloads, { onConflict: 'id' })
      if (error) {
        const isNetworkError = false
        await _handleBatchError(entries, error, isNetworkError, async () => {
          const { error: retryError } = await supabase!
            .from(tableEntry.supabaseTable)
            .upsert(payloads, { onConflict: 'id' })
          if (!retryError) {
            await db.syncQueue.bulkDelete(entries.map((e) => e.id!))
            return true
          }
          return false
        })
        return false
      }
    }

    // Success — delete uploaded entries from the queue.
    await db.syncQueue.bulkDelete(entries.map((e) => e.id!))
    return true
  } catch (err: unknown) {
    // Network error (TypeError from fetch) — no HTTP status.
    const isNetworkError = true
    await _handleBatchError(entries, null, isNetworkError, async () => false)
    console.error('[syncEngine] Network error during batch upload:', err)
    return false
  }
}

// ---------------------------------------------------------------------------
// E92-S06: Apply helpers — conflict strategy implementations
// ---------------------------------------------------------------------------

/**
 * Retrieve a local Dexie record by id, handling compound-PK tables.
 *
 * When `entry.compoundPkFields` is defined, the compound key array is built
 * from the record's field values and `.where().equals().first()` is used.
 * Otherwise falls back to `.get(record.id)`.
 *
 * Intentional: `progress` table lacks `compoundPkFields` in tableRegistry
 * (pre-existing known gap R1-PE-01 from E92-S02). Falls through to `get(record.id)`,
 * which may miss records if the id is not a stable PK. Tracked in known-issues.
 */
async function _getLocalRecord(
  table: Table<Record<string, unknown>>,
  entry: ReturnType<typeof getTableEntry>,
  record: Record<string, unknown>,
): Promise<Record<string, unknown> | undefined> {
  if (!entry) return undefined

  if (entry.compoundPkFields && entry.compoundPkFields.length > 0) {
    const keyValues = entry.compoundPkFields.map((f) => record[f])
    // Dexie compound key lookup: where(['a','b']).equals([va, vb]).first()
    return (table as unknown as { where: (fields: string[]) => { equals: (values: unknown[]) => { first: () => Promise<Record<string, unknown> | undefined> } } })
      .where(entry.compoundPkFields)
      .equals(keyValues)
      .first()
  }

  return table.get(record['id'] as string)
}

/**
 * Apply LWW (last-write-wins) strategy: overwrite local only when the
 * downloaded record has a strictly newer `updatedAt`.
 */
async function _applyLww(
  table: Table<Record<string, unknown>>,
  local: Record<string, unknown> | undefined,
  record: Record<string, unknown>,
): Promise<void> {
  if (!local) {
    await table.put(record)
    return
  }

  const serverTs = new Date(record['updatedAt'] as string).getTime()
  const localTs = new Date(local['updatedAt'] as string).getTime()

  if (serverTs > localTs) {
    await table.put(record)
    // server is newer — overwrite local
  }
  // client newer or equal → no-op (client wins ties)
}

/**
 * Apply monotonic strategy: for each `monotonicField`, keep `Math.max()` of
 * local and server values. LWW decides which record's non-monotonic fields win.
 */
async function _applyMonotonic(
  table: Table<Record<string, unknown>>,
  local: Record<string, unknown> | undefined,
  record: Record<string, unknown>,
  monotonicFields: string[],
): Promise<void> {
  if (!local) {
    await table.put(record)
    return
  }

  const serverTs = new Date(record['updatedAt'] as string).getTime()
  const localTs = new Date(local['updatedAt'] as string).getTime()

  // Determine which record is the LWW winner for non-monotonic fields.
  const base: Record<string, unknown> = serverTs > localTs ? { ...record } : { ...local }

  // Overlay monotonic fields: always use Math.max of both values.
  for (const field of monotonicFields) {
    const serverVal = Number(record[field] ?? 0)
    const localVal = Number(local[field] ?? 0)
    base[field] = Math.max(serverVal, localVal)
  }

  await table.put(base)
}

/**
 * Apply insert-only strategy: add the record if absent; never overwrite.
 */
async function _applyInsertOnly(
  table: Table<Record<string, unknown>>,
  local: Record<string, unknown> | undefined,
  record: Record<string, unknown>,
): Promise<void> {
  if (local) return // already present — insert-only records are immutable
  await table.add(record)
}

/**
 * Apply conflict-copy strategy: when remote wins on timestamp AND content
 * differs, preserve the local version as a JSONB snapshot (`conflictCopy`)
 * on the winning remote note rather than silently discarding it.
 * Otherwise fall back to LWW.
 *
 * Replaces the E93-S01 stub that created a duplicate Dexie record with a
 * new UUID. The inline-field approach avoids ghost entries in the notes list.
 *
 * Detection: remote wins when `remote.updatedAt > local.updatedAt`.
 * Content check: `remote.content !== local.content` (string equality).
 * Exact-same-timestamp writes are treated as no-conflict (fall through to LWW).
 */
async function _applyConflictCopy(
  table: Table<Record<string, unknown>>,
  local: Record<string, unknown> | undefined,
  record: Record<string, unknown>,
): Promise<void> {
  if (!local) {
    // New record — no conflict possible.
    await table.put(record)
    return
  }

  const remoteUpdatedAt = record['updatedAt'] as string
  const localUpdatedAt = local['updatedAt'] as string
  const remoteContent = record['content'] as string
  const localContent = local['content'] as string

  const remoteWins = remoteUpdatedAt > localUpdatedAt
  const contentDiffers = remoteContent !== localContent

  if (remoteWins && contentDiffers) {
    // Intentional: conflict-copy tables bypass bare LWW — applyConflictCopy
    // preserves the losing local version in conflictCopy rather than silently
    // discarding it.
    // If conflictCopy already exists, newest remote wins — previous snapshot is
    // replaced. Unresolved conflicts are superseded by the latest remote version.
    // Guard: ensure tags array is present on both sides before delegating to resolver.
    const localNote = local as unknown as Note
    const remoteNote = { ...record, tags: (record['tags'] as string[] | undefined) ?? [] } as unknown as Note
    const merged = applyConflictCopy(localNote, remoteNote)
    await table.put(merged as unknown as Record<string, unknown>)
    return
  }

  // No conflict (same timestamp, same content, or local wins) — apply LWW.
  await _applyLww(table, local, record)
}

/**
 * Route a single downloaded record to the correct apply strategy based on the
 * table's `conflictStrategy`. Throws on Dexie write failure so `_doDownload`
 * can catch per-record and continue.
 */
async function _applyRecord(
  entry: NonNullable<ReturnType<typeof getTableEntry>>,
  record: Record<string, unknown>,
): Promise<void> {
  // Intentional: dynamic table access — Dexie's TypeScript types don't expose a
  // typed index signature. Cast via `unknown` to avoid `any`.
  const table = (db as unknown as Record<string, Table<Record<string, unknown>>>)[entry.dexieTable]
  if (!table) {
    console.error(`[syncEngine] Dexie table "${entry.dexieTable}" not found — skipping record.`)
    return
  }

  const local = await _getLocalRecord(table, entry, record)

  switch (entry.conflictStrategy) {
    case 'lww':
      await _applyLww(table, local, record)
      break

    case 'monotonic':
      await _applyMonotonic(table, local, record, entry.monotonicFields ?? [])
      break

    case 'insert-only':
      await _applyInsertOnly(table, local, record)
      break

    case 'conflict-copy':
      await _applyConflictCopy(table, local, record)
      break

    default:
      // Intentional: 'skip' and any future unknown strategies are no-ops here.
      console.warn(`[syncEngine] Unknown conflict strategy "${entry.conflictStrategy}" for table "${entry.dexieTable}" — skipping.`)
  }

  // Post-apply hook: replay FSRS review log for flashcards that have been reviewed.
  // Guard: only call for the 'flashcards' table and only when last_review is set.
  // New (never-reviewed) cards have no review log — replaying them would be a no-op
  // Supabase query that could also overwrite a fresh local card with default FSRS state.
  // replayFlashcardReviews swallows its own errors, so failures here are non-fatal.
  if (entry.dexieTable === 'flashcards' && record['lastReview']) {
    await replayFlashcardReviews(record['id'] as string)
  }
}

// ---------------------------------------------------------------------------
// E92-S06: Core download cycle
// ---------------------------------------------------------------------------

/**
 * Download all syncable tables from Supabase, in registry priority order.
 * For each table:
 *   1. Reads `lastSyncTimestamp` from `syncMetadata` (null → full download).
 *   2. Fetches rows updated since the cursor (or all rows if null).
 *   3. Converts each row from snake_case to camelCase via `toCamelCase`.
 *   4. Applies each record using the table's conflict strategy.
 *   5. Advances `syncMetadata.lastSyncTimestamp` to the max `updated_at` seen.
 *   6. Calls any registered store refresh callback for the table.
 *
 * Per-record errors are caught individually — one bad record doesn't abort
 * the table. Per-table Supabase errors are caught — one bad table doesn't
 * abort the download.
 */
async function _doDownload(): Promise<void> {
  // Intentional: supabase null-guard — env vars may be missing in dev/test.
  if (!supabase) {
    console.warn('[syncEngine] Supabase client is null — skipping download cycle.')
    return
  }

  for (const entry of tableRegistry) {
    if (entry.skipSync) continue

    // Read incremental cursor.
    const meta = await db.syncMetadata.get(entry.dexieTable)
    const cursor = meta?.lastSyncTimestamp ?? null

    // Build Supabase query — chain .gte() only when cursor is present.
    let query = supabase
      .from(entry.supabaseTable)
      .select('*')
      .order('updated_at', { ascending: true })

    if (cursor !== null) {
      query = query.gte('updated_at', cursor)
    }

    const { data: rows, error } = await query

    if (error) {
      console.error(
        `[syncEngine] Download error for table "${entry.supabaseTable}":`,
        error.message,
      )
      continue // skip to next table
    }

    if (!rows || rows.length === 0) continue

    // Apply each row with per-record error isolation.
    let maxUpdatedAt: string | null = null

    for (const row of rows) {
      const rowUpdatedAt = row['updated_at'] as string | undefined
      if (rowUpdatedAt && (maxUpdatedAt === null || rowUpdatedAt > maxUpdatedAt)) {
        maxUpdatedAt = rowUpdatedAt
      }

      const record = toCamelCase(entry, row as Record<string, unknown>)

      try {
        await _applyRecord(entry, record)
      } catch (err) {
        console.error(
          `[syncEngine] Error applying record from "${entry.dexieTable}":`,
          err,
        )
        // Intentional: continue processing remaining records — one bad record
        // should not abort the whole table.
      }
    }

    // Advance the cursor to the max updated_at seen in this batch.
    if (maxUpdatedAt !== null) {
      await db.syncMetadata.put({
        table: entry.dexieTable,
        lastSyncTimestamp: maxUpdatedAt,
      })
    }

    // Notify registered Zustand store (if any) to reload from Dexie.
    const refreshFn = _storeRefreshRegistry.get(entry.dexieTable)
    if (refreshFn) {
      await refreshFn().catch((err) =>
        console.warn(`[syncEngine] Store refresh failed for "${entry.dexieTable}":`, err),
      )
    }
  }
}

// ---------------------------------------------------------------------------
// E92-S06: fullSync — upload then download
// ---------------------------------------------------------------------------

/**
 * Run a full sync cycle: flush pending writes (upload) then pull server changes
 * (download). Upload runs first so that unsynced local writes are sent before
 * the server snapshot is fetched — preventing a stale server record from
 * overwriting a more recent local edit on the next LWW comparison.
 *
 * Each phase is wrapped individually so an upload failure does not cancel the
 * download (best-effort: local records will win on LWW in the next cycle).
 *
 * Intentional: fullSync does NOT check `_started` — it can be called
 * independently by tests and E92-S07 without requiring `start()` first.
 * The individual phase functions (`_doUpload`, `_doDownload`) each have their
 * own null guard for the Supabase client.
 */
async function _doFullSync(): Promise<void> {
  try {
    await _doUpload()
  } catch (err) {
    console.error('[syncEngine] Upload phase error during fullSync:', err)
    // Intentional: continue to download even if upload failed.
  }

  try {
    await _doDownload()
  } catch (err) {
    console.error('[syncEngine] Download phase error during fullSync:', err)
  }
}

// ---------------------------------------------------------------------------
// Core upload cycle
// ---------------------------------------------------------------------------

async function _doUpload(): Promise<void> {
  // Intentional: supabase null-guard — return early if env vars missing.
  if (!supabase) {
    console.warn('[syncEngine] Supabase client is null — skipping upload cycle.')
    return
  }

  const coalesced = await _coalesceQueue()
  if (coalesced.length === 0) return

  // Group entries by table name.
  const byTable = new Map<string, SyncQueueEntry[]>()
  for (const entry of coalesced) {
    const group = byTable.get(entry.tableName) ?? []
    group.push(entry)
    byTable.set(entry.tableName, group)
  }

  for (const [tableName, entries] of byTable) {
    const tableEntry = getTableEntry(tableName)
    if (!tableEntry) {
      // Intentional: unknown table — skip (caller bug, not a transient failure).
      console.error(
        `[syncEngine] No registry entry for table "${tableName}" — skipping. Check tableRegistry.ts.`,
      )
      continue
    }

    if (tableEntry.skipSync) continue

    const batches = chunk(entries, BATCH_SIZE)
    for (const batch of batches) {
      await _uploadBatch(batch, tableEntry)
    }
  }
}

// ---------------------------------------------------------------------------
// Upload cycle runner — acquires concurrency guard before entering _doUpload
// ---------------------------------------------------------------------------

async function _runUploadCycle(): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.locks) {
    // Intentional: ifAvailable: true means the callback receives null if the
    // lock is already held — we skip rather than queue. This prevents multiple
    // concurrent upload cycles from stacking.
    await navigator.locks.request('sync-upload', { ifAvailable: true }, async (lock) => {
      if (!lock) return // lock not available — another cycle is running
      syncEngine._setRunning(true)
      try {
        await _doUpload()
      } finally {
        syncEngine._setRunning(false)
      }
    })
  } else {
    // Intentional: Safari ≤15.3 fallback — module-level boolean guard.
    if (_uploadInFlight) return
    _uploadInFlight = true
    syncEngine._setRunning(true)
    try {
      await _doUpload()
    } finally {
      _uploadInFlight = false
      syncEngine._setRunning(false)
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const syncEngine = {
  /**
   * Signal the engine to run an upload cycle soon.
   * Debounced 200ms — multiple rapid calls collapse into a single cycle.
   * No-op when the engine has not been started via `start()`.
   */
  nudge(): void {
    // Intentional: guard prevents nudge from triggering uploads before auth,
    // and stops residual nudge calls after stop() is called.
    if (!_started) return

    if (_debounceTimer !== null) {
      clearTimeout(_debounceTimer)
    }
    _debounceTimer = setTimeout(() => {
      _debounceTimer = null
      _runUploadCycle().catch((err) => {
        console.error('[syncEngine] Upload cycle error:', err)
      })
    }, DEBOUNCE_MS)
  },

  /** True when the engine is actively processing the sync queue. */
  get isRunning(): boolean {
    return _isRunning
  },

  /**
   * @internal — called by the concurrency guard to update running state.
   * Do not call from application code.
   */
  _setRunning(value: boolean): void {
    _isRunning = value
  },

  // ---------------------------------------------------------------------------
  // E92-S06: Lifecycle API
  // ---------------------------------------------------------------------------

  /**
   * Start the sync engine for the given user. Runs an initial `fullSync()`
   * immediately, then enables periodic nudges from `useSyncLifecycle` (E92-S07).
   *
   * Calling `start()` again while already running updates the userId and
   * triggers another fullSync — safe to call on session refresh.
   */
  async start(userId: string): Promise<void> {
    _userId = userId
    _started = true
    await _doFullSync()
  },

  /**
   * Stop the sync engine. Cancels any pending debounce timer and marks the
   * engine as stopped. Any in-flight upload lock cycle will complete naturally
   * (locks cannot be forcibly cancelled), but no new cycles will start.
   */
  stop(): void {
    _started = false
    _userId = null
    if (_debounceTimer !== null) {
      clearTimeout(_debounceTimer)
      _debounceTimer = null
    }
  },

  /**
   * Run a full sync cycle (upload then download) immediately.
   * Can be called without `start()` — useful for tests and E92-S07 triggers.
   * Does not propagate exceptions to the caller.
   */
  async fullSync(): Promise<void> {
    await _doFullSync()
  },

  // ---------------------------------------------------------------------------
  // E92-S06: Store refresh registry
  // ---------------------------------------------------------------------------

  /**
   * The currently authenticated user ID — set by `start()`, cleared by `stop()`.
   * Used by E92-S08 for userId backfill and per-user scoping.
   */
  get currentUserId(): string | null {
    return _userId
  },

  /**
   * Register a callback that the download engine will call after applying
   * downloaded records for `tableName`. Used by `useSyncLifecycle` (E92-S07)
   * to connect Dexie table updates to Zustand store reloads without importing
   * stores into this pure module.
   *
   * Example:
   *   syncEngine.registerStoreRefresh('notes', () => useNoteStore.getState().loadNotes())
   */
  registerStoreRefresh(tableName: string, callback: () => Promise<void>): void {
    _storeRefreshRegistry.set(tableName, callback)
  },
}
