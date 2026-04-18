// E92-S07: Tests for useSyncLifecycle hook
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// ---------------------------------------------------------------------------
// Mocks — vi.hoisted() ensures variables are available in vi.mock() factories
// (which are hoisted to top-of-file by Vitest's transform).
// ---------------------------------------------------------------------------

const {
  mockFullSync,
  mockNudge,
  mockRegisterStoreRefresh,
  mockSetStatus,
  mockMarkSyncComplete,
  mockRefreshPendingCount,
  mockLoadSessionStats,
} = vi.hoisted(() => ({
  mockFullSync: vi.fn().mockResolvedValue(undefined),
  mockNudge: vi.fn(),
  mockRegisterStoreRefresh: vi.fn(),
  mockSetStatus: vi.fn(),
  mockMarkSyncComplete: vi.fn(),
  mockRefreshPendingCount: vi.fn(),
  mockLoadSessionStats: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/sync/syncEngine', () => ({
  syncEngine: {
    fullSync: mockFullSync,
    nudge: mockNudge,
    registerStoreRefresh: mockRegisterStoreRefresh,
  },
}))

vi.mock('@/app/stores/useSyncStatusStore', () => ({
  useSyncStatusStore: {
    getState: vi.fn(() => ({
      setStatus: mockSetStatus,
      markSyncComplete: mockMarkSyncComplete,
      refreshPendingCount: mockRefreshPendingCount,
    })),
  },
}))

vi.mock('@/stores/useSessionStore', () => ({
  useSessionStore: {
    getState: vi.fn(() => ({
      loadSessionStats: mockLoadSessionStats,
    })),
  },
}))

// Import after mocks
import { useSyncLifecycle } from '../useSyncLifecycle'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { value, configurable: true })
}

function setVisibilityState(value: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { value, configurable: true })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useSyncLifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    setOnline(true)
    setVisibilityState('visible')
    mockFullSync.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  // -------------------------------------------------------------------------
  // AC1: fullSync called on mount
  // -------------------------------------------------------------------------

  it('calls syncEngine.fullSync exactly once on mount', async () => {
    await act(async () => {
      renderHook(() => useSyncLifecycle())
    })

    expect(mockFullSync).toHaveBeenCalledTimes(1)
  })

  it('sets status to syncing before mount fullSync, then marks complete on success', async () => {
    await act(async () => {
      renderHook(() => useSyncLifecycle())
    })

    expect(mockSetStatus).toHaveBeenCalledWith('syncing')
    expect(mockMarkSyncComplete).toHaveBeenCalledTimes(1)
  })

  it('sets status to error when mount fullSync rejects', async () => {
    mockFullSync.mockRejectedValueOnce(new Error('network error'))

    await act(async () => {
      renderHook(() => useSyncLifecycle())
    })

    expect(mockSetStatus).toHaveBeenCalledWith('error')
    expect(mockMarkSyncComplete).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // AC2: 30s timer nudge
  // -------------------------------------------------------------------------

  it('calls syncEngine.nudge after 30 seconds when online', async () => {
    await act(async () => {
      renderHook(() => useSyncLifecycle())
    })

    mockNudge.mockClear()

    act(() => {
      vi.advanceTimersByTime(30_000)
    })

    expect(mockNudge).toHaveBeenCalledTimes(1)
  })

  it('does NOT call syncEngine.nudge after 30 seconds when offline', async () => {
    setOnline(false)

    await act(async () => {
      renderHook(() => useSyncLifecycle())
    })

    mockNudge.mockClear()

    act(() => {
      vi.advanceTimersByTime(30_000)
    })

    expect(mockNudge).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // AC3: visibilitychange nudge
  // -------------------------------------------------------------------------

  it('calls syncEngine.nudge on visibilitychange to visible when online', async () => {
    await act(async () => {
      renderHook(() => useSyncLifecycle())
    })

    mockNudge.mockClear()
    setVisibilityState('visible')

    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })

    expect(mockNudge).toHaveBeenCalledTimes(1)
  })

  it('does NOT call syncEngine.nudge on visibilitychange when hidden', async () => {
    setVisibilityState('hidden')

    await act(async () => {
      renderHook(() => useSyncLifecycle())
    })

    mockNudge.mockClear()

    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })

    expect(mockNudge).not.toHaveBeenCalled()
  })

  it('does NOT call syncEngine.nudge on visibilitychange to visible when offline', async () => {
    setOnline(false)

    await act(async () => {
      renderHook(() => useSyncLifecycle())
    })

    mockNudge.mockClear()
    setVisibilityState('visible')

    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })

    expect(mockNudge).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // AC4: offline event
  // -------------------------------------------------------------------------

  it('sets status to offline on window offline event', async () => {
    await act(async () => {
      renderHook(() => useSyncLifecycle())
    })

    mockSetStatus.mockClear()

    act(() => {
      window.dispatchEvent(new Event('offline'))
    })

    expect(mockSetStatus).toHaveBeenCalledWith('offline')
  })

  // -------------------------------------------------------------------------
  // AC5: online event
  // -------------------------------------------------------------------------

  it('calls syncEngine.fullSync on window online event', async () => {
    await act(async () => {
      renderHook(() => useSyncLifecycle())
    })

    mockFullSync.mockClear()

    await act(async () => {
      window.dispatchEvent(new Event('online'))
    })

    expect(mockFullSync).toHaveBeenCalledTimes(1)
  })

  // -------------------------------------------------------------------------
  // AC10: registerStoreRefresh called before first fullSync
  // -------------------------------------------------------------------------

  it('registers studySessions store refresh before calling fullSync', async () => {
    const callOrder: string[] = []
    mockRegisterStoreRefresh.mockImplementation(() => {
      callOrder.push('registerStoreRefresh')
    })
    mockFullSync.mockImplementation(async () => {
      callOrder.push('fullSync')
    })

    await act(async () => {
      renderHook(() => useSyncLifecycle())
    })

    const registerIndex = callOrder.indexOf('registerStoreRefresh')
    const fullSyncIndex = callOrder.indexOf('fullSync')
    expect(registerIndex).toBeGreaterThanOrEqual(0)
    expect(fullSyncIndex).toBeGreaterThanOrEqual(0)
    expect(registerIndex).toBeLessThan(fullSyncIndex)
  })

  it('registers store refresh with dexie table name studySessions', async () => {
    await act(async () => {
      renderHook(() => useSyncLifecycle())
    })

    expect(mockRegisterStoreRefresh).toHaveBeenCalledWith(
      'studySessions',
      expect.any(Function)
    )
  })

  // -------------------------------------------------------------------------
  // Cleanup: all listeners removed and interval cleared on unmount
  // -------------------------------------------------------------------------

  it('removes all event listeners and clears interval on unmount', async () => {
    const removeWindowSpy = vi.spyOn(window, 'removeEventListener')
    const removeDocSpy = vi.spyOn(document, 'removeEventListener')

    let unmount: () => void
    await act(async () => {
      const result = renderHook(() => useSyncLifecycle())
      unmount = result.unmount
    })

    act(() => {
      unmount()
    })

    // 3 window listeners: online, offline, beforeunload
    expect(removeWindowSpy).toHaveBeenCalledWith('online', expect.any(Function))
    expect(removeWindowSpy).toHaveBeenCalledWith('offline', expect.any(Function))
    expect(removeWindowSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function))

    // 1 document listener: visibilitychange
    expect(removeDocSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function))
  })
})
