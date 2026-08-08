import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { InitialUploadProgress } from '@/lib/sync/syncCoordinator'

let state: InitialUploadProgress
let listener: (() => void) | null = null
const mockUnsubscribe = vi.fn()

vi.mock('@/lib/sync/syncCoordinator', () => ({
  syncCoordinator: {
    getInitialUploadProgress: () => state,
    subscribeInitialUpload: (next: () => void) => {
      listener = next
      return mockUnsubscribe
    },
  },
}))

import { useInitialUploadProgress } from '../useInitialUploadProgress'

function progress(overrides: Partial<InitialUploadProgress> = {}): InitialUploadProgress {
  return {
    phase: 'original',
    processed: 0,
    total: 63,
    recentTable: 'importedVideos',
    done: false,
    error: null,
    additionalPendingCount: 0,
    failures: [],
    ...overrides,
  }
}

describe('useInitialUploadProgress', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listener = null
    state = progress()
  })

  it('exposes coordinator snapshots without deriving progress from queue depth', () => {
    const { result } = renderHook(() => useInitialUploadProgress('user-1', true))
    expect(result.current).toMatchObject({ phase: 'original', processed: 0, total: 63 })

    act(() => {
      state = progress({ processed: 32 })
      listener?.()
    })
    expect(result.current.processed).toBe(32)

    // Later writes belong to the next phase; they cannot turn 32/63 back into
    // a smaller original value.
    act(() => {
      state = progress({ phase: 'additional', processed: 0, total: 31, additionalPendingCount: 31 })
      listener?.()
    })
    expect(result.current).toMatchObject({ phase: 'additional', processed: 0, total: 31 })
  })

  it('does not subscribe while disabled and unsubscribes on unmount', () => {
    const { result, rerender, unmount } = renderHook(
      ({ enabled }) => useInitialUploadProgress('user-1', enabled),
      { initialProps: { enabled: false } }
    )
    expect(result.current.phase).toBe('original')
    expect(listener).toBeNull()

    rerender({ enabled: true })
    expect(listener).not.toBeNull()
    unmount()
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1)
  })
})
