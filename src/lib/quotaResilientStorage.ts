import type { StateStorage } from 'zustand/middleware'
import { toastWarning } from '@/lib/toastHelpers'

const THROTTLE_MS = 30_000

let lastWarningAt = 0

/**
 * Checks whether an error is a storage quota exceeded error.
 * Handles the standard `QuotaExceededError` name and the Firefox-specific
 * `NS_ERROR_DOM_QUOTA_REACHED` variant.
 */
function isQuotaExceeded(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED')
  )
}

/**
 * Shows the storage-quota toast at most once every {@link THROTTLE_MS}.
 * Zustand persist triggers setItem on every state update, so without
 * throttling the user would see a toast flood.
 */
function showThrottledWarning(): void {
  const now = Date.now()
  if (now - lastWarningAt < THROTTLE_MS) return
  lastWarningAt = now
  toastWarning.storageQuota()
}

/**
 * Attempts to free localStorage space by removing orphaned quiz-progress
 * backup keys. These are per-quiz snapshots written by the useQuizStore
 * subscriber; stale ones accumulate when quizzes are abandoned.
 */
function clearStaleQuizKeys(): void {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i)
      if (key?.startsWith('quiz-progress-')) {
        localStorage.removeItem(key)
      }
    }
  } catch {
    // Storage may be completely inaccessible — nothing we can do
  }
}

/**
 * Zustand-compatible `StateStorage` adapter with localStorage → sessionStorage
 * fallback on quota exceeded errors.
 *
 * Strategy on setItem failure:
 * 1. Detect QuotaExceededError
 * 2. Clear stale quiz-progress-* keys to reclaim space
 * 3. Retry localStorage write
 * 4. If still full → fall back to sessionStorage (survives only the current tab)
 * 5. Show a throttled warning toast so the user knows
 */
export const quotaResilientStorage: StateStorage = {
  getItem(name: string): string | null {
    try {
      return localStorage.getItem(name) ?? sessionStorage.getItem(name)
    } catch {
      return null
    }
  },

  setItem(name: string, value: string): void {
    try {
      localStorage.setItem(name, value)
    } catch (error) {
      if (!isQuotaExceeded(error)) {
        console.error('[quotaResilientStorage] setItem failed:', error)
        return
      }

      // Phase 1: reclaim space and retry
      clearStaleQuizKeys()
      try {
        localStorage.setItem(name, value)
        return // success after cleanup
      } catch (retryError) {
        if (!isQuotaExceeded(retryError)) {
          console.error('[quotaResilientStorage] setItem retry failed:', retryError)
          return
        }
      }

      // Phase 2: fall back to sessionStorage
      try {
        sessionStorage.setItem(name, value)
      } catch (sessionError) {
        console.error('[quotaResilientStorage] sessionStorage fallback failed:', sessionError)
      }

      showThrottledWarning()
    }
  },

  removeItem(name: string): void {
    try {
      localStorage.removeItem(name)
    } catch {
      // best-effort
    }
    try {
      sessionStorage.removeItem(name)
    } catch {
      // best-effort
    }
  },
}

/** Visible for testing — resets the throttle timer. */
export function _resetWarningThrottle(): void {
  lastWarningAt = 0
}
