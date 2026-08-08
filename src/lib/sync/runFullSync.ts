/**
 * Backward-compatible manual sync helper.
 *
 * UI surfaces keep this small API while the coordinator owns status updates,
 * retry payload rebuilding, and run serialization.
 */
import { syncCoordinator } from './syncCoordinator'

/**
 * Run a manual retry and throw its actionable message when work remains.
 */
export async function runFullSync(): Promise<void> {
  const result = await syncCoordinator.retryFailed()
  if (result.outcome === 'complete') return

  const message =
    result.tableFailures[0]?.message ??
    result.assetFailures[0]?.message ??
    (result.failedTables.length > 0
      ? `Sync incomplete for ${result.failedTables.join(', ')}. Check the affected records and retry.`
      : result.deadLetterCount > 0
        ? `${result.deadLetterCount} change(s) need attention.`
        : `${result.pendingCount} change(s) are still waiting to upload.`)
  throw message
}
