/**
 * E97-S04: Progress source hook for the New-Device Download Overlay.
 *
 * Snapshots remote totals at mount time via Supabase HEAD count queries, then
 * polls Dexie table counts every 500ms to derive
 * `{ processed, total, done, error, recentTable, totalsFailedCount, totalTables }`.
 *
 * Covers all synced tables (P0–P4) derived from `tableRegistry`, excluding
 * `skipSync` entries (opted out of sync entirely) and `uploadOnly` entries
 * (e.g. `embeddings` — no download direction).
 *
 * HEAD failure policy (plan §R5):
 *   - `totalsFailedCount === totalTables` (ALL failed) → `error = true` with
 *     a user-facing copy. Overlay surfaces Retry.
 *   - `0 < totalsFailedCount < totalTables` (PARTIAL) → graceful degrade.
 *     Continue with partial baseline; numeric progress renders with a
 *     "(partial counts)" suffix from the component.
 *   - `totalsFailedCount === 0` → happy path.
 *
 * Mirrors `useInitialUploadProgress`'s snapshot-on-mount + useRef stability
 * pattern (E97-S03 F2 fix — poll must read from a ref, not state, to avoid
 * the race where an early completion returns total=0 before the snapshot
 * lands).
 *
 * @see docs/plans/2026-04-19-025-feat-e97-s04-new-device-download-experience-plan.md
 * @since E97-S04
 */
import { useEffect, useRef, useState } from 'react'
import { db } from '@/db'
import { supabase } from '@/lib/auth/supabase'
import { getCountedTables } from '@/lib/sync/shouldShowDownloadOverlay'
import { useDownloadStatusStore } from '@/app/stores/useDownloadStatusStore'
import type { TableRegistryEntry } from '@/lib/sync/tableRegistry'

export interface DownloadProgress {
  /** Items restored so far (clamped 0..total). */
  processed: number
  /** Remote total captured at mount time. Stable for the hook's lifetime. */
  total: number
  /** `true` when restore is considered visually complete. */
  done: boolean
  /** `true` when ALL HEAD count queries failed (user-facing error). */
  error: boolean
  /** Error message when `error` is true. */
  errorMessage: string | null
  /** Last Dexie table that grew this tick (cosmetic hint). */
  recentTable: string | null
  /** How many per-table HEAD count queries failed. */
  totalsFailedCount: number
  /** Total number of tables being counted. */
  totalTables: number
}

const POLL_INTERVAL_MS = 500

const INITIAL_STATE: DownloadProgress = {
  processed: 0,
  total: 0,
  done: false,
  error: false,
  errorMessage: null,
  recentTable: null,
  totalsFailedCount: 0,
  totalTables: 0,
}

/**
 * Resolve the Supabase column name used to filter rows by user for a given
 * registry entry. Mirrors `resolveUserColumn` in shouldShowDownloadOverlay.
 *
 * Uses the entry's `fieldMap` to detect a non-default mapping for the Dexie
 * `userId` field. If `fieldMap.userId` is present, that value is the Supabase
 * column name; otherwise defaults to `'user_id'`. This ensures tables with
 * non-standard user FK columns (e.g. future `owner_id` tables) are queried
 * correctly without touching call sites.
 */
function resolveUserColumn(entry: TableRegistryEntry): string {
  return entry.fieldMap['userId'] ?? 'user_id'
}

/**
 * Fire a single Supabase HEAD count query. Resolves to the integer count or
 * throws on error. Callers wrap with `Promise.allSettled` so one rejection
 * does not cancel the rest.
 *
 * Accepts an explicit `userColumn` parameter (resolved via `resolveUserColumn`)
 * so each table's user FK column is used correctly (F2 fix).
 *
 * Dev/test escape hatch: if `window.__mockHeadCounts` is set (non-prod only),
 * returns that value instead of hitting Supabase. Tree-shaken in prod.
 */
