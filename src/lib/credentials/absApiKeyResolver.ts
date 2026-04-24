/**
 * Audiobookshelf apiKey resolver + React hook.
 *
 * Every site that previously read `server.apiKey` directly must go through
 * `getAbsApiKey(serverId)` (imperative context) or `useAbsApiKey(serverId)`
 * (render context). The compiler enforces this — `AudiobookshelfServer` no
 * longer exposes `apiKey` (E95-S05).
 *
 * @module credentials/absApiKeyResolver
 * @since E95-S05
 */

import { createCredentialResolver } from './resolverFactory'

const resolver = createCredentialResolver('abs-server')

/** Imperative lookup. Returns null when not configured or unrecoverable. */
export const getAbsApiKey = (serverId: string | undefined | null) => resolver.get(serverId)

/** React hook — returns `{ value, loading, authFailed }`. */
export const useAbsApiKey = (serverId: string | undefined | null) => resolver.useValue(serverId)

/** Invalidate the cached value for a single server (e.g. after credential rotation). */
export const invalidateAbsApiKey = (serverId: string) => resolver.invalidate(serverId)

/**
 * Last-known resolver outcome for a server. Used by the sync hook to decide
 * whether a null apiKey means "sign in required" vs "re-enter key" vs
 * "transient error".
 */
export const getAbsApiKeyReason = (serverId: string | undefined | null) =>
  resolver.getLastReason(serverId)
