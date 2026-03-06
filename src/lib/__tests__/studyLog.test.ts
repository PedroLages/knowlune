import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  logStudyAction,
  getStudyLog,
  getStudyLogForCourse,
  getActionsPerDay,
  getRecentActions,
  getCurrentStreak,
  getLongestStreak,
  getStudyActivity,
  getStreakSnapshot,
  setStreakPause,
  getStreakPauseStatus,
  clearStreakPause,
  toLocalDateString,
} from '@/lib/studyLog'
import type { StudyAction } from '@/lib/studyLog'

function makeAction(overrides: Partial<StudyAction> = {}): StudyAction {
  return {
    type: 'lesson_complete',
    courseId: 'course-1',
    timestamp: new Date().toISOString(),
    ...overrides,
  }
}

// Fixed date to prevent midnight boundary flakiness
const FIXED_NOW = new Date('2026-01-15T12:00:00Z')

describe('studyLog', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
    vi.setSystemTime(FIXED_NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('logStudyAction', () => {
    it('adds action to the log', () => {
      logStudyAction(makeAction())
      const log = getStudyLog()
      expect(log).toHaveLength(1)
      expect(log[0].type).toBe('lesson_complete')
      expect(log[0].courseId).toBe('course-1')
    })

    it('appends multiple actions', () => {
      logStudyAction(makeAction({ type: 'lesson_complete' }))
      logStudyAction(makeAction({ type: 'video_progress' }))
      logStudyAction(makeAction({ type: 'note_saved' }))
      const log = getStudyLog()
      expect(log).toHaveLength(3)
    })

    it('stores metadata when provided', () => {
      logStudyAction(
        makeAction({
          type: 'video_progress',
          metadata: { seconds: 120 },
        })
      )
      const log = getStudyLog()
      expect(log[0].metadata).toEqual({ seconds: 120 })
    })

    it('stores lessonId when provided', () => {
      logStudyAction(makeAction({ lessonId: 'lesson-5' }))
      const log = getStudyLog()
      expect(log[0].lessonId).toBe('lesson-5')
    })

    it('truncates log at 1000 entries', () => {
      // Add 1005 entries
      for (let i = 0; i < 1005; i++) {
        logStudyAction(
          makeAction({
            courseId: `course-${i}`,
            timestamp: new Date(2024, 0, 1, 0, 0, i).toISOString(),
          })
        )
      }
      // Read raw from localStorage to check actual stored count
      const raw = JSON.parse(localStorage.getItem('study-log')!)
      expect(raw).toHaveLength(1000)
    })

    it('keeps the most recent entries when truncating', () => {
      for (let i = 0; i < 1005; i++) {
        logStudyAction(
          makeAction({
            courseId: `course-${i}`,
            timestamp: new Date(2024, 0, 1, 0, 0, i).toISOString(),
          })
        )
      }
      const raw = JSON.parse(localStorage.getItem('study-log')!) as StudyAction[]
      // The oldest entries (0-4) should have been removed
      expect(raw.some(a => a.courseId === 'course-0')).toBe(false)
      expect(raw.some(a => a.courseId === 'course-4')).toBe(false)
      // The most recent entries should still be present
      expect(raw.some(a => a.courseId === 'course-1004')).toBe(true)
      expect(raw.some(a => a.courseId === 'course-5')).toBe(true)
    })

    it('handles corrupted localStorage gracefully', () => {
      localStorage.setItem('study-log', 'corrupt')
      // Should not throw
      logStudyAction(makeAction())
      const log = getStudyLog()
      expect(log).toHaveLength(1)
    })

    it('dispatches study-log-updated event', () => {
      const handler = vi.fn()
      window.addEventListener('study-log-updated', handler)
      logStudyAction(makeAction())
      expect(handler).toHaveBeenCalledOnce()
      window.removeEventListener('study-log-updated', handler)
    })
  })

  describe('getStudyLog', () => {
    it('returns empty array when no log exists', () => {
      expect(getStudyLog()).toEqual([])
    })

    it('returns entries sorted by timestamp descending (newest first)', () => {
      logStudyAction(makeAction({ timestamp: '2024-01-01T10:00:00Z' }))
      logStudyAction(makeAction({ timestamp: '2024-01-03T10:00:00Z' }))
      logStudyAction(makeAction({ timestamp: '2024-01-02T10:00:00Z' }))

      const log = getStudyLog()
      expect(log[0].timestamp).toBe('2024-01-03T10:00:00Z')
      expect(log[1].timestamp).toBe('2024-01-02T10:00:00Z')
      expect(log[2].timestamp).toBe('2024-01-01T10:00:00Z')
    })
  })

  describe('getStudyLogForCourse', () => {
    it('filters actions by courseId', () => {
      logStudyAction(makeAction({ courseId: 'course-1' }))
      logStudyAction(makeAction({ courseId: 'course-2' }))
      logStudyAction(makeAction({ courseId: 'course-1' }))

      const log = getStudyLogForCourse('course-1')
      expect(log).toHaveLength(2)
      expect(log.every(a => a.courseId === 'course-1')).toBe(true)
    })

    it('returns empty array for course with no actions', () => {
      logStudyAction(makeAction({ courseId: 'course-1' }))
      expect(getStudyLogForCourse('course-99')).toEqual([])
    })

    it('returns results sorted by timestamp descending', () => {
      logStudyAction(
        makeAction({
          courseId: 'course-1',
          timestamp: '2024-01-01T10:00:00Z',
        })
      )
      logStudyAction(
        makeAction({
          courseId: 'course-1',
          timestamp: '2024-01-03T10:00:00Z',
        })
      )

      const log = getStudyLogForCourse('course-1')
      expect(log[0].timestamp).toBe('2024-01-03T10:00:00Z')
      expect(log[1].timestamp).toBe('2024-01-01T10:00:00Z')
    })
  })

  describe('getActionsPerDay', () => {
    it('returns correct counts for actions', () => {
      logStudyAction(makeAction({ timestamp: '2026-01-15T10:00:00Z' }))
      logStudyAction(makeAction({ timestamp: '2026-01-15T11:00:00Z' }))
      logStudyAction(makeAction({ timestamp: '2026-01-15T12:00:00Z' }))

      const perDay = getActionsPerDay(7)
      const todayEntry = perDay.find(d => d.date === '2026-01-15')
      expect(todayEntry).toBeDefined()
      expect(todayEntry!.count).toBe(3)
    })

    it('returns entries for the requested number of days', () => {
      const perDay = getActionsPerDay(7)
      expect(perDay).toHaveLength(7)
    })

    it('defaults to 30 days', () => {
      const perDay = getActionsPerDay()
      expect(perDay).toHaveLength(30)
    })

    it('returns 0 count for days with no activity', () => {
      const perDay = getActionsPerDay(7)
      // With no actions logged, every day should have count 0
      expect(perDay.every(d => d.count === 0)).toBe(true)
    })

    it('returns entries sorted by date ascending', () => {
      const perDay = getActionsPerDay(7)
      for (let i = 0; i < perDay.length - 1; i++) {
        expect(perDay[i].date < perDay[i + 1].date).toBe(true)
      }
    })

    it('ignores actions outside the date range', () => {
      // Log an action far in the past
      logStudyAction(makeAction({ timestamp: '2020-01-01T10:00:00Z' }))
      const perDay = getActionsPerDay(7)
      expect(perDay.every(d => d.count === 0)).toBe(true)
    })

    it('counts actions from different courses on same day', () => {
      logStudyAction(makeAction({ courseId: 'course-1', timestamp: '2026-01-15T08:00:00Z' }))
      logStudyAction(makeAction({ courseId: 'course-2', timestamp: '2026-01-15T09:00:00Z' }))

      const perDay = getActionsPerDay(7)
      const todayEntry = perDay.find(d => d.date === '2026-01-15')
      expect(todayEntry!.count).toBe(2)
    })
  })

  describe('getRecentActions', () => {
    it('returns most recent actions up to limit', () => {
      for (let i = 0; i < 25; i++) {
        logStudyAction(
          makeAction({
            courseId: `course-${i}`,
            timestamp: new Date(2024, 0, 1, 0, 0, i).toISOString(),
          })
        )
      }
      const recent = getRecentActions(5)
      expect(recent).toHaveLength(5)
      // Should be sorted descending by timestamp
      expect(recent[0].courseId).toBe('course-24')
    })

    it('defaults to 20 entries', () => {
      for (let i = 0; i < 25; i++) {
        logStudyAction(
          makeAction({
            courseId: `course-${i}`,
            timestamp: new Date(2024, 0, 1, 0, 0, i).toISOString(),
          })
        )
      }
      const recent = getRecentActions()
      expect(recent).toHaveLength(20)
    })

    it('returns all actions if fewer than limit', () => {
      logStudyAction(makeAction())
      logStudyAction(makeAction())
      const recent = getRecentActions(10)
      expect(recent).toHaveLength(2)
    })

    it('returns empty array when no actions', () => {
      expect(getRecentActions()).toEqual([])
    })
  })

  // ── Helper: seed study days relative to FIXED_NOW ──

  function seedStudyDays(daysAgo: number[]) {
    for (const d of daysAgo) {
      const ts = new Date(FIXED_NOW)
      ts.setDate(ts.getDate() - d)
      ts.setHours(12, 0, 0, 0)
      logStudyAction(makeAction({ timestamp: ts.toISOString() }))
    }
  }

  // ── toLocalDateString ──

  describe('toLocalDateString', () => {
    it('formats a date as YYYY-MM-DD', () => {
      const result = toLocalDateString(new Date(2026, 0, 15, 12, 0, 0))
      expect(result).toBe('2026-01-15')
    })

    it('defaults to current date', () => {
      const result = toLocalDateString()
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })
  })

  // ── getCurrentStreak ──

  describe('getCurrentStreak', () => {
    it('returns 0 with no activity', () => {
      expect(getCurrentStreak()).toBe(0)
    })

    it('returns 1 when studied today only', () => {
      seedStudyDays([0])
      expect(getCurrentStreak()).toBe(1)
    })

    it('returns 1 when studied yesterday only', () => {
      seedStudyDays([1])
      expect(getCurrentStreak()).toBe(1)
    })

    it('returns 0 when last study was 2+ days ago', () => {
      seedStudyDays([2])
      expect(getCurrentStreak()).toBe(0)
    })

    it('counts consecutive days from today', () => {
      seedStudyDays([0, 1, 2])
      expect(getCurrentStreak()).toBe(3)
    })

    it('counts consecutive days from yesterday', () => {
      seedStudyDays([1, 2, 3])
      expect(getCurrentStreak()).toBe(3)
    })

    it('breaks on gap', () => {
      seedStudyDays([0, 1, 3]) // gap at day 2
      expect(getCurrentStreak()).toBe(2)
    })

    it('ignores non-lesson_complete actions', () => {
      logStudyAction(makeAction({ type: 'video_progress' }))
      expect(getCurrentStreak()).toBe(0)
    })

    it('preserves streak during active pause', () => {
      seedStudyDays([1, 2, 3])
      setStreakPause(7)
      expect(getCurrentStreak()).toBe(3)
    })

    it('returns 0 after expired pause with no recent study', () => {
      seedStudyDays([10, 11, 12])
      // Set pause that started 8 days ago for 7 days (expired)
      const expiredStart = new Date(FIXED_NOW)
      expiredStart.setDate(expiredStart.getDate() - 8)
      localStorage.setItem(
        'study-streak-pause',
        JSON.stringify({ enabled: true, startDate: expiredStart.toISOString(), days: 7 })
      )
      expect(getCurrentStreak()).toBe(0)
    })
  })

  // ── getLongestStreak ──

  describe('getLongestStreak', () => {
    it('returns 0 with no activity', () => {
      expect(getLongestStreak()).toBe(0)
    })

    it('returns 1 for a single study day', () => {
      seedStudyDays([0])
      expect(getLongestStreak()).toBe(1)
    })

    it('counts consecutive days', () => {
      seedStudyDays([0, 1, 2, 3, 4])
      expect(getLongestStreak()).toBe(5)
    })

    it('finds longest across gaps', () => {
      seedStudyDays([0, 1, 2, 5, 6]) // streak of 3, then streak of 2
      expect(getLongestStreak()).toBe(3)
    })

    it('persists longest in localStorage', () => {
      seedStudyDays([0, 1, 2])
      getLongestStreak()
      const stored = parseInt(localStorage.getItem('study-longest-streak') || '0')
      expect(stored).toBe(3)
    })

    it('returns stored value if higher than computed', () => {
      localStorage.setItem('study-longest-streak', '10')
      seedStudyDays([0, 1])
      expect(getLongestStreak()).toBe(10)
    })

    it('updates stored value when computed is higher', () => {
      localStorage.setItem('study-longest-streak', '2')
      seedStudyDays([0, 1, 2, 3, 4])
      expect(getLongestStreak()).toBe(5)
      expect(localStorage.getItem('study-longest-streak')).toBe('5')
    })
  })

  // ── getStudyActivity ──

  describe('getStudyActivity', () => {
    it('returns correct number of days', () => {
      const activity = getStudyActivity(7)
      expect(activity).toHaveLength(7)
    })

    it('marks active days correctly', () => {
      seedStudyDays([0])
      const activity = getStudyActivity(7)
      const today = activity[activity.length - 1]
      expect(today.hasActivity).toBe(true)
      expect(today.lessonCount).toBe(1)
    })

    it('marks inactive days correctly', () => {
      const activity = getStudyActivity(7)
      expect(activity.every(d => !d.hasActivity)).toBe(true)
    })

    it('only counts lesson_complete actions', () => {
      logStudyAction(makeAction({ type: 'video_progress' }))
      const activity = getStudyActivity(7)
      expect(activity.every(d => !d.hasActivity)).toBe(true)
    })
  })

  // ── streak pause ──

  describe('streak pause', () => {
    it('returns null when no pause set', () => {
      expect(getStreakPauseStatus()).toBeNull()
    })

    it('sets and retrieves pause', () => {
      setStreakPause(7)
      const status = getStreakPauseStatus()
      expect(status).not.toBeNull()
      expect(status!.enabled).toBe(true)
      expect(status!.days).toBe(7)
    })

    it('clears pause', () => {
      setStreakPause(7)
      clearStreakPause()
      expect(getStreakPauseStatus()).toBeNull()
    })
  })

  // ── getStreakSnapshot ──

  describe('getStreakSnapshot', () => {
    it('returns zeros for empty log', () => {
      const snap = getStreakSnapshot(7)
      expect(snap.currentStreak).toBe(0)
      expect(snap.longestStreak).toBe(0)
      expect(snap.activity).toHaveLength(7)
      expect(snap.activity.every(d => !d.hasActivity)).toBe(true)
    })

    it('matches individual function results', () => {
      seedStudyDays([0, 1, 2])
      const snap = getStreakSnapshot(7)
      expect(snap.currentStreak).toBe(getCurrentStreak())
      expect(snap.longestStreak).toBe(getLongestStreak())
      expect(snap.activity).toHaveLength(7)
    })

    it('is parse-once consistent (same data regardless of call order)', () => {
      seedStudyDays([0, 1, 2, 5, 6])
      const snap1 = getStreakSnapshot(30)
      const snap2 = getStreakSnapshot(30)
      expect(snap1.currentStreak).toBe(snap2.currentStreak)
      expect(snap1.longestStreak).toBe(snap2.longestStreak)
    })
  })
})
