/**
 * Origin Check Middleware
 *
 * Validates that incoming requests originate from allowed origins.
 * Checks the Origin header (preferred) with Referer as fallback.
 * Protects against cross-origin request forgery.
 *
 * Usage:
 *   app.use('/api/protected', createOriginCheck({
 *     allowedOrigins: ['http://localhost:5173', 'https://knowlune.app']
 *   }))
 */

import type { Request, Response, NextFunction } from 'express'
import type { OriginCheckConfig } from './types.js'

/**
 * Creates an Express middleware that validates the request's Origin header
 * against a configurable allowlist.
 *
 * @param config - Origin check configuration with allowed origins
 * @returns Express middleware function
 */
export function createOriginCheck(config: OriginCheckConfig) {
  if (!config.allowedOrigins || config.allowedOrigins.length === 0) {
    throw new Error('Origin check middleware requires at least one allowed origin')
  }

  // Normalize origins: lowercase, strip trailing slashes
  const normalizedOrigins = new Set(
    config.allowedOrigins.map((o) => o.toLowerCase().replace(/\/+$/, ''))
  )

  return function originCheck(req: Request, res: Response, next: NextFunction): void {
    // Allow non-browser requests (e.g., server-to-server, curl) that lack Origin/Referer
    // These are not CSRF vectors — browsers always send Origin on cross-origin requests
    const origin = req.headers.origin
    const referer = req.headers.referer

    if (!origin && !referer) {
      // No Origin or Referer — likely a server-to-server or tool-based request
      next()
      return
    }

    // Check Origin header first (most reliable)
    if (origin) {
      const normalizedOrigin = origin.toLowerCase().replace(/\/+$/, '')
      if (normalizedOrigins.has(normalizedOrigin)) {
        next()
        return
      }
    }

    // Fallback: check Referer header (extract origin portion)
    if (referer) {
      try {
        const refererUrl = new URL(referer)
        const refererOrigin = refererUrl.origin.toLowerCase()
        if (normalizedOrigins.has(refererOrigin)) {
          next()
          return
        }
      } catch {
        // silent-catch-ok: invalid Referer URL, fall through to rejection
      }
    }

    res.status(403).json({ error: 'Forbidden: origin not allowed' })
  }
}
