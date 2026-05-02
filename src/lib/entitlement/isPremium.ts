// E19-S03: Entitlement System & Offline Caching
// Provides useIsPremium() hook with server validation + IndexedDB caching.

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/auth/supabase'
import { useAuthStore } from '@/stores/useAuthStore'
import { cacheEntitlement, getCachedEntitlement } from '@/lib/checkout'
import { db } from '@/db/schema'
import type { CachedEntitlement, EntitlementTier } from '@/data/types'

/** Cache TTL in days — configurable constant per AC */
export const ENTITLEMENT_CACHE_TTL_DAYS = 7

export interface EntitlementStatus {
  /** Whether the user has premium access (tier === 'premium' or 'trial') */
  isPremium: boolean
  /** True while the initial entitlement check is in progress */
  loading: boolean
  /** Current subscription tier */
  tier: EntitlementTier
  /** Whether the cached entitlement is stale (>TTL days old) */
  isStale: boolean
  /** Error message if validation failed */
  error: string | null
  /** ISO 8601 trial expiration date (E19-S08) */
  trialEnd: string | null
  /** Whether the user has previously used a free trial (E19-S08) */
  hadTrial: boolean
}

/** Checks if a cached entitlement is within the TTL window */
export function isCacheFresh(cached: CachedEntitlement): boolean {
  const cachedDate = new Date(cached.cachedAt)
  const now = new Date()
  const daysSinceCached = (now.getTime() - cachedDate.getTime()) / (1000 * 60 * 60 * 24)
  return daysSinceCached <= ENTITLEMENT_CACHE_TTL_DAYS
}

/**
 * Validates entitlement against the Supabase server.
 * Returns the entitlement record or null if free/error.
 */
export async function validateEntitlementOnServer(userId: string): Promise<{
  entitlement: CachedEntitlement | null
  error: string | null
}> {
  if (!supabase) return { entitlement: null, error: null }

  const { data, error } = await supabase
    .from('entitlements')
    .select(
      'user_id, tier, stripe_customer_id, stripe_subscription_id, plan_id, expires_at, trial_end, had_trial'
    )
    .eq('user_id', userId)
    .single()

  if (error || !data) {
    return { entitlement: null, error: (error as { message?: string } | null)?.message ?? null }
  }

  const entitlement: CachedEntitlement = {
    userId: data.user_id,
    tier: data.tier,
    stripeCustomerId: data.stripe_customer_id ?? undefined,
    stripeSubscriptionId: data.stripe_subscription_id ?? undefined,
    planId: data.plan_id ?? undefined,
    expiresAt: data.expires_at ?? undefined,
    trialEnd: data.trial_end ?? undefined,
    hadTrial: data.had_trial ?? undefined,
    cachedAt: new Date().toISOString(),
  }

  return { entitlement, error: null }
}

function formatEntitlementValidationError(raw: string | null): string | null {
  if (!raw) return null
  const msg = raw.toLowerCase()
  // Common symptom when frontend expects a column that doesn't exist (schema drift).
  if (msg.includes('column') && msg.includes('does not exist')) {
    return 'Unable to verify your subscription due to a server configuration issue. Please try again shortly.'
  }
  // RLS/policy/permission misconfiguration.
  if (msg.includes('permission denied') || msg.includes('violates row-level security')) {
    return 'Unable to verify your subscription due to a permissions issue. Please try again shortly.'
  }
  return 'Unable to verify your subscription right now. Please try again shortly.'
}

/**
 * Clears the cached entitlement for a user.
 * Used on explicit denial (cancelled/expired subscription).
 */
export async function clearCachedEntitlement(userId: string): Promise<void> {
  try {
    await db.entitlements.delete(userId)
  } catch (err) {
    console.error('Failed to clear cached entitlement:', err)
  }
}

/**
 * React hook that provides the current user's entitlement status
 * with server validation and offline caching.
 *
 * **UX hint for fast rendering. Server-side middleware is the security boundary.**
 *
 * This hook determines whether to show premium UI elements (gates, badges,
 * feature toggles). It is NOT a security mechanism — a determined user could
 * patch this function to return `true`. All premium API endpoints are protected
 * by the Express middleware chain (JWT + entitlement + rate limiter) in
 * `server/middleware/`. Client-side checks exist solely to provide a responsive
 * UI without waiting for server round-trips on every render.
 *
 * Behavior:
 * - Online: validates against server, caches result in IndexedDB (7-day TTL)
 * - Offline with fresh cache (<7 days): honors cached entitlement
 * - Offline with stale cache (>7 days): disables premium, shows message
 * - Coming back online: auto-revalidates
 * - Explicit denial from server: clears cache immediately
 * - Network error: honors existing fresh cache, silent retry next launch
 */
