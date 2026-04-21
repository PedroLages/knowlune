/**
 * Tests for useMissingCredentials hook — E97-S05 Unit 2.
 *
 * @since E97-S05
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// ── Mocks ──────────────────────────────────────────────────────────────────

const {
  mockUser,
  mockCatalogs,
  mockServers,
  mockLastSyncAt,
  mockAggregate,
  mockGetAIConfiguration,
} = vi.hoisted(() => ({
  mockUser: vi.fn<() => null | { id: string }>(() => null),
  mockCatalogs: vi.fn<() => unknown[]>(() => []),
  mockServers: vi.fn<() => unknown[]>(() => []),
  mockLastSyncAt: vi.fn<() => Date | null>(() => null),
  mockAggregate: vi.fn().mockResolvedValue({ missing: [], statusByKey: {} }),
  mockGetAIConfiguration: vi.fn().mockReturnValue({ provider: 'openai', providerKeys: {} }),
}))

vi.mock('@/stores/useAuthStore', () => ({
  useAuthStore: (selector: (s: { user: unknown }) => unknown) =>
    selector({ user: mockUser() }),
}))

vi.mock('@/stores/useOpdsCatalogStore', () => ({
  useOpdsCatalogStore: (selector: (s: { catalogs: unknown[] }) => unknown) =>
    selector({ catalogs: mockCatalogs() }),
}))

vi.mock('@/stores/useAudiobookshelfStore', () => ({
  useAudiobookshelfStore: (selector: (s: { servers: unknown[] }) => unknown) =>
    selector({ servers: mockServers() }),
}))

vi.mock('@/app/stores/useSyncStatusStore', () => ({
  useSyncStatusStore: (selector: (s: { lastSyncAt: Date | null }) => unknown) =>
    selector({ lastSyncAt: mockLastSyncAt() }),
}))

vi.mock('@/lib/credentials/credentialStatus', () => ({
  aggregateCredentialStatus: mockAggregate,
}))

vi.mock('@/lib/aiConfiguration', () => ({
  getAIConfiguration: mockGetAIConfiguration,
}))

import { useMissingCredentials } from '@/app/hooks/useMissingCredentials'

beforeEach(() => {
  vi.useFakeTimers()
  mockUser.mockReturnValue(null)
  mockCatalogs.mockReturnValue([])
  mockServers.mockReturnValue([])
  mockLastSyncAt.mockReturnValue(null)
  mockAggregate.mockResolvedValue({ missing: [], statusByKey: {} })
  mockGetAIConfiguration.mockReturnValue({ provider: 'openai', providerKeys: {} })
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => 'visible',
  })
})

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe('useMissingCredentials', () => {
  it('returns loading:true immediately, then missing + statusByKey after aggregator resolves', async () => {
    mockUser.mockReturnValue({ id: 'user-1' })
    mockLastSyncAt.mockReturnValue(new Date())
    const resolved = { missing: [{ kind: 'abs-server', id: 'srv-1', displayName: 'Home', status: 'missing' }], statusByKey: { 'abs-server:srv-1': 'missing' } }
    mockAggregate.mockResolvedValue(resolved)

    const { result } = renderHook(() => useMissingCredentials())

    // Initially loading
    expect(result.current.loading).toBe(true)

    // Let promise resolve
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(result.current.loading).toBe(false)
    expect(result.current.missing).toHaveLength(1)
  })

  it('unauthenticated user → returns empty, loading:false; no aggregator call', async () => {
    mockUser.mockReturnValue(null)
    mockLastSyncAt.mockReturnValue(new Date())

    const { result } = renderHook(() => useMissingCredentials())

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(result.current.loading).toBe(false)
    expect(result.current.missing).toHaveLength(0)
    expect(mockAggregate).not.toHaveBeenCalled()
  })

  it('lastSyncAt === null → loading:true persists', async () => {
    mockUser.mockReturnValue({ id: 'user-1' })
    mockLastSyncAt.mockReturnValue(null)

    const { result } = renderHook(() => useMissingCredentials())

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    // Should still be loading — no aggregate called
    expect(result.current.loading).toBe(true)
    expect(mockAggregate).not.toHaveBeenCalled()
  })

  it('dispatching ai-configuration-updated triggers re-aggregate', async () => {
    mockUser.mockReturnValue({ id: 'user-1' })
    mockLastSyncAt.mockReturnValue(new Date())
    mockAggregate.mockResolvedValue({ missing: [], statusByKey: {} })

    renderHook(() => useMissingCredentials())

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    const callsBefore = mockAggregate.mock.calls.length

    await act(async () => {
      window.dispatchEvent(new Event('ai-configuration-updated'))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(mockAggregate.mock.calls.length).toBeGreaterThan(callsBefore)
  })

  it('120s interval fires while visible → re-aggregate called', async () => {
    mockUser.mockReturnValue({ id: 'user-1' })
    mockLastSyncAt.mockReturnValue(new Date())
    mockAggregate.mockResolvedValue({ missing: [], statusByKey: {} })

    renderHook(() => useMissingCredentials())

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    const callsBefore = mockAggregate.mock.calls.length

    await act(async () => {
      vi.advanceTimersByTime(120_000)
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(mockAggregate.mock.calls.length).toBeGreaterThan(callsBefore)
  })

  it('visibility hidden: advancing 10 minutes does NOT call aggregator', async () => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    })

    mockUser.mockReturnValue({ id: 'user-1' })
    mockLastSyncAt.mockReturnValue(new Date())
    mockAggregate.mockResolvedValue({ missing: [], statusByKey: {} })

    renderHook(() => useMissingCredentials())

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    // User is unauthenticated check: in this test, user is set but tab is hidden
    // The initial aggregate may run (user is set + lastSyncAt set), but interval should not
    const callsAfterInit = mockAggregate.mock.calls.length

    await act(async () => {
      vi.advanceTimersByTime(10 * 60 * 1000)
      await Promise.resolve()
      await Promise.resolve()
    })

    // No additional interval calls while hidden
    expect(mockAggregate.mock.calls.length).toBe(callsAfterInit)
  })

  it('visibility resume: aggregator called once immediately + 120s cadence resumes', async () => {
    // Start hidden
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    })

    mockUser.mockReturnValue({ id: 'user-1' })
    mockLastSyncAt.mockReturnValue(new Date())
    mockAggregate.mockResolvedValue({ missing: [], statusByKey: {} })

    renderHook(() => useMissingCredentials())

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    const callsWhileHidden = mockAggregate.mock.calls.length

    // Transition to visible
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    })

    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
      await Promise.resolve()
      await Promise.resolve()
    })

    // One immediate call on visibility resume
    const callsAfterResume = mockAggregate.mock.calls.length
    expect(callsAfterResume).toBe(callsWhileHidden + 1)

    // Fresh 120s interval: advance 120s → one more call
    await act(async () => {
      vi.advanceTimersByTime(120_000)
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(mockAggregate.mock.calls.length).toBe(callsAfterResume + 1)
  })

  it('no interval stacking on rapid hidden→visible toggle', async () => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    })

    mockUser.mockReturnValue({ id: 'user-1' })
    mockLastSyncAt.mockReturnValue(new Date())
    mockAggregate.mockResolvedValue({ missing: [], statusByKey: {} })

    renderHook(() => useMissingCredentials())

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    // Toggle hidden → visible twice rapidly
    await act(async () => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' })
      document.dispatchEvent(new Event('visibilitychange'))
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' })
      document.dispatchEvent(new Event('visibilitychange'))
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' })
      document.dispatchEvent(new Event('visibilitychange'))
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' })
      document.dispatchEvent(new Event('visibilitychange'))
      await Promise.resolve()
      await Promise.resolve()
    })

    const callsBeforeAdvance = mockAggregate.mock.calls.length

    await act(async () => {
      vi.advanceTimersByTime(120_000)
      await Promise.resolve()
      await Promise.resolve()
    })

    // Exactly one additional call — no stacked intervals
    expect(mockAggregate.mock.calls.length).toBe(callsBeforeAdvance + 1)
  })

  it('cleanup: no callbacks execute after unmount', async () => {
    mockUser.mockReturnValue({ id: 'user-1' })
    mockLastSyncAt.mockReturnValue(new Date())
    mockAggregate.mockResolvedValue({ missing: [], statusByKey: {} })

    const { unmount } = renderHook(() => useMissingCredentials())

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    unmount()
    mockAggregate.mockClear()

    // Advance timers — no further calls
    await act(async () => {
      vi.advanceTimersByTime(120_000)
      await Promise.resolve()
    })

    expect(mockAggregate).not.toHaveBeenCalled()
  })
})
