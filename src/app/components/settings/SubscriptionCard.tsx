import { useState, useEffect, useCallback, useRef } from 'react'
import { Crown, Check, CheckCircle, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card'
import { Badge } from '@/app/components/ui/badge'
import { Button } from '@/app/components/ui/button'
// Progress removed — replaced with custom indeterminate gold bar (B-01)
import { useAuthStore } from '@/stores/useAuthStore'
import { startCheckout, pollEntitlement, getCachedEntitlement } from '@/lib/checkout'
import { toast } from 'sonner'
import { toastSuccess, toastError } from '@/lib/toastHelpers'
import type { CachedEntitlement } from '@/data/types'

const PREMIUM_FEATURES = [
  'AI Video Summaries',
  'Knowledge Gap Detection',
  'AI Learning Paths',
  'Auto Note Organization',
]

type CardState = 'loading' | 'free' | 'premium' | 'activating' | 'activated'

interface SubscriptionCardProps {
  checkoutStatus?: 'success' | 'cancel' | null
}

export function SubscriptionCard({ checkoutStatus }: SubscriptionCardProps) {
  const user = useAuthStore(s => s.user)
  const [state, setState] = useState<CardState>('loading')
  const [entitlement, setEntitlement] = useState<CachedEntitlement | null>(null)
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false)
  const checkoutInProgress = useRef(false)
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Load cached entitlement on mount
  useEffect(() => {
    if (!user || checkoutStatus === 'success') return

    let cancelled = false

    async function loadEntitlement() {
      const cached = await getCachedEntitlement(user!.id)
      if (cancelled) return

      if (cached && cached.tier !== 'free') {
        setEntitlement(cached)
        setState('premium')
      } else {
        setState('free')
      }
    }

    loadEntitlement()
    return () => {
      cancelled = true
    }
  }, [user, checkoutStatus])

  // Handle checkout return
  useEffect(() => {
    if (!checkoutStatus || !user) return

    if (checkoutStatus === 'cancel') {
      toast.error('Upgrade not completed')
      return
    }

    if (checkoutStatus === 'success') {
      setState('activating')

      let cancelled = false
      const abortController = new AbortController()
      let timerId: ReturnType<typeof setTimeout> | undefined
      async function activate() {
        const result = await pollEntitlement(30_000, 2_000, abortController.signal)
        if (cancelled) return

        if (result) {
          setEntitlement(result)
          setState('activated')
          toastSuccess.saved('Premium subscription activated!')
          // Transition to premium view after brief celebration
          timerId = setTimeout(() => {
            if (!cancelled) setState('premium')
          }, 3000)
        } else {
          // Timeout — webhook hasn't processed yet
          setState('free')
          toastError.saveFailed(
            'Subscription is being processed. It may take a moment — please refresh the page.'
          )
        }
      }

      activate()
      return () => {
        cancelled = true
        abortController.abort()
        clearTimeout(timerId)
      }
    }
  }, [checkoutStatus, user])

  const handleUpgrade = useCallback(async () => {
    if (checkoutInProgress.current) return
    checkoutInProgress.current = true
    try {
      setIsCheckoutLoading(true)
      const result = await startCheckout()

      if ('error' in result) {
        toastError.saveFailed(result.error)
        setIsCheckoutLoading(false)
        checkoutInProgress.current = false
        return
      }

      // Defense-in-depth: validate checkout URL before redirect
      if (!result.url.startsWith('https://checkout.stripe.com/')) {
        toastError.saveFailed('Invalid checkout URL received.')
        setIsCheckoutLoading(false)
        checkoutInProgress.current = false
        return
      }

      // Redirect to Stripe Checkout
      window.location.href = result.url
      // Fallback: reset loading if redirect doesn't happen (popup blocker, etc.)
      clearTimeout(fallbackTimerRef.current)
      fallbackTimerRef.current = setTimeout(() => {
        setIsCheckoutLoading(false)
        checkoutInProgress.current = false
      }, 5000)
    } catch {
      // silent-catch-ok — startCheckout handles its own errors with toastError above; this catch only resets loading state as a safety net
      setIsCheckoutLoading(false)
      checkoutInProgress.current = false
    }
  }, [])

  // Clean up fallback timer on unmount
  useEffect(() => {
    return () => clearTimeout(fallbackTimerRef.current)
  }, [])

  if (!user) return null

  return (
    <Card className="overflow-hidden shadow-studio-gold">
      <CardHeader className="border-b border-border/50 bg-surface-sunken/30">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-gold-muted p-2">
            {state === 'activating' ? (
              <Loader2 className="size-5 text-gold motion-safe:animate-spin" aria-hidden="true" />
            ) : (
              <Crown className="size-5 text-gold" aria-hidden="true" />
            )}
          </div>
          <div>
            <CardTitle className="text-lg font-display leading-none">
              {state === 'activating' ? 'Activating...' : 'Subscription'}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {state === 'activating'
                ? 'Setting up your premium subscription'
                : state === 'premium' || state === 'activated'
                  ? 'Manage your plan and billing'
                  : 'Upgrade to unlock premium features'}
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6" data-testid="subscription-section">
        {/* Loading state */}
        {state === 'loading' && (
          <div
            className="space-y-3 animate-pulse"
            role="status"
            aria-label="Loading subscription status"
          >
            <div className="h-6 w-20 bg-muted rounded-full" />
            <div className="h-4 w-48 bg-muted rounded" />
            <div className="h-10 w-full bg-muted rounded-xl" />
          </div>
        )}

        {/* Activating state — polling for webhook */}
        {state === 'activating' && (
          <div
            className="space-y-4"
            role="status"
            aria-live="polite"
            aria-label="Activating subscription"
          >
            <div
              className="h-2 w-full rounded-full bg-gold-muted overflow-hidden"
              aria-label="Activation progress"
            >
              <div className="h-full w-1/3 rounded-full bg-gold motion-safe:animate-[indeterminate_1.5s_ease-in-out_infinite]" />
            </div>
            <p className="text-sm text-muted-foreground">This usually takes a few seconds...</p>
          </div>
        )}

        {/* Activated celebration — brief transition state */}
        {state === 'activated' && (
          <div
            className="flex flex-col items-center gap-3 py-4 animate-in fade-in slide-in-from-bottom-2 duration-500"
            role="status"
            aria-live="polite"
            aria-label="Subscription activated"
          >
            <div className="rounded-full bg-success-soft p-3">
              <CheckCircle className="size-8 text-success" aria-hidden="true" />
            </div>
            <p className="text-lg font-display font-semibold">Welcome to Premium!</p>
            <p className="text-sm text-muted-foreground">All premium features are now unlocked.</p>
          </div>
        )}

        {/* Free tier — upgrade CTA */}
        {state === 'free' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">Free</Badge>
              <span className="text-sm text-muted-foreground">Basic features included</span>
            </div>

            <ul className="space-y-2" role="list" id="premium-features-list">
              {PREMIUM_FEATURES.map(feature => (
                <li key={feature} className="flex items-center gap-2.5 text-sm">
                  <Check className="size-4 text-success shrink-0" aria-hidden="true" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            <Button
              variant="brand"
              className="w-full min-h-[44px] gap-2"
              onClick={handleUpgrade}
              disabled={isCheckoutLoading}
              aria-label="Upgrade to Premium plan"
              aria-describedby="premium-features-list"
              aria-busy={isCheckoutLoading}
            >
              {isCheckoutLoading && (
                <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden="true" />
              )}
              {isCheckoutLoading ? 'Starting checkout...' : 'Upgrade to Premium'}
            </Button>
          </div>
        )}

        {/* Premium tier — active subscription */}
        {state === 'premium' && entitlement && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge className="bg-gold-muted text-gold-soft-foreground border-transparent">
                Premium
              </Badge>
              {/* TODO(E19-S03): derive interval from entitlement.planId when annual plans are added */}
              <span className="text-sm text-muted-foreground">Monthly</span>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="size-4 text-success shrink-0" aria-hidden="true" />
                <span className="font-medium">Active</span>
              </div>

              {entitlement.expiresAt && (
                <p className="text-sm text-muted-foreground ml-6">
                  Next billing:{' '}
                  {new Date(entitlement.expiresAt).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              )}
            </div>

            <Button
              variant="brand-outline"
              size="sm"
              className="mt-2 min-h-[44px]"
              onClick={() => {
                // TODO(E19-S03): Implement Stripe billing portal redirect
                toast.info(
                  'Billing portal coming soon — contact support to manage your subscription.'
                )
              }}
            >
              Manage Subscription
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
