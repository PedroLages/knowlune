import { useCallback, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { X, AlertTriangle } from 'lucide-react'
import { useAuthStore } from '@/stores/useAuthStore'

const SESSION_DISMISSED_KEY = 'knowlune-session-banner-dismissed'
const RETURN_TO_KEY = 'knowlune-auth-return-to'

/**
 * E43-S04: Persistent banner shown when session expires (system-initiated SIGNED_OUT).
 *
 * - Shows "Session expired. Sign in to resume syncing." with Sign in link and dismiss button
 * - Sign in link stores current route for return-to-route after auth
 * - Dismiss sets sessionStorage flag to prevent reappearance for current browser session
 * - After dismiss, sessionExpired stays true in store so avatar warning dot remains visible
 * - Hidden when offline banner is showing (offline takes priority)
 */
export function SessionExpiredBanner({ isOffline }: { isOffline: boolean }) {
  const sessionExpired = useAuthStore(s => s.sessionExpired)
  const location = useLocation()
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem(SESSION_DISMISSED_KEY) === 'true'
  )

  const handleDismiss = useCallback(() => {
    sessionStorage.setItem(SESSION_DISMISSED_KEY, 'true')
    setDismissed(true)
  }, [])

  const handleSignInClick = useCallback(() => {
    // Store current route for return-to after authentication
    const returnTo = location.pathname + location.search + location.hash
    sessionStorage.setItem(RETURN_TO_KEY, returnTo)
  }, [location])

  // Don't render if: not expired, dismissed, or offline (offline banner takes priority)
  if (!sessionExpired || dismissed || isOffline) {
    return null
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="bg-warning/10 text-warning-foreground border-b border-warning/20 px-4 py-2 text-center text-sm -mx-6 -mt-6 mb-4 flex items-center justify-center gap-2"
    >
      <AlertTriangle className="size-4 shrink-0 text-warning" aria-hidden="true" />
      <span>Session expired. Sign in to resume syncing.</span>
      <Link
        to="/login"
        onClick={handleSignInClick}
        className="font-medium text-brand-soft-foreground hover:underline focus-visible:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
      >
        Sign in
      </Link>
      <button
        type="button"
        onClick={handleDismiss}
        className="ml-2 p-1 rounded-md text-warning-foreground/70 hover:text-warning-foreground hover:bg-warning/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[44px] min-w-[44px] flex items-center justify-center"
        aria-label="Dismiss session expired banner"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  )
}

export { RETURN_TO_KEY, SESSION_DISMISSED_KEY }
