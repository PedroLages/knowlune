// E43-S04: Tests for useAuthLifecycle hook
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Mocks — must be declared before any imports that reference them
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
    },
  },
}))

vi.mock('@/lib/settings', () => ({
  hydrateSettingsFromSupabase: vi.fn(),
}))

// Import after mocks
import { useAuthLifecycle } from '../useAuthLifecycle'
import { useAuthStore } from '@/stores/useAuthStore'

const makeSession = (userId = 'user-1'): Session =>
  ({
    user: { id: userId, user_metadata: {} },
    access_token: 'token',
    refresh_token: 'refresh',
  }) as unknown as Session

describe('useAuthLifecycle', () => {
  beforeEach(() => {
    authChangeCallback = null
    mockUnsubscribe.mockClear()
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

  it('sets sessionExpired on system-initiated SIGNED_OUT', () => {
    renderHook(() => useAuthLifecycle())
    expect(authChangeCallback).toBeTruthy()

    // Simulate system-initiated sign-out (no _userInitiatedSignOut flag)
    authChangeCallback!('SIGNED_OUT', null)

    expect(useAuthStore.getState().sessionExpired).toBe(true)
  })

  it('does NOT set sessionExpired on user-initiated SIGNED_OUT', () => {
    // Set the flag that signOut() action would set
    useAuthStore.setState({ _userInitiatedSignOut: true })

    renderHook(() => useAuthLifecycle())
    authChangeCallback!('SIGNED_OUT', null)

    expect(useAuthStore.getState().sessionExpired).toBe(false)
    // Flag should be cleared after consumption
    expect(useAuthStore.getState()._userInitiatedSignOut).toBe(false)
  })

  it('TOKEN_REFRESHED produces no state changes beyond session update', () => {
    renderHook(() => useAuthLifecycle())

    const session = makeSession()
    authChangeCallback!('TOKEN_REFRESHED', session)

    const state = useAuthStore.getState()
    // Session should be updated
    expect(state.session).toBe(session)
    expect(state.user).toBe(session.user)
    // No sessionExpired change
    expect(state.sessionExpired).toBe(false)
    // No _userInitiatedSignOut change
    expect(state._userInitiatedSignOut).toBe(false)
  })

  it('clears sessionExpired on SIGNED_IN', () => {
    useAuthStore.setState({ sessionExpired: true })

    renderHook(() => useAuthLifecycle())
    authChangeCallback!('SIGNED_IN', makeSession())

    expect(useAuthStore.getState().sessionExpired).toBe(false)
  })

  it('clears sessionExpired on INITIAL_SESSION', () => {
    useAuthStore.setState({ sessionExpired: true })

    renderHook(() => useAuthLifecycle())
    authChangeCallback!('INITIAL_SESSION', makeSession())

    expect(useAuthStore.getState().sessionExpired).toBe(false)
  })

  it('unsubscribes on unmount', () => {
    const { unmount } = renderHook(() => useAuthLifecycle())
    unmount()
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1)
  })
})
