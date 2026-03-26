import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Crown,
  Check,
  CheckCircle,
  Loader2,
  ExternalLink,
  AlertTriangle,
  RefreshCw,
  WifiOff,
  CreditCard,
  XCircle,
  Clock,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card'
import { Badge } from '@/app/components/ui/badge'
import { Button } from '@/app/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/app/components/ui/alert-dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/app/components/ui/tooltip'
import { Skeleton } from '@/app/components/ui/skeleton'
import { useAuthStore } from '@/stores/useAuthStore'
import {
  startCheckout,
  pollEntitlement,
  getCachedEntitlement,
  createPortalSession,
} from '@/lib/checkout'
import { useIsPremium } from '@/lib/entitlement/isPremium'
import { useTrialStatus } from '@/app/hooks/useTrialStatus'
import { toast } from 'sonner'
import { toastSuccess, toastError } from '@/lib/toastHelpers'
import type { CachedEntitlement } from '@/data/types'

/** Shared plan details rendered in both premium and offline-cached states. */
function PlanDetails({ entitlement }: { entitlement: CachedEntitlement }) {
  return (
    <>
      {/* Plan info */}
      <div className="flex items-center gap-2">
        <Badge className="bg-gold-muted text-gold-soft-foreground border-transparent">
          Premium
        </Badge>
        <span className="text-sm text-muted-foreground">
          {entitlement.planId?.includes('annual') ? 'Annual' : 'Monthly'}
        </span>
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
    </>
  )
}

const PREMIUM_FEATURES = [
  'AI Video Summaries',
  'Knowledge Gap Detection',
  'AI Learning Paths',
  'Auto Note Organization',
]

type CardState =
  | 'loading'
  | 'free'
  | 'trial'
  | 'premium'
  | 'activating'
  | 'activated'
  | 'offline-cached'

interface SubscriptionCardProps {
  checkoutStatus?: 'success' | 'cancel' | null
}