async function headCount(
  supabaseTable: string,
  userId: string,
  userColumn: string = 'user_id',
): Promise<number> {
  if (!import.meta.env.PROD) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mock = (window as any).__mockHeadCounts as number | undefined
    if (typeof mock === 'number') return mock
  }
  if (!supabase) {
    throw new Error('Supabase client unavailable')
  }
  const { count, error } = await supabase
    .from(supabaseTable)
    .select('*', { count: 'exact', head: true })
    .eq(userColumn, userId)
  if (error) throw error
  return count ?? 0
}

/**
 * Sum local Dexie `.count()` across the same filtered registry entries.
 * Returns both the total and the per-table counts (used by the caller to
 * derive `recentTable` from the table with the largest delta since last tick).
 *
 * Applies the same strict userId filter as `localHasData` in
 * shouldShowDownloadOverlay:
 *   - Singleton tables (`fieldMap.id === 'user_id'`) are excluded — their Dexie
 *     PK is `'singleton'`, not a userId, so counting them would inflate processed
 *     counts if a prior user's singleton row persists on this device.
 *   - Only rows where `rowUserId === userId` are counted; rows with no userId
 *     field are excluded (pre-backfill singletons, cannot be user-scoped safely).
 */
async function localCountAll(
  userId: string,
): Promise<{ total: number; perTable: Record<string, number> }> {
  // Mirror the singleton exclusion from localHasData (F1 fix).
  const entries = getCountedTables().filter(
    (entry) => entry.fieldMap['id'] !== 'user_id',
  )
  const results = await Promise.allSettled(
    entries.map(async (entry) => {
      try {
        const count = await db
          .table(entry.dexieTable)
          .filter((r: Record<string, unknown>) => {
            const rowUserId = r.userId
            // Strict filter: only count rows explicitly belonging to this user.
            // Rows with no userId (singleton or pre-backfill) cannot be safely
            // attributed and are excluded (mirrors localHasData semantics).
            if (rowUserId === undefined || rowUserId === null || rowUserId === '') {
              return false
            }
            return rowUserId === userId
          })
          .count()
        return { table: entry.dexieTable, count }
      } catch (err) {
        // silent-catch-ok — missing/broken table contributes 0; log once
        console.error(
          `[useDownloadProgress] Dexie count failed for ${entry.dexieTable}:`,
          err,
        )
        return { table: entry.dexieTable, count: 0 }
      }
    }),
  )
  let total = 0
  const perTable: Record<string, number> = {}
  for (const r of results) {
    if (r.status === 'fulfilled') {
      total += r.value.count
      perTable[r.value.table] = r.value.count
    }
  }
  return { total, perTable }
}

