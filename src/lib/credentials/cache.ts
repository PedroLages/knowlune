/**
 * In-memory credential cache shared by the ABS and OPDS resolvers.
 *
 * Scope: per session. Cleared on `SIGNED_OUT` via the auth lifecycle hook
 * (`src/app/hooks/useAuthLifecycle.ts` wires `credentialCache.clear()`).
 *
 * Users have at most ~3 servers/catalogs — no LRU needed. Null results are
 * cached with a 5-minute TTL so a missing credential does not hammer the
 * broker on repeated cover renders; positive results are cached for the full
 * session (invalidation is explicit via `invalidate(kind, id)` when a caller
 * rotates a credential, and implicit on sign-out).
 *
 * @module credentials/cache
 * @since E95-S05
 */

import type { CredentialType } from '@/lib/vaultCredentials'

/** ABS apiKey and OPDS password share this cache. `ai-provider` is untouched. */
export type CachedCredentialKind = Extract<CredentialType, 'abs-server' | 'opds-catalog'>

/** 5 minutes — only applied to negative (null) cache entries. */
const NULL_TTL_MS = 5 * 60 * 1000

interface CacheEntry {
  value: string | null
  /** When null, the entry is a positive hit with no expiration. */
  expiresAt: number | null
}

const store = new Map<string, CacheEntry>()

function keyOf(kind: CachedCredentialKind, id: string): string {
  return `${kind}:${id}`
}

export const credentialCache = {
  get(kind: CachedCredentialKind, id: string): string | null | undefined {
    const entry = store.get(keyOf(kind, id))
    if (!entry) return undefined
    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      store.delete(keyOf(kind, id))
      return undefined
    }
    return entry.value
  },

  set(kind: CachedCredentialKind, id: string, value: string | null): void {
    store.set(keyOf(kind, id), {
      value,
      expiresAt: value === null ? Date.now() + NULL_TTL_MS : null,
    })
  },

  invalidate(kind: CachedCredentialKind, id: string): void {
    store.delete(keyOf(kind, id))
  },

  /** Clear all entries. Wired to the SIGNED_OUT auth event. */
  clear(): void {
    store.clear()
  },

  /** Test-only size probe. */
  _size(): number {
    return store.size
  },
}
