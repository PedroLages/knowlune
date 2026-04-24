import { create } from 'zustand'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/auth/supabase'

interface AuthState {
  user: User | null
  session: Session | null
  /** True after first session check completes — prevents flash of unauthenticated state */
  initialized: boolean
  /** True when session expired due to system-initiated sign-out (not user action) */
  sessionExpired: boolean
  /** Internal flag: set true before calling supabase.auth.signOut() to distinguish user vs system sign-out */
  _userInitiatedSignOut: boolean
}

interface AuthActions {
  signUp: (email: string, password: string) => Promise<{ error?: string }>
  signIn: (email: string, password: string) => Promise<{ error?: string }>
  signInWithMagicLink: (email: string) => Promise<{ error?: string }>
  signInWithGoogle: () => Promise<{ error?: string }>
  signOut: () => Promise<{ error?: string }>
  /** Called by onAuthStateChange listener — do not call directly */
  setSession: (session: Session | null) => void
  /** Clear session expired state (e.g., after dismiss or re-auth) */
  clearSessionExpired: () => void
}

type AuthStore = AuthState & AuthActions

/** Matches the mapped network error message — used by auth form components to show Retry buttons */
export const NETWORK_ERROR_MESSAGE =
  'Unable to connect. Please check your internet connection and try again.'

const NOT_CONFIGURED_MESSAGE =
  'Authentication is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'

export function mapSupabaseError(message: string): string {
  if (message.includes('User already registered')) {
    return 'This email is already registered. Try signing in instead.'
  }
  if (message.includes('Invalid login credentials')) {
    return 'Invalid email or password. Please try again.'
  }
  if (message.includes('Email not confirmed')) {
    return 'Please check your email and confirm your account before signing in.'
  }
  if (message.includes('Token has expired') || message.includes('already used')) {
    return 'This link has expired or was already used. Please request a new one.'
  }
  if (message.includes('rate limit') || message.includes('Too many requests')) {
    return 'Too many attempts. Please wait a minute and try again.'
  }
  if (message.includes('Signups not allowed')) {
    return 'New sign-ups are currently disabled. Please contact support.'
  }
  if (
    message.includes('Failed to fetch') ||
    message.includes('NetworkError') ||
    message.includes('network request failed') ||
    message.includes('Network request failed')
  ) {
    return NETWORK_ERROR_MESSAGE
  }
  return message
}

/**
 * Handle an exception thrown from a supabase.auth.* call. Only collapses to the
 * generic network error message when the exception actually signals a network
 * failure (fetch rejection, DOMException). Everything else surfaces the real
 * message so real bugs aren't masked as "check your internet".
 */
function handleAuthException(err: unknown): { error: string } {
  if (import.meta.env.DEV) {
    console.error('[useAuthStore] supabase auth exception:', err)
  }
  const message = err instanceof Error ? err.message : String(err ?? 'Unknown error')
  if (
    message.includes('Failed to fetch') ||
    message.includes('NetworkError') ||
    message.includes('network request failed') ||
    message.includes('Network request failed') ||
    err instanceof TypeError // fetch throws TypeError on CORS / DNS failures
  ) {
    return { error: NETWORK_ERROR_MESSAGE }
  }
  return { error: mapSupabaseError(message) }
}

function logIfDev(label: string, error: { message: string } | null | undefined) {
  if (import.meta.env.DEV && error) {
    console.error(`[useAuthStore] ${label}:`, error)
  }
}

export const useAuthStore = create<AuthStore>(set => ({
  user: null,
  session: null,
  initialized: false,
  sessionExpired: false,
  _userInitiatedSignOut: false,

  signUp: async (email, password) => {
    if (!supabase) return { error: NOT_CONFIGURED_MESSAGE }
    try {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) {
        logIfDev('signUp', error)
        return { error: mapSupabaseError(error.message) }
      }
      return {}
    } catch (err) {
      return handleAuthException(err)
    }
  },

  signIn: async (email, password) => {
    if (!supabase) return { error: NOT_CONFIGURED_MESSAGE }
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        logIfDev('signIn', error)
        return { error: mapSupabaseError(error.message) }
      }
      return {}
    } catch (err) {
      return handleAuthException(err)
    }
  },

  signInWithMagicLink: async email => {
    if (!supabase) return { error: NOT_CONFIGURED_MESSAGE }
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      })
      if (error) {
        logIfDev('signInWithMagicLink', error)
        return { error: mapSupabaseError(error.message) }
      }
      return {}
    } catch (err) {
      return handleAuthException(err)
    }
  },

  signInWithGoogle: async () => {
    if (!supabase) return { error: NOT_CONFIGURED_MESSAGE }
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      })
      if (error) {
        logIfDev('signInWithGoogle', error)
        return { error: mapSupabaseError(error.message) }
      }
      // OAuth redirects — no further state change needed
      return {}
    } catch (err) {
      return handleAuthException(err)
    }
  },

  signOut: async () => {
    if (!supabase) return { error: NOT_CONFIGURED_MESSAGE }
    try {
      set({ _userInitiatedSignOut: true })
      const { error } = await supabase.auth.signOut()
      if (error) {
        set({ _userInitiatedSignOut: false })
        return { error: mapSupabaseError(error.message) }
      }
      set({ user: null, session: null, sessionExpired: false })
      return {}
    } catch {
      set({ _userInitiatedSignOut: false })
      return { error: NETWORK_ERROR_MESSAGE }
    }
  },

  setSession: session => {
    set({
      session,
      user: session?.user ?? null,
      initialized: true,
    })
  },

  clearSessionExpired: () => {
    set({ sessionExpired: false })
  },
}))

/** Guest mode is derived — not stored — to stay in sync with sessionStorage. */
export function selectIsGuestMode(state: Pick<AuthState, 'initialized' | 'user'>): boolean {
  return state.initialized && state.user === null && sessionStorage.getItem('knowlune-guest') === 'true'
}

export type AuthRouteState = 'loading' | 'authenticated' | 'guest' | 'anonymous'

/** Derived auth state for route guards. */
export function selectAuthState(state: Pick<AuthState, 'initialized' | 'user'>): AuthRouteState {
  if (!state.initialized) return 'loading'
  if (state.user !== null) return 'authenticated'
  if (selectIsGuestMode(state)) return 'guest'
  return 'anonymous'
}

// Expose the store on window in development / test builds so E2E tests can
// drive auth state directly without spinning up a real Supabase session.
// Tree-shaken in production builds (import.meta.env.PROD is false in dev/test).
if (typeof window !== 'undefined' && !import.meta.env.PROD) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(window as any).__authStore = useAuthStore
}
