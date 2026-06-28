/**
 * Course Server authToken resolver + React hook.
 *
 * Every site that needs the course server's auth token must go through
 * `getCourseServerToken(serverId)` (imperative context) or
 * `useCourseServerToken(serverId)` (render context). The server type
 * does not expose `authToken` — the compiler enforces this.
 *
 * @module credentials/courseServerTokenResolver
 * @since E133-S01
 */

import { createCredentialResolver } from './resolverFactory'

const resolver = createCredentialResolver('cs-server')

/** Imperative lookup. Returns null when not configured or unrecoverable. */
export const getCourseServerToken = (serverId: string | undefined | null) => resolver.get(serverId)

/** React hook — returns `{ value, loading, authFailed }`. */
export const useCourseServerToken = (serverId: string | undefined | null) =>
  resolver.useValue(serverId)

/** Invalidate the cached value for a single server (e.g. after credential rotation). */
export const invalidateCourseServerToken = (serverId: string) => resolver.invalidate(serverId)

/**
 * Last-known resolver outcome for a server. Used by the sync hook to decide
 * whether a null authToken means "sign in required" vs "re-enter key" vs
 * "transient error".
 */
export const getCourseServerTokenReason = (serverId: string | undefined | null) =>
  resolver.getLastReason(serverId)
