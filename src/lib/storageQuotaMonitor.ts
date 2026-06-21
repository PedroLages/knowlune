/**
 * Browser Storage Quota Monitor (E32-S03, extended for offline downloads).
 *
 * Monitors total browser storage usage via `navigator.storage.estimate()`
 * (includes OPFS + IndexedDB) and warns users at graduated thresholds.
 * Catches QuotaExceededError during Dexie writes with user-friendly error handling.
 *
 * Runs:
 * - On app startup (deferred via requestIdleCallback)
 * - After bulk operations (import, AI analysis)
 * - After each download completes
 *
 * Graduated thresholds:
 * - 70%: info toast
 * - 85%: warning toast with "Manage Storage" action
 * - 95%: persistent error toast with Settings link
 * - QuotaExceededError: user-friendly error toast with guidance
 */

import { toast } from 'sonner'
import { TOAST_DURATION } from '@/lib/toastConfig'

// --- Constants ---

/** Graduated quota thresholds */
const THRESHOLD_INFO = 0.7 // 70% — informational
const THRESHOLD_WARNING = 0.85 // 85% — action recommended
const THRESHOLD_CRITICAL = 0.95 // 95% — immediate action needed

/** Minimum interval between warning toasts (5 minutes) to avoid spam */
const WARNING_THROTTLE_MS = 5 * 60 * 1000

/** Module-level throttle state — shared across all callers in the same tab */
let lastQuotaWarningAt = 0
/** Track last-seen severity to avoid re-toasting at same level */
let lastSeverity: 'info' | 'warning' | 'critical' | null = null

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
 * Check storage usage and show a graduated warning toast if usage exceeds thresholds.
 * Throttled to avoid toast spam — at most once per WARNING_THROTTLE_MS.
 *
 * Called on app startup, after bulk operations (import, AI analysis),
 * and after each download completes.
 */
export async function checkStorageQuota(): Promise<void> {
  const estimate = await getStorageEstimate()
  if (!estimate) return

  const pct = estimate.usagePercent

  if (pct >= THRESHOLD_CRITICAL) {
    showQuotaWarning(estimate, 'critical')
  } else if (pct >= THRESHOLD_WARNING) {
    showQuotaWarning(estimate, 'warning')
  } else if (pct >= THRESHOLD_INFO) {
    showQuotaWarning(estimate, 'info')
  }
}

/**
 * Shows a graduated warning toast based on storage usage.
 * - 70% (info): brief toast
 * - 85% (warning): persistent toast with "Manage Storage" action
 * - 95% (critical): persistent error toast with Settings link
 * Throttled to prevent duplicate toasts at the same severity level.
 */
function showQuotaWarning(
  estimate: StorageEstimate,
  severity: 'info' | 'warning' | 'critical'
): void {
  const now = Date.now()
  if (lastQuotaWarningAt > now) {
    lastQuotaWarningAt = 0
    lastSeverity = null
  }
  // Re-toast only if severity escalated or throttle window passed
  if (now - lastQuotaWarningAt < WARNING_THROTTLE_MS && lastSeverity === severity) return
  lastQuotaWarningAt = now
  lastSeverity = severity

  const percent = Math.round(estimate.usagePercent * 100)
  const detail = `(${estimate.usageMB} MB of ${estimate.quotaMB} MB)`

  if (severity === 'critical') {
    toast.error(
      `Storage nearly full: ${percent}% ${detail}. Free up space in Settings to avoid data loss.`,
      {
        duration: TOAST_DURATION.PERSISTENT,
        action: {
          label: 'Settings',
          onClick: () => {
            window.location.pathname = '/settings'
          },
        },
      }
    )
  } else if (severity === 'warning') {
    toast.warning(
      `Storage is ${percent}% full ${detail}. Consider managing downloads to free up space.`,
      {
        duration: TOAST_DURATION.PERSISTENT,
        action: {
          label: 'Manage Storage',
          onClick: () => {
            window.location.pathname = '/settings'
          },
        },
      }
    )
  } else {
    toast.info(`Storage ${percent}% used ${detail}.`, { duration: 5000 })
  }
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
    return error.name === 'QuotaExceededError' || error.message.includes('QuotaExceededError')
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
