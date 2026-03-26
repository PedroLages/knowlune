/**
 * YouTube API Quota Tracker
 *
 * Tracks daily YouTube Data API v3 quota usage in localStorage.
 * YouTube quotas reset at midnight Pacific Time (PT).
 *
 * Daily budget: 500 units (conservative target within 10,000 unit limit).
 * Warning threshold: 400 units (80% of daily target — NFR69).
 *
 * Quota costs (YouTube Data API v3):
 * - videos.list: 1 unit per call (up to 50 IDs per batch)
 * - playlistItems.list: 1 unit per page (50 items per page)
 * - channels.list: 1 unit per call
 *
 * @see E28-S03 — YouTube Data API v3 Client with Rate Limiting
 */

import { toast } from 'sonner'

/** Quota tracking state persisted to localStorage */
export interface QuotaState {
  /** Total units consumed today */
  unitsUsed: number
  /** Date string (YYYY-MM-DD) in Pacific Time — resets at midnight PT */
  dateKey: string
  /** Whether the warning toast has been shown for today */
  warningShown: boolean
}

/** localStorage key for quota state */
const STORAGE_KEY = 'youtube-quota-tracker'

/** Daily quota target (conservative — actual limit is 10,000) */
export const DAILY_QUOTA_TARGET = 500

/** Warning threshold (units) — show toast when exceeded (NFR69) */
export const QUOTA_WARNING_THRESHOLD = 400

/**
 * Get the current date key in Pacific Time (YYYY-MM-DD).
 * YouTube quotas reset at midnight PT.
 */
export function getPacificDateKey(): string {
  const now = new Date()
  // Use Intl to get the date in America/Los_Angeles timezone
  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return formatter.format(now)
}

/**
 * Load quota state from localStorage, resetting if the date has changed.
 */
export function getQuotaState(): QuotaState {
  const currentDateKey = getPacificDateKey()

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return { unitsUsed: 0, dateKey: currentDateKey, warningShown: false }
    }

    const stored = JSON.parse(raw) as QuotaState

    // Reset if the date key has changed (midnight PT rollover)
    if (stored.dateKey !== currentDateKey) {
      const fresh: QuotaState = { unitsUsed: 0, dateKey: currentDateKey, warningShown: false }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh))
      return fresh
    }

    return stored
  } catch (error) {
    console.warn('Failed to parse YouTube quota state, resetting:', error)
    const fresh: QuotaState = { unitsUsed: 0, dateKey: currentDateKey, warningShown: false }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh))
    return fresh
  }
}

/**
 * Record quota units consumed by an API call.
 *
 * Side effects:
 * - Updates localStorage with new quota state
 * - Shows a warning toast if the threshold is exceeded (once per day)
 *
 * @param units - Number of quota units consumed (default: 1)
 * @returns Updated quota state
 */
export function recordQuotaUsage(units: number = 1): QuotaState {
  const state = getQuotaState()
  state.unitsUsed += units

  // Show warning toast when crossing the threshold (once per day)
  if (state.unitsUsed >= QUOTA_WARNING_THRESHOLD && !state.warningShown) {
    state.warningShown = true
    toast.warning(
      `YouTube API quota at ${state.unitsUsed}/${DAILY_QUOTA_TARGET} units today. Consider waiting until tomorrow.`,
      { duration: 8000 }
    )
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  return state
}

/**
 * Check if the daily quota target has been exceeded.
 */
export function isQuotaExceeded(): boolean {
  return getQuotaState().unitsUsed >= DAILY_QUOTA_TARGET
}

/**
 * Get remaining quota units for the day.
 */
export function getRemainingQuota(): number {
  return Math.max(0, DAILY_QUOTA_TARGET - getQuotaState().unitsUsed)
}

/**
 * Get quota usage as a percentage (0-100+).
 */
export function getQuotaUsagePercent(): number {
  const state = getQuotaState()
  return Math.round((state.unitsUsed / DAILY_QUOTA_TARGET) * 100)
}

/**
 * Reset quota state (for testing or manual override).
 * @internal
 */
export function resetQuotaState(): void {
  localStorage.removeItem(STORAGE_KEY)
}
