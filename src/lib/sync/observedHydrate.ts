/**
 * E97-S04: Observational wrapper around `hydrateP3P4FromSupabase`.
 *
 * Mutates only the lightweight `useDownloadStatusStore` phase machine around
 * the existing hydrator call — does NOT modify the hydrator's contract. The
 * hydrator still resolves `undefined`, still swallows per-table errors via
 * its internal `Promise.allSettled`, and still writes via `bulkPut` (never
 * `syncableWrite`), preserving the E96-S02 echo-loop invariant.
 *
 * Phase transitions driven here:
 *   idle → hydrating-p3p4         (before `await`)
 *   hydrating-p3p4 → downloading-p0p2   (on resolve — hands off to Phase B
 *                                        watcher in `useDownloadEngineWatcher`)
 *   hydrating-p3p4 → error         (on reject; wrapper re-throws so existing
 *                                   callers' `.catch` still logs)
 *
 * NOT responsible for:
 *   - Transitioning to `complete` — that is owned by `useDownloadEngineWatcher`
 *     when the sync engine's first cursor pass finishes.
 *   - Starting the engine or enqueueing any sync work.
 *
 * @since E97-S04
 */

import { hydrateP3P4FromSupabase } from './hydrateP3P4'
import { useDownloadStatusStore } from '@/app/stores/useDownloadStatusStore'

/**
 * Wraps `hydrateP3P4FromSupabase(userId)` with phase observation against
 * `useDownloadStatusStore`. Idempotent: the underlying hydrator is
 * idempotent (bulkPut + `Promise.allSettled`).
 *
 * @param userId  Signed-in user id. No-op when falsy (mirrors hydrator).
 * @throws Re-throws the hydrator's rejection after stamping the store with
 *         an error transition.
 */
export async function observedHydrate(userId: string | null | undefined): Promise<void> {
  if (!userId) return

  const store = useDownloadStatusStore.getState()
  store.startHydrating()

  try {
    await hydrateP3P4FromSupabase(userId)
  } catch (err) {
    const message = err instanceof Error && err.message ? err.message : 'Hydration failed'
    // Read the store fresh — it may have been reset by a concurrent sign-out.
    useDownloadStatusStore.getState().failDownloading(message)
    throw err
  }

  // Hand off to the engine-observation phase. The watcher owns the
  // final `complete` transition once the first cursor pass finishes.
  useDownloadStatusStore.getState().startDownloadingP0P2()
}
