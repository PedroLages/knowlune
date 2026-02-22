/**
 * Retry a Dexie persistence operation with exponential backoff.
 * Shared across Zustand stores that persist to IndexedDB.
 */
export async function persistWithRetry(operation: () => Promise<void>, maxRetries = 3): Promise<void> {
  const delays = [1000, 2000, 4000]
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      await operation()
      return
    } catch (error) {
      if (attempt === maxRetries - 1) throw error
      await new Promise(resolve => setTimeout(resolve, delays[attempt]))
    }
  }
}
