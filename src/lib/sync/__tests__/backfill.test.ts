import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Dexie from 'dexie'
import { db } from '@/db'
import { backfillUserId, SYNCABLE_TABLES } from '../backfill'

/**
 * The v52 schema carries `userId` and `updatedAt` on every syncable record,
 * but the TypeScript data interfaces (Note, VideoBookmark, etc.) won't gain
 * those fields until E92-S03/S04 introduces the `SyncableFields` mixin.
 * Tests read those fields at runtime, so we narrow through `unknown` here.
 */
type Syncable = { userId?: string; updatedAt?: string }
const asSyncable = <T,>(record: T | undefined): (T & Syncable) | undefined =>
  record as (T & Syncable) | undefined

beforeEach(async () => {
  // Open fresh — each test gets a clean DB via fake-indexeddb reset via close+delete.
  await db.open()
})

afterEach(async () => {
  db.close()
  await Dexie.delete('ElearningDB')
})

describe('backfillUserId', () => {
  it('returns zero counts and is a no-op when userId is falsy', async () => {
    await db.notes.add({
      id: 'n1',
      courseId: 'c1',
      videoId: 'v1',
      tags: [],
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
      content: '',
    } as unknown as Parameters<typeof db.notes.add>[0])

    const empty = await backfillUserId('')
    expect(empty).toEqual({ tablesProcessed: 0, recordsStamped: 0, tablesFailed: [] })

    const nullish = await backfillUserId(null)
    expect(nullish.recordsStamped).toBe(0)

    // Record still untouched.
    const note = asSyncable(await db.notes.get('n1'))
    expect(note?.userId).toBeUndefined()
  })

  it('stamps userId on records whose userId is missing', async () => {
    await db.notes.bulkAdd([
      {
        id: 'n1',
        courseId: 'c1',
        videoId: 'v1',
        tags: [],
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
        content: '',
      },
      {
        id: 'n2',
        courseId: 'c1',
        videoId: 'v2',
        tags: [],
        createdAt: '2025-01-02T00:00:00Z',
        updatedAt: '2025-01-02T00:00:00Z',
        content: '',
      },
    ] as unknown as Parameters<typeof db.notes.bulkAdd>[0])

    const result = await backfillUserId('user-A')
    expect(result.tablesProcessed).toBe(SYNCABLE_TABLES.length)
    expect(result.tablesFailed).toEqual([])
    expect(result.recordsStamped).toBeGreaterThanOrEqual(2)

    const notes = await db.notes.toArray()
    expect(notes.every(n => asSyncable(n)?.userId === 'user-A')).toBe(true)
  })

  it('does not overwrite records that already have a userId', async () => {
    await db.notes.bulkAdd([
      {
        id: 'n-B',
        courseId: 'c1',
        videoId: 'v1',
        tags: [],
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
        content: '',
        userId: 'user-B',
      },
      {
        id: 'n-blank',
        courseId: 'c1',
        videoId: 'v2',
        tags: [],
        createdAt: '2025-01-02T00:00:00Z',
        updatedAt: '2025-01-02T00:00:00Z',
        content: '',
      },
    ] as unknown as Parameters<typeof db.notes.bulkAdd>[0])

    await backfillUserId('user-A')

    const preserved = asSyncable(await db.notes.get('n-B'))
    expect(preserved?.userId).toBe('user-B')

    const stamped = asSyncable(await db.notes.get('n-blank'))
    expect(stamped?.userId).toBe('user-A')
  })

  it('stamps updatedAt when missing, preserves when present', async () => {
    await db.bookmarks.add({
      id: 'bm1',
      courseId: 'c1',
      lessonId: 'l1',
      createdAt: '2025-01-05T00:00:00Z',
      timestamp: 0,
      title: '',
    } as unknown as Parameters<typeof db.bookmarks.add>[0])

    await db.notes.add({
      id: 'nKept',
      courseId: 'c1',
      videoId: 'v1',
      tags: [],
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2099-12-31T00:00:00Z',
      content: '',
    } as unknown as Parameters<typeof db.notes.add>[0])

    await backfillUserId('user-A')

    const bm = asSyncable(await db.bookmarks.get('bm1'))
    expect(typeof bm?.updatedAt).toBe('string')

    const note = asSyncable(await db.notes.get('nKept'))
    expect(note?.updatedAt).toBe('2099-12-31T00:00:00Z')
  })

  it('is idempotent — a second call stamps zero additional records', async () => {
    await db.notes.add({
      id: 'n1',
      courseId: 'c1',
      videoId: 'v1',
      tags: [],
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
      content: '',
    } as unknown as Parameters<typeof db.notes.add>[0])

    const first = await backfillUserId('user-A')
    expect(first.recordsStamped).toBeGreaterThanOrEqual(1)

    const second = await backfillUserId('user-A')
    expect(second.recordsStamped).toBe(0)
    expect(second.tablesFailed).toEqual([])
  })

  it('returns counts for multiple syncable tables', async () => {
    await db.bookmarks.add({
      id: 'bm1',
      courseId: 'c1',
      lessonId: 'l1',
      createdAt: '2025-01-05T00:00:00Z',
      timestamp: 0,
      title: '',
    } as unknown as Parameters<typeof db.bookmarks.add>[0])
    await db.flashcards.add({
      id: 'f1',
      courseId: 'c1',
      noteId: 'n1',
      due: '2025-02-01T00:00:00Z',
      createdAt: '2025-01-01T00:00:00Z',
    } as unknown as Parameters<typeof db.flashcards.add>[0])

    const result = await backfillUserId('user-A')
    expect(result.recordsStamped).toBeGreaterThanOrEqual(2)
  })

  it('continues past per-table failures and reports them in tablesFailed', async () => {
    // Force one table to throw by stubbing its .filter() method.
    const spy = vi.spyOn(db, 'table').mockImplementation((name: string) => {
      if (name === 'notes') {
        throw new Error('synthetic notes failure')
      }
      // Delegate to real table for everything else.
      return (Dexie.prototype.table.call(db, name) as unknown) as ReturnType<typeof db.table>
    })

    try {
      const result = await backfillUserId('user-A')
      expect(result.tablesFailed).toEqual(['notes'])
      // Processed every table except the one that threw.
      expect(result.tablesProcessed).toBe(SYNCABLE_TABLES.length - 1)
    } finally {
      spy.mockRestore()
    }
  })

  it('stamps records whose userId is an empty string', async () => {
    // Pre-existing empty-string userId (e.g. from a previous buggy write)
    // must still be overwritten by the backfill.
    await db.notes.add({
      id: 'n-empty',
      courseId: 'c1',
      videoId: 'v1',
      tags: [],
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
      content: '',
      userId: '',
    } as unknown as Parameters<typeof db.notes.add>[0])

    const result = await backfillUserId('user-A')
    expect(result.recordsStamped).toBeGreaterThanOrEqual(1)

    const stamped = asSyncable(await db.notes.get('n-empty'))
    expect(stamped?.userId).toBe('user-A')
  })
})
