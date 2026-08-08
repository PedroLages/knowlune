/**
 * Shared utility for triggering a full sync cycle with proper status bookkeeping.
 *
 * Extracted from the duplicated setStatus/fullSync/markSyncComplete/catch pattern
 * that existed in both SyncSection.handleSyncNow and SyncStatusIndicator.handleRetry.
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
 *   2. syncEngine.fullSync()
 *   3. markSyncComplete() + refreshPendingCount()
 *   4. On error: setStatus('error', message) and re-throw classified message
 *
 * @throws {string} Human-readable error message (already sent to useSyncStatusStore).
 */
export async function runFullSync(): Promise<void> {
  const { setStatus, setFailures, markSyncComplete, refreshPendingCount } =
    useSyncStatusStore.getState()

  setStatus('syncing')
  try {
    // Manual retry rebuilds payloads from current Dexie records first. This is
    // what makes the button useful after a legacy serializer/dead-letter event.
    if (typeof syncEngine.retryFailed === 'function') {
      await syncEngine.retryFailed({ rebuildPayloads: true })
    }
    const result = (await syncEngine.fullSync()) ?? {
      failedTables: [],
      deadLetterCount: 0,
      pendingCount: 0,
      tableFailures: [],
      assetFailures: [],
      completedAt: new Date().toISOString(),
      outcome: 'complete',
    }
    await refreshPendingCount()
    if (
      result.failedTables.length > 0 ||
      result.deadLetterCount > 0 ||
      result.pendingCount > 0 ||
      result.assetFailures.length > 0
    ) {
      if (typeof setFailures === 'function') {
        setFailures([
          ...(result.tableFailures ?? []).map(failure => ({
            table: failure.table,
            message: failure.message,
            retryable: true,
          })),
          ...(result.assetFailures ?? []).map(failure => ({
            table: failure.table,
            recordId: failure.recordId,
            message: failure.message,
            retryable: failure.retryable,
          })),
        ])
      }
      const failedTables = result.failedTables.join(', ')
      const state = useSyncStatusStore.getState()
      const message = failedTables
        ? `Sync incomplete for ${failedTables}. Check the affected records and retry.`
        : `${state.failedCount} item(s) need attention; ${state.pendingCount} waiting${result.assetFailures.length > 0 ? `; ${result.assetFailures.length} asset(s) failed` : ''}.`
      setStatus('error', message)
      throw message
    }
    markSyncComplete()
    await refreshPendingCount()
  } catch (err) {
    const message = typeof err === 'string' && err !== 'Sync failed' ? err : classifyError(err)
    setStatus('error', message)
    throw message
  }
}
