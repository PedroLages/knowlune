// E19-S08: Tests for useTrialStatus hook
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'

// ---------------------------------------------------------------------------
// Mocks — must be declared before any imports that reference them
// ---------------------------------------------------------------------------

const mockIsPremiumReturn: {
  isPremium: boolean
  loading: boolean
  tier: string
  isStale: boolean
  error: string | null
  trialEnd: string | null
  hadTrial: boolean
} = {
  isPremium: false,
  loading: false,
  tier: 'free',
  isStale: false,
  error: null,
  trialEnd: null,
  hadTrial: false,
}

vi.mock('@/lib/entitlement/isPremium', () => ({
  useIsPremium: () => ({ ...mockIsPremiumReturn }),
}))

import { useTrialStatus } from '../useTrialStatus'

describe('useTrialStatus', () => {
  beforeEach(() => {
    // Reset mock state
    Object.assign(mockIsPremiumReturn, {
      isPremium: false,
      loading: false,
      tier: 'free',
      isStale: false,
      error: null,
      trialEnd: null,
      hadTrial: false,
    })
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should return not trialing for free tier', () => {
    const { result } = renderHook(() => useTrialStatus())
    expect(result.current.isTrialing).toBe(false)
    expect(result.current.daysRemaining).toBe(0)
    expect(result.current.showReminder).toBe(false)
    expect(result.current.hadTrial).toBe(false)
    expect(result.current.canStartTrial).toBe(true)
  })

  it('should indicate trial eligibility when user never had a trial', () => {
    mockIsPremiumReturn.tier = 'free'
    mockIsPremiumReturn.hadTrial = false
    mockIsPremiumReturn.loading = false

    const { result } = renderHook(() => useTrialStatus())
    expect(result.current.canStartTrial).toBe(true)
  })

  it('should not allow trial for users who already had one (AC8)', () => {
    mockIsPremiumReturn.tier = 'free'
    mockIsPremiumReturn.hadTrial = true
    mockIsPremiumReturn.loading = false

    const { result } = renderHook(() => useTrialStatus())
    expect(result.current.canStartTrial).toBe(false)
    expect(result.current.hadTrial).toBe(true)
  })

  it('should compute days remaining for active trial', () => {
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 10)
    mockIsPremiumReturn.tier = 'trial'
    mockIsPremiumReturn.isPremium = true
    mockIsPremiumReturn.trialEnd = futureDate.toISOString()

    const { result } = renderHook(() => useTrialStatus())
    expect(result.current.isTrialing).toBe(true)
    expect(result.current.daysRemaining).toBe(10)
  })

  it('should show reminder when trial has 3 or fewer days remaining (AC3)', () => {
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 2)
    mockIsPremiumReturn.tier = 'trial'
    mockIsPremiumReturn.isPremium = true
    mockIsPremiumReturn.trialEnd = futureDate.toISOString()

    const { result } = renderHook(() => useTrialStatus())
    expect(result.current.showReminder).toBe(true)
    expect(result.current.daysRemaining).toBe(2)
  })

  it('should not show reminder when trial has more than 3 days', () => {
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 7)
    mockIsPremiumReturn.tier = 'trial'
    mockIsPremiumReturn.isPremium = true
    mockIsPremiumReturn.trialEnd = futureDate.toISOString()

    const { result } = renderHook(() => useTrialStatus())
    expect(result.current.showReminder).toBe(false)
  })

  it('should not show reminder if dismissed today', () => {
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 1)
    mockIsPremiumReturn.tier = 'trial'
    mockIsPremiumReturn.isPremium = true
    mockIsPremiumReturn.trialEnd = futureDate.toISOString()

    // Dismiss for today
    const today = new Date().toISOString().split('T')[0]
    localStorage.setItem('trial-reminder-dismissed-date', today)

    const { result } = renderHook(() => useTrialStatus())
    expect(result.current.showReminder).toBe(false)
  })

  it('should show reminder if dismissed on a different day', () => {
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 1)
    mockIsPremiumReturn.tier = 'trial'
    mockIsPremiumReturn.isPremium = true
    mockIsPremiumReturn.trialEnd = futureDate.toISOString()

    // Dismissed yesterday
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    localStorage.setItem(
      'trial-reminder-dismissed-date',
      yesterday.toISOString().split('T')[0]
    )

    const { result } = renderHook(() => useTrialStatus())
    expect(result.current.showReminder).toBe(true)
  })

  it('dismissReminder should store today\'s date in localStorage', () => {
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 1)
    mockIsPremiumReturn.tier = 'trial'
    mockIsPremiumReturn.isPremium = true
    mockIsPremiumReturn.trialEnd = futureDate.toISOString()

    const { result } = renderHook(() => useTrialStatus())
    result.current.dismissReminder()

    const today = new Date().toISOString().split('T')[0]
    expect(localStorage.getItem('trial-reminder-dismissed-date')).toBe(today)
  })

  it('should not allow trial start when loading', () => {
    mockIsPremiumReturn.loading = true
    mockIsPremiumReturn.tier = 'free'
    mockIsPremiumReturn.hadTrial = false

    const { result } = renderHook(() => useTrialStatus())
    expect(result.current.canStartTrial).toBe(false)
  })

  it('should handle trial ending today', () => {
    // Trial ends later today
    const endDate = new Date()
    endDate.setHours(endDate.getHours() + 2)
    mockIsPremiumReturn.tier = 'trial'
    mockIsPremiumReturn.isPremium = true
    mockIsPremiumReturn.trialEnd = endDate.toISOString()

    const { result } = renderHook(() => useTrialStatus())
    expect(result.current.isTrialing).toBe(true)
    // Should be 1 day remaining (ceil of partial day)
    expect(result.current.daysRemaining).toBeGreaterThanOrEqual(0)
    expect(result.current.daysRemaining).toBeLessThanOrEqual(1)
  })
})
