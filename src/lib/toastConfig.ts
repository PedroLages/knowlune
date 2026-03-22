/**
 * Standardized toast duration constants for Knowlune.
 * WCAG 2.1 SC 2.2.1: Minimum 3s for readability.
 */
export const TOAST_DURATION = {
  SHORT: 3000, // Quick confirmations ("Saved")
  MEDIUM: 5000, // Standard feedback (most toasts)
  LONG: 8000, // Errors with action items, milestones
  PERSISTENT: Infinity, // Requires acknowledgment (use sparingly)
} as const

export type ToastDuration = (typeof TOAST_DURATION)[keyof typeof TOAST_DURATION]
