// E43-S04 / E92-S08: Tests for useAuthLifecycle hook
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Mocks — must be declared before any imports that reference them
// ---------------------------------------------------------------------------

let authChangeCallback: ((event: AuthChangeEvent, session: Session | null) => void) | null = null
const mockUnsubscribe = vi.fn()
const mockGetSession = vi.hoisted(() => vi.fn())

vi.mock('@/lib/auth/supabase', () => ({
  supabase: {
    auth: {
      onAuthStateChange: vi.fn((cb: (event: AuthChangeEvent, session: Session | null) => void) => {
        authChangeCallback = cb
        return { data: { subscription: { unsubscribe: mockUnsubscribe } } }
      }),
      getSession: mockGetSession,
    },
  },
}))

vi.mock('@/lib/settings', () => ({
  hydrateSettingsFromSupabase: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/sync/observedHydrate', () => ({
  observedHydrate: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/credentials/migrateCredentialsToVault', () => ({
  runCredentialsToVaultMigration: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/sync/backfill', () => ({
  backfillUserId: vi
    .fn()
    .mockResolvedValue({ tablesProcessed: 0, recordsStamped: 0, tablesFailed: [] }),
  SYNCABLE_TABLES: ['notes', 'books'],
}))

vi.mock('@/lib/sync/syncCoordinator', () => ({
  syncCoordinator: {
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn(),
  },
}))

vi.mock('@/lib/sync/repairAccountData', () => ({
  repairAccountData: vi.fn().mockResolvedValue({ repaired: 0, failed: 0, skipped: false }),
  markAccountRepairComplete: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/sync/clearSyncState', () => ({
  clearSyncState: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/sync/hasUnlinkedRecords', () => ({
  // Default: no unlinked records — tests override as needed
  hasUnlinkedRecords: vi.fn().mockResolvedValue(false),
}))

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------
import { useAuthLifecycle } from '../useAuthLifecycle'
import { useAuthStore } from '@/stores/useAuthStore'
import { syncCoordinator } from '@/lib/sync/syncCoordinator'
import { clearSyncState } from '@/lib/sync/clearSyncState'
import { hasUnlinkedRecords } from '@/lib/sync/hasUnlinkedRecords'
import { backfillUserId } from '@/lib/sync/backfill'
import { repairAccountData } from '@/lib/sync/repairAccountData'

