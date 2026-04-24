/**
 * Postgres-backed per-user rate limiter for Supabase Edge Functions.
 *
 * Fixed-window algorithm. Each check-and-increment is a single atomic
 * upsert executed via the `increment_rate_limit` Postgres RPC, so it
 * survives Edge Function cold starts (unlike RateLimiterMemory).
 *
 * Fail-open: on DB/network error we allow the request and log, to
 * avoid converting a storage outage into a full API outage.
 */

export type RateLimitTier = 'free' | 'premium' | 'trial' | 'byok'

export interface RateLimitResult {
  allowed: boolean
  limit: number
  remaining: number
  resetInSeconds: number
  /** Populated only when !allowed. */
  retryAfter?: number
}

interface TierConfig {
  limit: number
  windowSeconds: number
}

const TIER_LIMITS: Record<RateLimitTier, TierConfig> = {
  free: { limit: 5, windowSeconds: 60 },
  premium: { limit: 15, windowSeconds: 60 },
  trial: { limit: 15, windowSeconds: 60 },
  byok: { limit: 30, windowSeconds: 120 },
}

/** Timeout for the RPC call. Kept short so rate-limit never stalls a request. */
const RPC_TIMEOUT_MS = 2000

/**
 * Atomically check and increment the caller's rate-limit bucket.
 *
 * @returns RateLimitResult describing whether the request is allowed and
 *          header values to surface back to the client.
 */
export async function checkRateLimit(params: {
  userId: string
  tier: RateLimitTier
  supabaseUrl: string
  serviceRoleKey: string
}): Promise<RateLimitResult> {
  const { userId, tier, supabaseUrl, serviceRoleKey } = params
  const cfg = TIER_LIMITS[tier]
  const windowMs = cfg.windowSeconds * 1000

  const now = Date.now()
  const windowStartMs = Math.floor(now / windowMs) * windowMs
  const windowStartIso = new Date(windowStartMs).toISOString()
  const bucketKey = `ai-${tier}`

  const resetInSeconds = Math.max(
    1,
    Math.ceil((windowStartMs + windowMs - now) / 1000)
  )

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), RPC_TIMEOUT_MS)

  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/increment_rate_limit`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        p_user_id: userId,
        p_bucket_key: bucketKey,
        p_window_start: windowStartIso,
      }),
      signal: controller.signal,
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      // silent-catch-ok: fail-open logs and returns allowed=true below
      console.error('[rate-limit] RPC non-OK', res.status, text)
      return failOpen(cfg, resetInSeconds)
    }

    const body = await res.json()
    const newCount = typeof body === 'number' ? body : Number(body)
    if (!Number.isFinite(newCount)) {
      console.error('[rate-limit] RPC returned non-numeric body', body)
      return failOpen(cfg, resetInSeconds)
    }

    const allowed = newCount <= cfg.limit
    const remaining = Math.max(0, cfg.limit - newCount)
    const result: RateLimitResult = {
      allowed,
      limit: cfg.limit,
      remaining,
      resetInSeconds,
    }
    if (!allowed) {
      result.retryAfter = resetInSeconds
    }
    return result
  } catch (err) {
    // silent-catch-ok: fail-open is intentional — logged and surfaced as allowed
    console.error('[rate-limit] RPC failed, failing open:', err)
    return failOpen(cfg, resetInSeconds)
  } finally {
    clearTimeout(timeoutId)
  }
}

function failOpen(cfg: TierConfig, resetInSeconds: number): RateLimitResult {
  return {
    allowed: true,
    limit: cfg.limit,
    remaining: cfg.limit,
    resetInSeconds,
  }
}

/**
 * Standard rate-limit headers. `Retry-After` is only set when a request
 * is denied.
 */
export function rateLimitHeaders(
  result: RateLimitResult
): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(result.resetInSeconds),
  }
  if (!result.allowed && result.retryAfter !== undefined) {
    headers['Retry-After'] = String(result.retryAfter)
  }
  return headers
}

/** Exposed for tests. */
export const __internal = { TIER_LIMITS }
