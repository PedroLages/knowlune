/**
 * Shared factory that turns a `CachedCredentialKind` into a resolver +
 * React hook pair. ABS and OPDS resolvers delegate here so the retry,
 * caching, telemetry, and sign-out-invalidation behavior cannot drift.
 *
 * Retry ladder on the broker read:
 *   1. Cache hit → return immediately (no broker call).
 *   2. Cache miss → call broker.
 *   3. Broker returns 401/403 → invalidate cache, call
 *      `supabase.auth.refreshSession()`, retry the broker once.
 *   4. Still 401/403 → emit `sync.credential.auth_failed` telemetry,
 *      return null, do NOT cache (callers can retry in a future session
 *      after re-authenticating).
 *   5. Broker returns network/unknown error → return null, do NOT cache.
 *
 * @module credentials/resolverFactory
 * @since E95-S05
 */

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/auth/supabase'
import { readCredentialWithStatus } from '@/lib/vaultCredentials'
import { credentialCache, type CachedCredentialKind } from './cache'
import { emitTelemetry } from './telemetry'

export interface ResolverHookResult {
  /** Resolved credential value, or `null` if unavailable / not configured. */
  value: string | null
  /** `true` while the first (or a re-fetch) broker round-trip is in flight. */
  loading: boolean
  /**
   * `true` when the broker returned 401/403 for this id and the resolver
   * could not recover via a session refresh. Consumers can drive a
   * "Re-enter credentials" banner from this flag (AC-4 deferred polish).
   */
  authFailed: boolean
}

/**
 * Create a `{ get, useValue, invalidate }` triplet for a credential kind.
 * The caller wraps this with a thin module so consumers import a named
 * function rather than the generic factory result.
 */
export function createCredentialResolver(kind: CachedCredentialKind) {
  /**
   * Tracks the last known outcome per `${kind}:${id}` key.
   * This separates "auth-failed" from "transient error / unauthenticated"
   * so `useValue` can set `authFailed` without racing the cache.
   */
  const lastReason = new Map<string, 'ok' | 'auth-failed' | 'error'>()

  async function get(id: string | undefined | null): Promise<string | null> {
    if (!id) return null

    const cached = credentialCache.get(kind, id)
    if (cached !== undefined) return cached

    let result = await readCredentialWithStatus(kind, id)

    if (!result.ok && result.reason === 'auth-failed') {
      // Retry once after refreshing the session.
      credentialCache.invalidate(kind, id)
      try {
        await supabase?.auth.refreshSession()
      } catch (err) {
        // silent-catch-ok — refresh errors fall through to the second attempt,
        // which will surface the same 401 and route into the auth-failed path.
        console.warn('[credentialResolver] refreshSession failed:', err)
      }
      result = await readCredentialWithStatus(kind, id)
    }

    const reasonKey = `${kind}:${id}`

    if (result.ok) {
      credentialCache.set(kind, id, result.value)
      lastReason.set(reasonKey, 'ok')
      return result.value
    }

    if (result.reason === 'auth-failed') {
      emitTelemetry('sync.credential.auth_failed', { kind, id })
      lastReason.set(reasonKey, 'auth-failed')
      // Do not cache — next session / re-auth should try again.
      return null
    }

    // network/unknown error or unauthenticated — do not cache; let next call retry.
    lastReason.set(reasonKey, 'error')
    return null
  }

  function useValue(id: string | undefined | null): ResolverHookResult {
    const [state, setState] = useState<ResolverHookResult>(() => {
      if (!id) return { value: null, loading: false, authFailed: false }
      const cached = credentialCache.get(kind, id)
      if (cached !== undefined) return { value: cached, loading: false, authFailed: false }
      return { value: null, loading: true, authFailed: false }
    })

    // Latest-request guard: if the id flips mid-flight, only the newest
    // response is allowed to commit state. (Avoids React strict-mode double
    // invocations racing each other.)
    const requestIdRef = useRef(0)

    useEffect(() => {
      if (!id) {
        setState({ value: null, loading: false, authFailed: false })
        return
      }
      const cached = credentialCache.get(kind, id)
      if (cached !== undefined) {
        setState({ value: cached, loading: false, authFailed: false })
        return
      }
      const reqId = ++requestIdRef.current
      setState(prev => ({ ...prev, loading: true }))
      ;(async () => {
        const value = await get(id)
        if (reqId !== requestIdRef.current) return
        // Use the explicit lastReason map to distinguish "auth-failed" from
        // transient network/unauthenticated errors — both result in null+no-cache
        // but only auth-failed should surface the "re-enter credentials" banner.
        const reasonKey = `${kind}:${id}`
        setState({
          value,
          loading: false,
          authFailed: lastReason.get(reasonKey) === 'auth-failed',
        })
      })()
    }, [id])

    return state
  }

  return {
    get,
    useValue,
    invalidate: (id: string) => credentialCache.invalidate(kind, id),
  }
}
