/**
 * Sync Engine — E92-S05 (upload phase)
 *
 * Replaces the E92-S04 no-op stub with a working upload engine. Reads from
 * `syncQueue` (Dexie), coalesces duplicates, batches to Supabase, retries
 * transient failures with exponential back-off, and dead-letters permanent ones.
 * Concurrent upload cycles are serialized via `navigator.locks`; a module-level
 * boolean is the fallback for Safari ≤15.3.
 *
 * **Public API — unchanged from S04:**
 *   - `syncEngine.nudge(): void` — debounced (200ms) upload trigger
 *   - `syncEngine.isRunning: boolean` — true when an upload cycle is active
 *
 * **Internal API (E92-S05):**
 *   - `syncEngine._setRunning(value: boolean): void`
 *
 * Pure module — no React imports. Safe to import anywhere.
 *
 * @module syncEngine
 * @since E92-S05
 */

import { db } from '@/db'
import type { SyncQueueEntry } from '@/db/schema'
import { supabase } from '@/lib/auth/supabase'
import { getTableEntry } from './tableRegistry'

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
            const singleEntry = [entry]
            const singlePayload = [payload]
            await _handleBatchError(singleEntry, error, isNetworkError, async () => {
              const { error: retryError } = await supabase!.rpc(rpc.rpcName, params)
              if (!retryError) {
                await db.syncQueue.bulkDelete([entry.id!])
                return true
              }
              return false
            })
            // Continue processing remaining entries in this batch.
            void singlePayload // suppress unused variable
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
   */
  nudge(): void {
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
}