export function useIsPremium(): EntitlementStatus {
  // Dev bypass: skip entitlement check entirely in development
  if (import.meta.env.VITE_DEV_PREMIUM === 'true') {
    return {
      isPremium: true,
      loading: false,
      tier: 'premium',
      isStale: false,
      error: null,
      trialEnd: null,
      hadTrial: false,
    }
  }

  const user = useAuthStore(s => s.user)
  const initialized = useAuthStore(s => s.initialized)
  const [tier, setTier] = useState<EntitlementTier>('free')
  const [loading, setLoading] = useState(true)
  const [isStale, setIsStale] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [trialEnd, setTrialEnd] = useState<string | null>(null)
  const [hadTrial, setHadTrial] = useState(false)
  const validationInProgress = useRef(false)
  const pendingRevalidation = useRef(false)

  const validate = useCallback(async () => {
    if (!user) return
    if (validationInProgress.current) {
      pendingRevalidation.current = true
      return
    }
    validationInProgress.current = true

    try {
      // Step 1: Check local cache first (fast path)
      const cached = await getCachedEntitlement(user.id)

      if (cached) {
        const fresh = isCacheFresh(cached)
        // Set cached value immediately (optimistic)
        setTier(cached.tier)
        setTrialEnd(cached.trialEnd ?? null)
        setHadTrial(cached.hadTrial ?? false)
        setIsStale(!fresh)

        if (!fresh) {
          // AC3: Stale cache — disable premium, show message
          setTier('free')
          setError(
            'Your subscription status is outdated. Please connect to the internet to verify.'
          )
          setLoading(false)
          // Don't return — try to revalidate below
        } else {
          // Fresh cache — show premium immediately
          setLoading(false)
        }
      }

      // Step 2: Try server validation (AC1 online, AC4 auto-revalidate)
      try {
        const { entitlement: serverResult, error: serverError } = await validateEntitlementOnServer(
          user.id
        )

        if (serverError) {
          // Surface validation failures instead of silently gating as free.
          console.error('[useIsPremium] Server entitlement validation failed:', serverError)
          if (!cached) {
            setError(formatEntitlementValidationError(serverError))
          }
        }

        if (serverResult) {
          if (serverResult.tier === 'free') {
            // AC8: Explicit denial — disable immediately, clear cache
            setTier('free')
            setTrialEnd(null)
            setHadTrial(serverResult.hadTrial ?? false)
            setIsStale(false)
            setError(null)
            await clearCachedEntitlement(user.id)
          } else {
            // AC1: Valid entitlement — cache and use
            setTier(serverResult.tier)
            setTrialEnd(serverResult.trialEnd ?? null)
            setHadTrial(serverResult.hadTrial ?? false)
            setIsStale(false)
            setError(null)
            await cacheEntitlement(serverResult)
          }
        } else if (!cached) {
          // No server result and no cache — user is free tier
          setTier('free')
          setIsStale(false)
          // If serverError exists, we already set a user-facing message above.
          if (!serverError) setError(null)
        }
        // If serverResult is null but we have fresh cache, keep using cache (AC7)
      } catch {
        // AC7: Network error — honor existing cache if fresh
        if (cached && isCacheFresh(cached)) {
          // Keep cached tier, no error shown
          setTier(cached.tier)
          setIsStale(false)
          setError(null)
        } else if (cached && !isCacheFresh(cached)) {
          // AC3: Stale cache + network error — disable premium
          setTier('free')
          setIsStale(true)
          setError(
            'Your subscription status is outdated. Please connect to the internet to verify.'
          )
        } else {
          // No cache at all + network error — free tier
          setTier('free')
          setError(null)
        }
      }
    } finally {
      setLoading(false)
      validationInProgress.current = false

      // If a revalidation was requested while we were in progress, run it now
      if (pendingRevalidation.current) {
        pendingRevalidation.current = false
        validate()
      }
    }
  }, [user])

  // Run validation on mount and when user changes
  useEffect(() => {
    if (!initialized) return

    if (!user) {
      setTier('free')
      setLoading(false)
      setIsStale(false)
      setError(null)
      setTrialEnd(null)
      setHadTrial(false)
      return
    }

    validate()
  }, [user, initialized, validate])

  // AC4: Auto-revalidate when coming back online
  useEffect(() => {
    if (!user) return

    function handleOnline() {
      validate()
    }

    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [user, validate])

  return {
    isPremium: tier === 'premium' || tier === 'trial',
    loading,
    tier,
    isStale,
    error,
    trialEnd,
    hadTrial,
  }
}
