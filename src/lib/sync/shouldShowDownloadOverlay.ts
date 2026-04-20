/**
 * E97-S04: Detection helper for the New-Device Download Overlay.
 *
 * Pure read-only predicate answering "should the new-device download overlay
 * appear for this user on this device?" Used by App.tsx to gate mounting of
 * `NewDeviceDownloadOverlay`.
 *
 * The predicate is the symmetric inverse of `shouldShowInitialUploadWizard`:
 * the wizard fires when local data is NOT synced up, the overlay fires when
 * local Dexie is EMPTY but remote Supabase has data to restore.
 *
 * Truth table:
 *   1. No userId            → false (guard)
 *   2. Local Dexie has any syncable rows for this user → false (R6 short-circuit)
 *   3. Remote HEAD counts all fail → false (safe default — don't mount on
 *      unknown state)
 *   4. Remote has any rows across the counted tables → true
 *   5. Remote is provably empty → false
 *
 * Echo-loop guard: uses `db.table(...).count()` reads only — never writes to
 * syncQueue or any Dexie table. Mirrors the E96-S02 invariant that hydrate
 * and detection paths never enqueue sync work.
 *
 * @see docs/plans/2026-04-19-025-feat-e97-s04-new-device-download-experience-plan.md
 * @since E97-S04
 */

import { db } from '@/db'
import { supabase } from '@/lib/auth/supabase'
import { tableRegistry, type TableRegistryEntry } from './tableRegistry'

/**
 * Tables counted for both emptiness detection (Dexie side) and remote
 * presence detection (Supabase side). Derived once at module load from
 * `tableRegistry`, filtered to entries that participate in the download
 * direction — `skipSync` tables are excluded (no sync at all), and
 * `uploadOnly` tables are excluded (no download direction — e.g. `embeddings`).
 *
 * This derivation is the single source of truth for the overlay: adding a
 * table to `tableRegistry` automatically flows into the overlay's counts
 * without touching this file.
 */
export function getCountedTables(): readonly TableRegistryEntry[] {
  return tableRegistry.filter((e) => !e.skipSync && !e.uploadOnly)
}

/**
 * Returns true if any Dexie row for this user exists across the syncable
 * tables. Used to short-circuit R6 — if local data exists, the overlay must
 * not appear regardless of remote state.
 *
 * Singleton tables (those whose Dexie PK maps to `user_id` in Supabase, i.e.
 * `fieldMap.id === 'user_id'`) are excluded from the emptiness probe. A
 * singleton row from a prior user session (e.g. `notificationPreferences`
 * stored with `id: 'singleton'`) would otherwise make `localHasData` return
 * `true` for a brand-new user, suppressing the overlay incorrectly (F3 fix).
 *
 * Errors on any single table count are swallowed (contribute 0), matching
 * the `hasUnlinkedRecords` / `computeUnlinkedCount` posture.
 */
async function localHasData(userId: string): Promise<boolean> {
  const entries = getCountedTables().filter(
    // Exclude singleton tables: their Dexie PK is not a userId but is mapped
    // to user_id in Supabase via fieldMap. A row from a prior user makes
    // localHasData return true for a new user, suppressing the overlay.
    (entry) => entry.fieldMap['id'] !== 'user_id',
  )
  const results = await Promise.allSettled(
    entries.map(async (entry) => {
      try {
        return await db
          .table(entry.dexieTable)
          .filter((r: Record<string, unknown>) => {
            const rowUserId = r.userId
            // Only count rows that explicitly belong to this user. Rows with no
            // userId field are skipped (they are singleton or pre-backfill rows
            // whose user-scope cannot be determined safely).
            if (rowUserId === undefined || rowUserId === null || rowUserId === '') {
              return false
            }
            return rowUserId === userId
          })
          .count()
      } catch (err) {
        // silent-catch-ok — missing/broken Dexie tables contribute 0 and
        // other tables still counted.
        console.error(
          `[shouldShowDownloadOverlay] Dexie count failed for ${entry.dexieTable}:`,
          err,
        )
        return 0
      }
    }),
  )
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value > 0) {
      return true
    }
  }
  return false
}

/**
 * Returns true if any Supabase HEAD count across the same filtered registry
 * tables returns a non-zero count. All-fail is treated as "unknown" →
 * returns false (safe default — don't mount the overlay on unknown state;
 * the watchdog would immediately complain otherwise).
 */
async function remoteHasAnyRows(userId: string): Promise<boolean> {
  if (!supabase) return false
  const client = supabase
  const entries = getCountedTables()

  const results = await Promise.allSettled(
    entries.map(async (entry) => {
      const { count, error } = await client
        .from(entry.supabaseTable)
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
      if (error) throw error
      return count ?? 0
    }),
  )

  for (const r of results) {
    if (r.status === 'fulfilled' && r.value > 0) {
      return true
    }
  }
  return false
}

/**
 * Returns `true` when the new-device download overlay should be mounted for
 * `userId`. Pure read-only — never writes.
 */
export async function shouldShowDownloadOverlay(
  userId: string | null | undefined,
): Promise<boolean> {
  if (!userId) return false

  try {
    // R6 short-circuit: if any local data exists, the overlay must not appear.
    if (await localHasData(userId)) {
      return false
    }
  } catch (err) {
    // silent-catch-ok — on detection error we default to NOT showing the
    // overlay (safer than surfacing an overlay over a broken DB read).
    console.error('[shouldShowDownloadOverlay] localHasData failed:', err)
    return false
  }

  try {
    return await remoteHasAnyRows(userId)
  } catch (err) {
    // silent-catch-ok — same safe default.
    console.error('[shouldShowDownloadOverlay] remoteHasAnyRows failed:', err)
    return false
  }
}
