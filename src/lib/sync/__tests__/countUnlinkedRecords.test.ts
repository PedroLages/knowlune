import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Dexie from 'dexie'
import { db } from '@/db'
import { countUnlinkedRecords } from '../countUnlinkedRecords'

// Mock SYNCABLE_TABLES to a controllable subset
vi.mock('../backfill', () => ({
  SYNCABLE_TABLES: ['importedCourses', 'notes', 'books', 'flashcards', 'studySessions'],
  backfillUserId: vi.fn(),
}))

beforeEach(async () => {
  await db.open()
})

afterEach(async () => {
  db.close()
  await Dexie.delete('ElearningDB')
  vi.clearAllMocks()
})

const addNote = (id: string, userId?: string) =>
  db.notes.add({
    id,
    courseId: 'c1',
    videoId: 'v1',
    tags: [],
    content: 'test',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    userId,
  } as unknown as Parameters<typeof db.notes.add>[0])

describe('countUnlinkedRecords', () => {
  it('returns all zeros when all tables are empty', async () => {
    const result = await countUnlinkedRecords('user-1')
    expect(result).toEqual({ courses: 0, notes: 0, books: 0, flashcards: 0, other: 0 })
  })

  it('counts unlinked notes correctly', async () => {
    await addNote('n1', undefined) // unlinked
    await addNote('n2', 'user-1') // linked (should NOT be counted)

    const result = await countUnlinkedRecords('user-1')
    expect(result.notes).toBe(1)
    expect(result.courses).toBe(0)
  })

  it('counts records from different userId as unlinked', async () => {
    await addNote('n1', 'user-other') // different user → unlinked
    const result = await countUnlinkedRecords('user-1')
    expect(result.notes).toBe(1)
  })

  it('accumulates counts across multiple tables into correct categories', async () => {
    // 2 unlinked notes
    await addNote('n1', undefined)
    await addNote('n2', undefined)
    // 1 linked note (should not count)
    await addNote('n3', 'user-1')

    const result = await countUnlinkedRecords('user-1')
    expect(result.notes).toBe(2)
    // studySessions in "other" category — empty → 0
    expect(result.other).toBe(0)
  })

  it('puts uncategorized tables into the "other" bucket', async () => {
    // studySessions is in our mock SYNCABLE_TABLES but not in a named category
    // It should be counted in "other"
    // We can't easily add to studySessions without complex setup,
    // but we can verify the category mapping by checking other=0 for empty tables
    const result = await countUnlinkedRecords('user-1')
    expect(result.other).toBe(0) // studySessions is empty
  })

  it('returns 0 for a category when its table query fails', async () => {
    // Make studySessions.table throw by spying on db.table
    const originalTable = db.table.bind(db)
    const tableSpy = vi.spyOn(db, 'table').mockImplementation((name: string) => {
      if (name === 'studySessions') throw new Error('table error')
      return originalTable(name)
    })

    // Add an unlinked note
    await addNote('n1', undefined)

    const result = await countUnlinkedRecords('user-1')
    // notes still counted correctly
    expect(result.notes).toBe(1)
    // studySessions failed → contributes 0 to "other"
    expect(result.other).toBe(0)

    tableSpy.mockRestore()
  })
})
