import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Dexie from 'dexie'
import { db } from '@/db'
import { resetLocalData } from '../resetLocalData'
import { syncEngine } from '../syncEngine'
import * as clearSyncStateMod from '../clearSyncState'

beforeEach(async () => {
  await db.open()
  vi.restoreAllMocks()
})

afterEach(async () => {
  db.close()
  await Dexie.delete('ElearningDB')
})

describe('resetLocalData', () => {
  it('stops the engine, wipes tables, clears sync state, and restarts when userId is present', async () => {
    // Seed fixtures across three distinct tables registered with different strategies.
    await db.notes.add({
      id: 'n1',
      courseId: 'c1',
      videoId: 'v1',
      tags: [],
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      content: 'hello',
    } as unknown as Parameters<typeof db.notes.add>[0])

    await db.bookmarks.add({
      id: 'b1',
      courseId: 'c1',
      videoId: 'v1',
      timestamp: 0,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    } as unknown as Parameters<typeof db.bookmarks.add>[0])

    await db.flashcards.add({
      id: 'f1',
      courseId: 'c1',
      front: 'q',
      back: 'a',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    } as unknown as Parameters<typeof db.flashcards.add>[0])

    // Seed sync infrastructure rows so we can assert clearSyncState() ran.
    await db.syncQueue.add({
      tableName: 'notes',
      recordId: 'n1',
      operation: 'put',
      payload: { id: 'n1' },
      attempts: 0,
      status: 'pending',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    })
    await db.syncMetadata.put({
      table: 'notes',
      lastSyncTimestamp: '2026-01-01T00:00:00Z',
      lastUploadedKey: 'key',
    })

    const stopSpy = vi.spyOn(syncEngine, 'stop')
    const startSpy = vi.spyOn(syncEngine, 'start').mockResolvedValue(undefined)
    const clearSpy = vi.spyOn(clearSyncStateMod, 'clearSyncState')

    await resetLocalData('user-1')

    expect(stopSpy).toHaveBeenCalledTimes(1)
    expect(clearSpy).toHaveBeenCalledTimes(1)
    expect(startSpy).toHaveBeenCalledWith('user-1')

    // All three data tables wiped.
    expect(await db.notes.count()).toBe(0)
    expect(await db.bookmarks.count()).toBe(0)
    expect(await db.flashcards.count()).toBe(0)

    // syncQueue cleared + cursors reset.
    expect(await db.syncQueue.count()).toBe(0)
    const meta = await db.syncMetadata.get('notes')
    expect(meta?.lastSyncTimestamp).toBeUndefined()
    expect(meta?.lastUploadedKey).toBeUndefined()
  })

  it('leaves the engine stopped when userId is null', async () => {
    const stopSpy = vi.spyOn(syncEngine, 'stop')
    const startSpy = vi.spyOn(syncEngine, 'start').mockResolvedValue(undefined)

    await resetLocalData(null)

    expect(stopSpy).toHaveBeenCalledTimes(1)
    expect(startSpy).not.toHaveBeenCalled()
  })

  it('continues clearing remaining tables when one table.clear() throws', async () => {
    await db.notes.add({
      id: 'n1',
      courseId: 'c1',
      videoId: 'v1',
      tags: [],
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      content: 'hello',
    } as unknown as Parameters<typeof db.notes.add>[0])
    await db.flashcards.add({
      id: 'f1',
      courseId: 'c1',
      front: 'q',
      back: 'a',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    } as unknown as Parameters<typeof db.flashcards.add>[0])

    // Force notes.clear() to throw, verify flashcards still clears.
    const originalClear = db.notes.clear.bind(db.notes)
    vi.spyOn(db.notes, 'clear').mockRejectedValueOnce(new Error('boom'))
    vi.spyOn(syncEngine, 'start').mockResolvedValue(undefined)
    const clearSpy = vi.spyOn(clearSyncStateMod, 'clearSyncState')

    await resetLocalData('user-1')

    // notes still has the row (mock rejected the clear)
    expect(await db.notes.count()).toBe(1)
    // flashcards table was still cleared
    expect(await db.flashcards.count()).toBe(0)
    // clearSyncState still fired
    expect(clearSpy).toHaveBeenCalledTimes(1)

    // Restore so afterEach cleanup works
    await originalClear().catch(() => {})
  })

  it('continues the reset sequence when syncEngine.stop() throws', async () => {
    vi.spyOn(syncEngine, 'stop').mockImplementationOnce(() => {
      throw new Error('stop threw')
    })
    const startSpy = vi.spyOn(syncEngine, 'start').mockResolvedValue(undefined)
    const clearSpy = vi.spyOn(clearSyncStateMod, 'clearSyncState')

    await resetLocalData('user-1')

    // Tables still cleared, clearSyncState still called, start still invoked.
    expect(clearSpy).toHaveBeenCalledTimes(1)
    expect(startSpy).toHaveBeenCalledWith('user-1')
  })

  it('leaves syncMetadata empty before rehydration so the next fullSync re-downloads from t=0', async () => {
    await db.syncMetadata.put({
      table: 'notes',
      lastSyncTimestamp: '2026-01-01T00:00:00Z',
      lastUploadedKey: 'key',
    })
    vi.spyOn(syncEngine, 'start').mockResolvedValue(undefined)

    await resetLocalData('user-1')

    const meta = await db.syncMetadata.get('notes')
    expect(meta?.lastSyncTimestamp).toBeUndefined()
  })
})