const makeSession = (userId = 'user-1'): Session =>
  ({
    user: { id: userId, user_metadata: {} },
    access_token: 'token',
    refresh_token: 'refresh',
  }) as unknown as Session

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resetMocks() {
  mockGetSession.mockResolvedValue({ data: { session: null }, error: null })
  vi.mocked(hasUnlinkedRecords).mockResolvedValue(false)
  vi.mocked(backfillUserId).mockResolvedValue({
    tablesProcessed: 0,
    recordsStamped: 0,
    tablesFailed: [],
  })
  vi.mocked(syncCoordinator.start).mockResolvedValue({
    failedTables: [],
    deadLetterCount: 0,
    pendingCount: 0,
    tableFailures: [],
    assetFailures: [],
    completedAt: '2026-08-08T00:00:00.000Z',
    outcome: 'complete',
  })
  vi.mocked(syncCoordinator.stop).mockReturnValue(undefined)
  vi.mocked(clearSyncState).mockResolvedValue(undefined)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useAuthLifecycle', () => {
  beforeEach(() => {
    authChangeCallback = null
    mockUnsubscribe.mockClear()
    vi.clearAllMocks()
    resetMocks()
    localStorage.clear()
    sessionStorage.clear()
    // Reset auth store to defaults
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

  // ── Existing auth state tests (E43-S04) ────────────────────────────────────

  it('sets sessionExpired on system-initiated SIGNED_OUT', () => {
    renderHook(() => useAuthLifecycle())
    expect(authChangeCallback).toBeTruthy()

    // Simulate system-initiated sign-out (no _userInitiatedSignOut flag)
    act(() => {
      authChangeCallback!('SIGNED_OUT', null)
    })

    expect(useAuthStore.getState().sessionExpired).toBe(true)
  })

  it('does NOT set sessionExpired on user-initiated SIGNED_OUT', () => {
    // Set the flag that signOut() action would set
    useAuthStore.setState({ _userInitiatedSignOut: true })

    renderHook(() => useAuthLifecycle())
    act(() => {
      authChangeCallback!('SIGNED_OUT', null)
    })

    expect(useAuthStore.getState().sessionExpired).toBe(false)
    // Flag should be cleared after consumption
    expect(useAuthStore.getState()._userInitiatedSignOut).toBe(false)
  })

  it('TOKEN_REFRESHED produces no state changes beyond session update', () => {
    renderHook(() => useAuthLifecycle())

    const session = makeSession()
    act(() => {
      authChangeCallback!('TOKEN_REFRESHED', session)
    })

    const state = useAuthStore.getState()
    // Session should be updated
    expect(state.session).toBe(session)
    expect(state.user).toBe(session.user)
    // No sessionExpired change
    expect(state.sessionExpired).toBe(false)
    // No _userInitiatedSignOut change
    expect(state._userInitiatedSignOut).toBe(false)
  })

  it('clears sessionExpired on SIGNED_IN', async () => {
    useAuthStore.setState({ sessionExpired: true })

    renderHook(() => useAuthLifecycle())
    act(() => {
      authChangeCallback!('SIGNED_IN', makeSession())
    })

    expect(useAuthStore.getState().sessionExpired).toBe(false)
  })

  it('clears sessionExpired on INITIAL_SESSION', async () => {
    useAuthStore.setState({ sessionExpired: true })

    renderHook(() => useAuthLifecycle())
    act(() => {
      authChangeCallback!('INITIAL_SESSION', makeSession())
    })

    expect(useAuthStore.getState().sessionExpired).toBe(false)
  })

  it('unsubscribes on unmount', () => {
    const { unmount } = renderHook(() => useAuthLifecycle())
    unmount()
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1)
  })

  // ── E92-S08: sync lifecycle on SIGNED_OUT ──────────────────────────────────

  it('stops the coordinator on SIGNED_OUT', () => {
    renderHook(() => useAuthLifecycle())
    act(() => {
      authChangeCallback!('SIGNED_OUT', null)
    })
    expect(syncCoordinator.stop).toHaveBeenCalled()
  })

  it('calls clearSyncState on SIGNED_OUT', async () => {
    renderHook(() => useAuthLifecycle())
    act(() => {
      authChangeCallback!('SIGNED_OUT', null)
    })
    // clearSyncState is async — wait for it
    await vi.waitFor(() => expect(clearSyncState).toHaveBeenCalled())
  })

  // ── E92-S08: sync lifecycle on SIGNED_IN — no unlinked records ────────────

  it('starts the coordinator when no unlinked records exist', async () => {
    vi.mocked(hasUnlinkedRecords).mockResolvedValue(false)

    renderHook(() => useAuthLifecycle())
    act(() => {
      authChangeCallback!('SIGNED_IN', makeSession('user-1'))
    })

    await vi.waitFor(() => expect(syncCoordinator.start).toHaveBeenCalledWith('user-1'))
  })

  it('calls backfillUserId when no unlinked records exist', async () => {
    vi.mocked(hasUnlinkedRecords).mockResolvedValue(false)

    renderHook(() => useAuthLifecycle())
    act(() => {
      authChangeCallback!('SIGNED_IN', makeSession('user-1'))
    })

    await vi.waitFor(() => expect(backfillUserId).toHaveBeenCalledWith('user-1', null))
  })

  it('passes the guest session id to backfillUserId before clearing guest state', async () => {
    sessionStorage.setItem('knowlune-guest-id', 'guest-session-1')

    renderHook(() => useAuthLifecycle())
    act(() => {
      authChangeCallback!('SIGNED_IN', makeSession('user-1'))
    })

    await vi.waitFor(() => expect(backfillUserId).toHaveBeenCalledWith('user-1', 'guest-session-1'))
  })

  it('sets the localStorage linked flag when no unlinked records', async () => {
    vi.mocked(hasUnlinkedRecords).mockResolvedValue(false)

    renderHook(() => useAuthLifecycle())
    act(() => {
      authChangeCallback!('SIGNED_IN', makeSession('user-1'))
    })

    await vi.waitFor(() => {
      expect(localStorage.getItem('sync:linked:user-1')).toBe('true')
    })
  })

  it('prepares and starts sync once when INITIAL_SESSION and getSession report the same account', async () => {
    mockGetSession.mockResolvedValue({ data: { session: makeSession('user-1') }, error: null })
    renderHook(() => useAuthLifecycle())
    act(() => {
      authChangeCallback!('INITIAL_SESSION', makeSession('user-1'))
    })

    await vi.waitFor(() => expect(syncCoordinator.start).toHaveBeenCalledTimes(1))
    expect(repairAccountData).toHaveBeenCalledTimes(1)
  })

  // ── E92-S08: sync lifecycle on SIGNED_IN — unlinked records exist ──────────

  it('calls onUnlinkedDetected when unlinked records exist', async () => {
    vi.mocked(hasUnlinkedRecords).mockResolvedValue(true)
    const onUnlinkedDetected = vi.fn()

    renderHook(() => useAuthLifecycle({ onUnlinkedDetected }))
    act(() => {
      authChangeCallback!('SIGNED_IN', makeSession('user-1'))
    })

    await vi.waitFor(() => expect(onUnlinkedDetected).toHaveBeenCalledWith('user-1'))
  })

  it('does NOT start the coordinator when unlinked records exist (deferred to dialog)', async () => {
    vi.mocked(hasUnlinkedRecords).mockResolvedValue(true)
    const onUnlinkedDetected = vi.fn()

    renderHook(() => useAuthLifecycle({ onUnlinkedDetected }))
    act(() => {
      authChangeCallback!('SIGNED_IN', makeSession('user-1'))
    })

    await vi.waitFor(() => expect(onUnlinkedDetected).toHaveBeenCalled())
    expect(syncCoordinator.start).not.toHaveBeenCalled()
  })

  // ── E92-S08: fast-path for already-linked device ───────────────────────────

  it('skips hasUnlinkedRecords and starts sync immediately when linked flag is set', async () => {
    localStorage.setItem('sync:linked:user-1', 'true')

    renderHook(() => useAuthLifecycle())
    act(() => {
      authChangeCallback!('SIGNED_IN', makeSession('user-1'))
    })

    await vi.waitFor(() => expect(syncCoordinator.start).toHaveBeenCalledWith('user-1'))
    // hasUnlinkedRecords should NOT be called — fast path skips it
    expect(hasUnlinkedRecords).not.toHaveBeenCalled()
  })

  // ── E97-S03: dismissal flag cleanup on SIGNED_OUT ─────────────────────────

  it('clears the wizard dismissal flag on SIGNED_OUT but keeps the completion flag', () => {
    // Simulate a user who dismissed the wizard and also completed it at some
    // prior point on this device.
    useAuthStore.setState({
      user: { id: 'user-1' } as unknown as Session['user'],
      session: null,
    })
    localStorage.setItem('sync:wizard:dismissed:user-1', '2026-01-01T00:00:00.000Z')
    localStorage.setItem('sync:wizard:complete:user-1', '2026-01-01T00:00:00.000Z')

    renderHook(() => useAuthLifecycle())
    act(() => {
      authChangeCallback!('SIGNED_OUT', null)
    })

    expect(localStorage.getItem('sync:wizard:dismissed:user-1')).toBeNull()
    // Completion flag survives — it is permanent per device.
    expect(localStorage.getItem('sync:wizard:complete:user-1')).not.toBeNull()
  })

  it('tolerates SIGNED_OUT with no current user (no throw)', () => {
    useAuthStore.setState({ user: null, session: null })
    renderHook(() => useAuthLifecycle())
    expect(() => {
      act(() => {
        authChangeCallback!('SIGNED_OUT', null)
      })
    }).not.toThrow()
  })
})
