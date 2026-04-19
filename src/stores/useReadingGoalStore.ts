/**
 * Reading goal store — persists user reading goals to localStorage and hydrates
 * the daily streak from the server.
 *
 * Goals (target/type/yearly) are user preferences → localStorage is the backing
 * store. Streak (current/longest/lastMetDate) is an AGGREGATE over study_sessions
 * and, since E95-S04, is computed server-side by `public.compute_reading_streak`.
 * The server is authoritative; the store holds the last successful hydration
 * plus an `isStale` flag for offline/cold-boot UX.
 *
 * History (why streak left localStorage):
 *   - Cross-device drift: streak only advanced on the device where you studied.
 *   - Storage clear = streak loss: private browsing / reinstall dropped history.
 *   - Trivial forgery: `localStorage.setItem('knowlune:reading-goal-streak', ...)`
 *     in devtools granted a permanent streak. No integrity check existed.
 *   All three dissolve once the streak is a pure read over the append-only
 *   RLS-gated `public.study_sessions` table.
 *
 * @module useReadingGoalStore
 * @since E86-S05 (original), E95-S04 (server-authoritative streak)
 */
import { create } from 'zustand'
import type { ReadingGoal } from '@/data/types'
import { saveSettingsToSupabase } from '@/lib/settings'
import { hydrateStreakFromSupabase } from '@/lib/streak'
import {
  cacheStreak,
  clearCachedStreak,
  getCachedStreak,
  isStale as cacheIsStale,
} from '@/lib/streakCache'

const STORAGE_KEY = 'knowlune:reading-goals'

/**
 * Legacy localStorage key that used to hold the forgeable streak triple.
 * E95-S04 deletes this key on first post-upgrade init (guarded by
 * LEGACY_STREAK_CLEANUP_FLAG so the delete runs exactly once).
 */
const LEGACY_STREAK_KEY = 'knowlune:reading-goal-streak'
const LEGACY_STREAK_CLEANUP_FLAG = 'knowlune:e95-s04-streak-cleanup'

export interface ReadingGoalStreak {
  currentStreak: number
  longestStreak: number
  /** ISO date (YYYY-MM-DD) of the last day the daily goal was met */
  lastMetDate: string | null
  /**
   * True when the currently-displayed streak came from cache and the cache is
   * older than the freshness threshold (or hydration is failing). Consumers
   * can use this to render a muted/"reconnecting" hint.
   * @since E95-S04
   */
  isStale?: boolean
}

interface ReadingGoalState {
  goal: ReadingGoal | null
  streak: ReadingGoalStreak
  hasGoal: boolean

  /** Load goal + cached streak from local storage (call on app init). */
  loadGoal: () => void
  /** Persist goal to localStorage and Supabase user_settings. */
  saveGoal: (goal: Omit<ReadingGoal, 'updatedAt'>) => void
  /** Clear reading goals and cached streak. */
  clearGoal: () => void
  /**
   * **Deprecated as of E95-S04.** Signature preserved so `BookReader` and any
   * other consumers continue to compile. Always returns `false` — the server
   * (via `hydrateStreak()`) is now the sole authority on streak advancement.
   * Call sites that rely on the return value for "goal reached today" toasts
   * should migrate to subscribing to `state.streak.lastMetDate === today`
   * transitions, which `hydrateStreak()` now drives.
   */
  checkDailyGoalMet: (minutesToday: number) => boolean
  /** Deprecated — see `checkDailyGoalMet`. Returns `false`. @since E108-S05 */
  checkPagesGoalMet: (pagesToday: number) => boolean
  /**
   * Call when a book is finished — returns true if yearly goal is newly reached.
   */
  checkYearlyGoalReached: (booksFinishedThisYear: number) => boolean
  /**
   * E95-S04: Re-read the streak from the server.
   *
   * Flow:
   *   1. Optimistic render from IDB cache (instant).
   *   2. Call `compute_reading_streak` RPC.
   *   3. On success: write state + refresh cache, clear `isStale`.
   *   4. On failure: keep cached value (if any), set `isStale: true`.
   *
   * No-ops if the user is anonymous / goal is unset.
   */
  hydrateStreak: (userId: string | null | undefined) => Promise<void>
}

const DEFAULT_STREAK: ReadingGoalStreak = {
  currentStreak: 0,
  longestStreak: 0,
  lastMetDate: null,
  isStale: false,
}

