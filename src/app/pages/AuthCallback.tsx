import { useEffect, useRef, useState } from 'react'
import { useNavigate, Link } from 'react-router'
import { Loader2, AlertCircle } from 'lucide-react'
import { supabase } from '@/lib/auth/supabase'
import { useAuthStore, selectAuthState } from '@/stores/useAuthStore'
import { Button } from '@/app/components/ui/button'
import { KnowluneLogo } from '@/app/components/figma/KnowluneLogo'

/**
 * OAuth / magic-link return URL.
 *
 * Supabase redirects here after Google OAuth or magic-link clicks.
 * Two flows are handled:
 *   - PKCE (v2 default): `?code=...` in the query string. We call exchangeCodeForSession.
 *   - Implicit: `#access_token=...` in the URL hash. onAuthStateChange in useAuthLifecycle
 *     picks it up; we just wait for authState to flip to 'authenticated'.
 *
 * Error handling:
 *   - URL has `?error` / `?error_description`: redirect to /?authError=<msg>
 *   - URL has `?authError=`: show inline error card immediately (e.g. Supabase server errors)
 *   - exchangeCodeForSession fails: redirect to /?authError=<msg>
 *
 * On success -> navigate to /courses (the default post-auth landing).
 * On error   -> navigate to /?authError=<message> so Landing can surface it inline.
 */
export function AuthCallback() {
  const navigate = useNavigate()
  const authState = useAuthStore(selectAuthState)
  const exchangeStarted = useRef(false)

  // If the user lands here with ?authError= already set (e.g. Supabase server-side
  // error before PKCE exchange), surface it immediately as an error card.
  const [authError, setAuthError] = useState<string | null>(() => {
    const url = new URL(window.location.href)
    return url.searchParams.get('authError')
  })

  useEffect(() => {
    if (exchangeStarted.current) return
    exchangeStarted.current = true

    const url = new URL(window.location.href)
    const code = url.searchParams.get('code')
    const errorParam = url.searchParams.get('error_description') || url.searchParams.get('error')

    // Already showing an authError card — do nothing.
    if (authError) return

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
  }, [navigate, authError])

  useEffect(() => {
    if (authState === 'authenticated') {
      navigate('/courses', { replace: true })
    }
  }, [authState, navigate])

  return (
    <div
        className="min-h-screen flex items-center justify-center p-6 bg-background"
        role="status"
        aria-busy={!authError}
        aria-label={authError ? 'Sign-in failed' : 'Completing sign in'}
      >
        <div className="anim-fade-slide-up bg-card rounded-2xl shadow-lg p-8 flex flex-col items-center gap-6 w-full max-w-sm">
          <KnowluneLogo className="h-7 w-auto" />

          {authError ? (
            /* ── Error state ─────────────────────────────────────── */
            <>
              <AlertCircle size={40} className="text-destructive" aria-hidden="true" />

              <div className="flex flex-col items-center gap-1 text-center">
                <h1 className="font-display text-2xl font-semibold text-foreground">
                  Sign-in failed
                </h1>
              </div>

              <div className="w-full bg-destructive/15 border border-destructive/40 rounded-xl px-4 py-3 text-sm text-destructive text-center">
                {authError}
              </div>

              <div className="flex flex-col gap-3 w-full">
                <Button variant="brand" asChild className="w-full min-h-[44px]">
                  <Link to="/">Back to sign in</Link>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setAuthError(null)
                    window.location.reload()
                  }}
                  className="w-full min-h-[44px]"
                >
                  Try again
                </Button>
              </div>
            </>
          ) : (
            /* ── Loading state ───────────────────────────────────── */
            <>
              <Loader2 size={40} className="animate-spin text-brand" aria-hidden="true" />

              <div className="flex flex-col items-center gap-2 text-center">
                <h1 className="font-display text-2xl font-semibold text-foreground">
                  Signing you in…
                </h1>
                <p className="text-sm text-muted-foreground text-center max-w-xs">
                  Verifying your credentials and setting up your workspace.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
  )
}
