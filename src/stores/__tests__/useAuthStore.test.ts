import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Mock supabase module
const mockSignUp = vi.fn()
const mockSignInWithPassword = vi.fn()
const mockSignInWithOtp = vi.fn()
const mockSignInWithOAuth = vi.fn()
const mockSignOut = vi.fn()

vi.mock('@/lib/auth/supabase', () => ({
  supabase: {
    auth: {
      signUp: (...args: unknown[]) => mockSignUp(...args),
      signInWithPassword: (...args: unknown[]) => mockSignInWithPassword(...args),
      signInWithOtp: (...args: unknown[]) => mockSignInWithOtp(...args),
      signInWithOAuth: (...args: unknown[]) => mockSignInWithOAuth(...args),
      signOut: (...args: unknown[]) => mockSignOut(...args),
    },
  },
}))

import { useAuthStore, mapSupabaseError, NETWORK_ERROR_MESSAGE, selectIsGuestMode, selectAuthState } from '@/stores/useAuthStore'

beforeEach(() => {
  vi.clearAllMocks()
  useAuthStore.setState({
    user: null,
    session: null,
    initialized: false,
  })
})

describe('mapSupabaseError', () => {
  it('maps "User already registered"', () => {
    expect(mapSupabaseError('User already registered')).toBe(
      'This email is already registered. Try signing in instead.'
    )
  })

  it('maps "Invalid login credentials"', () => {
    expect(mapSupabaseError('Invalid login credentials')).toBe(
      'Invalid email or password. Please try again.'
    )
  })

  it('maps "Email not confirmed"', () => {
    expect(mapSupabaseError('Email not confirmed')).toBe(
      'Please check your email and confirm your account before signing in.'
    )
  })

  it('maps "Token has expired"', () => {
    expect(mapSupabaseError('Token has expired or already used')).toBe(
      'This link has expired or was already used. Please request a new one.'
    )
  })

  it('maps "Failed to fetch" network error', () => {
    expect(mapSupabaseError('Failed to fetch')).toBe(NETWORK_ERROR_MESSAGE)
  })

  it('maps "NetworkError"', () => {
    expect(mapSupabaseError('NetworkError occurred')).toBe(NETWORK_ERROR_MESSAGE)
  })

  it('maps "network request failed"', () => {
    expect(mapSupabaseError('network request failed')).toBe(NETWORK_ERROR_MESSAGE)
  })

  it('maps "Network request failed" (capital N)', () => {
    expect(mapSupabaseError('Network request failed')).toBe(NETWORK_ERROR_MESSAGE)
  })

  it('returns original message for unknown errors', () => {
    expect(mapSupabaseError('Something else went wrong')).toBe('Something else went wrong')
  })

  it('maps rate-limit errors to a friendly retry message', () => {
    expect(mapSupabaseError('Too many requests')).toBe(
      'Too many attempts. Please wait a minute and try again.'
    )
    expect(mapSupabaseError('email rate limit exceeded')).toBe(
      'Too many attempts. Please wait a minute and try again.'
    )
  })

  it('maps "Signups not allowed" to a clear message', () => {
    expect(mapSupabaseError('Signups not allowed for this instance')).toBe(
      'New sign-ups are currently disabled. Please contact support.'
    )
  })
})

describe('setSession', () => {
  it('sets session and user', () => {
    const mockSession = {
      user: { id: 'user-1', email: 'test@test.com' },
      access_token: 'token',
    }
    useAuthStore.getState().setSession(mockSession as never)

    const state = useAuthStore.getState()
    expect(state.session).toBe(mockSession)
    expect(state.user).toEqual(mockSession.user)
    expect(state.initialized).toBe(true)
  })

  it('clears user when session is null', () => {
    useAuthStore.setState({
      user: { id: 'u1' } as never,
      session: { access_token: 'x' } as never,
    })

    useAuthStore.getState().setSession(null)

    expect(useAuthStore.getState().user).toBeNull()
    expect(useAuthStore.getState().session).toBeNull()
    expect(useAuthStore.getState().initialized).toBe(true)
  })
})

