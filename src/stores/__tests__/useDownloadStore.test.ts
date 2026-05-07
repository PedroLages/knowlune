/**
 * Unit tests for useDownloadStore selector hooks.
 *
 * Covers useAllDownloadedBookIds reference stability (regression test for
 * infinite re-render loop caused by unstably cached getSnapshot result).
 *
 * @since 2026-05-07
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act } from 'react'
import type { PendingDownloadState } from '@/stores/useDownloadStore'

const now = '2026-05-07T12:00:00.000Z'

function makeEntry(overrides: Partial<PendingDownloadState> = {}): PendingDownloadState {
  return {
    id: crypto.randomUUID(),
    bookId: 'book-1',
    status: 'downloaded',
    progress: 100,
    totalSize: 1_000_000,
    retryCount: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

describe('useAllDownloadedBookIds', () => {
  let useAllDownloadedBookIds: (typeof import('@/stores/useDownloadStore'))['useAllDownloadedBookIds']
  let useDownloadStore: (typeof import('@/stores/useDownloadStore'))['useDownloadStore']

  beforeEach(async () => {
    vi.resetModules()
    const mod = await import('@/stores/useDownloadStore')
    useAllDownloadedBookIds = mod.useAllDownloadedBookIds
    useDownloadStore = mod.useDownloadStore

    // Reset to default state
    useDownloadStore.setState({ downloads: new Map(), hydrated: false })
  })

  it('returns an empty array when no downloads exist', async () => {
    const { renderHook } = await import('@testing-library/react')
    const { result } = renderHook(() => useAllDownloadedBookIds())
    expect(result.current).toEqual([])
  })

  it('returns only book IDs with "downloaded" status', async () => {
    const map = new Map<string, PendingDownloadState>([
      ['book-a', makeEntry({ bookId: 'book-a', status: 'downloaded' })],
      ['book-b', makeEntry({ bookId: 'book-b', status: 'downloading' })],
      ['book-c', makeEntry({ bookId: 'book-c', status: 'pending' })],
      ['book-d', makeEntry({ bookId: 'book-d', status: 'downloaded' })],
    ])
    act(() => useDownloadStore.setState({ downloads: map }))

    const { renderHook } = await import('@testing-library/react')
    const { result } = renderHook(() => useAllDownloadedBookIds())
    expect(result.current).toEqual(['book-a', 'book-d'])
  })

  it('returns a stable reference when the downloads Map has not changed', async () => {
    const map = new Map<string, PendingDownloadState>([
      ['book-a', makeEntry({ bookId: 'book-a', status: 'downloaded' })],
    ])
    act(() => useDownloadStore.setState({ downloads: map }))

    const { renderHook } = await import('@testing-library/react')
    const { result, rerender } = renderHook(() => useAllDownloadedBookIds())

    const firstRef = result.current

    // Rerender without changing the downloads Map
    rerender()

    expect(result.current).toBe(firstRef)
  })

  it('returns a new reference when a download is added', async () => {
    const map = new Map<string, PendingDownloadState>([
      ['book-a', makeEntry({ bookId: 'book-a', status: 'downloaded' })],
    ])
    act(() => useDownloadStore.setState({ downloads: map }))

    const { renderHook } = await import('@testing-library/react')
    const { result, rerender } = renderHook(() => useAllDownloadedBookIds())

    const firstRef = result.current

    // Add a new downloaded book via the store action (creates a new Map)
    act(() => {
      useDownloadStore.getState().setDownloadState('book-b', {
        bookId: 'book-b',
        status: 'downloaded',
      })
    })

    rerender()
    expect(result.current).not.toBe(firstRef)
    expect(result.current).toEqual(['book-a', 'book-b'])
  })

  it('returns a new reference when a download is removed', async () => {
    const map = new Map<string, PendingDownloadState>([
      ['book-a', makeEntry({ bookId: 'book-a', status: 'downloaded' })],
      ['book-b', makeEntry({ bookId: 'book-b', status: 'downloaded' })],
    ])
    act(() => useDownloadStore.setState({ downloads: map }))

    const { renderHook } = await import('@testing-library/react')
    const { result, rerender } = renderHook(() => useAllDownloadedBookIds())

    const firstRef = result.current
    expect(firstRef).toEqual(['book-a', 'book-b'])

    act(() => {
      useDownloadStore.getState().removeDownloadState('book-b')
    })

    rerender()
    expect(result.current).not.toBe(firstRef)
    expect(result.current).toEqual(['book-a'])
  })
})
