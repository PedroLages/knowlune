import { useState } from 'react'
import { Link } from 'react-router'
import { X } from 'lucide-react'
import { useAuthStore, selectIsGuestMode } from '@/stores/useAuthStore'

const BANNER_DISMISSED_KEY = 'knowlune-guest-banner-dismissed'

export function GuestBanner() {
  const isGuest = useAuthStore(selectIsGuestMode)
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem(BANNER_DISMISSED_KEY) === 'true'
  )

  if (!isGuest || dismissed) return null

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="guest-banner"
      className="flex items-center justify-between gap-3 bg-brand-soft/60 border-b border-brand/20 px-4 py-2 text-sm text-brand-soft-foreground"
    >
      <span>
        You&apos;re browsing as a guest — sign up to save your progress.{' '}
        <Link to="/" className="font-medium underline underline-offset-2 hover:no-underline">
          Sign up
        </Link>
      </span>
      <button
        type="button"
        onClick={() => {
          sessionStorage.setItem(BANNER_DISMISSED_KEY, 'true')
          setDismissed(true)
        }}
        aria-label="Dismiss guest banner"
        className="shrink-0 rounded p-0.5 hover:bg-brand/10 transition-colors"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  )
}
