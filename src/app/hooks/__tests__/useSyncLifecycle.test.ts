import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  request: vi.fn().mockResolvedValue(undefined),
  start: vi.fn().mockResolvedValue(undefined),
  stop: vi.fn(),
  registerStoreRefresh: vi.fn(),
  setStatus: vi.fn(),
  loadPersistedStatus: vi.fn(),
  loadSessionStats: vi.fn().mockResolvedValue(undefined),
  loadNotes: vi.fn().mockResolvedValue(undefined),
  loadBookmarks: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/sync/syncEngine', () => ({
  syncEngine: { registerStoreRefresh: mocks.registerStoreRefresh },
}))

vi.mock('@/lib/sync/syncCoordinator', () => ({
  syncCoordinator: {
    request: mocks.request,
    start: mocks.start,
    stop: mocks.stop,
  },
}))

vi.mock('@/app/stores/useSyncStatusStore', () => ({
  useSyncStatusStore: {
    getState: vi.fn(() => ({
      setStatus: mocks.setStatus,
      loadPersistedStatus: mocks.loadPersistedStatus,
    })),
  },
}))

vi.mock('@/stores/useSessionStore', () => ({
  useSessionStore: { getState: () => ({ loadSessionStats: mocks.loadSessionStats }) },
}))
vi.mock('@/stores/useNoteStore', () => ({
  useNoteStore: { getState: () => ({ loadNotes: mocks.loadNotes }) },
}))
vi.mock('@/stores/useBookmarkStore', () => ({
  useBookmarkStore: { getState: () => ({ loadBookmarks: mocks.loadBookmarks }) },
}))

import { useSyncLifecycle } from '../useSyncLifecycle'

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { value, configurable: true })
}

function setVisibilityState(value: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { value, configurable: true })
}

describe('useSyncLifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    setOnline(true)
    setVisibilityState('visible')
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('registers store refreshes without racing the account-scoped auth startup sync', async () => {
    await act(async () => {
      renderHook(() => useSyncLifecycle())
    })

    expect(mocks.registerStoreRefresh).toHaveBeenCalledWith('studySessions', expect.any(Function))
    expect(mocks.registerStoreRefresh).toHaveBeenCalledWith('importedCourses', expect.any(Function))
    expect(mocks.registerStoreRefresh).toHaveBeenCalledWith('learningPaths', expect.any(Function))
    expect(mocks.request).not.toHaveBeenCalled()
  })

  it('uses one coordinator request on the 30-second periodic trigger', async () => {
    await act(async () => {
      renderHook(() => useSyncLifecycle())
    })
    act(() => {
      vi.advanceTimersByTime(30_000)
    })
    expect(mocks.request).toHaveBeenCalledWith({ reason: 'periodic' })
  })

  it('does not request a periodic sync while offline', async () => {
    setOnline(false)
    await act(async () => {
      renderHook(() => useSyncLifecycle())
    })
    act(() => {
      vi.advanceTimersByTime(30_000)
    })
    expect(mocks.request).not.toHaveBeenCalled()
  })

  it('uses one coordinator request when the tab becomes visible', async () => {
    await act(async () => {
      renderHook(() => useSyncLifecycle())
    })
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(mocks.request).toHaveBeenCalledWith({ reason: 'focus' })
  })

  it('uses one coordinator request on reconnect and updates offline status', async () => {
    await act(async () => {
      renderHook(() => useSyncLifecycle())
    })
    act(() => {
      window.dispatchEvent(new Event('offline'))
    })
    expect(mocks.setStatus).toHaveBeenCalledWith('offline')

    act(() => {
      window.dispatchEvent(new Event('online'))
    })
    expect(mocks.request).toHaveBeenCalledWith({ reason: 'online' })
  })

  it('removes every listener and the interval on unmount', async () => {
    const removeWindowSpy = vi.spyOn(window, 'removeEventListener')
    const removeDocumentSpy = vi.spyOn(document, 'removeEventListener')
    const { unmount } = renderHook(() => useSyncLifecycle())

    act(unmount)

    expect(removeWindowSpy).toHaveBeenCalledWith('online', expect.any(Function))
    expect(removeWindowSpy).toHaveBeenCalledWith('offline', expect.any(Function))
    expect(removeWindowSpy).toHaveBeenCalledWith('settingsUpdated', expect.any(Function))
    expect(removeDocumentSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function))
  })
})
