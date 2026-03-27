/**
 * Rate Limiter Middleware
 *
 * Per-user token bucket rate limiting using `rate-limiter-flexible`.
 * Authenticated users are rate-limited by their user ID (from JWT sub claim).
 * Unauthenticated requests fall back to IP-based limiting.
 *
 * Usage:
 *   app.use('/api/premium', createRateLimiter({ points: 100, duration: 60 }))
 *
 * Returns 429 Too Many Requests with Retry-After header when exceeded.
 */

import { RateLimiterMemory } from 'rate-limiter-flexible'
import type { Request, Response, NextFunction } from 'express'
import type { AuthenticatedRequest, RateLimiterConfig } from './types.js'

/** Default rate limit: 100 requests per 60 seconds */
const DEFAULT_POINTS = 100
const DEFAULT_DURATION = 60 // seconds

/**
 * Creates an Express middleware that enforces per-user rate limiting.
 *
 * Uses the authenticated user's ID (req.user.sub) as the key when available,
 * falling back to the client's IP address for unauthenticated requests.
 *
 * @param config - Rate limiter configuration (points and duration)
 * @returns Express middleware function
 */
export function createRateLimiter(config?: RateLimiterConfig) {
  const limiter = new RateLimiterMemory({
    points: config?.points ?? DEFAULT_POINTS,
    duration: config?.duration ?? DEFAULT_DURATION,
  })

  return async function rateLimiter(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    // Use user ID for authenticated requests, IP for anonymous
    const authenticatedReq = req as AuthenticatedRequest
    const key = authenticatedReq.user?.sub ?? req.ip ?? 'unknown'

    try {
      const result = await limiter.consume(key)

      // Set rate limit headers for observability
      res.set('X-RateLimit-Remaining', String(result.remainingPoints))
      res.set('X-RateLimit-Reset', String(Math.ceil(result.msBeforeNext / 1000)))

      next()
    } catch (rateLimiterRes) {
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
