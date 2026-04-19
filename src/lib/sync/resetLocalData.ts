/**
 * resetLocalData — E97-S02 destructive escape hatch.
 *
 * **DESTRUCTIVE: Clears all Dexie data tables registered in `tableRegistry`.**
 *
 * Sequence:
 *   1. `syncEngine.stop()`                — halt interval + pending debounce.
 *   2. `db[entry.dexieTable].clear()`     — wipe user data rows for every
 *      registry entry that is NOT marked `skipSync`. Upload-only tables (e.g.
 *      `embeddings`) are included because the user's intent is a full re-download
 *      escape hatch; stale locally-generated vectors are acceptable collateral.
 *      Each `.clear()` is wrapped in its own try/catch so one bad table does
 *      not abort the rest.
 *   3. `clearSyncState()`                 — drop `syncQueue` and reset
 *      `syncMetadata` cursors so the next `fullSync()` re-downloads from t=0.
 *   4. `syncEngine.start(userId)`         — triggers the initial fullSync that
 *      rehydrates Dexie from Supabase. Skipped when `userId` is null (signed
 *      out): the engine stays stopped and the next sign-in resumes it.
 *
 * Non-goals:
 *   - Does NOT clear localStorage (`app-settings`) or anything managed by
 *     Supabase Auth.
 *   - Does NOT attempt to flush pending `syncQueue` before clearing — the
 *     user's intent is recovery from corruption, and pending writes may be the
 *     corruption source.
 *   - Does NOT cancel a mid-flight upload lock cycle (navigator.locks cannot
 *     be forcibly released); the short wait is acceptable.
 *
 * @since E97-S02
 */

import { db } from '@/db'
import { syncEngine } from './syncEngine'
import { clearSyncState } from './clearSyncState'
import { tableRegistry } from './tableRegistry'

export async function resetLocalData(userId: string | null): Promise<void> {
  // 1. Halt the engine before touching data so no mid-flight upload can write
  //    a row we're about to clear back to Supabase.
  try {
    syncEngine.stop()
  } catch (err) {
    // Defensive: stop() is synchronous and should not throw, but if it does
    // we continue with the reset so the user's escape hatch still fires.
    console.warn('[resetLocalData] syncEngine.stop() threw:', err)
  }

  // 2. Wipe every registered table except those explicitly opted out of sync
  //    (skipSync=true). Upload-only tables (e.g. embeddings) ARE cleared so
  //    the re-download is genuinely clean; they will regenerate on demand.
  const dbAny = db as unknown as Record<string, { clear: () => Promise<void> } | undefined>
  for (const entry of tableRegistry) {
    if (entry.skipSync) continue
    const table = dbAny[entry.dexieTable]
    if (!table || typeof table.clear !== 'function') {
      console.warn(`[resetLocalData] unknown Dexie table in registry: ${entry.dexieTable}`)
      continue
    }
    try {
      await table.clear()
    } catch (err) {
      // Per-table failures must not abort the rest — the escape hatch stays usable.
      console.warn(`[resetLocalData] failed to clear table ${entry.dexieTable}:`, err)
    }
  }

  // 3. Clear sync queue + reset per-table download cursors so the next
  //    fullSync() re-downloads from the beginning instead of from a stale
  //    lastSyncTimestamp that would skip freshly-cleared rows.
  try {
    await clearSyncState()
  } catch (err) {
    console.warn('[resetLocalData] clearSyncState() failed:', err)
  }

  // 4. Restart the engine for the signed-in user. When signed out, leave the
  //    engine stopped — next sign-in's auth listener will start it.
  if (userId) {
    try {
      await syncEngine.start(userId)
    } catch (err) {
      // Surfaced to caller via rejection — the UI layer shows a toast.
      console.error('[resetLocalData] syncEngine.start failed after reset:', err)
      throw err
    }
  }
}
