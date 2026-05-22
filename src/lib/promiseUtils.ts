/**
 * Promise utility helpers.
 *
 * Shared helpers for common async patterns used across the Knowlune codebase.
 * Currently provides a `withTimeout` wrapper that races a promise against a
 * timer and cleans up the timer on completion to prevent leaks.
 *
 * @module
 */

/**
 * Wraps a promise with a timeout using Promise.race (ES2015 compatible).
 * If the timeout fires first, the returned promise rejects with the given
 * error message as a base Error. The internal timer is always cleaned up
 * via `.finally()` to prevent resource leaks.
 *
 * @typeParam T - The resolved type of the wrapped promise
 * @param promise - The promise to race against the timeout
 * @param ms - Timeout duration in milliseconds
 * @param timeoutMessage - Error message used when the timeout fires
 * @returns A promise that resolves with the wrapped promise's value or
 *   rejects with a timeout Error
 *
 * @example
 * ```typescript
 * const result = await withTimeout(fetchData(), 5000, 'Data fetch timed out')
 * ```
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  timeoutMessage: string
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), ms)
  })
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId))
}
