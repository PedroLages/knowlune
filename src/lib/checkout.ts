// E19-S02: Client-side checkout service
// Handles Stripe Checkout initiation, entitlement polling, and local caching.

import { supabase } from '@/lib/auth/supabase'
import { db } from '@/db/schema'
import { useAuthStore } from '@/stores/useAuthStore'
import type { CachedEntitlement } from '@/data/types'

const NOT_CONFIGURED = 'Subscription service is not configured. Please check your Supabase setup.'

/**
 * Initiates a Stripe Checkout session by calling the create-checkout Edge Function.
 * Returns the checkout URL for client redirect, or an error message.
 */
export async function startCheckout(): Promise<{ url: string } | { error: string }> {
  if (!supabase) return { error: NOT_CONFIGURED }

  const session = useAuthStore.getState().session
  if (!session) return { error: 'You must be signed in to upgrade.' }

  try {
    const { data, error } = await supabase.functions.invoke('create-checkout', {
      body: { origin: window.location.origin },
    })

    if (error) {
      console.error('create-checkout invoke error:', error)
      return { error: 'Unable to start checkout. Please try again.' }
    }

    if (!data?.url) {
      return { error: 'Unable to start checkout. Please try again.' }
    }

    return { url: data.url }
  } catch (err) {
    console.error('startCheckout error:', err)
    return { error: 'Unable to start checkout. Please try again.' }
  }
}

/**
 * Polls the Supabase entitlements table until the user's tier is not 'free',
 * or until the timeout expires. Used after Stripe Checkout redirect return
 * to wait for the webhook to process.
 */
export async function pollEntitlement(
  maxWaitMs = 30_000,
  intervalMs = 2_000,
  signal?: AbortSignal
): Promise<CachedEntitlement | null> {
  if (!supabase) return null

  const user = useAuthStore.getState().user
  if (!user) return null

  const deadline = Date.now() + maxWaitMs

  while (Date.now() < deadline) {
    if (signal?.aborted) return null
    try {
      const { data, error } = await supabase
        .from('entitlements')
        .select('user_id, tier, stripe_customer_id, stripe_subscription_id, plan_id, expires_at')
        .eq('user_id', user.id)
        .single()

      if (!error && data && data.tier !== 'free') {
        const entitlement: CachedEntitlement = {
          userId: data.user_id,
          tier: data.tier,
          stripeCustomerId: data.stripe_customer_id ?? undefined,
          stripeSubscriptionId: data.stripe_subscription_id ?? undefined,
          planId: data.plan_id ?? undefined,
          expiresAt: data.expires_at ?? undefined,
          cachedAt: new Date().toISOString(),
        }

        await cacheEntitlement(entitlement)
        return entitlement
      }
    } catch (err) {
      console.warn('Entitlement poll attempt failed:', err)
    }

    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, intervalMs))
  }

  return null // Timeout — webhook hasn't processed yet
}

/**
 * Caches an entitlement record to the local Dexie database.
 * Uses put() for upsert behavior (overwrite if exists).
 */
export async function cacheEntitlement(entitlement: CachedEntitlement): Promise<void> {
  try {
    await db.entitlements.put(entitlement)
  } catch (err) {
    console.error('Failed to cache entitlement:', err)
  }
}

/**
 * Reads the cached entitlement for a user from the local Dexie database.
 * Returns null if no cache exists or the cache has expired (>7 days old).
 */
export async function getCachedEntitlement(userId: string): Promise<CachedEntitlement | null> {
  try {
    const cached = await db.entitlements.get(userId)
    if (!cached) return null

    // Check 7-day TTL
    const cachedDate = new Date(cached.cachedAt)
    const now = new Date()
    const daysSinceCached = (now.getTime() - cachedDate.getTime()) / (1000 * 60 * 60 * 24)

    if (daysSinceCached > 7) {
      // Cache expired — remove it
      await db.entitlements.delete(userId)
      return null
    }

    return cached
  } catch (err) {
    console.error('Failed to read cached entitlement:', err)
    return null
  }
}
