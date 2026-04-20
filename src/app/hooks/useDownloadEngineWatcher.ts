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

export function useDownloadEngineWatcher(
  userId: string,
  enabled: boolean,
): void {
  const firstSyncingSeenRef = useRef(false)

  useEffect(() => {
    if (!enabled || !userId) {
      firstSyncingSeenRef.current = false
      return
    }

    // Reset per subscription session — each mount observes its own
    // `'syncing' → 'synced'` transition.
    firstSyncingSeenRef.current = false

    const unsubscribe = useSyncStatusStore.subscribe((state, prevState) => {
      // Only operate while we are in the download-p0p2 phase (or we've
      // handed off to success/error — no point in further work).
      const downloadStatus = useDownloadStatusStore.getState().status
      if (
        downloadStatus !== 'downloading-p0p2' &&
        downloadStatus !== 'hydrating-p3p4'
      ) {
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
        void db.syncQueue
          .where('status')
          .equals('pending')
          .count()
          .then((pending) => {
            if (pending === 0) {
              // Only advance if we are still in downloading-p0p2 — the store
              // may have been reset by a sign-out or already advanced.
              if (useDownloadStatusStore.getState().status === 'downloading-p0p2') {
                useDownloadStatusStore.getState().completeDownloading()
              }
            }
          })
          .catch((err) => {
            // silent-catch-ok — worst case we wait for the next synced tick.
            console.error(
              '[useDownloadEngineWatcher] syncQueue count failed:',
              err,
            )
          })
        return
      }

      if (state.status === 'error') {
        // Capture the engine's error message and advance to error phase,
        // but only if we're still in an active phase.
        const active = useDownloadStatusStore.getState().status
        if (active === 'downloading-p0p2' || active === 'hydrating-p3p4') {
          const msg =
            state.lastError ?? 'Sync failed during first cursor pass'
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
}
