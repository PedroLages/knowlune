// E19-S03: PremiumGate component
// Renders children for premium users, or an upgrade CTA for free users.
// Handles loading state with skeleton placeholder.
// E19-S05: Added unauthenticated user flow — shows AuthDialog before checkout.

import { type ReactNode } from 'react'
import { Crown, Loader2, LogIn } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { Card, CardContent } from '@/app/components/ui/card'
import { useIsPremium } from '@/lib/entitlement/isPremium'
import { useAuthStore } from '@/stores/useAuthStore'
import { startCheckout } from '@/lib/checkout'
import { toastError } from '@/lib/toastHelpers'
import { useState, useCallback, useEffect, useRef } from 'react'
import { AuthDialog } from '@/app/components/auth/AuthDialog'

interface PremiumGateProps {
  /** Content to render when user has premium access */
  children: ReactNode
  /** Optional label describing the gated feature (shown in upgrade CTA) */
  featureLabel?: string
  /** Optional custom fallback instead of the default upgrade CTA */
  fallback?: ReactNode
  /** If true, renders a skeleton placeholder while loading instead of nothing */
  showSkeleton?: boolean
}

/**
 * AC6: isPremium() guard — non-premium users see an upgrade CTA
 * instead of premium content.
 *
 * AC9: Loading state — shows skeleton for premium content while
 * entitlement status is being resolved, core content loads immediately.
 */
export function PremiumGate({
  children,
  featureLabel = 'this feature',
  fallback,
  showSkeleton = true,
}: PremiumGateProps) {
  const { isPremium, loading, isStale, error } = useIsPremium()

  // Loading state (AC9)
  if (loading) {
    if (!showSkeleton) return null
    return (
      <div
        className="animate-pulse space-y-3 rounded-[24px] border border-border/50 bg-surface-sunken/30 p-6"
        role="status"
        aria-label={`Loading ${featureLabel}`}
      >
        <div className="h-5 w-24 rounded bg-muted" />
        <div className="h-4 w-48 rounded bg-muted" />
        <div className="h-10 w-full rounded-xl bg-muted" />
      </div>
    )
  }

  // Premium user — render children
  if (isPremium && !isStale) {
    return <>{children}</>
  }

  // Custom fallback
  if (fallback) {
    return <>{fallback}</>
  }

  // Default upgrade CTA (AC6)
  return <UpgradeCTA featureLabel={featureLabel} error={error} isStale={isStale} />
}

// --- Exported upgrade CTA component ---

export interface UpgradeCTAProps {
  featureLabel: string
  error?: string | null
  isStale?: boolean
}

export function UpgradeCTA({ featureLabel, error = null, isStale = false }: UpgradeCTAProps) {
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false)
  const [showAuthDialog, setShowAuthDialog] = useState(false)
  const user = useAuthStore(s => s.user)
  // Track whether the auth dialog was opened for upgrade flow
  const pendingCheckoutRef = useRef(false)

  const handleCheckout = useCallback(async () => {
    setIsCheckoutLoading(true)
    try {
      const result = await startCheckout()
      if ('error' in result) {
        toastError.saveFailed(result.error)
        return
      }
      if (!result.url.startsWith('https://checkout.stripe.com/')) {
        toastError.saveFailed('Invalid checkout URL received.')
        return
      }
      window.location.href = result.url
    } catch {
      // silent-catch-ok — startCheckout handles errors internally; this resets loading state
    } finally {
      setIsCheckoutLoading(false)
    }
  }, [])

  // E19-S05 AC5: When user signs in via AuthDialog, proceed to checkout automatically.
  // Uses useEffect + subscribe to avoid race conditions with synchronous getState() reads.
  useEffect(() => {
    if (!pendingCheckoutRef.current) return
    if (user) {
      pendingCheckoutRef.current = false
      setShowAuthDialog(false)
      handleCheckout()
    }
  }, [user, handleCheckout])

  // E19-S05 AC5: Unauthenticated user → show login first, then checkout
  const handleUpgrade = useCallback(() => {
    if (!user) {
      pendingCheckoutRef.current = true
      setShowAuthDialog(true)
      return
    }
    handleCheckout()
  }, [user, handleCheckout])

  // When auth dialog closes, clear pending checkout if user didn't sign in
  const handleAuthDialogChange = useCallback((open: boolean) => {
    setShowAuthDialog(open)
    if (!open) {
      pendingCheckoutRef.current = false
    }
  }, [])

  return (
    <>
      <Card
        className="border-gold-muted/50 bg-gold-muted/10"
        data-testid="premium-gate-cta"
        role="region"
        aria-label={`Upgrade required for ${featureLabel}`}
      >
        <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
          <div className="rounded-full bg-gold-muted p-3">
            <Crown className="size-6 text-gold" aria-hidden="true" />
          </div>

          <div className="space-y-1">
            <h3 className="text-base font-display font-semibold">Premium Feature</h3>
            <p className="text-sm text-muted-foreground">
              {isStale
                ? 'Your subscription status is outdated. Connect to the internet to verify your access.'
                : error
                  ? error
                  : `Upgrade to Premium to unlock ${featureLabel}.`}
            </p>
          </div>

          <Button
            variant="brand"
            className="w-full max-w-xs min-h-[44px] gap-2"
            onClick={handleUpgrade}
            disabled={isCheckoutLoading}
            aria-label={
              user
                ? `Upgrade to Premium to unlock ${featureLabel}`
                : `Sign in to upgrade to Premium and unlock ${featureLabel}`
            }
            aria-busy={isCheckoutLoading}
          >
            {isCheckoutLoading ? (
              <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden="true" />
            ) : !user ? (
              <LogIn className="size-4" aria-hidden="true" />
            ) : null}
            {isCheckoutLoading
              ? 'Starting checkout...'
              : user
                ? 'Upgrade to Premium'
                : 'Sign In to Upgrade'}
          </Button>

          {/* AC5: Resubscribe option for cancelled subscriptions */}
          {isStale && (
            <p className="text-xs text-muted-foreground">
              If your subscription has expired, you can resubscribe by upgrading above.
            </p>
          )}

          {/* E19-S07: Legal links for checkout flow */}
          <p className="text-xs text-muted-foreground">
            By upgrading you agree to our{' '}
            <a
              href="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-soft-foreground hover:underline focus-visible:underline focus-visible:outline-none"
            >
              Privacy Policy
            </a>{' '}
            and{' '}
            <a
              href="/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-soft-foreground hover:underline focus-visible:underline focus-visible:outline-none"
            >
              Terms of Service
            </a>
          </p>
        </CardContent>
      </Card>

      {/* E19-S05 AC5: Auth dialog for unauthenticated upgrade flow */}
      <AuthDialog
        open={showAuthDialog}
        onOpenChange={handleAuthDialogChange}
        defaultMode="sign-in"
      />
    </>
  )
}
