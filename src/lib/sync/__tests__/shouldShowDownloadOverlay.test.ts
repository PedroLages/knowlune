/**
 * E97-S04 Unit 2: Tests for shouldShowDownloadOverlay predicate.
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Dexie from 'dexie'
import { db } from '@/db'

// Mock supabase BEFORE importing the module under test.
const mockHeadCount = vi.fn()

vi.mock('@/lib/auth/supabase', () => ({
  supabase: {
    from: (tableName: string) => ({
      select: (_sel: string, _opts: { count: string; head: boolean }) => ({
        eq: (_col: string, _val: string) => mockHeadCount(tableName),
      }),
    }),
  },
}))

import { shouldShowDownloadOverlay, getCountedTables } from '../shouldShowDownloadOverlay'
import { tableRegistry } from '../tableRegistry'

const USER = 'user-1'

beforeEach(async () => {
  await db.open()
  // Default: all HEAD counts return 0
  mockHeadCount.mockReset()
  mockHeadCount.mockResolvedValue({ count: 0, error: null })
})

afterEach(async () => {
  db.close()
  await Dexie.delete('ElearningDB')
  vi.clearAllMocks()
})

async function addNote(id: string, userId: string | undefined = USER) {
  await db.notes.add({
    id,
    courseId: 'c1',
    videoId: 'v1',
    tags: [],
    content: 'test',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    userId,
  } as unknown as Parameters<typeof db.notes.add>[0])
}

describe('shouldShowDownloadOverlay', () => {
  it('returns false for empty userId', async () => {
    expect(await shouldShowDownloadOverlay('')).toBe(false)
    expect(await shouldShowDownloadOverlay(null)).toBe(false)
    expect(await shouldShowDownloadOverlay(undefined)).toBe(false)
  })

  it('returns false when local Dexie has syncable rows for the user (R6)', async () => {
    await addNote('n1', USER)
    const result = await shouldShowDownloadOverlay(USER)
    expect(result).toBe(false)
    // Remote HEAD must NOT have been queried (short-circuit).
    expect(mockHeadCount).not.toHaveBeenCalled()
  })

  it('returns false when local is empty AND remote is empty', async () => {
    // Default mock: all counts return 0
    const result = await shouldShowDownloadOverlay(USER)
    expect(result).toBe(false)
    // Remote was queried
    expect(mockHeadCount).toHaveBeenCalled()
  })

  it('returns true when local is empty AND remote has rows', async () => {
    // First HEAD returns 3, rest return 0
    mockHeadCount.mockImplementation((tableName: string) => {
      if (tableName === 'notes') return Promise.resolve({ count: 3, error: null })
      return Promise.resolve({ count: 0, error: null })
    })
    const result = await shouldShowDownloadOverlay(USER)
    expect(result).toBe(true)
  })

  it('returns false when all remote HEAD queries fail (safe default)', async () => {
    mockHeadCount.mockResolvedValue({ count: null, error: { message: 'boom' } })
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const result = await shouldShowDownloadOverlay(USER)
    expect(result).toBe(false)
    errSpy.mockRestore()
  })

  it('returns true when SOME remote HEAD queries fail but at least one reports rows', async () => {
    // Half fail, the rest return 2 rows for notes
    mockHeadCount.mockImplementation((tableName: string) => {
      if (tableName === 'notes') return Promise.resolve({ count: 2, error: null })
      if (tableName.startsWith('a')) {
        return Promise.resolve({ count: null, error: { message: 'partial fail' } })
      }
      return Promise.resolve({ count: 0, error: null })
    })
    const result = await shouldShowDownloadOverlay(USER)
    expect(result).toBe(true)
  })

  it('does not write to syncQueue during evaluation (echo-loop guard)', async () => {
    const before = await db.syncQueue.count()
    await shouldShowDownloadOverlay(USER)
    const after = await db.syncQueue.count()
    expect(after).toBe(before)
  })

  it('counts rows with undefined userId as belonging to this user (pre-backfill)', async () => {
    await addNote('n1', undefined)
    const result = await shouldShowDownloadOverlay(USER)
    // Has local data → no overlay
    expect(result).toBe(false)
  })

  it('ignores rows stamped with a different userId', async () => {
    await addNote('n1', 'other-user')
    // Mock remote to have 0 rows to clearly assert predicate semantics.
    const result = await shouldShowDownloadOverlay(USER)
    // Local has no USER rows, remote is empty → false
    expect(result).toBe(false)
    expect(mockHeadCount).toHaveBeenCalled()
  })
})

describe('getCountedTables', () => {
  it('excludes skipSync and uploadOnly tables from the counted list', () => {
    const counted = getCountedTables()
    for (const entry of counted) {
      expect(entry.skipSync).not.toBe(true)
      expect(entry.uploadOnly).not.toBe(true)
    }
  })

  it('excludes embeddings (uploadOnly)', () => {
    const counted = getCountedTables()
    expect(counted.find(e => e.dexieTable === 'embeddings')).toBeUndefined()
  })

  it('includes representative P0-P4 tables', () => {
    const counted = getCountedTables().map(e => e.dexieTable)
    // P0
    expect(counted).toContain('contentProgress')
    expect(counted).toContain('studySessions')
    expect(counted).toContain('progress')
    // P1
    expect(counted).toContain('notes')
    expect(counted).toContain('flashcards')
    // P2
    expect(counted).toContain('books')
    // P3
    expect(counted).toContain('learningPaths')
    // P4
    expect(counted).toContain('quizzes')
  })

  it('count matches tableRegistry minus excluded entries', () => {
    const counted = getCountedTables()
    const excluded = tableRegistry.filter(e => e.skipSync || e.uploadOnly)
    expect(counted.length).toBe(tableRegistry.length - excluded.length)
  })
})
