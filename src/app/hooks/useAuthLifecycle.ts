import { useEffect } from 'react'
import { supabase } from '@/lib/auth/supabase'
import { useAuthStore } from '@/stores/useAuthStore'
import { hydrateSettingsFromSupabase } from '@/lib/settings'
import { backfillUserId } from '@/lib/sync/backfill'

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

    let ignore = false

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (ignore) return

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
        // E92-S02: stamp userId on existing pre-auth records. Idempotent.
        // Fire-and-forget — the UI should not block on backfill completion.
        // silent-catch-ok — backfill is self-healing; next sign-in retries.
        backfillUserId(session.user.id).catch(err => {
          console.error('[useAuthLifecycle] backfillUserId failed:', err)
        })
      }
    })

    // Safety net: getSession() reads from localStorage (no network request).
    // Catches sessions established before React mounts (e.g., OAuth redirect
    // where tokens are extracted from URL hash before useEffect runs).
    // IMPORTANT: subscription MUST be established BEFORE getSession() so that
    // any session change during getSession() is not missed.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (ignore) return
      const state = useAuthStore.getState()
      state.setSession(session)
      if (session?.user) {
        hydrateSettingsFromSupabase(session.user.user_metadata)
        // silent-catch-ok — backfill is self-healing; next sign-in retries.
        backfillUserId(session.user.id).catch(err => {
          console.error('[useAuthLifecycle] backfillUserId failed:', err)
        })
      }
    })

    // Clean hash fragment after OAuth redirect (cosmetic — Supabase cleanup is unreliable)
    if (window.location.hash.includes('access_token')) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search)
    }

    return () => {
      ignore = true
      subscription.unsubscribe()
    }
  }, [])
}
