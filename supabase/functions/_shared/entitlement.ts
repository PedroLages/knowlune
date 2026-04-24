/**
 * Entitlement resolver (Deno / Edge Function port)
 *
 * Pure function library — no Express, no middleware abstraction.
 * Mirrors `server/middleware/entitlement.ts`:
 *   - BYOK detection from parsed JSON body (apiKey or ollamaServerUrl)
 *   - Tier resolution via Supabase PostgREST with 5s timeout
 *   - In-memory LRU cache (5-min TTL, max 1000 entries) scoped to the
 *     Edge Function instance (cold start = cache miss, acceptable).
 *   - Fail-safe: returns 'free' on any error (never grants premium on failure).
 */

export type EntitlementTier = 'free' | 'premium' | 'trial'

/** Cache TTL: 5 minutes. */
const CACHE_TTL_MS = 5 * 60 * 1000

/** Max cache entries before LRU eviction. */
const CACHE_MAX_ENTRIES = 1000

interface CacheEntry {
  tier: EntitlementTier
  expiresAt: number
}

/**
 * Simple insertion-order LRU using Map semantics.
 * - `get`: checks TTL; on hit, re-inserts to move to "most recent".
 * - `set`: deletes then re-inserts; evicts oldest when over capacity.
 */
const cache = new Map<string, CacheEntry>()

function cacheGet(key: string): EntitlementTier | undefined {
  const entry = cache.get(key)
  if (!entry) return undefined
  if (Date.now() >= entry.expiresAt) {
    cache.delete(key)
    return undefined
  }
  // Refresh recency.
  cache.delete(key)
  cache.set(key, entry)
  return entry.tier
}

function cacheSet(key: string, tier: EntitlementTier): void {
  if (cache.has(key)) cache.delete(key)
  cache.set(key, { tier, expiresAt: Date.now() + CACHE_TTL_MS })
  while (cache.size > CACHE_MAX_ENTRIES) {
    const oldestKey = cache.keys().next().value
    if (oldestKey === undefined) break
    cache.delete(oldestKey)
  }
}

/** Test-only: reset the module-level cache. */
export function __resetEntitlementCacheForTests(): void {
  cache.clear()
}

/**
 * Detects BYOK (Bring Your Own Key) requests from a parsed JSON body.
 *
 * Detection keys (must be non-empty strings):
 *   - `apiKey`          — cloud provider BYOK (OpenAI, Anthropic, Groq, Gemini)
 *   - `ollamaServerUrl` — self-hosted Ollama BYOK
 */
export function isBYOK(body: unknown): boolean {
  if (!body || typeof body !== 'object') return false
  const b = body as Record<string, unknown>
  const hasApiKey = typeof b.apiKey === 'string' && b.apiKey.length > 0
  const hasOllamaUrl =
    typeof b.ollamaServerUrl === 'string' && b.ollamaServerUrl.length > 0
  return hasApiKey || hasOllamaUrl
}

/**
 * Resolves a user's entitlement tier via Supabase PostgREST.
 *
 * Fail-safe: returns 'free' on any error (network, timeout, non-2xx, parse).
 * Uses an in-memory LRU cache (5-min TTL, max 1000 entries).
 */
export async function resolveEntitlement(params: {
  userId: string
  supabaseUrl: string
  serviceRoleKey: string
}): Promise<EntitlementTier> {
  const { userId, supabaseUrl, serviceRoleKey } = params

  const cached = cacheGet(userId)
  if (cached !== undefined) return cached

  const url =
    `${supabaseUrl}/rest/v1/subscriptions` +
    `?user_id=eq.${encodeURIComponent(userId)}` +
    `&status=eq.active&select=tier&limit=1`

  try {
    const response = await fetch(url, {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(5_000),
    })

    if (!response.ok) {
      console.error(
        `[entitlement] Supabase query failed: ${response.status} ${response.statusText}`
      )
      cacheSet(userId, 'free')
      return 'free'
    }

    const rows = (await response.json()) as Array<{ tier?: string }>
    let tier: EntitlementTier = 'free'
    if (rows.length > 0) {
      const t = rows[0].tier
      if (t === 'premium' || t === 'trial') tier = t
    }
    cacheSet(userId, tier)
    return tier
  } catch (error) {
    console.error(
      '[entitlement] Failed to resolve entitlement:',
      (error as Error).message
    )
    // Fail-safe: default to 'free'. Do NOT cache errors — retry next call.
    return 'free'
  }
}
