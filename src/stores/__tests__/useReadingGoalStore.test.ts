/**
 * Unit tests for useReadingGoalStore — reading goals with localStorage persistence.
 *
 * Tests loadGoal, saveGoal, clearGoal, checkDailyGoalMet (streak logic),
 * and checkYearlyGoalReached.
 *
 * @since E106-S01
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

const FIXED_DATE = new Date('2026-03-23T10:00:00.000Z')

let useReadingGoalStore: (typeof import('@/stores/useReadingGoalStore'))['useReadingGoalStore']

beforeEach(async () => {
  vi.useFakeTimers()
  vi.setSystemTime(FIXED_DATE)
  localStorage.clear()
  vi.resetModules()
  const mod = await import('@/stores/useReadingGoalStore')
  useReadingGoalStore = mod.useReadingGoalStore
})

afterEach(() => {
  vi.useRealTimers()
})

describe('initial state', () => {
  it('starts with null goal and zero streak', () => {
    const state = useReadingGoalStore.getState()
    expect(state.goal).toBeNull()
    expect(state.hasGoal).toBe(false)
    expect(state.streak.currentStreak).toBe(0)
    expect(state.streak.longestStreak).toBe(0)
    expect(state.streak.lastMetDate).toBeNull()
  })
})

describe('loadGoal', () => {
  it('loads goal from localStorage', () => {
    const goal = {
      dailyType: 'minutes',
      dailyTarget: 30,
      yearlyBookTarget: 12,
      updatedAt: FIXED_DATE.toISOString(),
    }
    localStorage.setItem('knowlune:reading-goals', JSON.stringify(goal))

    useReadingGoalStore.getState().loadGoal()

    const state = useReadingGoalStore.getState()
    expect(state.goal).toEqual(goal)
    expect(state.hasGoal).toBe(true)
  })

  it('loads streak from localStorage', () => {
    const streak = { currentStreak: 5, longestStreak: 10, lastMetDate: '2026-03-22' }
    localStorage.setItem('knowlune:reading-goal-streak', JSON.stringify(streak))

    useReadingGoalStore.getState().loadGoal()

    expect(useReadingGoalStore.getState().streak).toEqual(streak)
  })

  it('handles missing localStorage gracefully', () => {
    useReadingGoalStore.getState().loadGoal()
    expect(useReadingGoalStore.getState().goal).toBeNull()
    expect(useReadingGoalStore.getState().hasGoal).toBe(false)
  })

  it('handles corrupted localStorage gracefully', () => {
    localStorage.setItem('knowlune:reading-goals', 'not-json')

    useReadingGoalStore.getState().loadGoal()

    expect(useReadingGoalStore.getState().goal).toBeNull()
    expect(useReadingGoalStore.getState().hasGoal).toBe(false)
  })
})

describe('saveGoal', () => {
  it('persists goal to localStorage with updatedAt', () => {
    useReadingGoalStore.getState().saveGoal({
      dailyType: 'minutes',
      dailyTarget: 30,
      yearlyBookTarget: 12,
    })

    const state = useReadingGoalStore.getState()
    expect(state.goal?.dailyTarget).toBe(30)
    expect(state.goal?.updatedAt).toBe(FIXED_DATE.toISOString())
    expect(state.hasGoal).toBe(true)

    // Verify localStorage
    const stored = JSON.parse(localStorage.getItem('knowlune:reading-goals')!)
    expect(stored.dailyTarget).toBe(30)
  })

  it('overwrites existing goal', () => {
    useReadingGoalStore.getState().saveGoal({
      dailyType: 'minutes',
      dailyTarget: 30,
      yearlyBookTarget: 12,
    })
    useReadingGoalStore.getState().saveGoal({
      dailyType: 'pages',
      dailyTarget: 50,
      yearlyBookTarget: 24,
    })

    expect(useReadingGoalStore.getState().goal?.dailyType).toBe('pages')
    expect(useReadingGoalStore.getState().goal?.dailyTarget).toBe(50)
  })
})

describe('clearGoal', () => {
  it('removes goal and streak from state and localStorage', () => {
    useReadingGoalStore.getState().saveGoal({
      dailyType: 'minutes',
      dailyTarget: 30,
      yearlyBookTarget: 12,
    })
    expect(useReadingGoalStore.getState().hasGoal).toBe(true)

    useReadingGoalStore.getState().clearGoal()

    const state = useReadingGoalStore.getState()
    expect(state.goal).toBeNull()
    expect(state.hasGoal).toBe(false)
    expect(state.streak.currentStreak).toBe(0)
    expect(localStorage.getItem('knowlune:reading-goals')).toBeNull()
    expect(localStorage.getItem('knowlune:reading-goal-streak')).toBeNull()
  })
})

describe('checkDailyGoalMet', () => {
  it('returns false when no goal is set', () => {
    const result = useReadingGoalStore.getState().checkDailyGoalMet(60)
    expect(result).toBe(false)
  })

  it('returns false when dailyType is pages (not minutes)', () => {
    useReadingGoalStore.getState().saveGoal({
      dailyType: 'pages',
      dailyTarget: 20,
      yearlyBookTarget: 12,
    })
    const result = useReadingGoalStore.getState().checkDailyGoalMet(60)
    expect(result).toBe(false)
  })

  it('returns false when target not met', () => {
    useReadingGoalStore.getState().saveGoal({
      dailyType: 'minutes',
      dailyTarget: 30,
      yearlyBookTarget: 12,
    })
    const result = useReadingGoalStore.getState().checkDailyGoalMet(20)
    expect(result).toBe(false)
  })

  it('returns true and starts streak when goal met for the first time', () => {
    useReadingGoalStore.getState().saveGoal({
      dailyType: 'minutes',
      dailyTarget: 30,
      yearlyBookTarget: 12,
    })

    const result = useReadingGoalStore.getState().checkDailyGoalMet(30)

    expect(result).toBe(true)
    const streak = useReadingGoalStore.getState().streak
    expect(streak.currentStreak).toBe(1)
    expect(streak.longestStreak).toBe(1)
    expect(streak.lastMetDate).toBe('2026-03-23')
  })

  it('returns false when already credited today', () => {
    useReadingGoalStore.getState().saveGoal({
      dailyType: 'minutes',
      dailyTarget: 30,
      yearlyBookTarget: 12,
    })

    useReadingGoalStore.getState().checkDailyGoalMet(30) // First call
    const result = useReadingGoalStore.getState().checkDailyGoalMet(60) // Second call same day

    expect(result).toBe(false)
  })

  it('increments streak for consecutive days', () => {
    useReadingGoalStore.getState().saveGoal({
      dailyType: 'minutes',
      dailyTarget: 30,
      yearlyBookTarget: 12,
    })

    // Day 1: March 22
    vi.setSystemTime(new Date('2026-03-22T10:00:00.000Z'))
    useReadingGoalStore.getState().checkDailyGoalMet(30)

    // Day 2: March 23 (consecutive)
    vi.setSystemTime(new Date('2026-03-23T10:00:00.000Z'))
    const result = useReadingGoalStore.getState().checkDailyGoalMet(45)

    expect(result).toBe(true)
    expect(useReadingGoalStore.getState().streak.currentStreak).toBe(2)
    expect(useReadingGoalStore.getState().streak.longestStreak).toBe(2)
  })

  it('resets streak when days are not consecutive', () => {
    useReadingGoalStore.getState().saveGoal({
      dailyType: 'minutes',
      dailyTarget: 30,
      yearlyBookTarget: 12,
    })

    // Day 1: March 20
    vi.setSystemTime(new Date('2026-03-20T10:00:00.000Z'))
    useReadingGoalStore.getState().checkDailyGoalMet(30)

    // Day 3: March 23 (skipped a day)
    vi.setSystemTime(new Date('2026-03-23T10:00:00.000Z'))
    useReadingGoalStore.getState().checkDailyGoalMet(30)

    expect(useReadingGoalStore.getState().streak.currentStreak).toBe(1)
    expect(useReadingGoalStore.getState().streak.longestStreak).toBe(1)
  })

  it('preserves longestStreak even when current resets', () => {
    useReadingGoalStore.getState().saveGoal({
      dailyType: 'minutes',
      dailyTarget: 30,
      yearlyBookTarget: 12,
    })

    // Build 3-day streak
    vi.setSystemTime(new Date('2026-03-20T10:00:00.000Z'))
    useReadingGoalStore.getState().checkDailyGoalMet(30)
    vi.setSystemTime(new Date('2026-03-21T10:00:00.000Z'))
    useReadingGoalStore.getState().checkDailyGoalMet(30)
    vi.setSystemTime(new Date('2026-03-22T10:00:00.000Z'))
    useReadingGoalStore.getState().checkDailyGoalMet(30)
    expect(useReadingGoalStore.getState().streak.longestStreak).toBe(3)

    // Skip a day, start new streak
    vi.setSystemTime(new Date('2026-03-25T10:00:00.000Z'))
    useReadingGoalStore.getState().checkDailyGoalMet(30)

    expect(useReadingGoalStore.getState().streak.currentStreak).toBe(1)
    expect(useReadingGoalStore.getState().streak.longestStreak).toBe(3) // Preserved
  })

  it('persists streak to localStorage', () => {
    useReadingGoalStore.getState().saveGoal({
      dailyType: 'minutes',
      dailyTarget: 30,
      yearlyBookTarget: 12,
    })

    useReadingGoalStore.getState().checkDailyGoalMet(30)

    const stored = JSON.parse(localStorage.getItem('knowlune:reading-goal-streak')!)
    expect(stored.currentStreak).toBe(1)
    expect(stored.lastMetDate).toBe('2026-03-23')
  })
})

describe('checkPagesGoalMet', () => {
  it('returns false when no goal is set', () => {
    const result = useReadingGoalStore.getState().checkPagesGoalMet(30)
    expect(result).toBe(false)
  })

  it('returns false when dailyType is minutes (not pages)', () => {
    useReadingGoalStore.getState().saveGoal({
      dailyType: 'minutes',
      dailyTarget: 30,
      yearlyBookTarget: 12,
    })
    const result = useReadingGoalStore.getState().checkPagesGoalMet(50)
    expect(result).toBe(false)
  })

  it('returns false when target not met', () => {
    useReadingGoalStore.getState().saveGoal({
      dailyType: 'pages',
      dailyTarget: 20,
      yearlyBookTarget: 12,
    })
    const result = useReadingGoalStore.getState().checkPagesGoalMet(10)
    expect(result).toBe(false)
  })

  it('returns false when dailyTarget is 0 (zero target edge case)', () => {
    useReadingGoalStore.getState().saveGoal({
      dailyType: 'pages',
      dailyTarget: 0,
      yearlyBookTarget: 12,
    })
    // A target of 0 is meaningless and must not credit the streak.
    // Without an explicit guard, pagesToday(0) >= target(0) would be true and credit incorrectly.
    const result = useReadingGoalStore.getState().checkPagesGoalMet(0)
    expect(result).toBe(false)
  })

  it('returns true and starts streak when goal met for the first time', () => {
    useReadingGoalStore.getState().saveGoal({
      dailyType: 'pages',
      dailyTarget: 20,
      yearlyBookTarget: 12,
    })

    const result = useReadingGoalStore.getState().checkPagesGoalMet(20)

    expect(result).toBe(true)
    const streak = useReadingGoalStore.getState().streak
    expect(streak.currentStreak).toBe(1)
    expect(streak.longestStreak).toBe(1)
    expect(streak.lastMetDate).toBe('2026-03-23')
  })

  it('returns false when already credited today', () => {
    useReadingGoalStore.getState().saveGoal({
      dailyType: 'pages',
      dailyTarget: 20,
      yearlyBookTarget: 12,
    })

    useReadingGoalStore.getState().checkPagesGoalMet(20) // First call
    const result = useReadingGoalStore.getState().checkPagesGoalMet(40) // Second call same day

    expect(result).toBe(false)
  })
})

describe('checkYearlyGoalReached', () => {
  it('returns false when no goal is set', () => {
    const result = useReadingGoalStore.getState().checkYearlyGoalReached(5)
    expect(result).toBe(false)
  })

  it('returns false when target is zero', () => {
    useReadingGoalStore.getState().saveGoal({
      dailyType: 'minutes',
      dailyTarget: 30,
      yearlyBookTarget: 0,
    })
    const result = useReadingGoalStore.getState().checkYearlyGoalReached(0)
    expect(result).toBe(false)
  })

  it('returns true exactly when count equals target', () => {
    useReadingGoalStore.getState().saveGoal({
      dailyType: 'minutes',
      dailyTarget: 30,
      yearlyBookTarget: 12,
    })

    expect(useReadingGoalStore.getState().checkYearlyGoalReached(11)).toBe(false)
    expect(useReadingGoalStore.getState().checkYearlyGoalReached(12)).toBe(true)
    expect(useReadingGoalStore.getState().checkYearlyGoalReached(13)).toBe(false) // Past threshold
  })
})
