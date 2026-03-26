// E19-S08: Free Trial Status Hook
// Computes trial-specific derived state from entitlement data.

import { useMemo } from 'react'
import { useIsPremium } from '@/lib/entitlement/isPremium'

/** Trial reminder dismissal key prefix in localStorage */
const TRIAL_REMINDER_KEY = 'trial-reminder-dismissed-date'

export interface TrialStatus {
  /** Whether the user is currently on a free trial */
  isTrialing: boolean
  /** Number of full days remaining in the trial (0 if not trialing) */
  daysRemaining: number
  /** Whether the trial reminder banner should be shown (<=3 days, not dismissed today) */
  showReminder: boolean
  /** Whether the user has previously used a free trial */
  hadTrial: boolean
  /** Whether the user is eligible for a free trial (authenticated, never had trial) */
  canStartTrial: boolean
  /** ISO 8601 trial end date, or null */
  trialEnd: string | null
  /** Dismiss the trial reminder for the rest of today */
  dismissReminder: () => void
}

/**
 * Computes trial-specific status from the entitlement hook.
 * Used by TrialIndicator, TrialReminderBanner, and SubscriptionCard.
 */
export function useTrialStatus(): TrialStatus {
  const { tier, trialEnd, hadTrial, loading } = useIsPremium()

  const isTrialing = tier === 'trial'

  const daysRemaining = useMemo(() => {
    if (!isTrialing || !trialEnd) return 0
    const now = new Date()
    const end = new Date(trialEnd)
    const diffMs = end.getTime() - now.getTime()
    return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)))
  }, [isTrialing, trialEnd])

  const showReminder = useMemo(() => {
    if (!isTrialing || daysRemaining > 3) return false

    // Check if dismissed today
    const dismissedDate = localStorage.getItem(TRIAL_REMINDER_KEY)
    if (dismissedDate) {
      const today = new Date().toISOString().split('T')[0]
      if (dismissedDate === today) return false
    }
    return true
  }, [isTrialing, daysRemaining])

  const canStartTrial = !loading && !hadTrial && tier === 'free'

  function dismissReminder() {
    const today = new Date().toISOString().split('T')[0]
    localStorage.setItem(TRIAL_REMINDER_KEY, today)
  }

  return {
    isTrialing,
    daysRemaining,
    showReminder,
    hadTrial,
    canStartTrial,
    trialEnd,
    dismissReminder,
  }
}
