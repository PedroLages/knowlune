/**
 * E95-S04 Unit 2: Tests for `hydrateStreakFromSupabase`.
 *
 * Mirrors the mocking pattern from `src/lib/entitlement/__tests__/isPremium.test.ts`.
 * The function under test is a pure wrapper around `supabase.rpc(...)`; these
 * tests verify the input-shape contract (parameter names + timezone passthrough)
 * and the null-on-failure semantics the store depends on.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockRpc = vi.fn()

vi.mock('@/lib/auth/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}))

import { hydrateStreakFromSupabase } from '@/lib/streak'

const MOCK_TZ = 'America/Los_Angeles'

beforeEach(() => {
  mockRpc.mockReset()
  // Stable timezone so timezone-passthrough assertions are deterministic.
  vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(
    () => ({ resolvedOptions: () => ({ timeZone: MOCK_TZ }) }) as unknown as Intl.DateTimeFormat
  )
})

describe('hydrateStreakFromSupabase', () => {
  it('returns normalized shape on happy-path RPC response', async () => {
    mockRpc.mockResolvedValueOnce({
      data: [{ current_streak: 7, longest_streak: 12, last_met_date: '2026-04-19' }],
      error: null,
    })

    const result = await hydrateStreakFromSupabase('user-1', {
      dailyType: 'minutes',
      dailyTarget: 20,
    })

    expect(result).toEqual({ currentStreak: 7, longestStreak: 12, lastMetDate: '2026-04-19' })
    expect(mockRpc).toHaveBeenCalledWith('compute_reading_streak', {
      p_user_id: 'user-1',
      p_timezone: MOCK_TZ,
      p_goal_type: 'minutes',
      p_goal_target: 20,
    })
  })

  it('returns null when the RPC returns an error', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'boom' } })
    const result = await hydrateStreakFromSupabase('user-1', {
      dailyType: 'minutes',
      dailyTarget: 20,
    })
    expect(result).toBeNull()
  })

  it('returns null for anonymous users without calling supabase', async () => {
    const result = await hydrateStreakFromSupabase(null, {
      dailyType: 'minutes',
      dailyTarget: 20,
    })
    expect(result).toBeNull()
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('returns null when goal is missing without calling supabase', async () => {
    const result = await hydrateStreakFromSupabase('user-1', null)
    expect(result).toBeNull()
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('coerces string integer responses (postgres int4 over PostgREST)', async () => {
    mockRpc.mockResolvedValueOnce({
      data: [{ current_streak: '3', longest_streak: '5', last_met_date: '2026-04-18' }],
      error: null,
    })

    const result = await hydrateStreakFromSupabase('user-1', {
      dailyType: 'minutes',
      dailyTarget: 20,
    })

    expect(result).toEqual({ currentStreak: 3, longestStreak: 5, lastMetDate: '2026-04-18' })
  })

  it('passes the resolved timezone from Intl.DateTimeFormat', async () => {
    mockRpc.mockResolvedValueOnce({
      data: [{ current_streak: 0, longest_streak: 0, last_met_date: null }],
      error: null,
    })

    await hydrateStreakFromSupabase('user-1', { dailyType: 'minutes', dailyTarget: 30 })

    expect(mockRpc).toHaveBeenCalledTimes(1)
    const [, args] = mockRpc.mock.calls[0]
    expect((args as { p_timezone: string }).p_timezone).toBe(MOCK_TZ)
  })

  it('handles a single-object response (not wrapped in array) gracefully', async () => {
    mockRpc.mockResolvedValueOnce({
      data: { current_streak: 2, longest_streak: 9, last_met_date: '2026-04-17' },
      error: null,
    })

    const result = await hydrateStreakFromSupabase('user-1', {
      dailyType: 'minutes',
      dailyTarget: 30,
    })

    expect(result).toEqual({ currentStreak: 2, longestStreak: 9, lastMetDate: '2026-04-17' })
  })

  it('returns null when the RPC returns an empty array', async () => {
    mockRpc.mockResolvedValueOnce({ data: [], error: null })
    const result = await hydrateStreakFromSupabase('user-1', {
      dailyType: 'minutes',
      dailyTarget: 20,
    })
    expect(result).toBeNull()
  })
})
