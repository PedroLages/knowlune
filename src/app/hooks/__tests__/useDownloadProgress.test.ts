/**
 * E97-S04 Unit 4: Tests for useDownloadProgress hook.
 *
 * Covers the HEAD-count snapshot + Dexie poll loop. All Supabase HEAD calls
 * are mocked; Dexie is real via fake-indexeddb so table-count semantics match
 * production.
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import Dexie from 'dexie'
import { db } from '@/db'

// Mock supabase HEAD counts BEFORE importing the hook.
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

import { useDownloadProgress } from '../useDownloadProgress'
import { useDownloadStatusStore } from '@/app/stores/useDownloadStatusStore'
import { getCountedTables } from '@/lib/sync/shouldShowDownloadOverlay'

const USER = 'user-1'

async function addNote(id: string) {
  await db.notes.add({
    id,
    courseId: 'c1',
    videoId: 'v1',
    tags: [],
    content: 'test',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    userId: USER,
  } as unknown as Parameters<typeof db.notes.add>[0])
}

beforeEach(async () => {
  await db.open()
  mockHeadCount.mockReset()
  mockHeadCount.mockResolvedValue({ count: 0, error: null })
  useDownloadStatusStore.setState({
    status: 'hydrating-p3p4',
    lastError: null,
    startedAt: Date.now(),
  })
})

afterEach(async () => {
  db.close()
  await Dexie.delete('ElearningDB')
  vi.clearAllMocks()
})

describe('useDownloadProgress', () => {
  it('snapshots remote total from HEAD counts on first run', async () => {
    mockHeadCount.mockImplementation((tableName: string) => {
      if (tableName === 'notes') return Promise.resolve({ count: 3, error: null })
      if (tableName === 'books') return Promise.resolve({ count: 2, error: null })
      return Promise.resolve({ count: 0, error: null })
    })

    const { result } = renderHook(() => useDownloadProgress(USER, true))
    await waitFor(() => {
      expect(result.current.total).toBe(5)
    })
    expect(result.current.error).toBe(false)
    expect(result.current.totalTables).toBe(getCountedTables().length)
  })

  it('advances processed as Dexie tables fill', async () => {
    mockHeadCount.mockImplementation((tableName: string) => {
      if (tableName === 'notes') return Promise.resolve({ count: 3, error: null })
      return Promise.resolve({ count: 0, error: null })
    })

    const { result } = renderHook(() => useDownloadProgress(USER, true))
    await waitFor(() => expect(result.current.total).toBe(3))

    await addNote('n1')
    await waitFor(
      () => {
        expect(result.current.processed).toBeGreaterThanOrEqual(1)
      },
      { timeout: 2000 },
    )

    await addNote('n2')
    await addNote('n3')
    await waitFor(
      () => {
        expect(result.current.processed).toBe(3)
      },
      { timeout: 2000 },
    )
  })

  it('reports done=true when store status is complete', async () => {
    mockHeadCount.mockResolvedValue({ count: 0, error: null })

    const { result } = renderHook(() => useDownloadProgress(USER, true))
    await waitFor(() => expect(result.current.totalTables).toBeGreaterThan(0))

    act(() => {
      useDownloadStatusStore.setState({ status: 'complete' })
    })

    await waitFor(
      () => {
        expect(result.current.done).toBe(true)
      },
      { timeout: 2000 },
    )
  })

  it('is a no-op when enabled=false', async () => {
    const { result } = renderHook(() => useDownloadProgress(USER, false))
    // Wait one poll cycle; state stays idle.
    await new Promise((r) => setTimeout(r, 700))
    expect(result.current.total).toBe(0)
    expect(result.current.processed).toBe(0)
    expect(mockHeadCount).not.toHaveBeenCalled()
  })

  it('is a no-op when userId is empty', async () => {
    const { result } = renderHook(() => useDownloadProgress('', true))
    await new Promise((r) => setTimeout(r, 700))
    expect(mockHeadCount).not.toHaveBeenCalled()
    expect(result.current.total).toBe(0)
  })

  it('surfaces error=true when ALL HEAD queries fail', async () => {
    mockHeadCount.mockResolvedValue({ count: null, error: { message: 'boom' } })
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { result } = renderHook(() => useDownloadProgress(USER, true))
    await waitFor(
      () => {
        expect(result.current.error).toBe(true)
      },
      { timeout: 2000 },
    )
    expect(result.current.errorMessage).toContain('Could not determine remote totals')
    expect(result.current.totalsFailedCount).toBe(result.current.totalTables)
    expect(result.current.totalTables).toBeGreaterThan(0)
    errSpy.mockRestore()
  })

  it('gracefully degrades when SOME HEAD queries fail (PARTIAL)', async () => {
    // Fail a few tables; the rest return small counts
    mockHeadCount.mockImplementation((tableName: string) => {
      if (tableName === 'notes') return Promise.resolve({ count: 2, error: null })
      if (tableName.startsWith('audio')) {
        return Promise.resolve({ count: null, error: { message: 'partial' } })
      }
      return Promise.resolve({ count: 0, error: null })
    })
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const { result } = renderHook(() => useDownloadProgress(USER, true))
    await waitFor(
      () => {
        expect(result.current.total).toBe(2)
      },
      { timeout: 2000 },
    )
    expect(result.current.error).toBe(false)
    expect(result.current.totalsFailedCount).toBeGreaterThan(0)
    expect(result.current.totalsFailedCount).toBeLessThan(result.current.totalTables)
    expect(warnSpy).toHaveBeenCalledWith(
      '[useDownloadProgress] HEAD count failed for tables:',
      expect.any(Array),
    )
    warnSpy.mockRestore()
  })

  it('clears the interval on unmount', async () => {
    mockHeadCount.mockResolvedValue({ count: 1, error: null })
    const spy = vi.spyOn(window, 'clearInterval')
    const { unmount } = renderHook(() => useDownloadProgress(USER, true))
    await waitFor(() => expect(mockHeadCount).toHaveBeenCalled())
    act(() => unmount())
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('countedTables matches tableRegistry.filter(!skipSync && !uploadOnly)', () => {
    const counted = getCountedTables()
    expect(counted.length).toBeGreaterThan(20) // Sanity — we have ~37 tables
    // embeddings is uploadOnly — must be excluded
    expect(counted.find((e) => e.dexieTable === 'embeddings')).toBeUndefined()
  })

  it('retry (incrementing retryNonce) re-runs the snapshot and clears error state', async () => {
    // First render: ALL HEAD queries fail → error=true.
    mockHeadCount.mockResolvedValue({ count: null, error: { message: 'fail' } })
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    let retryNonce = 0
    const { result, rerender } = renderHook(() =>
      useDownloadProgress(USER, true, retryNonce),
    )

    await waitFor(
      () => {
        expect(result.current.error).toBe(true)
      },
      { timeout: 2000 },
    )

    // Now fix the mock so HEAD queries succeed.
    mockHeadCount.mockResolvedValue({ count: 5, error: null })

    // Simulate retry by incrementing retryNonce.
    retryNonce = 1
    rerender()

    await waitFor(
      () => {
        expect(result.current.error).toBe(false)
      },
      { timeout: 2000 },
    )
    // Should have re-snapshotted with new totals from the fixed mock.
    await waitFor(
      () => {
        expect(result.current.total).toBeGreaterThan(0)
      },
      { timeout: 2000 },
    )

    errSpy.mockRestore()
  })
})
