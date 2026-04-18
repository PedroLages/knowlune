import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Dexie from 'dexie'
import { db } from '@/db'
import { clearSyncState } from '../clearSyncState'

beforeEach(async () => {
  await db.open()
})

afterEach(async () => {
  db.close()
  await Dexie.delete('ElearningDB')
})

describe('clearSyncState', () => {
  it('clears all syncQueue entries', async () => {
    // Seed queue entries
    await db.syncQueue.bulkAdd([
      {
        tableName: 'notes',
        recordId: 'n1',
        operation: 'put',
        payload: { id: 'n1' },
        attempts: 0,
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        tableName: 'books',
        recordId: 'b1',
        operation: 'put',
        payload: { id: 'b1' },
        attempts: 3,
        status: 'dead-letter',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ])

    expect(await db.syncQueue.count()).toBe(2)
    await clearSyncState()
    expect(await db.syncQueue.count()).toBe(0)
  })

  it('resets syncMetadata lastSyncTimestamp and lastUploadedKey', async () => {
    // Seed metadata rows
    await db.syncMetadata.bulkPut([
      { table: 'notes', lastSyncTimestamp: '2026-01-01T00:00:00Z', lastUploadedKey: 'note-key-1' },
      { table: 'books', lastSyncTimestamp: '2026-01-02T00:00:00Z', lastUploadedKey: undefined },
    ])

    await clearSyncState()

    const notesRow = await db.syncMetadata.get('notes')
    const booksRow = await db.syncMetadata.get('books')

    // lastSyncTimestamp and lastUploadedKey reset to undefined
    expect(notesRow?.lastSyncTimestamp).toBeUndefined()
    expect(notesRow?.lastUploadedKey).toBeUndefined()
    expect(booksRow?.lastSyncTimestamp).toBeUndefined()
    expect(booksRow?.lastUploadedKey).toBeUndefined()
  })

  it('succeeds when syncQueue is already empty', async () => {
    expect(await db.syncQueue.count()).toBe(0)
    // Should not throw
    await expect(clearSyncState()).resolves.toBeUndefined()
  })

  it('succeeds when syncMetadata has no rows', async () => {
    expect(await db.syncMetadata.count()).toBe(0)
    await expect(clearSyncState()).resolves.toBeUndefined()
  })

  it('does NOT delete local content records (notes, books, etc.)', async () => {
    // Seed a note record (not a sync infrastructure table)
    await db.notes.add({
      id: 'n1',
      courseId: 'c1',
      videoId: 'v1',
      tags: [],
      content: 'hello',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as unknown as Parameters<typeof db.notes.add>[0])

    await clearSyncState()

    // Note should survive
    const note = await db.notes.get('n1')
    expect(note).toBeDefined()
    expect((note as unknown as { id: string }).id).toBe('n1')
  })
})
