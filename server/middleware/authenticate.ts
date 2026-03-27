/**
 * JWT Authentication Middleware
 *
 * Validates Supabase JWTs using the `jose` library.
 * Supports HS256 (via SUPABASE_JWT_SECRET) with a JWKS-ready architecture
 * for future key rotation (via SUPABASE_JWKS_URL).
 *
 * Usage:
 *   app.use('/api/protected', createAuthMiddleware({ jwtSecret: process.env.SUPABASE_JWT_SECRET }))
 *
 * After this middleware, `req.user` contains the decoded JWT payload.
 */

import { jwtVerify, createRemoteJWKSet, type JWTVerifyResult, type KeyLike } from 'jose'
import type { Response, NextFunction } from 'express'
import type { AuthConfig, AuthenticatedRequest, SupabaseJwtPayload } from './types.js'

/**
 * Creates an Express middleware that validates JWTs from the Authorization header.
 *
 * @param config - JWT configuration (secret or JWKS URL)
 * @returns Express middleware function
 */
export function createAuthMiddleware(config: AuthConfig) {
  // Validate config at startup — fail fast
  if (!config.jwtSecret && !config.jwksUrl) {
    throw new Error(
      'Authentication middleware requires either SUPABASE_JWT_SECRET or SUPABASE_JWKS_URL'
    )
  }

  // Pre-compute the key/JWKS set once (not per-request)
  let keyOrJwks: Uint8Array | ReturnType<typeof createRemoteJWKSet>

  if (config.jwksUrl) {
    // Future: JWKS-based key resolution with automatic rotation
    keyOrJwks = createRemoteJWKSet(new URL(config.jwksUrl))
  } else {
    // Current: HS256 symmetric secret
    keyOrJwks = new TextEncoder().encode(config.jwtSecret!)
  }

  return async function authenticate(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing or malformed Authorization header' })
      return
    }

    const token = authHeader.slice(7) // Remove "Bearer " prefix

    if (!token) {
      res.status(401).json({ error: 'Empty bearer token' })
      return
    }

    try {
      const result: JWTVerifyResult = await jwtVerify(
        token,
        keyOrJwks as KeyLike | Uint8Array,
        {
          algorithms: config.jwksUrl ? undefined : ['HS256'],
        }
      )

      const payload = result.payload as unknown as SupabaseJwtPayload

      // Validate required claims
      if (!payload.sub) {
        res.status(401).json({ error: 'JWT missing required "sub" claim' })
        return
      }

      // Attach user to request for downstream middleware/handlers
      req.user = payload
      next()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Token verification failed'

      // Distinguish between expired and invalid tokens
      if (message.includes('expired') || message.includes('"exp" claim')) {
        res.status(401).json({ error: 'Token expired' })
        return
      }

      res.status(401).json({ error: 'Invalid token' })
    }
  }
}