export function useDownloadProgress(
  userId: string,
  enabled: boolean,
  retryNonce: number = 0,
): DownloadProgress {
  const [state, setState] = useState<DownloadProgress>(INITIAL_STATE)

  // Refs survive renders; avoid the state-read race on early ticks.
  const snapshotTakenRef = useRef(false)
  const totalRef = useRef(0)
  const totalsFailedCountRef = useRef(0)
  const totalTablesRef = useRef(0)
  const lastPerTableRef = useRef<Record<string, number>>({})

  useEffect(() => {
    if (!enabled || !userId) {
      // Reset on disable so a subsequent re-enable takes a fresh snapshot.
      snapshotTakenRef.current = false
      totalRef.current = 0
      totalsFailedCountRef.current = 0
      totalTablesRef.current = 0
      lastPerTableRef.current = {}
      setState(INITIAL_STATE)
      return
    }

    // Reset all refs when retryNonce changes so the hook re-snapshots HEAD
    // counts from scratch rather than resuming with stale error state.
    snapshotTakenRef.current = false
    totalRef.current = 0
    totalsFailedCountRef.current = 0
    totalTablesRef.current = 0
    lastPerTableRef.current = {}
    setState(INITIAL_STATE)

    let cancelled = false
    let intervalId: number | null = null

    async function tick() {
      if (cancelled) return
      try {
        const { total: localTotal, perTable } = await localCountAll(userId)
        if (cancelled) return

        const remoteTotal = totalRef.current
        const processed = Math.max(
          0,
          remoteTotal > 0 ? Math.min(remoteTotal, localTotal) : localTotal,
        )

        // Derive recentTable by comparing per-tick deltas
        let recentTable: string | null = null
        let maxDelta = 0
        for (const [table, count] of Object.entries(perTable)) {
          const prev = lastPerTableRef.current[table] ?? 0
          const delta = count - prev
          if (delta > maxDelta) {
            maxDelta = delta
            recentTable = table
          }
        }
        lastPerTableRef.current = perTable

        const storeStatus = useDownloadStatusStore.getState().status
        const done =
          storeStatus === 'complete' ||
          (remoteTotal > 0 &&
            processed >= remoteTotal &&
            totalsFailedCountRef.current === 0)

        setState((prev) => ({
          ...prev,
          processed,
          total: remoteTotal,
          done,
          recentTable: recentTable ?? prev.recentTable,
          totalsFailedCount: totalsFailedCountRef.current,
          totalTables: totalTablesRef.current,
        }))
      } catch (err) {
        if (cancelled) return
        // silent-catch-ok — tick failure non-fatal; next poll retries.
        console.error('[useDownloadProgress] tick failed:', err)
      }
    }

    async function snapshotAndStart() {
      // Exclude singleton tables (fieldMap.id === 'user_id') from HEAD counts,
      // mirroring localCountAll and remoteHasAnyRows (F2 fix — consistent
      // userId scoping). Singletons contribute at most 1 row per user and a
      // prior-user singleton would be filtered by the .eq() anyway, but
      // excluding them keeps the counted-table set symmetric across all paths.
      const entries = getCountedTables().filter(
        (entry) => entry.fieldMap['id'] !== 'user_id',
      )
      totalTablesRef.current = entries.length

      // Parallel HEAD counts with allSettled so a partial outage degrades
      // gracefully (R5). resolveUserColumn selects the correct FK column per
      // table so non-standard user columns don't silently reject (F2 fix).
      const results = await Promise.allSettled(
        entries.map((entry) =>
          headCount(entry.supabaseTable, userId, resolveUserColumn(entry)),
        ),
      )

      // F4: Check cancelled BEFORE writing to any refs so rapid open/close
      // toggles cannot leak stale totals into a subsequent hook instance.
      if (cancelled) return

      let remoteTotal = 0
      let failedCount = 0
      const failedTables: string[] = []
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') {
          remoteTotal += r.value
        } else {
          failedCount += 1
          failedTables.push(entries[i].supabaseTable)
        }
      })

      totalRef.current = remoteTotal
      totalsFailedCountRef.current = failedCount
      snapshotTakenRef.current = true

      const allFailed = failedCount === entries.length && entries.length > 0
      if (allFailed) {
        setState({
          processed: 0,
          total: 0,
          done: false,
          error: true,
          errorMessage:
            'Could not determine remote totals — check your connection.',
          recentTable: null,
          totalsFailedCount: failedCount,
          totalTables: entries.length,
        })
        // No polling if we can't measure — Retry re-mounts the hook.
        return
      }

      if (failedCount > 0) {
        // PARTIAL — log once, then continue with partial baseline.
        console.warn(
          '[useDownloadProgress] HEAD count failed for tables:',
          failedTables,
        )
      }

      setState({
        processed: 0,
        total: remoteTotal,
        done: false,
        error: false,
        errorMessage: null,
        recentTable: null,
        totalsFailedCount: failedCount,
        totalTables: entries.length,
      })

      if (!cancelled) {
        // Immediately tick once to avoid a 500ms blank window.
        void tick()
        intervalId = window.setInterval(tick, POLL_INTERVAL_MS)
      }
    }

    void snapshotAndStart()

    return () => {
      cancelled = true
      if (intervalId !== null) {
        window.clearInterval(intervalId)
      }
    }
  }, [userId, enabled, retryNonce])

  return state
}
