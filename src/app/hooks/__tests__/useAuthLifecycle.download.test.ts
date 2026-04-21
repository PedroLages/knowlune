/**
 * E97-S04 Unit 3: Tests for the download-lifecycle wiring in useAuthLifecycle.
 *
 * Covers the integration points:
 *   - `handleSignIn` invokes `observedHydrate` (not the raw hydrator directly)
 *   - SIGNED_OUT resets `useDownloadStatusStore` to idle
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Mocks — declared before imports so module-load order resolves them
// ---------------------------------------------------------------------------

let authChangeCallback: ((event: AuthChangeEvent, session: Session | null) => void) | null = null
const mockUnsubscribe = vi.fn()

vi.mock('@/lib/auth/supabase', () => ({
  supabase: {
    auth: {
      onAuthStateChange: vi.fn((cb: (event: AuthChangeEvent, session: Session | null) => void) => {
        authChangeCallback = cb
        return { data: { subscription: { unsubscribe: mockUnsubscribe } } }
      }),
      getSession: vi.fn(() => Promise.resolve({ data: { session: null }, error: null })),
    },
  },
}))

vi.mock('@/lib/settings', () => ({
  hydrateSettingsFromSupabase: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/sync/backfill', () => ({
  backfillUserId: vi
    .fn()
    .mockResolvedValue({ tablesProcessed: 0, recordsStamped: 0, tablesFailed: [] }),
  SYNCABLE_TABLES: ['notes', 'books'],
}))

vi.mock('@/lib/sync/syncEngine', () => ({
  syncEngine: {
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn(),
  },
}))

vi.mock('@/lib/sync/clearSyncState', () => ({
  clearSyncState: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/sync/hasUnlinkedRecords', () => ({
  hasUnlinkedRecords: vi.fn().mockResolvedValue(false),
}))

vi.mock('@/lib/credentials/migrateCredentialsToVault', () => ({
  runCredentialsToVaultMigration: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/credentials/cache', () => ({
  credentialCache: { clear: vi.fn() },
}))

// `observedHydrate` is the wrap point — we assert it is called instead of
// the raw hydrator.
const mockObservedHydrate = vi.fn().mockResolvedValue(undefined)
vi.mock('@/lib/sync/observedHydrate', () => ({
  observedHydrate: (...args: unknown[]) => mockObservedHydrate(...args),
}))

// Mock the download status store so we can assert `reset()` was called.
const mockReset = vi.fn()
const mockStartHydrating = vi.fn()
const mockStartDownloadingP0P2 = vi.fn()
const mockCompleteDownloading = vi.fn()
const mockFailDownloading = vi.fn()

vi.mock('@/app/stores/useDownloadStatusStore', () => ({
  useDownloadStatusStore: {
    getState: () => ({
      status: 'idle',
      lastError: null,
      startedAt: null,
      reset: mockReset,
      startHydrating: mockStartHydrating,
      startDownloadingP0P2: mockStartDownloadingP0P2,
      completeDownloading: mockCompleteDownloading,
      failDownloading: mockFailDownloading,
    }),
  },
}))

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------
import { useAuthLifecycle } from '../useAuthLifecycle'
import { useAuthStore } from '@/stores/useAuthStore'

const makeSession = (userId = 'user-1'): Session =>
  ({
    user: { id: userId, user_metadata: {} },
    access_token: 'token',
    refresh_token: 'refresh',
  }) as unknown as Session

beforeEach(() => {
  authChangeCallback = null
  mockUnsubscribe.mockClear()
  mockObservedHydrate.mockClear()
  mockObservedHydrate.mockResolvedValue(undefined)
  mockReset.mockClear()
  vi.clearAllMocks()
  localStorage.clear()
  useAuthStore.setState({
    user: null,
    session: null,
    initialized: false,
    sessionExpired: false,
    _userInitiatedSignOut: false,
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useAuthLifecycle — download lifecycle wiring (E97-S04)', () => {
  it('invokes observedHydrate on SIGNED_IN (not the raw hydrator)', async () => {
    renderHook(() => useAuthLifecycle())
    act(() => {
      authChangeCallback!('SIGNED_IN', makeSession('user-42'))
    })
    await vi.waitFor(() => expect(mockObservedHydrate).toHaveBeenCalledWith('user-42'))
  })

  it('invokes observedHydrate on INITIAL_SESSION', async () => {
    renderHook(() => useAuthLifecycle())
    act(() => {
      authChangeCallback!('INITIAL_SESSION', makeSession('user-99'))
    })
    await vi.waitFor(() => expect(mockObservedHydrate).toHaveBeenCalledWith('user-99'))
  })

  it('resets the download status store on SIGNED_OUT', () => {
    // Establish a signed-in user so the sign-out branch takes the normal path.
    useAuthStore.setState({
      user: { id: 'user-1', user_metadata: {} } as Session['user'],
    })
    renderHook(() => useAuthLifecycle())
    act(() => {
      authChangeCallback!('SIGNED_OUT', null)
    })
    expect(mockReset).toHaveBeenCalled()
  })

  it('swallows observedHydrate rejections (error is logged, flow continues)', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockObservedHydrate.mockRejectedValue(new Error('supabase 500'))
    renderHook(() => useAuthLifecycle())
    act(() => {
      authChangeCallback!('SIGNED_IN', makeSession('user-1'))
    })
    await vi.waitFor(() =>
      expect(errSpy).toHaveBeenCalledWith(
        '[useAuthLifecycle] hydrateP3P4FromSupabase failed:',
        expect.any(Error)
      )
    )
    errSpy.mockRestore()
  })
})
