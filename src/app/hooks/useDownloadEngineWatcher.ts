/**
 * E97-S04: Observational bridge from useSyncStatusStore + syncQueue depth to
 * useDownloadStatusStore.
 *
 * Detects the first-cursor-complete transition during Phase B of the
 * new-device restore (store phase = `downloading-p0p2`) and advances the
 * download store to `complete`. If the sync engine transitions to `error`
 * before the first successful cursor pass, advances to `error` instead.
 *
 * Purely observational — no writes to the engine, no writes to syncQueue,
 * no effect on the engine's primitives. The overlay mounts this watcher so
 * Phase B observation is scoped to the overlay's lifetime.
 *
 * Logic:
 *   - Subscribe to `useSyncStatusStore` only while enabled + store phase is
 *     `downloading-p0p2`.
 *   - Latch `firstSyncingSeenRef` on the first observed `'syncing'` status
 *     (guards against a stale initial `'synced'` at mount time).
 *   - On `'synced'` after the latch fires, check `syncQueue` pending depth;
 *     if 0, advance the download store to `complete`. If non-zero, wait for
 *     the next `'synced'` tick (steady-state sync still draining uploads).
 *   - On `'error'` before the latch fires OR during Phase B, advance the
 *     download store to `error` with the engine's last error.
 *   - On `'offline'`, no-op — watchdog handles stuck state.
 *
 * @since E97-S04
 */
import { useEffect, useRef } from 'react'
import { db } from '@/db'
import { useSyncStatusStore } from '@/app/stores/useSyncStatusStore'
import { useDownloadStatusStore } from '@/app/stores/useDownloadStatusStore'

/**
 * Attempt a queue-drained complete transition. Shared by both the subscribe
 * callback and the fast-path check so the logic is not duplicated.
 */
function tryCompleteIfQueueDrained(): void {
  void db.syncQueue
    .where('status')
    .equals('pending')
    .count()
    .then(pending => {
      if (pending === 0) {
        if (useDownloadStatusStore.getState().status === 'downloading-p0p2') {
          useDownloadStatusStore.getState().completeDownloading()
        }
      }
    })
    .catch(err => {
      // silent-catch-ok — worst case we wait for the next synced tick.
      console.error('[useDownloadEngineWatcher] syncQueue count failed:', err)
    })
}

export function useDownloadEngineWatcher(userId: string, enabled: boolean): void {
  const firstSyncingSeenRef = useRef(false)
  // Track previous downloadStatus to detect the exact moment we transition
  // INTO downloading-p0p2 (not just when it's the initial state on mount).
  // Initialized to the sentinel value 'initializing' so the fast-path effect
  // can distinguish "hook just mounted" from a real transition. On first run,
  // the effect captures the actual current status as the baseline.
  const prevDownloadStatusRef = useRef<string>('initializing')

  useEffect(() => {
    if (!enabled || !userId) {
      firstSyncingSeenRef.current = false
      // Reset so re-enable captures the correct initial state.
      prevDownloadStatusRef.current = 'initializing'
      return
    }

    // Reset per subscription session — each mount observes its own
    // `'syncing' → 'synced'` transition. Capture the current downloadStatus
    // as the initial baseline so the fast-path effect doesn't mistake the
    // initial state for a transition.
    firstSyncingSeenRef.current = false
    prevDownloadStatusRef.current = useDownloadStatusStore.getState().status

    const unsubscribe = useSyncStatusStore.subscribe((state, prevState) => {
      // Only operate while we are in the download-p0p2 phase (or we've
      // handed off to success/error — no point in further work).
      const downloadStatus = useDownloadStatusStore.getState().status
      if (downloadStatus !== 'downloading-p0p2' && downloadStatus !== 'hydrating-p3p4') {
        return
      }

      if (state.status === prevState.status) return

      if (state.status === 'syncing') {
        firstSyncingSeenRef.current = true
        return
      }

      if (state.status === 'synced' && firstSyncingSeenRef.current) {
        // Verify the queue has drained before advancing to complete — a
        // `'synced'` tick with pending writes indicates steady-state sync
        // still flushing; defer to the next tick.
        tryCompleteIfQueueDrained()
        return
      }

      if (state.status === 'error') {
        // Capture the engine's error message and advance to error phase,
        // but only if we're still in an active phase.
        const active = useDownloadStatusStore.getState().status
        if (active === 'downloading-p0p2' || active === 'hydrating-p3p4') {
          const msg = state.lastError ?? 'Sync failed during first cursor pass'
          useDownloadStatusStore.getState().failDownloading(msg)
        }
        return
      }

      // 'offline' — no-op; the watchdog (owned by the overlay) handles
      // stuck states.
    })

    return () => {
      unsubscribe()
    }
  }, [userId, enabled])

  // F2 fast-path: when the store transitions INTO downloading-p0p2 (Phase B),
  // immediately check the current sync status. If the engine already completed
  // its first cursor pass (status === 'synced') during Phase A (hydrating-p3p4),
  // the subscribe callback will never fire for that transition because it happened
  // before Phase B started. We snap the current status here so a fast engine is
  // not stuck waiting for the 60s watchdog.
  //
  // Note: we only fire this fast-path on the TRANSITION into downloading-p0p2,
  // not on initial mount (prevDownloadStatusRef guards against that). The
  // subscribe callback handles the normal path where syncing → synced happens
  // after Phase B has started.
  const downloadStatus = useDownloadStatusStore(s => s.status)
  useEffect(() => {
    if (!enabled || !userId) {
      // Don't update prevDownloadStatusRef here — the [userId, enabled] effect
      // handles reset. Just bail out.
      return
    }

    const prevStatus = prevDownloadStatusRef.current

    // Only trigger the fast-path when we TRANSITION to downloading-p0p2, not
    // when it's already downloading-p0p2 at hook mount time (prevStatus is
    // initialized to the mount-time status by the [userId, enabled] effect).
    if (downloadStatus === 'downloading-p0p2' && prevStatus !== 'downloading-p0p2') {
      const currentSyncStatus = useSyncStatusStore.getState().status
      if (currentSyncStatus === 'synced') {
        // Engine already completed during Phase A (hydrating-p3p4). Fire the
        // complete transition right now — no need to wait for another tick.
        firstSyncingSeenRef.current = true
        tryCompleteIfQueueDrained()
      }
      // If status is 'syncing', the subscribe handler will catch 'synced' when
      // it arrives — no extra action needed here.
    }

    // Always update prevStatus after evaluating the transition.
    prevDownloadStatusRef.current = downloadStatus
  }, [downloadStatus, enabled, userId])
}
