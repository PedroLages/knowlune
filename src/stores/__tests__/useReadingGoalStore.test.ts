/**
 * Unit tests for useReadingGoalStore.
 *
 * Since E95-S04 the streak is server-authoritative:
 *   - `checkDailyGoalMet` / `checkPagesGoalMet` are deprecated no-ops.
 *   - Streak is never written to localStorage.
 *   - `hydrateStreak()` is the single entry-point for advancing state,
 *     and it reads from IDB cache then overwrites with the RPC result.
 *
 * Goals themselves (dailyType/dailyTarget/yearlyBookTarget) still round-trip
 * through localStorage and Supabase user_settings.
 *
 * @since E106-S01 (original), E95-S04 (server-authoritative streak)
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

// ── Mocks — must precede the store import so module-load captures them ──────
const mockSaveSettingsToSupabase = vi.fn()
vi.mock('@/lib/settings', () => ({
  saveSettingsToSupabase: mockSaveSettingsToSupabase,
}))

const mockHydrateStreakFromSupabase = vi.fn()
vi.mock('@/lib/streak', () => ({
  hydrateStreakFromSupabase: (...args: unknown[]) => mockHydrateStreakFromSupabase(...args),
}))

const mockGetCachedStreak = vi.fn()
const mockCacheStreak = vi.fn()
const mockClearCachedStreak = vi.fn()
const mockIsStale = vi.fn()
vi.mock('@/lib/streakCache', () => ({
  getCachedStreak: (...args: unknown[]) => mockGetCachedStreak(...args),
  cacheStreak: (...args: unknown[]) => mockCacheStreak(...args),
  clearCachedStreak: (...args: unknown[]) => mockClearCachedStreak(...args),
  isStale: (...args: unknown[]) => mockIsStale(...args),
  DEFAULT_STALE_THRESHOLD_MS: 24 * 60 * 60 * 1000,
}))

const FIXED_DATE = new Date('2026-03-23T10:00:00.000Z')

let useReadingGoalStore: (typeof import('@/stores/useReadingGoalStore'))['useReadingGoalStore']

beforeEach(async () => {
  vi.useFakeTimers()
  vi.setSystemTime(FIXED_DATE)
  localStorage.clear()
  mockSaveSettingsToSupabase.mockReset()
  mockHydrateStreakFromSupabase.mockReset()
  mockGetCachedStreak.mockReset().mockResolvedValue(undefined)
  mockCacheStreak.mockReset().mockResolvedValue(undefined)
  mockClearCachedStreak.mockReset().mockResolvedValue(undefined)
  mockIsStale.mockReset().mockReturnValue(false)
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

  it('ignores forged streak values in legacy localStorage key (E95-S04)', () => {
    localStorage.setItem(
      'knowlune:reading-goal-streak',
      JSON.stringify({ currentStreak: 9999, longestStreak: 9999, lastMetDate: '2026-03-22' })
    )

    useReadingGoalStore.getState().loadGoal()

    expect(useReadingGoalStore.getState().streak.currentStreak).toBe(0)
    expect(useReadingGoalStore.getState().streak.longestStreak).toBe(0)
    expect(useReadingGoalStore.getState().streak.lastMetDate).toBeNull()
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
  it('removes goal and resets streak', () => {
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
  })
})

// ── E95-S04: checkDailyGoalMet / checkPagesGoalMet are deprecated no-ops ────
describe('deprecated checkDailyGoalMet / checkPagesGoalMet (E95-S04)', () => {
  it('checkDailyGoalMet always returns false, even when goal is met', () => {
    useReadingGoalStore.getState().saveGoal({
      dailyType: 'minutes',
      dailyTarget: 30,
      yearlyBookTarget: 12,
    })

    expect(useReadingGoalStore.getState().checkDailyGoalMet(60)).toBe(false)
    expect(useReadingGoalStore.getState().streak.currentStreak).toBe(0)
  })

  it('checkPagesGoalMet always returns false', () => {
    useReadingGoalStore.getState().saveGoal({
      dailyType: 'pages',
      dailyTarget: 20,
      yearlyBookTarget: 12,
    })
    expect(useReadingGoalStore.getState().checkPagesGoalMet(40)).toBe(false)
  })

  it('does NOT write to the legacy localStorage streak key', () => {
    useReadingGoalStore.getState().saveGoal({
      dailyType: 'minutes',
      dailyTarget: 30,
      yearlyBookTarget: 12,
    })
    const setItem = vi.spyOn(Storage.prototype, 'setItem')

    useReadingGoalStore.getState().checkDailyGoalMet(30)
    useReadingGoalStore.getState().checkPagesGoalMet(30)

    const streakWrites = setItem.mock.calls.filter(
      ([key]) => key === 'knowlune:reading-goal-streak'
    )
    expect(streakWrites.length).toBe(0)
    setItem.mockRestore()
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
    expect(useReadingGoalStore.getState().checkYearlyGoalReached(13)).toBe(false)
  })
})

// ── E95-S01: Supabase dual-write ────────────────────────────────────────────

describe('saveGoal — Supabase dual-write (E95-S01)', () => {
  it('calls saveSettingsToSupabase with goal fields (no streak fields)', () => {
    useReadingGoalStore.getState().saveGoal({
      dailyType: 'pages',
      dailyTarget: 20,
      yearlyBookTarget: 24,
    })

    expect(mockSaveSettingsToSupabase).toHaveBeenCalledWith({
      dailyType: 'pages',
      dailyTarget: 20,
      yearlyBookTarget: 24,
    })
  })

  it('does NOT include streak fields in the Supabase patch', () => {
    useReadingGoalStore.getState().saveGoal({
      dailyType: 'minutes',
      dailyTarget: 30,
      yearlyBookTarget: 12,
    })

    const callArgs = mockSaveSettingsToSupabase.mock.calls[0][0]
    expect(callArgs).not.toHaveProperty('currentStreak')
    expect(callArgs).not.toHaveProperty('longestStreak')
    expect(callArgs).not.toHaveProperty('lastMetDate')
  })

  it('clearGoal does NOT call saveSettingsToSupabase', () => {
    useReadingGoalStore.getState().saveGoal({
      dailyType: 'minutes',
      dailyTarget: 30,
      yearlyBookTarget: 12,
    })
    mockSaveSettingsToSupabase.mockClear()

    useReadingGoalStore.getState().clearGoal()
    expect(mockSaveSettingsToSupabase).not.toHaveBeenCalled()
  })
})

// ── E95-S04: hydrateStreak ──────────────────────────────────────────────────

describe('hydrateStreak (E95-S04)', () => {
  it('no-ops for anonymous users', async () => {
    useReadingGoalStore.getState().saveGoal({
      dailyType: 'minutes',
      dailyTarget: 30,
      yearlyBookTarget: 12,
    })

    await useReadingGoalStore.getState().hydrateStreak(null)

    expect(mockHydrateStreakFromSupabase).not.toHaveBeenCalled()
    expect(mockGetCachedStreak).not.toHaveBeenCalled()
  })

  it('no-ops when no goal is set', async () => {
    await useReadingGoalStore.getState().hydrateStreak('user-1')
    expect(mockHydrateStreakFromSupabase).not.toHaveBeenCalled()
  })

  it('populates streak from server on success and caches the result', async () => {
    useReadingGoalStore.getState().saveGoal({
      dailyType: 'minutes',
      dailyTarget: 30,
      yearlyBookTarget: 12,
    })
    mockHydrateStreakFromSupabase.mockResolvedValueOnce({
      currentStreak: 7,
      longestStreak: 12,
      lastMetDate: '2026-03-23',
    })

    await useReadingGoalStore.getState().hydrateStreak('user-1')

    const streak = useReadingGoalStore.getState().streak
    expect(streak.currentStreak).toBe(7)
    expect(streak.longestStreak).toBe(12)
    expect(streak.lastMetDate).toBe('2026-03-23')
    expect(streak.isStale).toBe(false)
    expect(mockCacheStreak).toHaveBeenCalledWith('user-1', {
      currentStreak: 7,
      longestStreak: 12,
      lastMetDate: '2026-03-23',
    })
  })

  it('always calls the server, even when a fresh cache exists (E95-S03 pattern)', async () => {
    useReadingGoalStore.getState().saveGoal({
      dailyType: 'minutes',
      dailyTarget: 30,
      yearlyBookTarget: 12,
    })
    mockGetCachedStreak.mockResolvedValueOnce({
      userId: 'user-1',
      currentStreak: 4,
      longestStreak: 9,
      lastMetDate: '2026-03-22',
      cachedAt: Date.now() - 60 * 1000,
    })
    mockIsStale.mockReturnValueOnce(false)
    mockHydrateStreakFromSupabase.mockResolvedValueOnce({
      currentStreak: 5,
      longestStreak: 9,
      lastMetDate: '2026-03-23',
    })

    await useReadingGoalStore.getState().hydrateStreak('user-1')

    expect(mockHydrateStreakFromSupabase).toHaveBeenCalledTimes(1)
    expect(useReadingGoalStore.getState().streak.currentStreak).toBe(5)
  })

  it('renders optimistically from cache before the server responds', async () => {
    useReadingGoalStore.getState().saveGoal({
      dailyType: 'minutes',
      dailyTarget: 30,
      yearlyBookTarget: 12,
    })
    mockGetCachedStreak.mockResolvedValueOnce({
      userId: 'user-1',
      currentStreak: 3,
      longestStreak: 8,
      lastMetDate: '2026-03-22',
      cachedAt: Date.now() - 1000,
    })
    mockIsStale.mockReturnValueOnce(false)

    // Server call never resolves — we only assert the optimistic step.
    mockHydrateStreakFromSupabase.mockImplementationOnce(() => new Promise(() => {}))

    const promise = useReadingGoalStore.getState().hydrateStreak('user-1')
    // Allow the cache-read microtask to flush.
    await Promise.resolve()
    await Promise.resolve()

    expect(useReadingGoalStore.getState().streak.currentStreak).toBe(3)
    expect(useReadingGoalStore.getState().streak.lastMetDate).toBe('2026-03-22')
    // Discard the still-pending promise to keep the test runner happy.
    void promise
  })

  it('flags isStale when server fails (keeps cached values)', async () => {
    useReadingGoalStore.getState().saveGoal({
      dailyType: 'minutes',
      dailyTarget: 30,
      yearlyBookTarget: 12,
    })
    mockGetCachedStreak.mockResolvedValueOnce({
      userId: 'user-1',
      currentStreak: 3,
      longestStreak: 8,
      lastMetDate: '2026-03-22',
      cachedAt: Date.now() - 25 * 60 * 60 * 1000,
    })
    mockIsStale.mockReturnValueOnce(true)
    mockHydrateStreakFromSupabase.mockResolvedValueOnce(null)

    await useReadingGoalStore.getState().hydrateStreak('user-1')

    const streak = useReadingGoalStore.getState().streak
    expect(streak.currentStreak).toBe(3)
    expect(streak.isStale).toBe(true)
    expect(mockCacheStreak).not.toHaveBeenCalled()
  })
})

// ── E95-S04: one-time legacy localStorage cleanup ───────────────────────────

describe('legacy streak cleanup (E95-S04)', () => {
  it('removes the legacy streak key and sets the cleanup flag on first module load', async () => {
    // The top-level beforeEach already called vi.resetModules + localStorage.clear.
    // Simulate a user who had a forged streak before upgrading.
    localStorage.setItem('knowlune:reading-goal-streak', JSON.stringify({ currentStreak: 9999 }))
    localStorage.removeItem('knowlune:e95-s04-streak-cleanup')

    vi.resetModules()
    await import('@/stores/useReadingGoalStore')

    expect(localStorage.getItem('knowlune:reading-goal-streak')).toBeNull()
    expect(localStorage.getItem('knowlune:e95-s04-streak-cleanup')).toBe('1')
  })

  it('does not re-run the cleanup once the flag is set', async () => {
    localStorage.setItem('knowlune:e95-s04-streak-cleanup', '1')
    const removeItem = vi.spyOn(Storage.prototype, 'removeItem')

    vi.resetModules()
    await import('@/stores/useReadingGoalStore')

    const legacyRemovals = removeItem.mock.calls.filter(
      ([k]) => k === 'knowlune:reading-goal-streak'
    )
    expect(legacyRemovals.length).toBe(0)
    removeItem.mockRestore()
  })
})
