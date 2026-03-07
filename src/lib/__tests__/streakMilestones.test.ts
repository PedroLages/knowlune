import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  getMilestones,
  addMilestone,
  getUncelebratedMilestones,
  detectAndRecordMilestones,
  getStreakStartDate,
  MILESTONE_VALUES,
  getTierConfig,
  TIER_CONFIG,
} from '@/lib/streakMilestones'

// Fixed date to prevent midnight boundary flakiness
const FIXED_NOW = new Date('2026-01-15T12:00:00Z')

describe('streakMilestones', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
    vi.setSystemTime(FIXED_NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ── getMilestones ────────────────────────────────────────────

  describe('getMilestones', () => {
    it('returns empty array when nothing stored', () => {
      expect(getMilestones()).toEqual([])
    })

    it('returns stored milestones', () => {
      const milestones = [
        {
          id: 'abc-123',
          milestoneValue: 7,
          earnedAt: '2026-01-15T12:00:00.000Z',
          streakStartDate: '2026-01-09',
        },
      ]
      localStorage.setItem('streak-milestones', JSON.stringify(milestones))
      expect(getMilestones()).toEqual(milestones)
    })

    it('handles corrupted JSON gracefully', () => {
      localStorage.setItem('streak-milestones', '{not valid json!!')
      expect(getMilestones()).toEqual([])
    })
  })

  // ── addMilestone ─────────────────────────────────────────────

  describe('addMilestone', () => {
    it('adds a milestone to storage', () => {
      const result = addMilestone(7, '2026-01-09')

      expect(result).toMatchObject({
        milestoneValue: 7,
        streakStartDate: '2026-01-09',
        earnedAt: expect.any(String),
        id: expect.any(String),
      })

      const stored = getMilestones()
      expect(stored).toHaveLength(1)
      expect(stored[0].milestoneValue).toBe(7)
    })

    it('appends to existing milestones', () => {
      addMilestone(7, '2026-01-09')
      addMilestone(30, '2025-12-17')

      const stored = getMilestones()
      expect(stored).toHaveLength(2)
      expect(stored[0].milestoneValue).toBe(7)
      expect(stored[1].milestoneValue).toBe(30)
    })
  })

  // ── getStreakStartDate ───────────────────────────────────────

  describe('getStreakStartDate', () => {
    it('returns today for a streak of 1', () => {
      // streak=1 means only today, so start = today - 0 = today
      const result = getStreakStartDate(1)
      expect(result).toBe('2026-01-15')
    })

    it('returns yesterday for a streak of 2', () => {
      const result = getStreakStartDate(2)
      expect(result).toBe('2026-01-14')
    })

    it('returns correct date for streak of 7', () => {
      // streak=7: today - 6 = Jan 9
      const result = getStreakStartDate(7)
      expect(result).toBe('2026-01-09')
    })

    it('returns correct date for streak of 30', () => {
      // streak=30: Jan 15 - 29 = Dec 17
      const result = getStreakStartDate(30)
      expect(result).toBe('2025-12-17')
    })
  })

  // ── getUncelebratedMilestones ────────────────────────────────

  describe('getUncelebratedMilestones', () => {
    it('returns empty array for streak below first threshold', () => {
      expect(getUncelebratedMilestones(6)).toEqual([])
      expect(getUncelebratedMilestones(0)).toEqual([])
      expect(getUncelebratedMilestones(1)).toEqual([])
    })

    it('returns milestones not yet celebrated', () => {
      const result = getUncelebratedMilestones(7)
      expect(result).toEqual([7])
    })

    it('returns multiple milestones for high streaks', () => {
      const result = getUncelebratedMilestones(100)
      expect(result).toEqual([7, 30, 60, 100])
    })

    it('filters out already-celebrated milestones by streakStartDate match', () => {
      // Pre-celebrate the 7-day milestone for this streak instance
      const streakStart = getStreakStartDate(30)
      addMilestone(7, streakStart)

      const result = getUncelebratedMilestones(30)
      // 7 is already celebrated, so only 30 should remain
      expect(result).toEqual([30])
    })

    it('does not filter milestones from a different streak instance', () => {
      // Celebrate 7-day from a previous streak (different start date)
      addMilestone(7, '2025-06-01')

      // Current streak of 7 starts on a different date
      const result = getUncelebratedMilestones(7)
      expect(result).toEqual([7])
    })
  })

  // ── detectAndRecordMilestones ────────────────────────────────

  describe('detectAndRecordMilestones', () => {
    it('detects correct milestones at threshold 7', () => {
      const result = detectAndRecordMilestones(7)
      expect(result).toHaveLength(1)
      expect(result[0].milestoneValue).toBe(7)
    })

    it('detects correct milestones at threshold 30', () => {
      const result = detectAndRecordMilestones(30)
      expect(result).toHaveLength(2)
      expect(result.map(m => m.milestoneValue)).toEqual([7, 30])
    })

    it('detects correct milestones at threshold 60', () => {
      const result = detectAndRecordMilestones(60)
      expect(result).toHaveLength(3)
      expect(result.map(m => m.milestoneValue)).toEqual([7, 30, 60])
    })

    it('detects correct milestones at threshold 100', () => {
      const result = detectAndRecordMilestones(100)
      expect(result).toHaveLength(4)
      expect(result.map(m => m.milestoneValue)).toEqual([7, 30, 60, 100])
    })

    it('does not fire for N-1 (e.g., streak=6 does not trigger 7-day)', () => {
      const result = detectAndRecordMilestones(6)
      expect(result).toEqual([])
      expect(getMilestones()).toEqual([])
    })

    it('does not re-detect already recorded milestones', () => {
      detectAndRecordMilestones(7)
      const second = detectAndRecordMilestones(7)
      expect(second).toEqual([])
      // Only the original milestone should be stored
      expect(getMilestones()).toHaveLength(1)
    })

    it('handles repeat milestones with different streakStartDate', () => {
      // First streak: detect 7-day
      detectAndRecordMilestones(7)
      expect(getMilestones()).toHaveLength(1)

      // Simulate a new streak starting on a different date
      // Move time forward so getStreakStartDate(7) returns a different date
      vi.setSystemTime(new Date('2026-03-01T12:00:00Z'))

      const result = detectAndRecordMilestones(7)
      expect(result).toHaveLength(1)
      expect(result[0].milestoneValue).toBe(7)
      // Now we have 2 milestones total: one from each streak
      expect(getMilestones()).toHaveLength(2)
    })

    it('persists detected milestones to storage', () => {
      detectAndRecordMilestones(30)
      const stored = getMilestones()
      expect(stored).toHaveLength(2) // 7 + 30
      expect(stored.map(m => m.milestoneValue)).toEqual([7, 30])
    })
  })

  // ── getTierConfig ────────────────────────────────────────────

  describe('getTierConfig', () => {
    it('returns config for known milestone values', () => {
      for (const value of MILESTONE_VALUES) {
        const config = getTierConfig(value)
        expect(config.label).toContain(`${value}-Day`)
      }
    })

    it('falls back to 7-day config for unknown values', () => {
      const config = getTierConfig(999)
      expect(config).toBe(TIER_CONFIG[7])
    })
  })
})
