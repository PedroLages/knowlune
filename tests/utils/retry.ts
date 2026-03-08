/**
 * Retry Utilities
 *
 * Shared retry/polling logic for E2E tests to eliminate code duplication.
 *
 * Usage:
 *   import { retryUntil, rafPoll } from './retry'
 *
 *   // Wait for a condition with Playwright's expect.toPass
 *   await retryUntil(async () => {
 *     const count = await getItemCount()
 *     expect(count).toBeGreaterThan(0)
 *   })
 *
 *   // Use requestAnimationFrame polling (browser context)
 *   await rafPoll(500) // Wait 500ms using rAF
 */

import { expect } from '@playwright/test'
import { RETRY_CONFIG } from './constants'

/**
 * Retry a condition until it passes using Playwright's expect.toPass
 *
 * @param condition - Async function containing expect assertions
 * @param options - Configuration options
 * @returns Promise that resolves when condition passes
 * @throws Error if condition doesn't pass within timeout
 *
 * @example
 * ```ts
 * await retryUntil(async () => {
 *   const sessions = await getSessions()
 *   expect(sessions.length).toBeGreaterThan(0)
 * }, { timeout: 10000 })
 * ```
 */
export async function retryUntil(
  condition: () => Promise<void>,
  options: { timeout?: number; interval?: number } = {}
): Promise<void> {
  const { timeout = RETRY_CONFIG.TIMEOUT, interval = RETRY_CONFIG.POLL_INTERVAL } = options

  await expect(async () => {
    await condition()
  }).toPass({
    timeout,
    intervals: [interval],
  })
}

/**
 * Poll using requestAnimationFrame until timeout (for browser context)
 *
 * This is useful for waiting in browser evaluation contexts where
 * page.waitForTimeout() is not available. Uses requestAnimationFrame
 * for non-blocking polling.
 *
 * @param delayMs - Delay in milliseconds
 * @returns Promise that resolves after the delay
 *
 * @example
 * ```ts
 * // In page.evaluate context
 * await page.evaluate(async (delayMs) => {
 *   await new Promise(resolve => {
 *     const startTime = performance.now()
 *     const check = () => {
 *       if (performance.now() - startTime >= delayMs) {
 *         resolve(undefined)
 *       } else {
 *         requestAnimationFrame(check)
 *       }
 *     }
 *     requestAnimationFrame(check)
 *   })
 * }, delayMs)
 * ```
 */
export function rafPoll(delayMs: number): Promise<void> {
  return new Promise(resolve => {
    const startTime = performance.now()
    const check = () => {
      if (performance.now() - startTime >= delayMs) {
        resolve()
      } else {
        requestAnimationFrame(check)
      }
    }
    requestAnimationFrame(check)
  })
}

/**
 * Retry an operation with exponential backoff
 *
 * @param operation - Async function to retry
 * @param options - Configuration options
 * @returns Result from successful operation
 * @throws Error if all retries fail
 *
 * @example
 * ```ts
 * const data = await retryWithBackoff(
 *   async () => await fetchData(),
 *   { maxAttempts: 5, initialDelay: 100 }
 * )
 * ```
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  options: {
    maxAttempts?: number
    initialDelay?: number
    maxDelay?: number
    backoffFactor?: number
  } = {}
): Promise<T> {
  const {
    maxAttempts = RETRY_CONFIG.MAX_ATTEMPTS,
    initialDelay = RETRY_CONFIG.POLL_INTERVAL,
    maxDelay = 5000,
    backoffFactor = 2,
  } = options

  let lastError: Error | undefined
  let delay = initialDelay

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error as Error

      if (attempt === maxAttempts) {
        break
      }

      // Wait before next retry
      await new Promise(resolve => setTimeout(resolve, delay))

      // Exponential backoff with cap
      delay = Math.min(delay * backoffFactor, maxDelay)
    }
  }

  throw new Error(
    `Operation failed after ${maxAttempts} attempts: ${lastError?.message || 'Unknown error'}`
  )
}
