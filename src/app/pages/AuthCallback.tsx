import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import { supabase } from '@/lib/auth/supabase'
import { useAuthStore, selectAuthState } from '@/stores/useAuthStore'
import { Skeleton } from '@/app/components/ui/skeleton'

/**
 * OAuth / magic-link return URL.
 *
 * Supabase redirects here after Google OAuth or magic-link clicks.
 * Two flows are handled:
 *   - PKCE (v2 default): `?code=...` in the query string. We call exchangeCodeForSession.
 *   - Implicit: `#access_token=...` in the URL hash. onAuthStateChange in useAuthLifecycle
 *     picks it up; we just wait for authState to flip to 'authenticated'.
 *
 * On success -> navigate to /courses (the default post-auth landing).
 * On error   -> navigate to /?authError=<message> so Landing can surface it inline.
 */
export function AuthCallback() {
  const navigate = useNavigate()
  const authState = useAuthStore(selectAuthState)
  const exchangeStarted = useRef(false)

  useEffect(() => {
    if (exchangeStarted.current) return
    exchangeStarted.current = true

    const url = new URL(window.location.href)
    const code = url.searchParams.get('code')
    const errorParam = url.searchParams.get('error_description') || url.searchParams.get('error')

    if (errorParam) {
      navigate(`/?authError=${encodeURIComponent(errorParam)}`, { replace: true })
      return
    }

    if (code && supabase) {
      supabase.auth
        .exchangeCodeForSession(window.location.href)
        .then(({ error }) => {
          if (error) {
            navigate(`/?authError=${encodeURIComponent(error.message)}`, { replace: true })
          }
          // On success, onAuthStateChange will flip authState to 'authenticated'
          // and the effect below will navigate to /courses.
        })
        // silent-catch-ok — error is surfaced as a visible banner on the Landing
        // page via the authError query param.
        .catch(err => {
          const msg = err instanceof Error ? err.message : 'Authentication failed'
          navigate(`/?authError=${encodeURIComponent(msg)}`, { replace: true })
        })
      return
    }

    // Hash-based (implicit) flow — clean the hash once we detect it; auth state
    // listener has already picked up the session.
    if (window.location.hash.includes('access_token')) {
      window.history.replaceState(null, '', window.location.pathname)
    }
  }, [navigate])

  useEffect(() => {
    if (authState === 'authenticated') {
      navigate('/courses', { replace: true })
    }
  }, [authState, navigate])

  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Completing sign in"
      className="min-h-screen flex items-center justify-center p-6"
    >
      <div className="w-full max-w-sm space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-3/4" />
      </div>
    </div>
  )
}