function runLegacyStreakCleanupOnce(): void {
  try {
    if (typeof localStorage === 'undefined') return
    if (localStorage.getItem(LEGACY_STREAK_CLEANUP_FLAG) === '1') return
    localStorage.removeItem(LEGACY_STREAK_KEY)
    localStorage.setItem(LEGACY_STREAK_CLEANUP_FLAG, '1')
  } catch {
    // silent-catch-ok: cleanup is opportunistic; never blocks the store.
  }
}

// Run the one-time legacy cleanup as the store module initializes. Synchronous
// `localStorage` access is safe inside module init — Knowlune is a single-page
// client app, and the write of the flag is itself atomic. Guarded by the flag
// so repeated imports (HMR, tests that clear modules) cannot double-remove.
runLegacyStreakCleanupOnce()

export const useReadingGoalStore = create<ReadingGoalState>((set, get) => ({
  goal: null,
  streak: { ...DEFAULT_STREAK },
  hasGoal: false,

  loadGoal: () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      const goal = raw ? (JSON.parse(raw) as ReadingGoal) : null
      // Streak is no longer loaded from localStorage (E95-S04). Cold-boot shows
      // defaults until `hydrateStreak()` fires from `hydrateSettingsFromSupabase`.
      set({ goal, streak: { ...DEFAULT_STREAK }, hasGoal: goal !== null })
    } catch {
      // silent-catch-ok: corrupted storage — start fresh
      set({
        goal: null,
        streak: { ...DEFAULT_STREAK },
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
    // Streak fields (currentStreak, longestStreak, lastMetDate) are intentionally excluded — E95-S04.
    void saveSettingsToSupabase({
      dailyType: goal.dailyType,
      dailyTarget: goal.dailyTarget,
      yearlyBookTarget: goal.yearlyBookTarget,
    })
  },

  clearGoal: () => {
    try {
      localStorage.removeItem(STORAGE_KEY)
      // Best-effort remove in case the legacy cleanup ran on a different
      // session and some shadow copy of the forgeable key remains.
      localStorage.removeItem(LEGACY_STREAK_KEY)
    } catch {
      // silent-catch-ok
    }
    set({
      goal: null,
      hasGoal: false,
      streak: { ...DEFAULT_STREAK },
    })
  },

  // ── Deprecated checkers — always return false (E95-S04) ─────────────────────
  // Kept so legacy call sites (notably src/app/pages/BookReader.tsx) continue to
  // compile. The "goal met today" toast is intentionally silenced here; a
  // future story can revive it by subscribing to `hydrateStreak` transitions.
  checkDailyGoalMet: (_minutesToday: number): boolean => false,
  checkPagesGoalMet: (_pagesToday: number): boolean => false,

  checkYearlyGoalReached: (booksFinishedThisYear: number): boolean => {
    const { goal } = get()
    if (!goal || goal.yearlyBookTarget <= 0) return false
    // Return true exactly when the count equals the target (crossing the threshold)
    return booksFinishedThisYear === goal.yearlyBookTarget
  },

  hydrateStreak: async (userId: string | null | undefined) => {
    const { goal } = get()
    if (!userId || !goal) return

    // Step 1 — optimistic render from IDB cache.
    const cached = await getCachedStreak(userId)
    if (cached) {
      set({
        streak: {
          currentStreak: cached.currentStreak,
          longestStreak: cached.longestStreak,
          lastMetDate: cached.lastMetDate,
          isStale: cacheIsStale(cached),
        },
      })
    }

    // Step 2 — authoritative server call. Always runs, even with fresh cache
    // (E95-S03 pattern: server is always the truth; cache is a UX hint).
    const fresh = await hydrateStreakFromSupabase(userId, goal)

    if (fresh) {
      set({ streak: { ...fresh, isStale: false } })
      await cacheStreak(userId, fresh)
      return
    }

    // Server failed. Flip isStale on the cached values (if any) so consumers
    // can show a hint. If there was no cache, keep defaults + isStale=true
    // so the UI can render "—" rather than a confident zero.
    set(state => ({
      streak: { ...state.streak, isStale: true },
    }))
  },
}))

/** Test-only helper: clear the user's cached streak (signed-out path).  */
export async function clearStreakCacheForUser(userId: string): Promise<void> {
  await clearCachedStreak(userId)
}
