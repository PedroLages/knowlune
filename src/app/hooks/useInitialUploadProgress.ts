/**
 * E97-S03: Progress source hook for the Initial Upload Wizard.
 *
 * Snapshots the total at mount time, then polls `syncQueue` every 500ms to
 * derive `{ processed, total, recentTable, done }` for the wizard UI. No
 * engine events; polling keeps the E97-S03 "no engine primitive changes"
 * invariant (R6).
 *
 * @see docs/plans/2026-04-19-024-feat-e97-s03-initial-upload-wizard-plan.md
 * @since E97-S03
 */
import { useEffect, useRef, useState } from 'react'
import { db } from '@/db'
import { SYNCABLE_TABLES } from '@/lib/sync/backfill'

export interface InitialUploadProgress {
  /** Items processed so far (clamped 0..total). */
  processed: number
  /** Total items at snapshot time. Stable for the hook's lifetime. */
  total: number
  /** Most-recently-updated pending row's tableName, or null. */
  recentTable: string | null
  /** `true` once all pending entries have been drained. */
  done: boolean
  /** Last Dexie read error (non-fatal — next poll retries). */
  error: Error | null
}

const POLL_INTERVAL_MS = 500

async function computeUnlinkedCount(userId: string): Promise<number> {
  let total = 0
  const results = await Promise.allSettled(
    SYNCABLE_TABLES.map(async (tableName) => {
      return db
        .table(tableName)
        .filter(
          (r: Record<string, unknown>) =>
            r.userId === null || r.userId === undefined || r.userId !== userId,
        )
        .count()
    }),
  )
  for (const r of results) {
    if (r.status === 'fulfilled') total += r.value
    // Missing/broken table contributes 0 — matches hasUnlinkedRecords posture.
  }
  return total
}

async function readPendingCount(): Promise<number> {
  return db.syncQueue.where('status').equals('pending').count()
}

async function readRecentPendingTable(): Promise<string | null> {
  // Pick the most recently updated pending row. sortBy returns a full array
  // (Dexie 4); volume is low because this only polls while the wizard is
  // open with active pending work. Callers swallow errors.
  try {
    const rows = await db.syncQueue
      .where('status')
      .equals('pending')
      .sortBy('updatedAt')
    if (rows.length === 0) return null
    const newest = rows[rows.length - 1]
    return newest?.tableName ?? null
  } catch {
    // silent-catch-ok — recentTable is cosmetic; progress bar still advances.
    return null
  }
}

/**
 * @param userId  The user whose unlinked records are counted into the total.
 *                Pass the signed-in userId. Snapshot captured on first effect run.
 * @param enabled When false, the hook does nothing (no timer, no Dexie reads).
 *                Lets callers mount the hook conditionally while still following
 *                rules-of-hooks.
 */
export function useInitialUploadProgress(
  userId: string,
  enabled: boolean,
): InitialUploadProgress {
  const [state, setState] = useState<InitialUploadProgress>({
    processed: 0,
    total: 0,
    recentTable: null,
    done: false,
    error: null,
  })
  const snapshotTakenRef = useRef(false)
  const totalRef = useRef(0)

  useEffect(() => {
    if (!enabled || !userId) return
    let cancelled = false
    // intervalId is assigned after the snapshot resolves to guarantee the
    // polling total is always the captured snapshot value (not 0).
    let intervalId: ReturnType<typeof window.setInterval> | null = null

    async function tick() {
      if (cancelled) return
      try {
        const [pendingNow, recent] = await Promise.all([
          readPendingCount(),
          readRecentPendingTable(),
        ])
        if (cancelled) return
        // Always read from the ref — guarantees we use the snapshot total even
        // if fullSync drains the queue before the first tick fires.
        const total = totalRef.current
        const processed = Math.max(0, Math.min(total, total - pendingNow))
        setState({
          processed,
          total,
          recentTable: recent,
          done: pendingNow === 0,
          error: null,
        })
      } catch (err) {
        if (cancelled) return
        // silent-catch-ok — tick failure is non-fatal; error surfaces in state
        // and the next poll retries.
        console.error('[useInitialUploadProgress] tick failed:', err)
        setState((prev) => ({ ...prev, error: err as Error }))
      }
    }

    async function snapshotAndStart() {
      // F2 fix: capture the initial pending count BEFORE calling fullSync.
      // This guarantees total > 0 when we enter the uploading state, preventing
      // the race where fullSync drains the queue before our snapshot lands and
      // `progress.total` is 0, causing the success transition to never fire.
      try {
        const [pendingAtStart, unlinkedAtStart] = await Promise.all([
          readPendingCount(),
          computeUnlinkedCount(userId),
        ])
        if (cancelled) return

        const total = pendingAtStart + unlinkedAtStart

        // AC5 silent-close path: no local data at snapshot time. Write the
        // completion flag here before the wizard even starts uploading.
        if (total === 0) {
          snapshotTakenRef.current = true
          totalRef.current = 0
          setState({
            processed: 0,
            total: 0,
            recentTable: null,
            done: true,
            error: null,
          })
          return
        }

        // Store the snapshot total in the ref BEFORE starting the poll loop.
        // Later ticks always read totalRef.current so they use this stable value
        // even if the queue has already been partially or fully drained by the
        // time the first tick fires.
        snapshotTakenRef.current = true
        totalRef.current = total
        setState({
          processed: 0,
          total,
          recentTable: null,
          done: false,
          error: null,
        })

        // Only start polling AFTER the snapshot is captured.
        if (!cancelled) {
          intervalId = window.setInterval(tick, POLL_INTERVAL_MS)
        }
      } catch (err) {
        if (cancelled) return
        // silent-catch-ok — snapshot failure surfaces to state; poll loop retries.
        console.error('[useInitialUploadProgress] snapshot failed:', err)
        setState((prev) => ({ ...prev, error: err as Error }))
      }
    }

    void snapshotAndStart()

    return () => {
      cancelled = true
      if (intervalId !== null) {
        window.clearInterval(intervalId)
      }
    }
  }, [userId, enabled])

  return state
}
