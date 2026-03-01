/**
 * Retry a Dexie persistence operation with exponential backoff.
 * Shared across Zustand stores that persist to IndexedDB.
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
      if (attempt === maxRetries - 1) throw error
      const delay = Math.min(1000 * Math.pow(2, attempt), 8000)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
}
