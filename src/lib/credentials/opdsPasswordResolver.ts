/**
 * OPDS catalog password resolver + React hook.
 *
 * Mirror of `absApiKeyResolver` for OPDS catalogs. Consumers that previously
 * read `catalog.auth.password` directly must go through
 * `getOpdsPassword(catalogId)` (imperative context) or
 * `useOpdsPassword(catalogId)` (render context). The compiler enforces this —
 * `OpdsCatalog.auth` no longer exposes `password` (E95-S05).
 *
 * @module credentials/opdsPasswordResolver
 * @since E95-S05
 */

import { createCredentialResolver } from './resolverFactory'

const resolver = createCredentialResolver('opds-catalog')

/** Imperative lookup. Returns null when not configured or unrecoverable. */
export const getOpdsPassword = (catalogId: string | undefined | null) => resolver.get(catalogId)

/** React hook — returns `{ value, loading, authFailed }`. */
export const useOpdsPassword = (catalogId: string | undefined | null) =>
  resolver.useValue(catalogId)

/** Invalidate the cached value for a single catalog (e.g. after credential rotation). */
export const invalidateOpdsPassword = (catalogId: string) => resolver.invalidate(catalogId)
