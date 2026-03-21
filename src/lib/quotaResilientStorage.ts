import type { StateStorage } from 'zustand/middleware'
import { toastWarning, toastError } from '@/lib/toastHelpers'

// 30 seconds — Zustand persist calls setItem on every state change, so
// without throttling a full quiz session would flood the user with toasts.
const THROTTLE_MS = 30_000

/**
 * Module-level mutable state for throttle tracking.
 * Intentionally module-scoped: each import of this module shares the same
 * throttle timer, preventing duplicate toasts across Zustand persist and
 * subscriber write paths within the same tab.
 */
let lastWarningAt = 0

/**
 * Checks whether an error is a storage quota exceeded error.
 * Handles the standard `QuotaExceededError` name and the Firefox-specific
 * `NS_ERROR_DOM_QUOTA_REACHED` variant.
 */
export function isQuotaExceeded(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED')
  )
}

/**
 * Shows the storage-quota toast at most once every {@link THROTTLE_MS}.
 * Zustand persist triggers setItem on every state update, so without
 * throttling the user would see a toast flood.
 *
 * Uses absolute comparison (`lastWarningAt > now`) to handle backward
 * system clock jumps — resets the timer instead of suppressing indefinitely.
 */
export function showThrottledWarning(): void {
  const now = Date.now()
  if (lastWarningAt > now) {
    // Clock jumped backward — reset to avoid permanent suppression
    lastWarningAt = 0
  }
  if (now - lastWarningAt < THROTTLE_MS) return
  lastWarningAt = now
  toastWarning.storageQuota()
}

/**
 * Attempts to free localStorage space by removing orphaned quiz-progress
 * backup keys. These are per-quiz snapshots written by the useQuizStore
 * subscriber; stale ones accumulate when quizzes are abandoned.
 *
 * Note: Only clears `quiz-progress-*` keys, not the larger Zustand persist
 * key (`levelup-quiz-store`). If the persist key itself is bloating storage,
 * this cleanup won't help — the user must clear browser data manually.
 *
 * @param preserveKey Key to skip during cleanup (typically the active quiz's key)
 */
export function clearStaleQuizKeys(preserveKey?: string): void {
  try {
    // Snapshot keys first to avoid index-shifting during removal
    // and multi-tab race conditions with concurrent localStorage writes
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key) keys.push(key)
    }
    for (const key of keys) {
      if (key.startsWith('quiz-progress-') && key !== preserveKey) {
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

      // Phase 1: reclaim space and retry (preserve the key being written)
      clearStaleQuizKeys(name)
      try {
        localStorage.setItem(name, value)
        // Retry succeeded — clean up any orphaned sessionStorage copy
        // from a previous fallback write, so getItem's ?? chain stays correct.
        try {
          sessionStorage.removeItem(name)
        } catch {
          // best-effort
        }
        return // success after cleanup
      } catch (retryError) {
        if (!isQuotaExceeded(retryError)) {
          console.error('[quotaResilientStorage] setItem retry failed:', retryError)
          return
        }
      }

      // Phase 2: fall back to sessionStorage
      let sessionSucceeded = false
      try {
        sessionStorage.setItem(name, value)
        sessionSucceeded = true
        // Remove stale localStorage entry so getItem's ?? chain returns
        // the newer sessionStorage value instead of the old localStorage one.
        try {
          localStorage.removeItem(name)
        } catch {
          // best-effort — localStorage may be inaccessible
        }
      } catch (sessionError) {
        console.error('[quotaResilientStorage] sessionStorage fallback failed:', sessionError)
      }

      if (sessionSucceeded) {
        showThrottledWarning()
      } else {
        toastError.storageFull()
      }
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
