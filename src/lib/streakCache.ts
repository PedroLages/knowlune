/**
 * E95-S04: IndexedDB-backed cache of the last successful server streak.
 *
 * Lives in `db.readingStreakCache` (Dexie v56). The cache is a UX hint only —
 * the server (`compute_reading_streak`) is always called on hydration. The
 * cache exists so cold-boot renders a believable number instantly instead of
 * flashing 0 for the duration of the round-trip.
 *
 * Shape mirrors `src/lib/checkout.ts` `{cache,get}Entitlement` helpers — same
 * "IDB-backed server-state cache" pattern.
 */
import { db } from '@/db/schema'
import type { ReadingStreakCacheRow } from '@/db/schema'
import type { ServerStreak } from '@/lib/streak'

/** 24 hours in milliseconds — the default staleness threshold. */
export const DEFAULT_STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000

/**
 * Returns the cached streak row for a user, or `undefined` if none exists
 * / the read fails. Never throws — callers treat absence as "no cache".
 */
export async function getCachedStreak(
  userId: string
): Promise<ReadingStreakCacheRow | undefined> {
  try {
    return await db.readingStreakCache.get(userId)
  } catch (err) {
    // silent-catch-ok — cache read failure falls back to post-RPC render.
    console.warn('[streakCache] read failed:', err)
    return undefined
  }
}

/**
 * Upserts the given streak triple for this user. Sets `cachedAt` to now.
 * Non-throwing: failure is logged and swallowed so a broken cache never
 * blocks the store's hydration path.
 */
export async function cacheStreak(userId: string, streak: ServerStreak): Promise<void> {
  try {
    const row: ReadingStreakCacheRow = {
      userId,
      currentStreak: streak.currentStreak,
      longestStreak: streak.longestStreak,
      lastMetDate: streak.lastMetDate,
      cachedAt: Date.now(),
    }
    await db.readingStreakCache.put(row)
  } catch (err) {
    // silent-catch-ok — cache write is best-effort.
    console.warn('[streakCache] write failed:', err)
  }
}

/**
 * Removes the cached streak for this user. Used on sign-out (to avoid
 * showing the previous user's streak to an anonymous visitor on the same
 * device).
 */
export async function clearCachedStreak(userId: string): Promise<void> {
  try {
    await db.readingStreakCache.delete(userId)
  } catch (err) {
    // silent-catch-ok
    console.warn('[streakCache] delete failed:', err)
  }
}

/**
 * Returns `true` if the given cache row is older than the staleness threshold.
 * `undefined` / missing `cachedAt` is treated as stale (safer default).
 */
export function isStale(
  row: ReadingStreakCacheRow | undefined,
  thresholdMs: number = DEFAULT_STALE_THRESHOLD_MS
): boolean {
  if (!row || typeof row.cachedAt !== 'number') return true
  return Date.now() - row.cachedAt > thresholdMs
}
