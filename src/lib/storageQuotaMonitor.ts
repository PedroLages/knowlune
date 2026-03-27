/**
 * IndexedDB Storage Quota Monitor (E32-S03)
 *
 * Monitors IndexedDB storage usage via `navigator.storage.estimate()` and warns
 * users when approaching browser storage limits. Catches QuotaExceededError
 * during Dexie writes with user-friendly error handling.
 *
 * Runs:
 * - On app startup (deferred via requestIdleCallback)
 * - After bulk operations (import, AI analysis)
 *
 * Thresholds:
 * - 80%+ usage: persistent warning toast linking to Settings > Data Management
 * - QuotaExceededError: user-friendly error toast with guidance
 */

import { toast } from 'sonner'
import { TOAST_DURATION } from '@/lib/toastConfig'

// --- Constants ---

/** Usage percentage that triggers a warning (80%) */
const WARNING_THRESHOLD = 0.8

/** Minimum interval between warning toasts (5 minutes) to avoid spam */
const WARNING_THROTTLE_MS = 5 * 60 * 1000

/** Module-level throttle state — shared across all callers in the same tab */
let lastQuotaWarningAt = 0

// --- Types ---

export interface StorageEstimate {
  usage: number
  quota: number
  usagePercent: number
  usageMB: number
  quotaMB: number
}

// --- Core API ---

/**
 * Estimate current storage usage via `navigator.storage.estimate()`.
 * Returns null if the Storage API is unavailable (e.g., insecure context, older browsers).
 */
export async function getStorageEstimate(): Promise<StorageEstimate | null> {
  if (!navigator.storage?.estimate) {
    return null
  }

  try {
    const estimate = await navigator.storage.estimate()
    const usage = estimate.usage ?? 0
    const quota = estimate.quota ?? 0

    return {
      usage,
      quota,
      usagePercent: quota > 0 ? usage / quota : 0,
      usageMB: Math.round(usage / (1024 * 1024)),
      quotaMB: Math.round(quota / (1024 * 1024)),
    }
  } catch (error) {
    console.warn('[StorageQuota] Failed to estimate storage:', error)
    return null
  }
}

/**
 * Check storage usage and show a warning toast if usage exceeds the threshold.
 * Throttled to avoid toast spam — at most once per WARNING_THROTTLE_MS.
 *
 * Called on app startup and after bulk operations (import, AI analysis).
 */
export async function checkStorageQuota(): Promise<void> {
  const estimate = await getStorageEstimate()
  if (!estimate) return

  if (estimate.usagePercent >= WARNING_THRESHOLD) {
    showQuotaWarning(estimate)
  }
}

/**
 * Shows a persistent warning toast when storage usage exceeds the threshold.
 * Links the user to Settings > Data Management for cleanup.
 * Throttled to prevent duplicate toasts.
 */
function showQuotaWarning(estimate: StorageEstimate): void {
  const now = Date.now()
  // Handle backward clock jumps
  if (lastQuotaWarningAt > now) {
    lastQuotaWarningAt = 0
  }
  if (now - lastQuotaWarningAt < WARNING_THROTTLE_MS) return
  lastQuotaWarningAt = now

  const percent = Math.round(estimate.usagePercent * 100)
  toast.warning(
    `Storage is ${percent}% full (${estimate.usageMB} MB of ${estimate.quotaMB} MB). ` +
      'Free up space in Settings > Data Management to avoid data loss.',
    {
      duration: TOAST_DURATION.PERSISTENT,
      action: {
        label: 'Go to Settings',
        onClick: () => {
          window.location.hash = ''
          window.location.pathname = '/settings'
          // Scroll to Data Management section after navigation
          setTimeout(() => {
            const section = document.getElementById('data-management')
            section?.scrollIntoView({ behavior: 'smooth' })
          }, 500)
        },
      },
    }
  )
}

// --- QuotaExceededError handling ---

/**
 * Checks whether an error is a QuotaExceededError from IndexedDB (Dexie).
 * Handles standard DOMException and Dexie's wrapped error types.
 */
export function isIndexedDBQuotaExceeded(error: unknown): boolean {
  if (error instanceof DOMException) {
    return error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED'
  }
  // Dexie wraps IndexedDB errors — check the inner cause
  if (error instanceof Error) {
    const inner = (error as Error & { inner?: Error }).inner
    if (inner instanceof DOMException) {
      return inner.name === 'QuotaExceededError' || inner.name === 'NS_ERROR_DOM_QUOTA_REACHED'
    }
    // Also check message for Dexie-style wrapped errors
    // Note: only match 'QuotaExceededError' specifically, not generic 'quota' (avoids YouTube quota false positives)
    return (
      error.name === 'QuotaExceededError' || error.message.includes('QuotaExceededError')
    )
  }
  return false
}

/**
 * Shows a user-friendly error toast when a Dexie write fails due to
 * QuotaExceededError. Directs the user to Settings > Data Management.
 */
export function handleQuotaExceededError(): void {
  toast.error(
    'Storage is full — your data could not be saved. ' +
      'Free up space in Settings > Data Management, or clear browser data.',
    {
      duration: TOAST_DURATION.PERSISTENT,
      action: {
        label: 'Go to Settings',
        onClick: () => {
          window.location.hash = ''
          window.location.pathname = '/settings'
          setTimeout(() => {
            const section = document.getElementById('data-management')
            section?.scrollIntoView({ behavior: 'smooth' })
          }, 500)
        },
      },
    }
  )
}

/**
 * Wraps a Dexie write operation with QuotaExceededError detection.
 * On quota error, shows a user-friendly toast and re-throws.
 * On other errors, re-throws without additional handling.
 *
 * @example
 * await withQuotaGuard(() => db.notes.put(note))
 */
export async function withQuotaGuard<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    if (isIndexedDBQuotaExceeded(error)) {
      handleQuotaExceededError()
    }
    throw error
  }
}

// --- Testing helpers ---

/** Visible for testing — resets the quota warning throttle timer. */
export function _resetQuotaWarningThrottle(): void {
  lastQuotaWarningAt = 0
}
