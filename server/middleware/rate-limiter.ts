/**
 * Rate Limiter Middleware
 *
 * Per-user token bucket rate limiting using `rate-limiter-flexible`.
 * Authenticated users are rate-limited by their user ID (from JWT sub claim).
 * Unauthenticated requests fall back to IP-based limiting.
 *
 * Supports tier-based rate limiting:
 *   - BYOK: 30 burst, 15/min refill, 1 point per request
 *   - Default: 100 requests per 60 seconds (configurable)
 *
 * Usage:
 *   app.use('/api/ai', createRateLimiter({ points: 100, duration: 60 }))
 *
 * Returns 429 Too Many Requests with Retry-After header when exceeded.
 */

import { RateLimiterMemory } from 'rate-limiter-flexible'
import type { Request, Response, NextFunction } from 'express'
import type { AuthenticatedRequest, RateLimiterConfig } from './types.js'

/** Default rate limit: 100 requests per 60 seconds */
const DEFAULT_POINTS = 100
const DEFAULT_DURATION = 60 // seconds

/** BYOK rate limit: 30 burst, 15/min refill (= 30 points per 120 seconds) */
const BYOK_POINTS = 30
const BYOK_DURATION = 120 // seconds (30 points / 120s ≈ 15/min refill)

/**
 * Creates an Express middleware that enforces per-user rate limiting.
 *
 * Uses the authenticated user's ID (req.user.sub) as the key when available,
 * falling back to the client's IP address for unauthenticated requests.
 *
 * BYOK requests (req.isBYOK === true) use a separate rate limiter with
 * its own bucket: 30 burst, 15/min refill, 1 point per request. This ensures
 * BYOK rate limiting is independent of the user's subscription tier.
 *
 * @param config - Rate limiter configuration (points and duration)
 * @returns Express middleware function
 */
export function createRateLimiter(config?: RateLimiterConfig) {
  const defaultLimiter = new RateLimiterMemory({
    points: config?.points ?? DEFAULT_POINTS,
    duration: config?.duration ?? DEFAULT_DURATION,
  })

  const byokLimiter = new RateLimiterMemory({
    points: BYOK_POINTS,
    duration: BYOK_DURATION,
  })

  return async function rateLimiter(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    // Use user ID for authenticated requests, IP for anonymous
    const authenticatedReq = req as AuthenticatedRequest
    const key = authenticatedReq.user?.sub ?? req.ip ?? 'unknown'

    // Select limiter based on BYOK status
    const limiter = authenticatedReq.isBYOK ? byokLimiter : defaultLimiter

    try {
      const result = await limiter.consume(key)

      // Set rate limit headers for observability
      res.set('X-RateLimit-Remaining', String(result.remainingPoints))
      res.set('X-RateLimit-Reset', String(Math.ceil(result.msBeforeNext / 1000)))

      next()
    } catch (rateLimiterRes) {
      // silent-catch-ok: rate-limiter-flexible throws RateLimiterRes when limit exceeded, surfaced as 429
      // rate-limiter-flexible throws a RateLimiterRes when limit is exceeded
      const rlRes = rateLimiterRes as { msBeforeNext: number; remainingPoints: number }
      const retryAfter = Math.ceil(rlRes.msBeforeNext / 1000)

      res.set('Retry-After', String(retryAfter))
      res.set('X-RateLimit-Remaining', '0')
      res.set('X-RateLimit-Reset', String(retryAfter))
      res.status(429).json({
        error: 'Too many requests',
        retryAfter,
      })
    }
  }
}
