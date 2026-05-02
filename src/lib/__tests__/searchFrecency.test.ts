import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Dexie from 'dexie'
import {
  getRecentHits,
  recordVisit,
  applyFrecency,
  RECENT_LIST_KEY,
  RECENT_LIST_MAX,
  type FrecencyRow,
} from '../searchFrecency'
import type { UnifiedSearchResult } from '../unifiedSearch'

let db: Awaited<typeof import('@/db/schema')>['db']

beforeEach(async () => {
  localStorage.clear()
  await Dexie.delete('ElearningDB')
  const mod = await import('@/db/schema')
  db = mod.db
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ───────────────────────────────────────────────────────────────────────────
// localStorage side
// ───────────────────────────────────────────────────────────────────────────

describe('searchFrecency — recent list (localStorage)', () => {
  it('first recordVisit adds an entry to an empty list', async () => {
    await recordVisit('course', 'c1')
    const list = getRecentHits()
    expect(list).toHaveLength(1)
    expect(list[0].type).toBe('course')
    expect(list[0].id).toBe('c1')
    expect(typeof list[0].openedAt).toBe('string')
  })

  it('second recordVisit for a different entity prepends (newest-first)', async () => {
    await recordVisit('course', 'c1')
    await recordVisit('book', 'b1')
    const list = getRecentHits()
    expect(list.map(h => `${h.type}:${h.id}`)).toEqual(['book:b1', 'course:c1'])
  })

  it('dedups same entity — only one entry remains at the top with newer openedAt', async () => {
    await recordVisit('course', 'c1')
    const first = getRecentHits()[0].openedAt
    // Nudge clock so the new ISO timestamp is strictly newer
    await new Promise(r => setTimeout(r, 2))
    await recordVisit('course', 'c1')
    const list = getRecentHits()
    expect(list).toHaveLength(1)
    expect(list[0].id).toBe('c1')
    expect(list[0].openedAt >= first).toBe(true)
  })

  it('caps at RECENT_LIST_MAX (20 entries) — oldest dropped', async () => {
    for (let i = 0; i < RECENT_LIST_MAX + 1; i++) {
      await recordVisit('course', `c-${i}`)
    }
    const list = getRecentHits()
    expect(list).toHaveLength(RECENT_LIST_MAX)
    // The most-recent call was c-20; oldest remaining should be c-1 (c-0 dropped)
    expect(list[0].id).toBe(`c-${RECENT_LIST_MAX}`)
    expect(list[list.length - 1].id).toBe('c-1')
  })

  it('returns [] when localStorage is empty', () => {
    expect(getRecentHits()).toEqual([])
  })

  it('returns [] + warns when recent-list JSON is corrupt', () => {
    localStorage.setItem(RECENT_LIST_KEY, '{not-json')
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(getRecentHits()).toEqual([])
    expect(warnSpy).toHaveBeenCalled()
  })

  it('filters out malformed entries (shape guard)', () => {
    localStorage.setItem(
      RECENT_LIST_KEY,
      JSON.stringify([
        { type: 'course', id: 'c1', openedAt: '2026-01-01T00:00:00.000Z' },
        { bogus: 1 },
        { type: 'unknown-type', id: 'x', openedAt: '...' },
      ])
    )
    const list = getRecentHits()
    expect(list).toHaveLength(1)
    expect(list[0].id).toBe('c1')
  })

  it('recordVisit with empty string id is a no-op', async () => {
    await recordVisit('course', '')
    expect(getRecentHits()).toHaveLength(0)
    expect(await db.searchFrecency.toArray()).toHaveLength(0)
  })
})

// ───────────────────────────────────────────────────────────────────────────
// Dexie side
// ───────────────────────────────────────────────────────────────────────────

describe('searchFrecency — Dexie counters', () => {
  it('first call creates a row with openCount: 1', async () => {
    await recordVisit('course', 'c1')
    const row = await db.searchFrecency.get(['course', 'c1'])
    expect(row).toBeDefined()
    expect(row!.openCount).toBe(1)
    expect(typeof row!.lastOpenedAt).toBe('string')
  })

  it('second call for same entity increments to 2 and updates lastOpenedAt', async () => {
    await recordVisit('course', 'c1')
    const first = await db.searchFrecency.get(['course', 'c1'])
    await new Promise(r => setTimeout(r, 2))
    await recordVisit('course', 'c1')
    const row = await db.searchFrecency.get(['course', 'c1'])
    expect(row!.openCount).toBe(2)
    expect(row!.lastOpenedAt >= first!.lastOpenedAt).toBe(true)
  })

  it('concurrent recordVisit calls on the same entity produce openCount: 2 (transaction serializes RMW)', async () => {
    await Promise.all([recordVisit('course', 'c1'), recordVisit('course', 'c1')])
    const row = await db.searchFrecency.get(['course', 'c1'])
    // Without the transaction this would be 1 (lost update); with it, 2.
    expect(row!.openCount).toBe(2)
  })

  it('rapid sequential double-call produces openCount: 2', async () => {
    await recordVisit('course', 'c1')
    await recordVisit('course', 'c1')
    const row = await db.searchFrecency.get(['course', 'c1'])
    expect(row!.openCount).toBe(2)
    // LS still has a single entry at the top (dedup)
    const list = getRecentHits()
    expect(list).toHaveLength(1)
  })

  it('logs and does NOT throw when Dexie put rejects', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const putSpy = vi.spyOn(db.searchFrecency, 'put').mockRejectedValueOnce(new Error('boom'))
    await expect(recordVisit('course', 'c-fail')).resolves.toBeUndefined()
    expect(errSpy).toHaveBeenCalled()
    putSpy.mockRestore()
  })
})

// ───────────────────────────────────────────────────────────────────────────
// applyFrecency — pure transform
// ───────────────────────────────────────────────────────────────────────────

function makeResult(
  type: UnifiedSearchResult['type'],
  id: string,
  score: number
): UnifiedSearchResult {
  return { id, type, score, displayTitle: `${type}:${id}` }
}

describe('searchFrecency — applyFrecency (pure)', () => {
  it('today + 3 opens hits the 2.0 cap', () => {
    const now = Date.parse('2026-04-18T00:00:00.000Z')
    const map = new Map<string, FrecencyRow>([
      [
        'course:a',
        {
          entityType: 'course',
          entityId: 'a',
          openCount: 3,
          lastOpenedAt: '2026-04-18T00:00:00.000Z',
        },
      ],
    ])
    const out = applyFrecency([makeResult('course', 'a', 10)], map, now)
    expect(out[0].score).toBeCloseTo(20, 5)
  })

  it('openCount = 1000 is capped at the same 2.0 ceiling as openCount = 3', () => {
    const now = Date.parse('2026-04-18T00:00:00.000Z')
    const mkMap = (count: number) =>
      new Map<string, FrecencyRow>([
        [
          'course:a',
          {
            entityType: 'course',
            entityId: 'a',
            openCount: count,
            lastOpenedAt: '2026-04-18T00:00:00.000Z',
          },
        ],
      ])
    const low = applyFrecency([makeResult('course', 'a', 10)], mkMap(3), now)
    const high = applyFrecency([makeResult('course', 'a', 10)], mkMap(1000), now)
    expect(high[0].score).toBeCloseTo(low[0].score, 5)
    expect(high[0].score).toBeCloseTo(20, 5)
  })

  it('result not in frecencyMap keeps the pure MiniSearch score (multiplier = 1)', () => {
    const now = Date.parse('2026-04-18T00:00:00.000Z')
    const out = applyFrecency([makeResult('course', 'nope', 7)], new Map(), now)
    expect(out[0].score).toBeCloseTo(7, 5)
  })

  it('lastOpenedAt 31 days ago → decay clamps to 0 → multiplier = 1', () => {
    const now = Date.parse('2026-04-18T00:00:00.000Z')
    const thirtyOneAgo = new Date(now - 31 * 86_400_000).toISOString()
    const map = new Map<string, FrecencyRow>([
      [
        'course:a',
        {
          entityType: 'course',
          entityId: 'a',
          openCount: 10,
          lastOpenedAt: thirtyOneAgo,
        },
      ],
    ])
    const out = applyFrecency([makeResult('course', 'a', 10)], map, now)
    expect(out[0].score).toBeCloseTo(10, 5)
  })

  it('openCount = 0 → log2(1) = 0 → multiplier = 1', () => {
    const now = Date.parse('2026-04-18T00:00:00.000Z')
    const map = new Map<string, FrecencyRow>([
      [
        'course:a',
        {
          entityType: 'course',
          entityId: 'a',
          openCount: 0,
          lastOpenedAt: '2026-04-18T00:00:00.000Z',
        },
      ],
    ])
    const out = applyFrecency([makeResult('course', 'a', 10)], map, now)
    expect(out[0].score).toBeCloseTo(10, 5)
  })

  it('does NOT mutate input result objects', () => {
    const now = Date.parse('2026-04-18T00:00:00.000Z')
    const input = makeResult('course', 'a', 10)
    const map = new Map<string, FrecencyRow>([
      [
        'course:a',
        {
          entityType: 'course',
          entityId: 'a',
          openCount: 3,
          lastOpenedAt: '2026-04-18T00:00:00.000Z',
        },
      ],
    ])
    const before = { ...input }
    applyFrecency([input], map, now)
    expect(input).toEqual(before)
  })
})
