// E97-S03: Tests for useInitialUploadProgress hook
import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import Dexie from 'dexie'
import { db } from '@/db'
import { useInitialUploadProgress } from '../useInitialUploadProgress'

// Minimal SYNCABLE_TABLES so unlinked-count path does not touch unused tables.
vi.mock('@/lib/sync/backfill', () => ({
  SYNCABLE_TABLES: ['notes'],
  backfillUserId: vi.fn(),
}))

const USER = 'user-1'

async function addPending(id: number, tableName = 'notes', updatedAt?: string) {
  await db.syncQueue.add({
    id,
    tableName,
    recordId: `r${id}`,
    operation: 'put',
    payload: {},
    attempts: 0,
    status: 'pending',
    createdAt: new Date(id * 1000).toISOString(),
    updatedAt: updatedAt ?? new Date(id * 1000).toISOString(),
  })
}

beforeEach(async () => {
  await db.open()
})

afterEach(async () => {
  db.close()
  await Dexie.delete('ElearningDB')
  vi.clearAllMocks()
})

describe('useInitialUploadProgress', () => {
  it('snapshots total and sets done=true immediately when empty', async () => {
    const { result } = renderHook(() => useInitialUploadProgress(USER, true))
    await waitFor(() => {
      expect(result.current.total).toBe(0)
      expect(result.current.done).toBe(true)
    })
  })

  it('drives processed from total as pending entries are drained', async () => {
    await addPending(1)
    await addPending(2)
    await addPending(3)

    const { result } = renderHook(() => useInitialUploadProgress(USER, true))

    await waitFor(() => {
      expect(result.current.total).toBe(3)
    })
    expect(result.current.done).toBe(false)
    expect(result.current.processed).toBe(0)

    // Drain one entry, wait for the 500ms poll to pick it up.
    await db.syncQueue.delete(1)
    await waitFor(
      () => {
        expect(result.current.processed).toBe(1)
      },
      { timeout: 2000 }
    )

    await db.syncQueue.delete(2)
    await db.syncQueue.delete(3)
    await waitFor(
      () => {
        expect(result.current.done).toBe(true)
        expect(result.current.processed).toBe(3)
      },
      { timeout: 2000 }
    )
  })

  it('clamps processed to [0, total] even if new entries are enqueued after snapshot', async () => {
    await addPending(1)
    const { result } = renderHook(() => useInitialUploadProgress(USER, true))
    await waitFor(() => expect(result.current.total).toBe(1))

    // Enqueue more after snapshot — total must stay 1, processed cannot go negative.
    await addPending(2)
    await addPending(3)

    // Wait for at least one poll cycle
    await new Promise(r => setTimeout(r, 700))
    expect(result.current.total).toBe(1)
    expect(result.current.processed).toBeGreaterThanOrEqual(0)
    expect(result.current.processed).toBeLessThanOrEqual(1)
  })

  it('reports recentTable from the most-recent pending row', async () => {
    await addPending(1, 'books', '2020-01-01T00:00:00.000Z')
    await addPending(2, 'flashcards', '2030-01-01T00:00:00.000Z')

    const { result } = renderHook(() => useInitialUploadProgress(USER, true))
    await waitFor(
      () => {
        expect(result.current.recentTable).toBe('flashcards')
      },
      { timeout: 2000 }
    )
  })

  it('does nothing when enabled is false', async () => {
    await addPending(1)
    const { result } = renderHook(() => useInitialUploadProgress(USER, false))

    // Wait one poll cycle; state stays at initial zero values.
    await new Promise(r => setTimeout(r, 700))
    expect(result.current.total).toBe(0)
    expect(result.current.processed).toBe(0)
    expect(result.current.done).toBe(false)
  })

  it('clears the interval on unmount', async () => {
    await addPending(1)
    const spy = vi.spyOn(window, 'clearInterval')
    const { unmount } = renderHook(() => useInitialUploadProgress(USER, true))
    await waitFor(() => expect(spy).not.toHaveBeenCalled())
    act(() => unmount())
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })
})
