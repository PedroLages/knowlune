import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Dexie from 'dexie'

// Mock syncableWrite so the useSyncableWrite:true path in matchOrCreateAuthor
// works without auth/queue dependencies. The mock delegates to the real Dexie
// write so DB state is testable.
const { syncableWriteMock } = vi.hoisted(() => ({
  syncableWriteMock: vi.fn(),
}))

vi.mock('@/lib/sync/syncableWrite', () => ({
  syncableWrite: syncableWriteMock,
}))

let matchOrCreateAuthor: (typeof import('@/lib/authorDetection'))['matchOrCreateAuthor']
let db: (typeof import('@/db'))['db']

beforeEach(async () => {
  await Dexie.delete('ElearningDB')
  vi.resetModules()

  // Wire up the syncableWrite mock to actually write to the DB
  syncableWriteMock.mockImplementation(
    async (_tableName: string, operation: string, record: Record<string, unknown>) => {
      const dbModule = await import('@/db')
      if (operation === 'add') {
        await dbModule.db.authors.add(record as any)
      } else if (operation === 'put') {
        await dbModule.db.authors.put(record as any)
      }
    }
  )

  const dbModule = await import('@/db')
  db = dbModule.db

  const detectionModule = await import('@/lib/authorDetection')
  matchOrCreateAuthor = detectionModule.matchOrCreateAuthor
})

describe('matchOrCreateAuthor', () => {
  it('returns null when authorName is null', async () => {
    const result = await matchOrCreateAuthor(null)
    expect(result).toBeNull()
  })

  it('returns null when authorName is empty string', async () => {
    const result = await matchOrCreateAuthor('')
    expect(result).toBeNull()
  })

  it('returns null when authorName is only whitespace', async () => {
    const result = await matchOrCreateAuthor('   ')
    expect(result).toBeNull()
  })

  it('matches existing author by exact name (case-insensitive)', async () => {
    // Seed an author
    await db.authors.add({
      id: 'chase-hughes-id',
      name: 'Chase Hughes',
      courseIds: [],
      isPreseeded: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })

    const result = await matchOrCreateAuthor('chase hughes')
    expect(result).toBe('chase-hughes-id')
  })

  it('creates new author when no match exists', async () => {
    const result = await matchOrCreateAuthor('Jane Smith')
    expect(result).toBeTruthy()

    // Verify created in DB
    const author = await db.authors.get(result!)
    expect(author).toBeDefined()
    expect(author!.name).toBe('Jane Smith')
    expect(author!.isPreseeded).toBe(false)
    expect(author!.courseIds).toEqual([])
  })

  it('does not create duplicate when called twice with same name', async () => {
    const id1 = await matchOrCreateAuthor('Jane Smith')
    const id2 = await matchOrCreateAuthor('Jane Smith')
    expect(id1).toBe(id2)

    const count = await db.authors.count()
    expect(count).toBe(1)
  })

  it('creates exactly one author when called concurrently with same name (KI-106)', async () => {
    const [id1, id2] = await Promise.all([
      matchOrCreateAuthor('Concurrent Author'),
      matchOrCreateAuthor('Concurrent Author'),
    ])
    expect(id1).toBe(id2)

    const count = await db.authors.count()
    expect(count).toBe(1)
  })

  it('matches case-insensitively with leading/trailing whitespace', async () => {
    await db.authors.add({
      id: 'john-doe-id',
      name: 'John Doe',
      courseIds: [],
      isPreseeded: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })

    const result = await matchOrCreateAuthor('  JOHN DOE  ')
    expect(result).toBe('john-doe-id')
  })

  it('uses syncableWrite when useSyncableWrite option is true', async () => {
    const result = await matchOrCreateAuthor('Syncable Author', undefined, {
      useSyncableWrite: true,
    })

    expect(result).toBeTruthy()
    expect(syncableWriteMock).toHaveBeenCalledWith(
      'authors',
      'add',
      expect.objectContaining({
        name: 'Syncable Author',
        isPreseeded: false,
        courseIds: [],
      })
    )

    // Author should be in the DB
    const author = await db.authors.get(result!)
    expect(author).toBeDefined()
    expect(author!.name).toBe('Syncable Author')

    // Second call with same name returns same ID (dedup)
    syncableWriteMock.mockClear()
    const result2 = await matchOrCreateAuthor('Syncable Author', undefined, {
      useSyncableWrite: true,
    })
    expect(result2).toBe(result)
    // syncableWrite should NOT be called for the second call (author already exists)
    expect(syncableWriteMock).not.toHaveBeenCalled()
  })

  it('does not create duplicate when useSyncableWrite is true and called twice with same name', async () => {
    const id1 = await matchOrCreateAuthor(
      'Dedup Author',
      { title: 'Expert' },
      { useSyncableWrite: true }
    )
    const id2 = await matchOrCreateAuthor(
      'Dedup Author',
      { title: 'Expert' },
      { useSyncableWrite: true }
    )
    expect(id1).toBe(id2)

    const count = await db.authors.count()
    expect(count).toBe(1)
  })
})
