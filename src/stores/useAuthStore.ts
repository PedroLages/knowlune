import { create } from 'zustand'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/auth/supabase'

interface AuthState {
  user: User | null
  session: Session | null
  loading: boolean
  error: string | null
  /** True after first session check completes — prevents flash of unauthenticated state */
  initialized: boolean
}

interface AuthActions {
  signUp: (email: string, password: string) => Promise<{ error?: string }>
  signIn: (email: string, password: string) => Promise<{ error?: string }>
  signInWithMagicLink: (email: string) => Promise<{ error?: string }>
  signInWithGoogle: () => Promise<{ error?: string }>
  signOut: () => Promise<void>
  /** Called by onAuthStateChange listener — do not call directly */
  setSession: (session: Session | null) => void
  clearError: () => void
}

type AuthStore = AuthState & AuthActions

function mapSupabaseError(message: string): string {
  if (message.includes('User already registered')) {
    return 'This email is already registered. Try signing in instead.'
  }
  if (message.includes('Invalid login credentials')) {
    return 'Invalid email or password. Please try again.'
  }
  if (message.includes('Email not confirmed')) {
    return 'Please check your email and confirm your account before signing in.'
  }
  if (message.includes('Network')) {
    return 'Unable to connect. Please check your internet connection and try again.'
  }
  return message
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  session: null,
  loading: false,
  error: null,
  initialized: false,

  signUp: async (email, password) => {
    set({ loading: true, error: null })
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) {
      const mapped = mapSupabaseError(error.message)
      set({ loading: false, error: mapped })
      return { error: mapped }
    }
    set({ loading: false })
    return {}
  },

  signIn: async (email, password) => {
    set({ loading: true, error: null })
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      const mapped = mapSupabaseError(error.message)
      set({ loading: false, error: mapped })
      return { error: mapped }
    }
    set({ loading: false })
    return {}
  },

  signInWithMagicLink: async (email) => {
    set({ loading: true, error: null })
    const { error } = await supabase.auth.signInWithOtp({ email })
    if (error) {
      const mapped = mapSupabaseError(error.message)
      set({ loading: false, error: mapped })
      return { error: mapped }
    }
    set({ loading: false })
    return {}
  },

  signInWithGoogle: async () => {
    set({ loading: true, error: null })
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    if (error) {
      const mapped = mapSupabaseError(error.message)
      set({ loading: false, error: mapped })
      return { error: mapped }
    }
    // OAuth redirects — loading state persists until redirect
    return {}
  },

  signOut: async () => {
    set({ loading: true, error: null })
    await supabase.auth.signOut()
    set({ user: null, session: null, loading: false })
  },

  setSession: (session) => {
    set({
      session,
      user: session?.user ?? null,
      initialized: true,
      loading: false,
    })
  },

  clearError: () => set({ error: null }),
}))
