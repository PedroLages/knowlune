/**
 * E95-S04: Server-authoritative reading streak hydration.
 *
 * Calls the `public.compute_reading_streak` RPC (migration
 * 20260425000001_compute_reading_streak.sql) and normalizes the response into
 * the shape consumed by `useReadingGoalStore`.
 *
 * This is the read-side of the streak system. Writes (the `study_sessions`
 * rows the RPC aggregates) flow through the sync engine — this module never
 * writes to the server. It also never writes to localStorage: the legacy
 * `knowlune:reading-goal-streak` key was the source of cross-device drift and
 * trivial devtools forgery that this story eliminates.
 *
 * Precedent: follows the same shape as `validateEntitlementOnServer` in
 * `src/lib/entitlement/isPremium.ts` — server is always the truth, client
 * returns `null` on any error so the caller can fall back to its cache.
 */
import { supabase } from '@/lib/auth/supabase'
import type { ReadingGoal } from '@/data/types'
import { db } from '@/db'
import { toLocalDateString } from '@/lib/dateUtils'
import { computeAverageReadingSpeed } from '@/services/ReadingStatsService'

/** Streak triple returned by the server. Mirrors `useReadingGoalStore.streak`. */
export interface ServerStreak {
  currentStreak: number
  longestStreak: number
  /** ISO date (YYYY-MM-DD) of the last day the daily goal was met, or null. */
  lastMetDate: string | null
}

/**
 * Calls `compute_reading_streak` with the caller's current IANA timezone and
 * the user's active goal target. Returns a normalized streak triple, or `null`
 * on any failure (anonymous user, missing Supabase client, RPC error).
 *
 * Null-return semantics: the caller (store) keeps its existing cached streak
 * and surfaces an `isStale` flag rather than zeroing state.
 */
export async function hydrateStreakFromSupabase(
  userId: string | null | undefined,
  goal: Pick<ReadingGoal, 'dailyType' | 'dailyTarget'> | null | undefined
): Promise<ServerStreak | null> {
  if (!supabase || !userId || !goal) return null

  const timezone = resolveTimezone()

  const { data, error } = await supabase.rpc('compute_reading_streak', {
    p_user_id: userId,
    p_timezone: timezone,
    p_goal_type: goal.dailyType,
    p_goal_target: goal.dailyTarget,
  })

  if (error) {
    // silent-catch-ok — streak is visual state. Caller falls back to cache.
    console.warn('[streak] compute_reading_streak RPC failed:', error)
    return null
  }
  if (!data) return null

  // Postgres `RETURNS TABLE` arrives as an array of rows. We always expect one.
  const row = Array.isArray(data) ? data[0] : data
  if (!row) return null

  const rpcResult: ServerStreak = {
    currentStreak: toInt(row.current_streak),
    longestStreak: toInt(row.longest_streak),
    lastMetDate: typeof row.last_met_date === 'string' ? row.last_met_date : null,
  }

  // KI-E95-S04-L01: Pages-mode fallback. The server RPC returns zeros for
  // pages goal (deferred per OQ1). Compute the streak from local Dexie data
  // so pages-goal users see a meaningful streak.
  if (
    goal.dailyType === 'pages' &&
    rpcResult.currentStreak === 0 &&
    rpcResult.longestStreak === 0
  ) {
    const local = await computePagesStreakFromLocal(goal)
    if (local) return local
  }

  return rpcResult
}

/**
 * KI-E95-S04-L01: Pages-goal fallback — compute a reading streak from local
 * Dexie data when the server-side RPC returns zeros (pages goal not yet
 * supported server-side per OQ1).
 *
 * Strategy: group all book study sessions (courseId = '') by date, estimate
 * pages per day using the user's actual reading speed (pages/hour from
 * finished books), or fall back to a 2 min/page heuristic. Count consecutive
 * days where the estimate meets or exceeds the daily target.
 *
 * Returns null on any failure so the caller falls back to the RPC result.
 */
export async function computePagesStreakFromLocal(
  goal: Pick<ReadingGoal, 'dailyTarget'>
): Promise<ServerStreak | null> {
  try {
    const avgSpeedPagesPerHour = await computeAverageReadingSpeed()
    const minPerPage = avgSpeedPagesPerHour ? 60 / avgSpeedPagesPerHour : 2

    const sessions = await db.studySessions
      .where('courseId')
      .equals('')
      .toArray()

    const todayStr = toLocalDateString(new Date())

    // Group session durations (seconds) by date
    const secondsByDate = new Map<string, number>()
    for (const s of sessions) {
      if (!s.startTime) continue
      const date = toLocalDateString(new Date(s.startTime))
      if (date > todayStr) continue // skip future dates
      secondsByDate.set(date, (secondsByDate.get(date) ?? 0) + (s.duration ?? 0))
    }

    const sortedDates = Array.from(secondsByDate.keys()).sort()

    let currentStreak = 0
    let longestStreak = 0
    let lastMetDate: string | null = null

    for (const date of sortedDates) {
      const minutes = (secondsByDate.get(date) ?? 0) / 60
      const pagesEstimate = Math.round(minutes / minPerPage)

      if (pagesEstimate >= goal.dailyTarget) {
        currentStreak++
        if (currentStreak > longestStreak) longestStreak = currentStreak
        lastMetDate = date
      } else {
        currentStreak = 0
      }
    }

    return { currentStreak, longestStreak, lastMetDate }
  } catch (err) {
    console.error('[streak] Local pages streak computation failed:', err)
    return null
  }
}

/**
 * Returns the caller's IANA timezone, falling back to `'UTC'` in environments
 * where `Intl.DateTimeFormat` is unavailable or returns an unusable value.
 */
function resolveTimezone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (typeof tz === 'string' && tz.length > 0) return tz
  } catch {
    // silent-catch-ok — fallback below
  }
  return 'UTC'
}

function toInt(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value)
  if (typeof value === 'string') {
    const parsed = parseInt(value, 10)
    if (Number.isFinite(parsed)) return parsed
  }
  return 0
}
