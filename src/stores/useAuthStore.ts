import { create } from 'zustand'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/auth/supabase'

interface AuthState {
  user: User | null
  session: Session | null
  /** True after first session check completes — prevents flash of unauthenticated state */
  initialized: boolean
}

interface AuthActions {
  signUp: (email: string, password: string) => Promise<{ error?: string }>
  signIn: (email: string, password: string) => Promise<{ error?: string }>
  signInWithMagicLink: (email: string) => Promise<{ error?: string }>
  signInWithGoogle: () => Promise<{ error?: string }>
  signOut: () => Promise<{ error?: string }>
  /** Called by onAuthStateChange listener — do not call directly */
  setSession: (session: Session | null) => void
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

export const useAuthStore = create<AuthStore>(set => ({
  user: null,
  session: null,
  initialized: false,

  signUp: async (email, password) => {
    if (!supabase) return { error: NOT_CONFIGURED_MESSAGE }
    try {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) {
        return { error: mapSupabaseError(error.message) }
      }
      return {}
    } catch {
      return { error: NETWORK_ERROR_MESSAGE }
    }
  },

  signIn: async (email, password) => {
    if (!supabase) return { error: NOT_CONFIGURED_MESSAGE }
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        return { error: mapSupabaseError(error.message) }
      }
      return {}
    } catch {
      return { error: NETWORK_ERROR_MESSAGE }
    }
  },

  signInWithMagicLink: async email => {
    if (!supabase) return { error: NOT_CONFIGURED_MESSAGE }
    try {
      const { error } = await supabase.auth.signInWithOtp({ email })
      if (error) {
        return { error: mapSupabaseError(error.message) }
      }
      return {}
    } catch {
      return { error: NETWORK_ERROR_MESSAGE }
    }
  },

  signInWithGoogle: async () => {
    if (!supabase) return { error: NOT_CONFIGURED_MESSAGE }
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      })
      if (error) {
        return { error: mapSupabaseError(error.message) }
      }
      // OAuth redirects — no further state change needed
      return {}
    } catch {
      return { error: NETWORK_ERROR_MESSAGE }
    }
  },

  signOut: async () => {
    if (!supabase) return { error: NOT_CONFIGURED_MESSAGE }
    try {
      const { error } = await supabase.auth.signOut()
      if (error) {
        return { error: mapSupabaseError(error.message) }
      }
      set({ user: null, session: null })
      return {}
    } catch {
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
}))
