/**
 * E95-S04 Unit 3: Tests for the Dexie-backed reading-streak cache.
 *
 * Uses an in-memory mock of the `db.readingStreakCache` surface — the real
 * Dexie instance is exercised by integration tests; here we verify the
 * helpers' null-safe semantics and staleness logic in isolation.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const store = new Map<string, unknown>()
const mockGet = vi.fn(async (userId: string) => store.get(userId))
const mockPut = vi.fn(async (row: { userId: string }) => {
  store.set(row.userId, row)
  return row.userId
})
const mockDelete = vi.fn(async (userId: string) => {
  store.delete(userId)
})

vi.mock('@/db/schema', () => ({
  db: {
    readingStreakCache: {
      get: (...args: unknown[]) => mockGet(...(args as [string])),
      put: (...args: unknown[]) => mockPut(...(args as [{ userId: string }])),
      delete: (...args: unknown[]) => mockDelete(...(args as [string])),
    },
  },
}))

import {
  getCachedStreak,
  cacheStreak,
  clearCachedStreak,
  isStale,
  DEFAULT_STALE_THRESHOLD_MS,
} from '@/lib/streakCache'

beforeEach(() => {
  store.clear()
  mockGet.mockClear()
  mockPut.mockClear()
  mockDelete.mockClear()
})

describe('streakCache', () => {
  it('cacheStreak + getCachedStreak round-trips the triple', async () => {
    await cacheStreak('user-1', {
      currentStreak: 7,
      longestStreak: 12,
      lastMetDate: '2026-04-19',
    })
    const result = await getCachedStreak('user-1')
    expect(result).toMatchObject({
      userId: 'user-1',
      currentStreak: 7,
      longestStreak: 12,
      lastMetDate: '2026-04-19',
    })
    expect(typeof result?.cachedAt).toBe('number')
  })

  it('returns undefined for a user with no cached streak', async () => {
    const result = await getCachedStreak('nobody')
    expect(result).toBeUndefined()
  })

  it('clearCachedStreak removes the row', async () => {
    await cacheStreak('user-1', {
      currentStreak: 1,
      longestStreak: 1,
      lastMetDate: '2026-04-19',
    })
    await clearCachedStreak('user-1')
    const result = await getCachedStreak('user-1')
    expect(result).toBeUndefined()
  })

  it('swallows read failures and returns undefined', async () => {
    mockGet.mockRejectedValueOnce(new Error('IDB blocked'))
    const result = await getCachedStreak('user-1')
    expect(result).toBeUndefined()
  })

  it('swallows write failures without throwing', async () => {
    mockPut.mockRejectedValueOnce(new Error('quota'))
    await expect(
      cacheStreak('user-1', { currentStreak: 2, longestStreak: 2, lastMetDate: null })
    ).resolves.toBeUndefined()
  })

  describe('isStale', () => {
    it('treats missing row as stale', () => {
      expect(isStale(undefined)).toBe(true)
    })

    it('treats 25h-old cache as stale at the default threshold', () => {
      const row = {
        userId: 'u',
        currentStreak: 1,
        longestStreak: 1,
        lastMetDate: null,
        cachedAt: Date.now() - 25 * 60 * 60 * 1000,
      }
      expect(isStale(row)).toBe(true)
    })

    it('treats 23h-old cache as fresh at the default threshold', () => {
      const row = {
        userId: 'u',
        currentStreak: 1,
        longestStreak: 1,
        lastMetDate: null,
        cachedAt: Date.now() - 23 * 60 * 60 * 1000,
      }
      expect(isStale(row)).toBe(false)
    })

    it('respects a custom threshold', () => {
      const row = {
        userId: 'u',
        currentStreak: 1,
        longestStreak: 1,
        lastMetDate: null,
        cachedAt: Date.now() - 61 * 1000,
      }
      expect(isStale(row, 60 * 1000)).toBe(true)
      expect(isStale(row, 120 * 1000)).toBe(false)
    })

    it('exposes the default threshold constant', () => {
      expect(DEFAULT_STALE_THRESHOLD_MS).toBe(24 * 60 * 60 * 1000)
    })
  })
})
