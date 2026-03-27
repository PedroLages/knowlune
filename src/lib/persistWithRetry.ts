import { isIndexedDBQuotaExceeded, handleQuotaExceededError } from '@/lib/storageQuotaMonitor'

/**
 * Retry a Dexie persistence operation with exponential backoff.
 * Shared across Zustand stores that persist to IndexedDB.
 *
 * E32-S03: Catches QuotaExceededError specifically — shows a user-friendly
 * toast and does NOT retry (retrying a full disk is pointless).
 */
export async function persistWithRetry(
  operation: () => Promise<void>,
  maxRetries = 3
): Promise<void> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      await operation()
      return
    } catch (error) {
      // QuotaExceededError: show user-friendly toast, don't retry
      if (isIndexedDBQuotaExceeded(error)) {
        handleQuotaExceededError()
        throw error
      }
      if (attempt === maxRetries - 1) throw error
      const delay = Math.min(1000 * Math.pow(2, attempt), 8000)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
}
