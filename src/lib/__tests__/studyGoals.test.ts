import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  getStudyGoal,
  saveStudyGoal,
  clearStudyGoal,
  computeDailyProgress,
  computeWeeklyProgress,
  computeGoalProgress,
  computeWeeklyAdherence,
} from '@/lib/studyGoals'
import type { StudyGoal } from '@/lib/studyGoals'

// Fix time to Wednesday 2026-03-04 10:00 to avoid flaky day-boundary issues
const FIXED_NOW = new Date(2026, 2, 4, 10, 0, 0)

function makeEntry(daysAgo: number, durationMs = 0) {
  const d = new Date(FIXED_NOW)
  d.setDate(d.getDate() - daysAgo)
  d.setHours(10, 0, 0, 0)
  return {
    type: 'lesson_complete' as const,
    courseId: 'course-1',
    timestamp: d.toISOString(),
    durationMs,
  }
}

describe('studyGoals', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers({ now: FIXED_NOW })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ── localStorage CRUD ──

  describe('getStudyGoal / saveStudyGoal / clearStudyGoal', () => {
    it('returns null when no goal is set', () => {
      expect(getStudyGoal()).toBeNull()
    })

    it('round-trips a goal through localStorage', () => {
      const goal: StudyGoal = {
        frequency: 'daily',
        metric: 'time',
        target: 60,
        createdAt: new Date().toISOString(),
      }
      saveStudyGoal(goal)
      expect(getStudyGoal()).toEqual(goal)
    })

    it('dispatches study-goals-updated event on save', () => {
      const handler = vi.fn()
      window.addEventListener('study-goals-updated', handler)
      saveStudyGoal({ frequency: 'daily', metric: 'time', target: 30, createdAt: '' })
      expect(handler).toHaveBeenCalledOnce()
      window.removeEventListener('study-goals-updated', handler)
    })

    it('clears goal and dispatches event', () => {
      saveStudyGoal({ frequency: 'daily', metric: 'time', target: 30, createdAt: '' })
      const handler = vi.fn()
      window.addEventListener('study-goals-updated', handler)
      clearStudyGoal()
      expect(getStudyGoal()).toBeNull()
      expect(handler).toHaveBeenCalledOnce()
      window.removeEventListener('study-goals-updated', handler)
    })

    it('returns null for malformed JSON in localStorage', () => {
      localStorage.setItem('study-goals', '{not valid json')
      expect(getStudyGoal()).toBeNull()
    })

    it('returns null for JSON with invalid frequency', () => {
      localStorage.setItem(
        'study-goals',
        JSON.stringify({
          frequency: 'monthly',
          metric: 'time',
          target: 60,
          createdAt: '',
        })
      )
      expect(getStudyGoal()).toBeNull()
    })

    it('returns null for JSON with invalid metric', () => {
      localStorage.setItem(
        'study-goals',
        JSON.stringify({
          frequency: 'daily',
          metric: 'pages',
          target: 60,
          createdAt: '',
        })
      )
      expect(getStudyGoal()).toBeNull()
    })

    it('returns null for JSON with zero target', () => {
      localStorage.setItem(
        'study-goals',
        JSON.stringify({
          frequency: 'daily',
          metric: 'time',
          target: 0,
          createdAt: '',
        })
      )
      expect(getStudyGoal()).toBeNull()
    })

    it('returns null for JSON with negative target', () => {
      localStorage.setItem(
        'study-goals',
        JSON.stringify({
          frequency: 'daily',
          metric: 'time',
          target: -10,
          createdAt: '',
        })
      )
      expect(getStudyGoal()).toBeNull()
    })
  })

  // ── Daily progress ──

  describe('computeDailyProgress', () => {
    const timeGoal: StudyGoal = {
      frequency: 'daily',
      metric: 'time',
      target: 60,
      createdAt: '',
    }

    const sessionGoal: StudyGoal = {
      frequency: 'daily',
      metric: 'sessions',
      target: 3,
      createdAt: '',
    }

    it('computes time-based daily progress', () => {
      const log = [makeEntry(0, 45 * 60 * 1000)] // 45 min today
      const result = computeDailyProgress(timeGoal, log)
      expect(result.current).toBe(45)
      expect(result.target).toBe(60)
      expect(result.percent).toBe(75)
      expect(result.completed).toBe(false)
    })

    it('computes session-based daily progress', () => {
      const log = [makeEntry(0), makeEntry(0)]
      const result = computeDailyProgress(sessionGoal, log)
      expect(result.current).toBe(2)
      expect(result.target).toBe(3)
      expect(result.completed).toBe(false)
    })

    it('ignores entries from other days', () => {
      const log = [makeEntry(0, 30 * 60 * 1000), makeEntry(1, 60 * 60 * 1000)]
      const result = computeDailyProgress(timeGoal, log)
      expect(result.current).toBe(30)
    })

    it('clamps percent at 100 when over target', () => {
      const log = [makeEntry(0, 90 * 60 * 1000)]
      const result = computeDailyProgress(timeGoal, log)
      expect(result.percent).toBe(100)
      expect(result.completed).toBe(true)
    })

    it('returns zero progress with no entries', () => {
      const result = computeDailyProgress(timeGoal, [])
      expect(result.current).toBe(0)
      expect(result.percent).toBe(0)
      expect(result.completed).toBe(false)
    })

    it('ignores non-lesson_complete entries', () => {
      const log = [{ type: 'note_saved', courseId: 'c', timestamp: new Date().toISOString() }]
      const result = computeDailyProgress(sessionGoal, log)
      expect(result.current).toBe(0)
    })

    it('handles target of zero without NaN', () => {
      const zeroGoal: StudyGoal = { frequency: 'daily', metric: 'time', target: 0, createdAt: '' }
      const result = computeDailyProgress(zeroGoal, [])
      expect(result.percent).toBe(0)
      expect(result.completed).toBe(false)
      expect(Number.isNaN(result.percent)).toBe(false)
    })
  })

  // ── Weekly progress ──

  describe('computeWeeklyProgress', () => {
    const weeklyGoal: StudyGoal = {
      frequency: 'weekly',
      metric: 'time',
      target: 300,
      createdAt: '',
    }

    it('sums time across current week', () => {
      // Wed fixed date: Mon=2 days ago, Tue=1, Wed=0 are all in current week
      const log = [
        makeEntry(0, 60 * 60 * 1000), // 60 min
        makeEntry(1, 60 * 60 * 1000), // 60 min
        makeEntry(2, 60 * 60 * 1000), // 60 min
      ]
      const result = computeWeeklyProgress(weeklyGoal, log)
      expect(result.current).toBe(180)
      expect(result.target).toBe(300)
    })

    it('excludes entries from previous week', () => {
      const log = [
        makeEntry(0, 60 * 60 * 1000),
        makeEntry(7, 120 * 60 * 1000), // last week
      ]
      const result = computeWeeklyProgress(weeklyGoal, log)
      expect(result.current).toBe(60)
    })
  })

  // ── computeGoalProgress dispatcher ──

  describe('computeGoalProgress', () => {
    it('delegates to daily for daily goal', () => {
      const goal: StudyGoal = { frequency: 'daily', metric: 'time', target: 60, createdAt: '' }
      const log = [makeEntry(0, 30 * 60 * 1000)]
      const result = computeGoalProgress(goal, log)
      expect(result.current).toBe(30)
    })

    it('delegates to weekly for weekly goal', () => {
      const goal: StudyGoal = { frequency: 'weekly', metric: 'time', target: 300, createdAt: '' }
      const log = [makeEntry(0, 60 * 60 * 1000), makeEntry(1, 60 * 60 * 1000)]
      const result = computeGoalProgress(goal, log)
      expect(result.current).toBe(120)
    })
  })

  // ── Weekly adherence ──

  describe('computeWeeklyAdherence', () => {
    it('counts distinct days with study in last 7 days', () => {
      const log = [makeEntry(0), makeEntry(1), makeEntry(2), makeEntry(4), makeEntry(6)]
      const result = computeWeeklyAdherence(log)
      expect(result.daysStudied).toBe(5)
      expect(result.totalDays).toBe(7)
      expect(result.percent).toBe(71) // 5/7 ≈ 71%
    })

    it('returns 0 with no study entries', () => {
      const result = computeWeeklyAdherence([])
      expect(result.daysStudied).toBe(0)
      expect(result.percent).toBe(0)
    })

    it('does not double-count multiple entries on same day', () => {
      const log = [makeEntry(0), makeEntry(0), makeEntry(0)]
      const result = computeWeeklyAdherence(log)
      expect(result.daysStudied).toBe(1)
    })

    it('excludes entries older than 7 days', () => {
      const log = [makeEntry(0), makeEntry(8)]
      const result = computeWeeklyAdherence(log)
      expect(result.daysStudied).toBe(1)
    })

    it('correctly handles 7-day boundary (entry exactly 7 days ago excluded)', () => {
      // An entry from exactly 7 days ago should NOT be counted
      const log = [makeEntry(7)]
      const result = computeWeeklyAdherence(log)
      expect(result.daysStudied).toBe(0)
    })

    it('includes entry from exactly 6 days ago', () => {
      const log = [makeEntry(6)]
      const result = computeWeeklyAdherence(log)
      expect(result.daysStudied).toBe(1)
    })
  })
})
