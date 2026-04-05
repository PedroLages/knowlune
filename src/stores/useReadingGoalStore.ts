/**
 * Reading goal store — persists user reading goals to localStorage.
 *
 * Goals are user preferences (not per-book content), so localStorage is the
 * right backing store — no Dexie migration needed.
 *
 * Tracks:
 *   - Daily goal (minutes or pages per day)
 *   - Yearly book target
 *   - Daily streak (consecutive days meeting the daily goal)
 *   - Longest daily streak
 *
 * @module useReadingGoalStore
 * @since E86-S05
 */
import { create } from 'zustand'
import type { ReadingGoal } from '@/data/types'

const STORAGE_KEY = 'knowlune:reading-goals'
const STREAK_KEY = 'knowlune:reading-goal-streak'

interface ReadingGoalStreak {
  currentStreak: number
  longestStreak: number
  /** ISO date (YYYY-MM-DD) of the last day the daily goal was met */
  lastMetDate: string | null
}

interface ReadingGoalState {
  goal: ReadingGoal | null
  streak: ReadingGoalStreak
  hasGoal: boolean

  /** Load from localStorage (call on app init) */
  loadGoal: () => void
  /** Persist goal to localStorage */
  saveGoal: (goal: Omit<ReadingGoal, 'updatedAt'>) => void
  /** Clear reading goals */
  clearGoal: () => void
  /**
   * Call after a reading session — if daily goal is met today and not already
   * credited, increments the streak. Returns true if goal was newly met.
   */
  checkDailyGoalMet: (minutesToday: number) => boolean
  /**
   * Call when a book is finished — returns true if yearly goal is newly reached.
   */
  checkYearlyGoalReached: (booksFinishedThisYear: number) => boolean
}

function loadStreakFromStorage(): ReadingGoalStreak {
  try {
    const raw = localStorage.getItem(STREAK_KEY)
    if (raw) return JSON.parse(raw) as ReadingGoalStreak
  } catch {
    // silent-catch-ok: corrupted storage falls back to defaults
  }
  return { currentStreak: 0, longestStreak: 0, lastMetDate: null }
}

function saveStreakToStorage(streak: ReadingGoalStreak) {
  try {
    localStorage.setItem(STREAK_KEY, JSON.stringify(streak))
  } catch {
    // silent-catch-ok: storage quota — streak not critical
  }
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export const useReadingGoalStore = create<ReadingGoalState>((set, get) => ({
  goal: null,
  streak: { currentStreak: 0, longestStreak: 0, lastMetDate: null },
  hasGoal: false,

  loadGoal: () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      const goal = raw ? (JSON.parse(raw) as ReadingGoal) : null
      const streak = loadStreakFromStorage()
      set({ goal, streak, hasGoal: goal !== null })
    } catch {
      // silent-catch-ok: corrupted storage — start fresh
      set({
        goal: null,
        streak: { currentStreak: 0, longestStreak: 0, lastMetDate: null },
        hasGoal: false,
      })
    }
  },

  saveGoal: partial => {
    const goal: ReadingGoal = { ...partial, updatedAt: new Date().toISOString() }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(goal))
    } catch {
      // silent-catch-ok: storage quota
    }
    set({ goal, hasGoal: true })
  },

  clearGoal: () => {
    try {
      localStorage.removeItem(STORAGE_KEY)
      localStorage.removeItem(STREAK_KEY)
    } catch {
      // silent-catch-ok
    }
    set({
      goal: null,
      hasGoal: false,
      streak: { currentStreak: 0, longestStreak: 0, lastMetDate: null },
    })
  },

  checkDailyGoalMet: (minutesToday: number): boolean => {
    const { goal, streak } = get()
    if (!goal || goal.dailyType !== 'minutes') return false

    const today = todayIso()
    // Already credited today
    if (streak.lastMetDate === today) return false
    // Goal not met
    if (minutesToday < goal.dailyTarget) return false

    // Check if yesterday was the last met date (consecutive)
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const isConsecutive = streak.lastMetDate === yesterday.toISOString().slice(0, 10)

    const newCurrent = isConsecutive ? streak.currentStreak + 1 : 1
    const newLongest = Math.max(streak.longestStreak, newCurrent)
    const newStreak: ReadingGoalStreak = {
      currentStreak: newCurrent,
      longestStreak: newLongest,
      lastMetDate: today,
    }
    saveStreakToStorage(newStreak)
    set({ streak: newStreak })
    return true
  },

  checkYearlyGoalReached: (booksFinishedThisYear: number): boolean => {
    const { goal } = get()
    if (!goal || goal.yearlyBookTarget <= 0) return false
    // Return true exactly when the count equals the target (crossing the threshold)
    return booksFinishedThisYear === goal.yearlyBookTarget
  },
}))
