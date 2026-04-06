/**
 * Entitlement Middleware
 *
 * Resolves a user's subscription tier (free/premium/trial) using an LRU cache
 * with Supabase as the source of truth. Cache entries expire after 5 minutes
 * to balance performance with freshness.
 *
 * BYOK (Bring Your Own Key) detection:
 *   Requests containing `apiKey` (cloud providers) or `ollamaServerUrl` (self-hosted)
 *   in the request body skip the entitlement check entirely. BYOK requests still
 *   require a valid JWT (no open relay). The BYOK flag is set on `req.isBYOK`.
 *
 * Usage:
 *   app.use('/api/ai', createDetectBYOKMiddleware())
 *   app.use('/api/ai', createEntitlementMiddleware({ ... }))
 *
 * Middleware chain: authenticateJWT -> detectBYOK -> [if !BYOK: checkEntitlement] -> rateLimitByTier
 *
 * After this middleware, `req.entitlement` contains the user's tier.
 * Requires `authenticate` middleware to have run first (needs req.user).
 */

import { LRUCache } from 'lru-cache'
import type { Response, NextFunction } from 'express'
import type { AuthenticatedRequest, EntitlementCacheEntry, EntitlementTier } from './types.js'

/** Cache TTL in milliseconds (5 minutes) */
const CACHE_TTL_MS = 5 * 60 * 1000

/** Maximum number of cached entries */
const CACHE_MAX_ENTRIES = 1000

/**
 * Configuration for the entitlement middleware.
 */
export interface EntitlementConfig {
  /** Supabase project URL */
  supabaseUrl: string
  /** Supabase service role key (server-side only — never expose to client) */
  supabaseServiceRoleKey: string
}

/**
 * Fetches a user's entitlement tier from Supabase.
 * This is the fallback when the cache misses.
 *
 * Queries the `subscriptions` table for active subscriptions.
 * Falls back to 'free' if no active subscription is found.
 */
async function fetchEntitlementFromSupabase(
  userId: string,
  config: EntitlementConfig
): Promise<EntitlementTier> {
  const url = `${config.supabaseUrl}/rest/v1/subscriptions?user_id=eq.${encodeURIComponent(userId)}&status=eq.active&select=tier&limit=1`

  const response = await fetch(url, {
    headers: {
      apikey: config.supabaseServiceRoleKey,
      Authorization: `Bearer ${config.supabaseServiceRoleKey}`,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(5_000),
  })

  if (!response.ok) {
    console.error(
      `[entitlement] Supabase query failed: ${response.status} ${response.statusText}`
    )
    // Default to 'free' on error — fail-safe (never grant premium on failure)
    return 'free'
  }

  const rows = (await response.json()) as Array<{ tier?: string }>

  if (rows.length === 0) {
    return 'free'
  }

  const tier = rows[0].tier
  if (tier === 'premium' || tier === 'trial') {
    return tier
  }

  return 'free'
}

/**
 * Creates an Express middleware that detects BYOK (Bring Your Own Key) requests.
 *
 * Detection keys:
 *   - `body.apiKey` — cloud provider BYOK (OpenAI, Anthropic, Groq, Gemini)
 *   - `body.ollamaServerUrl` — self-hosted Ollama BYOK
 *
 * Sets `req.isBYOK = true` when detected. Downstream entitlement middleware
 * checks this flag to skip the subscription check.
 *
 * Critical design rule: BYOK detection is independent of entitlement state.
 * A BYOK request must NEVER be rejected because of hosted-AI entitlement state.
 */
export function createDetectBYOKMiddleware() {
  return function detectBYOK(
    req: AuthenticatedRequest,
    _res: Response,
    next: NextFunction
  ): void {
    const body = req.body as Record<string, unknown> | undefined

    const hasApiKey = typeof body?.apiKey === 'string' && body.apiKey.length > 0
    const hasOllamaUrl =
      typeof body?.ollamaServerUrl === 'string' && body.ollamaServerUrl.length > 0

    req.isBYOK = hasApiKey || hasOllamaUrl

    next()
  }
}

/**
 * Creates an Express middleware that resolves and attaches entitlement tier.
 * Uses an LRU cache (5-min TTL, max 1000 entries) with Supabase fallback.
 *
 * BYOK requests (req.isBYOK === true) skip the entitlement check entirely
 * and proceed directly to the next middleware. This ensures users who provide
 * their own API keys are never blocked by subscription state.
 *
 * @param config - Supabase connection configuration
 * @returns Express middleware function
 */
export function createEntitlementMiddleware(config: EntitlementConfig) {
  if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
    throw new Error(
      'Entitlement middleware requires supabaseUrl and supabaseServiceRoleKey'
    )
  }

  const cache = new LRUCache<string, EntitlementCacheEntry>({
    max: CACHE_MAX_ENTRIES,
    ttl: CACHE_TTL_MS,
  })

  return async function entitlement(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    // BYOK requests skip entitlement check — user provides their own key/server.
    // Critical: This check is independent of hosted-AI entitlement state.
    if (req.isBYOK) {
      next()
      return
    }

    if (!req.user?.sub) {
      res.status(401).json({ error: 'Authentication required for entitlement check' })
      return
    }

    const userId = req.user.sub

    // Check cache first
    const cached = cache.get(userId)
    if (cached) {
      req.entitlement = cached.tier
      next()
      return
    }

    // Cache miss — fetch from Supabase
    try {
      const tier = await fetchEntitlementFromSupabase(userId, config)

      // Update cache
      cache.set(userId, {
        userId,
        tier,
        cachedAt: Date.now(),
      })

      req.entitlement = tier
      next()
    } catch (error) {
      // silent-catch-ok: server middleware fail-safe, defaults to 'free' tier
      console.error('[entitlement] Failed to resolve entitlement:', (error as Error).message)
      // Fail-safe: default to 'free' — never grant premium on error
      req.entitlement = 'free'
      next()
    }
  }
}
