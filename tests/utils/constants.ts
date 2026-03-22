/**
 * Test Timeout and Delay Constants
 *
 * Centralized timeout/delay values for E2E tests to improve maintainability
 * and eliminate magic numbers.
 *
 * Usage:
 *   import { TIMEOUTS, DELAYS } from './constants'
 *
 *   await expect(element).toBeVisible({ timeout: TIMEOUTS.LONG })
 *   await page.waitForTimeout(DELAYS.ANIMATION)
 */

/**
 * Standard timeout values for assertions and waits
 */
export const TIMEOUTS = {
  /** 1 second - Quick interactions, fast state changes */
  SHORT: 1000,

  /** 2 seconds - Standard UI updates */
  MEDIUM: 2000,

  /** 3 seconds - Component rendering with data */
  DEFAULT: 3000,

  /** 5 seconds - Network requests, route navigation */
  LONG: 5000,

  /** 8 seconds - Complex operations, course completion */
  EXTENDED: 8000,

  /** 10 seconds - Large data fetches, API responses */
  NETWORK: 10000,

  /** 15 seconds - Video loading, heavy media */
  MEDIA: 15000,

  /** 30 seconds - Initial page load, editor initialization */
  PAGE_LOAD: 30000,
} as const

/**
 * Standard delay values for explicit waits
 */
export const DELAYS = {
  /** 100ms - Minimal debounce delay */
  DEBOUNCE_SHORT: 100,

  /** 200ms - IndexedDB retry polling interval */
  RETRY_INTERVAL: 200,

  /** 300ms - Animation completion */
  ANIMATION: 300,

  /** 500ms - Standard debounce delay */
  DEBOUNCE: 500,

  /** 3000ms - Debug/analysis wait */
  DEBUG: 3000,
} as const

/**
 * Retry configuration values
 */
export const RETRY_CONFIG = {
  /** Maximum retry attempts for IndexedDB operations */
  MAX_ATTEMPTS: 10,

  /** Polling interval for retry loops (ms) */
  POLL_INTERVAL: 200,

  /** Total timeout for retry operations (ms) */
  TIMEOUT: 5000,
} as const
