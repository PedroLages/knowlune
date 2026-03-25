import { useState, useEffect, useCallback } from 'react'
import { Crown, Check, CheckCircle, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card'
import { Badge } from '@/app/components/ui/badge'
import { Button } from '@/app/components/ui/button'
import { Progress } from '@/app/components/ui/progress'
import { useAuthStore } from '@/stores/useAuthStore'
import { startCheckout, pollEntitlement, getCachedEntitlement } from '@/lib/checkout'
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

  // Load cached entitlement on mount
  useEffect(() => {
    if (!user) return

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
    return () => { cancelled = true }
  }, [user])

  // Handle checkout return
  useEffect(() => {
    if (!checkoutStatus || !user) return

    if (checkoutStatus === 'cancel') {
      toastError.saveFailed('Upgrade not completed')
      return
    }

    if (checkoutStatus === 'success') {
      setState('activating')

      let cancelled = false
      async function activate() {
        const result = await pollEntitlement()
        if (cancelled) return

        if (result) {
          setEntitlement(result)
          setState('activated')
          toastSuccess.saved('Premium subscription activated!')
          // Transition to premium view after brief celebration
          setTimeout(() => {
            if (!cancelled) setState('premium')
          }, 3000)
        } else {
          // Timeout — webhook hasn't processed yet
          setState('free')
          toastError.saveFailed(
            'Subscription is being processed. It may take a moment — please refresh the page.',
          )
        }
      }

      activate()
      return () => { cancelled = true }
    }
  }, [checkoutStatus, user])

  const handleUpgrade = useCallback(async () => {
    setIsCheckoutLoading(true)
    const result = await startCheckout()

    if ('error' in result) {
      toastError.saveFailed(result.error)
      setIsCheckoutLoading(false)
      return
    }

    // Redirect to Stripe Checkout
    window.location.href = result.url
  }, [])

  if (!user) return null

  return (
    <Card className="overflow-hidden shadow-[0_2px_8px_var(--shadow-gold)]">
      <CardHeader className="border-b border-border/50 bg-surface-sunken/30">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-gold-muted p-2">
            {state === 'activating' ? (
              <Loader2
                className="size-5 text-gold animate-spin"
                aria-hidden="true"
              />
            ) : (
              <Crown className="size-5 text-gold" aria-hidden="true" />
            )}
          </div>
          <div>
            <CardTitle className="text-lg font-display leading-none">
              {state === 'activating'
                ? 'Activating...'
                : 'Subscription'}
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
          <div className="space-y-3 animate-pulse">
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
            <Progress className="h-2 bg-gold-muted" aria-label="Activation progress" />
            <p className="text-sm text-muted-foreground text-center">
              This usually takes a few seconds...
            </p>
          </div>
        )}

        {/* Activated celebration — brief transition state */}
        {state === 'activated' && (
          <div
            className="flex flex-col items-center gap-3 py-4 animate-in fade-in slide-in-from-bottom-2 duration-500"
            role="status"
            aria-live="polite"
          >
            <div className="rounded-full bg-success-soft p-3">
              <CheckCircle className="size-8 text-success" />
            </div>
            <p className="text-lg font-display font-semibold">
              Welcome to Premium!
            </p>
            <p className="text-sm text-muted-foreground">
              All premium features are now unlocked.
            </p>
          </div>
        )}

        {/* Free tier — upgrade CTA */}
        {state === 'free' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">Free</Badge>
              <span className="text-sm text-muted-foreground">
                Basic features included
              </span>
            </div>

            <ul className="space-y-2" role="list">
              {PREMIUM_FEATURES.map(feature => (
                <li key={feature} className="flex items-center gap-2.5 text-sm">
                  <Check className="size-4 text-success flex-shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            <Button
              variant="brand"
              className="w-full min-h-[44px]"
              onClick={handleUpgrade}
              disabled={isCheckoutLoading}
              aria-label="Upgrade to Premium plan"
              aria-busy={isCheckoutLoading}
            >
              {isCheckoutLoading && (
                <Loader2 className="size-4 animate-spin mr-2" />
              )}
              {isCheckoutLoading ? 'Starting checkout...' : 'Upgrade to Premium'}
            </Button>
          </div>
        )}

        {/* Premium tier — active subscription */}
        {state === 'premium' && entitlement && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge className="bg-brand text-brand-foreground border-transparent">
                Premium
              </Badge>
              <span className="text-sm text-muted-foreground">Monthly</span>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="size-4 text-success flex-shrink-0" />
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
          </div>
        )}
      </CardContent>
    </Card>
  )
}