describe('signUp', () => {
  it('returns success on successful sign up', async () => {
    mockSignUp.mockResolvedValue({ error: null })
    const result = await useAuthStore.getState().signUp('test@test.com', 'password123')
    expect(result).toEqual({})
    expect(mockSignUp).toHaveBeenCalledWith({ email: 'test@test.com', password: 'password123' })
  })

  it('returns mapped error on supabase error', async () => {
    mockSignUp.mockResolvedValue({ error: { message: 'User already registered' } })
    const result = await useAuthStore.getState().signUp('test@test.com', 'pw')
    expect(result.error).toBe('This email is already registered. Try signing in instead.')
  })

  it('returns network error when exception is a real fetch failure', async () => {
    mockSignUp.mockRejectedValue(new TypeError('Failed to fetch'))
    const result = await useAuthStore.getState().signUp('test@test.com', 'pw')
    expect(result.error).toBe(NETWORK_ERROR_MESSAGE)
  })

  it('surfaces real error message when exception is not a network failure', async () => {
    mockSignUp.mockRejectedValue(new Error('Password too weak'))
    const result = await useAuthStore.getState().signUp('test@test.com', 'pw')
    expect(result.error).toBe('Password too weak')
  })
})

describe('signIn', () => {
  it('returns success on successful sign in', async () => {
    mockSignInWithPassword.mockResolvedValue({ error: null })
    const result = await useAuthStore.getState().signIn('test@test.com', 'pw')
    expect(result).toEqual({})
  })

  it('returns mapped error on supabase error', async () => {
    mockSignInWithPassword.mockResolvedValue({ error: { message: 'Invalid login credentials' } })
    const result = await useAuthStore.getState().signIn('test@test.com', 'wrong')
    expect(result.error).toBe('Invalid email or password. Please try again.')
  })

  it('returns network error when exception is a real fetch failure', async () => {
    mockSignInWithPassword.mockRejectedValue(new TypeError('Failed to fetch'))
    const result = await useAuthStore.getState().signIn('test@test.com', 'pw')
    expect(result.error).toBe(NETWORK_ERROR_MESSAGE)
  })

  it('surfaces real error message when exception is not a network failure', async () => {
    mockSignInWithPassword.mockRejectedValue(new Error('Unexpected server response'))
    const result = await useAuthStore.getState().signIn('test@test.com', 'pw')
    expect(result.error).toBe('Unexpected server response')
  })
})

describe('signInWithMagicLink', () => {
  it('returns success', async () => {
    mockSignInWithOtp.mockResolvedValue({ error: null })
    const result = await useAuthStore.getState().signInWithMagicLink('test@test.com')
    expect(result).toEqual({})
  })

  it('returns mapped error', async () => {
    mockSignInWithOtp.mockResolvedValue({ error: { message: 'Token has expired' } })
    const result = await useAuthStore.getState().signInWithMagicLink('test@test.com')
    expect(result.error).toContain('expired')
  })

  it('returns network error when exception is a real fetch failure', async () => {
    mockSignInWithOtp.mockRejectedValue(new TypeError('Failed to fetch'))
    const result = await useAuthStore.getState().signInWithMagicLink('test@test.com')
    expect(result.error).toBe(NETWORK_ERROR_MESSAGE)
  })

  it('surfaces real supabase error instead of masking as network error', async () => {
    mockSignInWithOtp.mockResolvedValue({
      error: { message: 'Too many requests, please try again later' },
    })
    const result = await useAuthStore.getState().signInWithMagicLink('test@test.com')
    expect(result.error).toBe('Too many attempts. Please wait a minute and try again.')
  })

  it('passes redirectTo callback URL to signInWithOtp', async () => {
    mockSignInWithOtp.mockResolvedValue({ error: null })
    await useAuthStore.getState().signInWithMagicLink('test@test.com')
    expect(mockSignInWithOtp).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'test@test.com',
        options: expect.objectContaining({
          emailRedirectTo: expect.stringContaining('/auth/callback'),
        }),
      })
    )
  })
})

