/**
 * Unit Tests: youtubeQuotaTracker.ts
 *
 * Tests daily YouTube API quota tracking:
 * - Quota state persistence in localStorage
 * - Midnight PT reset
 * - Warning toast at 400/500 threshold
 * - Helper functions (isQuotaExceeded, getRemainingQuota, etc.)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getQuotaState,
  recordQuotaUsage,
  isQuotaExceeded,
  getRemainingQuota,
  getQuotaUsagePercent,
  resetQuotaState,
  getPacificDateKey,
  DAILY_QUOTA_TARGET,
  QUOTA_WARNING_THRESHOLD,
} from '@/lib/youtubeQuotaTracker'

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    warning: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
  },
}))

describe('youtubeQuotaTracker.ts', () => {
  beforeEach(() => {
    resetQuotaState()
    vi.clearAllMocks()
  })

  describe('getPacificDateKey', () => {
    it('returns a date string in YYYY-MM-DD format', () => {
      const key = getPacificDateKey()
      expect(key).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })
  })

  describe('getQuotaState', () => {
    it('returns fresh state when no data in localStorage', () => {
      const state = getQuotaState()
      expect(state.unitsUsed).toBe(0)
      expect(state.warningShown).toBe(false)
      expect(state.dateKey).toBe(getPacificDateKey())
    })

    it('returns persisted state from localStorage', () => {
      const dateKey = getPacificDateKey()
      localStorage.setItem(
        'youtube-quota-tracker',
        JSON.stringify({ unitsUsed: 42, dateKey, warningShown: false })
      )
      const state = getQuotaState()
      expect(state.unitsUsed).toBe(42)
    })

    it('resets state when date key changes (midnight rollover)', () => {
      // Store state with a past date
      localStorage.setItem(
        'youtube-quota-tracker',
        JSON.stringify({ unitsUsed: 300, dateKey: '2020-01-01', warningShown: true })
      )
      const state = getQuotaState()
      expect(state.unitsUsed).toBe(0)
      expect(state.warningShown).toBe(false)
    })

    it('handles corrupted localStorage gracefully', () => {
      localStorage.setItem('youtube-quota-tracker', 'not-json')
      const state = getQuotaState()
      expect(state.unitsUsed).toBe(0)
    })
  })

  describe('recordQuotaUsage', () => {
    it('increments units used by default amount (1)', () => {
      recordQuotaUsage()
      const state = getQuotaState()
      expect(state.unitsUsed).toBe(1)
    })

    it('increments units used by specified amount', () => {
      recordQuotaUsage(5)
      const state = getQuotaState()
      expect(state.unitsUsed).toBe(5)
    })

    it('accumulates across multiple calls', () => {
      recordQuotaUsage(10)
      recordQuotaUsage(20)
      const state = getQuotaState()
      expect(state.unitsUsed).toBe(30)
    })

    it('shows warning toast when crossing threshold', async () => {
      const { toast } = await import('sonner')
      recordQuotaUsage(QUOTA_WARNING_THRESHOLD)
      expect(toast.warning).toHaveBeenCalledTimes(1)
      expect(toast.warning).toHaveBeenCalledWith(
        expect.stringContaining(`${QUOTA_WARNING_THRESHOLD}/${DAILY_QUOTA_TARGET}`),
        expect.any(Object)
      )
    })

    it('shows warning toast only once per day', async () => {
      const { toast } = await import('sonner')
      recordQuotaUsage(QUOTA_WARNING_THRESHOLD)
      recordQuotaUsage(10) // Additional usage after warning
      expect(toast.warning).toHaveBeenCalledTimes(1)
    })
  })

  describe('isQuotaExceeded', () => {
    it('returns false when under quota', () => {
      recordQuotaUsage(100)
      expect(isQuotaExceeded()).toBe(false)
    })

    it('returns true when at quota', () => {
      recordQuotaUsage(DAILY_QUOTA_TARGET)
      expect(isQuotaExceeded()).toBe(true)
    })

    it('returns true when over quota', () => {
      recordQuotaUsage(DAILY_QUOTA_TARGET + 1)
      expect(isQuotaExceeded()).toBe(true)
    })
  })

  describe('getRemainingQuota', () => {
    it('returns full quota when nothing used', () => {
      expect(getRemainingQuota()).toBe(DAILY_QUOTA_TARGET)
    })

    it('returns correct remaining after usage', () => {
      recordQuotaUsage(100)
      expect(getRemainingQuota()).toBe(DAILY_QUOTA_TARGET - 100)
    })

    it('returns 0 when quota exceeded (never negative)', () => {
      recordQuotaUsage(DAILY_QUOTA_TARGET + 50)
      expect(getRemainingQuota()).toBe(0)
    })
  })

  describe('getQuotaUsagePercent', () => {
    it('returns 0 when nothing used', () => {
      expect(getQuotaUsagePercent()).toBe(0)
    })

    it('returns 50 when half used', () => {
      recordQuotaUsage(DAILY_QUOTA_TARGET / 2)
      expect(getQuotaUsagePercent()).toBe(50)
    })

    it('returns 100 when fully used', () => {
      recordQuotaUsage(DAILY_QUOTA_TARGET)
      expect(getQuotaUsagePercent()).toBe(100)
    })
  })

  describe('Constants', () => {
    it('has correct quota target', () => {
      expect(DAILY_QUOTA_TARGET).toBe(500)
    })

    it('has correct warning threshold', () => {
      expect(QUOTA_WARNING_THRESHOLD).toBe(400)
    })
  })
})
