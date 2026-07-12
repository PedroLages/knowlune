/**
 * Shared utility for triggering a full sync cycle with proper status bookkeeping.
 *
 * Extracted from the duplicated setStatus/fullSync/markSyncComplete/catch pattern
 * that existed in both SyncSection.handleSyncNow and SyncStatusIndicator.handleRetry.
 *
 * Uses the syncEngine's single-flight guard — concurrent callers join the existing
 * cycle instead of launching parallel downloads. Status transitions are handled
 * here (not in individual callers) so all paths through runFullSync have consistent
 * status bookkeeping.
 *
 * Callers are responsible for:
 *   - Preventing re-entrant calls (check status === 'syncing' before calling).
 *   - Surfacing the returned error message to the user via toast or similar.
 *
 * @returns void on success, or throws after updating status to 'error'.
 *
 * @since E97-S02 (R2 dedup extraction)
 */

import { useSyncStatusStore } from '@/app/stores/useSyncStatusStore'
import { syncEngine } from '@/lib/sync/syncEngine'
import { classifyError } from '@/lib/sync/classifyError'

/**
 * Run a full sync cycle:
 *   1. setStatus('syncing')
 *   2. syncEngine.fullSync() (single-flight — concurrent callers join)
 *   3. markSyncComplete() + refreshPendingCount()
 *   4. On error: setStatus('error', message) and re-throw classified message
 *
 * @throws {string} Human-readable error message (already sent to useSyncStatusStore).
 */
export async function runFullSync(): Promise<void> {
  const { setStatus, markSyncComplete, refreshPendingCount } = useSyncStatusStore.getState()

  // Don't set status to 'syncing' if already in that state — avoids
  // resetting elapsedSeconds and phase during a running cycle.
  if (useSyncStatusStore.getState().status !== 'syncing') {
    setStatus('syncing')
  }

  try {
    await syncEngine.fullSync()
    markSyncComplete()
    await refreshPendingCount()
  } catch (err) {
    const message = classifyError(err)
    setStatus('error', message)
    throw message
  }
}