export function SubscriptionCard({ checkoutStatus }: SubscriptionCardProps) {
  const user = useAuthStore(s => s.user)
  const { isStale, error: entitlementError } = useIsPremium()
  const { daysRemaining, canStartTrial, hadTrial, trialEnd } = useTrialStatus()
  const [state, setState] = useState<CardState>('loading')
  const [entitlement, setEntitlement] = useState<CachedEntitlement | null>(null)
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false)
  const [isPortalLoading, setIsPortalLoading] = useState(false)
  const [isCancelLoading, setIsCancelLoading] = useState(false)
  const [portalError, setPortalError] = useState<string | null>(null)
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
        // Check if we're offline with stale data
        if (!navigator.onLine || isStale) {
          setState('offline-cached')
        } else if (cached.tier === 'trial') {
          setState('trial')
        } else {
          setState('premium')
        }
      } else {
        setState('free')
      }
    }

    loadEntitlement()
    return () => {
      cancelled = true
    }
  }, [user, checkoutStatus, isStale])

  // Update state when entitlement status changes (online/offline transitions)
  useEffect(() => {
    if (state === 'loading' || state === 'activating' || state === 'activated') return
    if (!entitlement || entitlement.tier === 'free') return

    if (!navigator.onLine || isStale || entitlementError) {
      setState('offline-cached')
    } else if (entitlement.tier === 'trial') {
      setState('trial')
    } else {
      setState('premium')
    }
  }, [isStale, entitlementError, entitlement, state])

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

  const handleUpgrade = useCallback(
    async (trial?: boolean) => {
      if (checkoutInProgress.current) return
      checkoutInProgress.current = true
      try {
        setIsCheckoutLoading(true)
        const result = await startCheckout(trial)

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
    },
    []
  )

  const handleManageBilling = useCallback(async () => {
    setIsPortalLoading(true)
    setPortalError(null)
    try {
      const result = await createPortalSession()

      if ('error' in result) {
        setPortalError(result.error)
        return
      }

      // Defense-in-depth: validate portal URL before redirect
      if (!result.url.startsWith('https://') || !result.url.includes('stripe.com')) {
        setPortalError('Invalid billing portal URL received.')
        setIsPortalLoading(false)
        return
      }

      window.location.href = result.url
      // Fallback: reset loading if redirect doesn't happen
      clearTimeout(fallbackTimerRef.current)
      fallbackTimerRef.current = setTimeout(() => {
        setIsPortalLoading(false)
      }, 5000)
    } catch {
      // silent-catch-ok — createPortalSession handles errors; this resets loading state as safety net
      setPortalError('Unable to open billing portal. Please try again.')
      setIsPortalLoading(false)
    }
  }, [])

  const handleCancelSubscription = useCallback(async () => {
    setIsCancelLoading(true)
    setPortalError(null)
    try {
      const result = await createPortalSession('cancel')

      if ('error' in result) {
        setPortalError(result.error)
        setIsCancelLoading(false)
        return
      }

      window.location.href = result.url
      clearTimeout(fallbackTimerRef.current)
      fallbackTimerRef.current = setTimeout(() => {
        setIsCancelLoading(false)
      }, 5000)
    } catch {
      // silent-catch-ok — createPortalSession handles errors; this resets loading state as safety net
      setPortalError('Unable to process cancellation. Please try again.')
      setIsCancelLoading(false)
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
            ) : state === 'offline-cached' ? (
              <WifiOff className="size-5 text-warning" aria-hidden="true" />
            ) : state === 'trial' ? (
              <Clock className="size-5 text-gold" aria-hidden="true" />
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
                : state === 'offline-cached'
                  ? 'Showing cached subscription data'
                  : state === 'trial'
                    ? 'Your free trial is active'
                    : state === 'premium' || state === 'activated'
                      ? 'Manage your plan and billing'
                      : 'Upgrade to unlock premium features'}
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6" data-testid="subscription-section">
        {/* Loading state — skeleton loader */}
        {state === 'loading' && (
          <div
            className="space-y-4"
            role="status"
            aria-label="Loading subscription status"
            aria-busy="true"
          >
            <div className="flex items-center gap-2">
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-4 w-24" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-36" />
            </div>
            <div className="flex gap-3 pt-2">
              <Skeleton className="h-10 w-36 rounded-xl" />
              <Skeleton className="h-10 w-40 rounded-xl" />
            </div>
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

            {/* AC1/AC8: Show "Start Free Trial" if eligible, otherwise "Subscribe" */}
            {canStartTrial ? (
              <div className="space-y-3">
                <Button
                  variant="brand"
                  className="w-full min-h-[44px] gap-2"
                  onClick={() => handleUpgrade(true)}
                  disabled={isCheckoutLoading}
                  aria-label="Start 14-day free trial"
                  aria-describedby="premium-features-list"
                  aria-busy={isCheckoutLoading}
                >
                  {isCheckoutLoading && (
                    <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden="true" />
                  )}
                  {isCheckoutLoading ? 'Starting checkout...' : 'Start Free Trial'}
                </Button>
                <p className="text-xs text-center text-muted-foreground">
                  14-day free trial. No charge until trial ends.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <Button
                  variant="brand"
                  className="w-full min-h-[44px] gap-2"
                  onClick={() => handleUpgrade(false)}
                  disabled={isCheckoutLoading}
                  aria-label={hadTrial ? 'Subscribe to Premium' : 'Upgrade to Premium plan'}
                  aria-describedby="premium-features-list"
                  aria-busy={isCheckoutLoading}
                >
                  {isCheckoutLoading && (
                    <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden="true" />
                  )}
                  {isCheckoutLoading ? 'Starting checkout...' : 'Subscribe'}
                </Button>

                {/* AC7: Post-trial charge failure — update payment method */}
                {hadTrial && (
                  <Button
                    variant="brand-outline"
                    className="w-full min-h-[44px] gap-2"
                    onClick={handleManageBilling}
                    disabled={isPortalLoading}
                    aria-label="Update payment method in Stripe"
                  >
                    {isPortalLoading ? (
                      <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden="true" />
                    ) : (
                      <CreditCard className="size-4" aria-hidden="true" />
                    )}
                    {isPortalLoading ? 'Opening...' : 'Update Payment Method'}
                    {!isPortalLoading && (
                      <ExternalLink className="size-3.5" aria-hidden="true" />
                    )}
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Trial state — active trial with management options */}
        {state === 'trial' && entitlement && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge className="bg-gold-muted text-gold-soft-foreground border-transparent">
                Trial
              </Badge>
              <span className="text-sm text-muted-foreground">
                {daysRemaining === 0
                  ? 'Ends today'
                  : daysRemaining === 1
                    ? '1 day remaining'
                    : `${daysRemaining} days remaining`}
              </span>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-sm">
                <Clock className="size-4 text-gold shrink-0" aria-hidden="true" />
                <span className="font-medium">Free trial active</span>
              </div>
              {trialEnd && (
                <p className="text-sm text-muted-foreground ml-6">
                  Trial ends:{' '}
                  {new Date(trialEnd).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              )}
              <p className="text-sm text-muted-foreground ml-6">
                All premium features are unlocked during your trial.
              </p>
            </div>

            {/* Trial progress bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Trial progress</span>
                <span>{Math.max(0, 14 - daysRemaining)} of 14 days used</span>
              </div>
              <div
                className="h-2 w-full rounded-full bg-gold-muted overflow-hidden"
                role="progressbar"
                aria-valuenow={Math.max(0, 14 - daysRemaining)}
                aria-valuemin={0}
                aria-valuemax={14}
                aria-label="Trial progress"
              >
                <div
                  className="h-full rounded-full bg-gold transition-all duration-300"
                  style={{
                    width: `${Math.min(100, ((14 - daysRemaining) / 14) * 100)}%`,
                  }}
                />
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-3 pt-1">
              <Button
                variant="brand"
                size="sm"
                className="min-h-[44px] gap-2"
                onClick={() => handleUpgrade(false)}
                disabled={isCheckoutLoading}
                aria-label="Subscribe now to continue after trial"
              >
                {isCheckoutLoading ? (
                  <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden="true" />
                ) : (
                  <CreditCard className="size-4" aria-hidden="true" />
                )}
                {isCheckoutLoading ? 'Starting checkout...' : 'Subscribe Now'}
              </Button>

              {/* AC5: Cancel Trial */}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="min-h-[44px] gap-2 text-muted-foreground hover:text-destructive"
                    disabled={isCancelLoading}
                    aria-label="Cancel your free trial"
                  >
                    {isCancelLoading ? (
                      <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden="true" />
                    ) : (
                      <XCircle className="size-4" aria-hidden="true" />
                    )}
                    {isCancelLoading ? 'Processing...' : 'Cancel Trial'}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="rounded-[24px]">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancel your free trial?</AlertDialogTitle>
                    <AlertDialogDescription asChild>
                      <div className="space-y-3">
                        <p>If you cancel your trial:</p>
                        <div className="space-y-2">
                          <div className="flex items-start gap-2 text-sm">
                            <CheckCircle
                              className="size-4 text-success shrink-0 mt-0.5"
                              aria-hidden="true"
                            />
                            <span>Your payment method will not be charged</span>
                          </div>
                          <div className="flex items-start gap-2 text-sm">
                            <XCircle
                              className="size-4 text-destructive shrink-0 mt-0.5"
                              aria-hidden="true"
                            />
                            <span>You will lose access to premium features immediately</span>
                          </div>
                          <div className="flex items-start gap-2 text-sm">
                            <CheckCircle
                              className="size-4 text-success shrink-0 mt-0.5"
                              aria-hidden="true"
                            />
                            <span>Your progress, notes, and achievements are never deleted</span>
                          </div>
                          <div className="flex items-start gap-2 text-sm">
                            <XCircle
                              className="size-4 text-destructive shrink-0 mt-0.5"
                              aria-hidden="true"
                            />
                            <span>You cannot start another free trial in the future</span>
                          </div>
                        </div>
                      </div>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep Trial</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleCancelSubscription}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Cancel Trial
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            {/* Portal error banner */}
            {portalError && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm"
              >
                <AlertTriangle
                  className="size-4 text-destructive shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                <div className="flex-1">
                  <p className="text-destructive">{portalError}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0 gap-1.5 text-destructive hover:text-destructive min-h-[36px]"
                  onClick={() => {
                    setPortalError(null)
                  }}
                  aria-label="Dismiss error"
                >
                  <RefreshCw className="size-3.5" aria-hidden="true" />
                  Dismiss
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Premium tier — active subscription with management */}
        {state === 'premium' && entitlement && (
          <div className="space-y-4">
            <PlanDetails entitlement={entitlement} />

            {/* Portal error banner */}
            {portalError && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm"
              >
                <AlertTriangle
                  className="size-4 text-destructive shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                <div className="flex-1">
                  <p className="text-destructive">{portalError}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0 gap-1.5 text-destructive hover:text-destructive min-h-[36px]"
                  onClick={() => {
                    setPortalError(null)
                    handleManageBilling()
                  }}
                  aria-label="Retry opening billing portal"
                >
                  <RefreshCw className="size-3.5" aria-hidden="true" />
                  Retry
                </Button>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-wrap gap-3 pt-1">
              <Button
                variant="brand-outline"
                size="sm"
                className="min-h-[44px] gap-2"
                onClick={handleManageBilling}
                disabled={isPortalLoading}
                aria-label="Open Stripe billing portal to manage payment methods and invoices"
              >
                {isPortalLoading ? (
                  <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden="true" />
                ) : (
                  <CreditCard className="size-4" aria-hidden="true" />
                )}
                {isPortalLoading ? 'Opening...' : 'Manage Billing'}
                {!isPortalLoading && <ExternalLink className="size-3.5" aria-hidden="true" />}
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="min-h-[44px] gap-2 text-muted-foreground hover:text-destructive"
                    disabled={isCancelLoading}
                    aria-label="Cancel your premium subscription"
                  >
                    {isCancelLoading ? (
                      <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden="true" />
                    ) : (
                      <XCircle className="size-4" aria-hidden="true" />
                    )}
                    {isCancelLoading ? 'Processing...' : 'Cancel Subscription'}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="rounded-[24px]">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancel your subscription?</AlertDialogTitle>
                    <AlertDialogDescription asChild>
                      <div className="space-y-3">
                        <p>If you cancel, here is what happens:</p>
                        <div className="space-y-2">
                          <div className="flex items-start gap-2 text-sm">
                            <CheckCircle
                              className="size-4 text-success shrink-0 mt-0.5"
                              aria-hidden="true"
                            />
                            <span>
                              You keep premium access until the end of your current billing period
                              {entitlement.expiresAt && (
                                <>
                                  {' '}
                                  (
                                  {new Date(entitlement.expiresAt).toLocaleDateString(undefined, {
                                    month: 'long',
                                    day: 'numeric',
                                    year: 'numeric',
                                  })}
                                  )
                                </>
                              )}
                            </span>
                          </div>
                          <div className="flex items-start gap-2 text-sm">
                            <CheckCircle
                              className="size-4 text-success shrink-0 mt-0.5"
                              aria-hidden="true"
                            />
                            <span>Your progress, notes, and achievements are never deleted</span>
                          </div>
                          <div className="flex items-start gap-2 text-sm">
                            <XCircle
                              className="size-4 text-destructive shrink-0 mt-0.5"
                              aria-hidden="true"
                            />
                            <span>
                              You lose access to AI Summaries, Knowledge Gap Detection, AI Learning
                              Paths, and Auto Note Organization
                            </span>
                          </div>
                          <div className="flex items-start gap-2 text-sm">
                            <CheckCircle
                              className="size-4 text-success shrink-0 mt-0.5"
                              aria-hidden="true"
                            />
                            <span>You can resubscribe anytime to restore premium features</span>
                          </div>
                        </div>
                      </div>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep Subscription</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleCancelSubscription}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Cancel Subscription
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        )}

        {/* Offline / stale cache state */}
        {state === 'offline-cached' && entitlement && (
          <div className="space-y-4">
            <PlanDetails entitlement={entitlement} />

            {/* Offline notice */}
            <div
              role="status"
              className="flex items-start gap-2 rounded-xl border border-warning/20 bg-warning/5 p-3 text-sm"
              aria-live="polite"
            >
              <WifiOff className="size-4 text-warning shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="text-foreground font-medium">Using cached subscription data</p>
                <p className="text-muted-foreground mt-0.5">
                  Last updated:{' '}
                  {new Date(entitlement.cachedAt).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>

            {/* Disabled action buttons with tooltips */}
            <TooltipProvider>
              <div className="flex flex-wrap gap-3 pt-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span tabIndex={0}>
                      <Button
                        variant="brand-outline"
                        size="sm"
                        className="min-h-[44px] gap-2"
                        disabled
                        aria-label="Manage Billing — requires internet connection"
                      >
                        <CreditCard className="size-4" aria-hidden="true" />
                        Manage Billing
                        <ExternalLink className="size-3.5" aria-hidden="true" />
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Requires an internet connection</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <span tabIndex={0}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="min-h-[44px] gap-2 text-muted-foreground"
                        disabled
                        aria-label="Cancel Subscription — requires internet connection"
                      >
                        <XCircle className="size-4" aria-hidden="true" />
                        Cancel Subscription
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Requires an internet connection</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