describe('signInWithGoogle', () => {
  it('returns success on OAuth redirect', async () => {
    mockSignInWithOAuth.mockResolvedValue({ error: null })
    const result = await useAuthStore.getState().signInWithGoogle()
    expect(result).toEqual({})
  })

  it('returns mapped error', async () => {
    mockSignInWithOAuth.mockResolvedValue({ error: { message: 'Some OAuth error' } })
    const result = await useAuthStore.getState().signInWithGoogle()
    expect(result.error).toBe('Some OAuth error')
  })

  it('returns network error when exception is a real fetch failure', async () => {
    mockSignInWithOAuth.mockRejectedValue(new TypeError('Failed to fetch'))
    const result = await useAuthStore.getState().signInWithGoogle()
    expect(result.error).toBe(NETWORK_ERROR_MESSAGE)
  })

  it('passes /auth/callback as redirectTo to Supabase', async () => {
    mockSignInWithOAuth.mockResolvedValue({ error: null })
    await useAuthStore.getState().signInWithGoogle()
    expect(mockSignInWithOAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'google',
        options: expect.objectContaining({
          redirectTo: expect.stringContaining('/auth/callback'),
        }),
      })
    )
  })
})

describe('signOut', () => {
  it('clears user and session on success', async () => {
    useAuthStore.setState({
      user: { id: 'u1' } as never,
      session: { access_token: 'x' } as never,
    })

    mockSignOut.mockResolvedValue({ error: null })
    const result = await useAuthStore.getState().signOut()

    expect(result).toEqual({})
    expect(useAuthStore.getState().user).toBeNull()
    expect(useAuthStore.getState().session).toBeNull()
  })

  it('returns error on supabase error', async () => {
    mockSignOut.mockResolvedValue({ error: { message: 'Session expired' } })
    const result = await useAuthStore.getState().signOut()
    expect(result.error).toBe('Session expired')
  })

  it('returns network error when exception is a real fetch failure', async () => {
    mockSignOut.mockRejectedValue(new TypeError('Failed to fetch'))
    const result = await useAuthStore.getState().signOut()
    expect(result.error).toBe(NETWORK_ERROR_MESSAGE)
  })
})

describe('selectIsGuestMode', () => {
  afterEach(() => {
    sessionStorage.clear()
  })

  it('returns true when initialized, no user, and sessionStorage flag set', () => {
    sessionStorage.setItem('knowlune-guest', 'true')
    expect(selectIsGuestMode({ initialized: true, user: null })).toBe(true)
  })

  it('returns false when not initialized (prevents flash on reload)', () => {
    sessionStorage.setItem('knowlune-guest', 'true')
    expect(selectIsGuestMode({ initialized: false, user: null })).toBe(false)
  })

  it('returns false when user is present (even if sessionStorage flag exists)', () => {
    sessionStorage.setItem('knowlune-guest', 'true')
    expect(selectIsGuestMode({ initialized: true, user: { id: 'user-1' } as never })).toBe(false)
  })

  it('returns false when sessionStorage flag is absent', () => {
    expect(selectIsGuestMode({ initialized: true, user: null })).toBe(false)
  })
})

describe('selectAuthState', () => {
  afterEach(() => {
    sessionStorage.clear()
  })

  it('returns "loading" when not initialized', () => {
    expect(selectAuthState({ initialized: false, user: null })).toBe('loading')
  })

  it('returns "authenticated" when user is present', () => {
    expect(selectAuthState({ initialized: true, user: { id: 'user-1' } as never })).toBe('authenticated')
  })

  it('returns "guest" when initialized, no user, and guest flag set', () => {
    sessionStorage.setItem('knowlune-guest', 'true')
    expect(selectAuthState({ initialized: true, user: null })).toBe('guest')
  })

  it('returns "anonymous" when initialized, no user, and no guest flag', () => {
    expect(selectAuthState({ initialized: true, user: null })).toBe('anonymous')
  })
})

describe('supabase not configured', () => {
  it('returns not configured error when supabase is null', async () => {
    // Re-import with null supabase
    vi.doMock('@/lib/auth/supabase', () => ({ supabase: null }))
    vi.resetModules()
    const { useAuthStore: freshStore } = await import('@/stores/useAuthStore')

    const signUpResult = await freshStore.getState().signUp('test@test.com', 'pw')
    expect(signUpResult.error).toContain('not configured')

    const signInResult = await freshStore.getState().signIn('test@test.com', 'pw')
    expect(signInResult.error).toContain('not configured')

    const magicResult = await freshStore.getState().signInWithMagicLink('test@test.com')
    expect(magicResult.error).toContain('not configured')

    const googleResult = await freshStore.getState().signInWithGoogle()
    expect(googleResult.error).toContain('not configured')

    const signOutResult = await freshStore.getState().signOut()
    expect(signOutResult.error).toContain('not configured')
  })
})
