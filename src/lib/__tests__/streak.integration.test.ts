/**
 * E95-S04 Unit 5: Integration-style tests for `compute_reading_streak` consumption.
 *
 * Scope: these tests stub `supabase.rpc('compute_reading_streak', ...)` with
 * canned RPC payloads that represent what the real PL/pgSQL function would
 * return under known data conditions. They verify that the client correctly
 * **consumes** the RPC contract — not that the SQL itself is correct.
 *
 * SQL correctness is verified manually during Unit 1 via the following
 * reproducible `psql` checklist:
 *
 *   # 1. Apply the migration
 *   supabase migration up
 *
 *   # 2. Seed 7 consecutive met days for a test user
 *   INSERT INTO public.study_sessions (user_id, started_at, duration_seconds)
 *     SELECT 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
 *            (current_date - (d || ' days')::interval + time '10:00')::timestamptz,
 *            25 * 60
 *     FROM generate_series(0, 6) AS d;
 *
 *   # 3. Expect (7, 7, today)
 *   SELECT * FROM public.compute_reading_streak(
 *     'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'UTC', 'minutes', 20);
 *
 *   # 4. Add a 2-day gap; expect (1, 7, today).
 *
 * Project has no pgTAP harness yet — once one exists, true SQL-level tests
 * can port the scenarios below.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockRpc = vi.fn()

vi.mock('@/lib/auth/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}))

import { hydrateStreakFromSupabase } from '@/lib/streak'

const USER_ID = '11111111-1111-1111-1111-111111111111'

beforeEach(() => {
  mockRpc.mockReset()
})

describe('compute_reading_streak consumption contract', () => {
  it('7 consecutive met days → (7, 7, today)', async () => {
    mockRpc.mockResolvedValueOnce({
      data: [{ current_streak: 7, longest_streak: 7, last_met_date: '2026-04-19' }],
      error: null,
    })

    const result = await hydrateStreakFromSupabase(USER_ID, {
      dailyType: 'minutes',
      dailyTarget: 20,
    })

    expect(result).toEqual({ currentStreak: 7, longestStreak: 7, lastMetDate: '2026-04-19' })
  })

  it('7 met days then 2-day gap then 1 today → (1, 7, today)', async () => {
    mockRpc.mockResolvedValueOnce({
      data: [{ current_streak: 1, longest_streak: 7, last_met_date: '2026-04-19' }],
      error: null,
    })

    const result = await hydrateStreakFromSupabase(USER_ID, {
      dailyType: 'minutes',
      dailyTarget: 20,
    })

    expect(result).toEqual({ currentStreak: 1, longestStreak: 7, lastMetDate: '2026-04-19' })
  })

  it('goal target 30 excludes a 15-minute day (threshold filter)', async () => {
    // Contract: client passes p_goal_target through; server excludes shortfalls.
    mockRpc.mockResolvedValueOnce({
      data: [{ current_streak: 0, longest_streak: 0, last_met_date: null }],
      error: null,
    })

    const result = await hydrateStreakFromSupabase(USER_ID, {
      dailyType: 'minutes',
      dailyTarget: 30,
    })

    expect(mockRpc).toHaveBeenCalledWith('compute_reading_streak', {
      p_user_id: USER_ID,
      p_timezone: expect.any(String),
      p_goal_type: 'minutes',
      p_goal_target: 30,
    })
    expect(result?.currentStreak).toBe(0)
    expect(result?.lastMetDate).toBeNull()
  })

  it('timezone passthrough — client zone reaches RPC param', async () => {
    vi.spyOn(Intl, 'DateTimeFormat').mockImplementationOnce(
      () =>
        ({
          resolvedOptions: () => ({ timeZone: 'Europe/Berlin' }),
        }) as unknown as Intl.DateTimeFormat
    )
    mockRpc.mockResolvedValueOnce({
      data: [{ current_streak: 3, longest_streak: 3, last_met_date: '2026-04-19' }],
      error: null,
    })

    await hydrateStreakFromSupabase(USER_ID, { dailyType: 'minutes', dailyTarget: 20 })

    const [, args] = mockRpc.mock.calls[0]
    expect((args as { p_timezone: string }).p_timezone).toBe('Europe/Berlin')
  })

  it('pages goal → RPC returns zeros (contract: pages deferred per OQ1)', async () => {
    // Function body short-circuits for p_goal_type !== 'minutes'.
    mockRpc.mockResolvedValueOnce({
      data: [{ current_streak: 0, longest_streak: 0, last_met_date: null }],
      error: null,
    })

    const result = await hydrateStreakFromSupabase(USER_ID, {
      dailyType: 'pages',
      dailyTarget: 20,
    })

    expect(mockRpc).toHaveBeenCalledWith('compute_reading_streak', {
      p_user_id: USER_ID,
      p_timezone: expect.any(String),
      p_goal_type: 'pages',
      p_goal_target: 20,
    })
    expect(result).toEqual({ currentStreak: 0, longestStreak: 0, lastMetDate: null })
  })
})
