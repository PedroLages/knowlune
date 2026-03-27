/**
 * Shared types for server middleware modules.
 *
 * These types define the contract between authentication, entitlement,
 * rate-limiting, and origin-check middleware layers.
 */

import type { Request } from 'express'

/**
 * JWT payload shape from Supabase Auth tokens.
 * Contains the standard claims plus Supabase-specific fields.
 */
export interface SupabaseJwtPayload {
  /** Subject — the Supabase user ID (UUID) */
  sub: string
  /** Email address */
  email?: string
  /** Token issued-at timestamp (Unix seconds) */
  iat?: number
  /** Token expiration timestamp (Unix seconds) */
  exp?: number
  /** Audience */
  aud?: string
  /** Role (e.g., 'authenticated') */
  role?: string
  /** Supabase app_metadata */
  app_metadata?: Record<string, unknown>
  /** Supabase user_metadata */
  user_metadata?: Record<string, unknown>
}

/**
 * Express Request extended with authenticated user information.
 * Available after the `authenticate` middleware has run.
 */
export interface AuthenticatedRequest extends Request {
  /** Authenticated user data extracted from the JWT */
  user: SupabaseJwtPayload
  /** User's current entitlement tier (set by entitlement middleware) */
  entitlement?: EntitlementTier
  /** Whether the request is a BYOK (Bring Your Own Key) request — skips entitlement check */
  isBYOK?: boolean
}

/**
 * Entitlement tiers supported by the platform.
 */
export type EntitlementTier = 'free' | 'premium' | 'trial'

/**
 * Cached entitlement entry stored in the LRU cache.
 */
export interface EntitlementCacheEntry {
  /** User ID (Supabase sub) */
  userId: string
  /** Current entitlement tier */
  tier: EntitlementTier
  /** When this entry was cached (Unix ms) */
  cachedAt: number
}

/**
 * Configuration for the JWT authentication middleware.
 */
export interface AuthConfig {
  /** HS256 secret for JWT verification (from SUPABASE_JWT_SECRET) */
  jwtSecret?: string
  /** JWKS URL for key rotation (future — from SUPABASE_JWKS_URL) */
  jwksUrl?: string
}

/**
 * Configuration for the rate limiter middleware.
 */
export interface RateLimiterConfig {
  /** Maximum number of requests in the window */
  points: number
  /** Window duration in seconds */
  duration: number
}

/**
 * Configuration for the origin check middleware.
 */
export interface OriginCheckConfig {
  /** List of allowed origins (from ALLOWED_ORIGINS, comma-separated) */
  allowedOrigins: string[]
}
