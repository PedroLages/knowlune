import { useEffect } from 'react'
import { supabase } from '@/lib/auth/supabase'
import { useAuthStore } from '@/stores/useAuthStore'
import { hydrateSettingsFromSupabase } from '@/lib/settings'

/**
 * E43-S04: Subscribes to Supabase auth state changes and manages session lifecycle.
 *
 * Handles:
 * - SIGNED_IN / INITIAL_SESSION: sets session, hydrates settings from user_metadata
 * - TOKEN_REFRESHED: silently updates session (no UI)
 * - SIGNED_OUT: distinguishes user-initiated vs system-initiated (session expiry)
 *   - User-initiated: clears state, no banner
 *   - System-initiated: sets sessionExpired flag for banner display
 *
 * Replaces the useEffect at App.tsx lines 66-79 (E19-S01).
 */
export function useAuthLifecycle(): void {
  useEffect(() => {
    if (!supabase) return

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const state = useAuthStore.getState()

      if (event === 'SIGNED_OUT') {
        // Distinguish user-initiated sign-out from system-initiated (token expiry)
        if (state._userInitiatedSignOut) {
          // User clicked "Sign out" — no expiry banner, reset flag
          useAuthStore.setState({ _userInitiatedSignOut: false })
        } else {
          // System-initiated (refresh token expired) — show expiry banner
          useAuthStore.setState({ sessionExpired: true })
        }
      }

      // Clear sessionExpired on successful re-authentication
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        state.clearSessionExpired()
        useAuthStore.setState({ _userInitiatedSignOut: false })
      }

      // Always update session state (handles all events including TOKEN_REFRESHED)
      state.setSession(session)

      // Hydrate localStorage settings from Supabase user_metadata on sign-in
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
        hydrateSettingsFromSupabase(session.user.user_metadata)
      }
    })

    return () => subscription.unsubscribe()
  }, [])
}
