/**
 * Vault credential client module — E95-S02
 *
 * Typed async wrappers around the vault-credentials Edge Function routes.
 * All functions are non-throwing: errors are surfaced via console.warn and
 * safe return values (null / false) rather than exceptions.
 *
 * When the user is not authenticated, all functions return immediately (no-op)
 * so callers never need to guard against unauthenticated state.
 *
 * @module vaultCredentials
 * @since E95-S02
 */

import { supabase } from '@/lib/auth/supabase'

/** Supported credential types that can be stored in Vault. */
export type CredentialType = 'ai-provider' | 'opds-catalog' | 'abs-server'

const FUNCTION_NAME = 'vault-credentials'

/** Build query string for GET/DELETE requests */
function buildQuery(credentialType: CredentialType, credentialId: string): string {
  return `?credentialType=${encodeURIComponent(credentialType)}&credentialId=${encodeURIComponent(credentialId)}`
}

/**
 * Result of a Vault write. Mirrors `ReadCredentialResult` so callers can
 * distinguish "user not signed in" from "network / server error" and surface
 * actionable messaging. `reason: 'unauthenticated'` is the common case when
 * the user tries to save ABS/OPDS credentials before signing into Supabase —
 * the legacy `storeCredential` would silently no-op, leading to downstream
 * "API key missing" errors at sync time with no breadcrumb at save time.
 */
export type StoreCredentialResult =
  | { ok: true }
  | { ok: false; reason: 'unauthenticated' | 'error'; message?: string }

/**
 * Discriminated-result variant of `storeCredential`. Prefer this at
 * user-initiated save sites so the UI can surface an error toast when the
 * Vault write could not proceed.
 */
export async function storeCredentialWithStatus(
  credentialType: CredentialType,
  credentialId: string,
  secret: string
): Promise<StoreCredentialResult> {
  if (!supabase) return { ok: false, reason: 'unauthenticated' }
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, reason: 'unauthenticated' }

  try {
    const { error } = await supabase.functions.invoke(`${FUNCTION_NAME}/store-credential`, {
      method: 'POST',
      body: { credentialType, credentialId, secret },
    })
    if (error) {
      console.warn('[vaultCredentials] storeCredential failed:', error)
      return { ok: false, reason: 'error', message: error.message }
    }
    return { ok: true }
  } catch (err) {
    console.warn('[vaultCredentials] storeCredential error:', err)
    return { ok: false, reason: 'error', message: err instanceof Error ? err.message : String(err) }
  }
}

/**
 * Stores (or updates) a credential in Supabase Vault.
 *
 * - No-op if the user is not authenticated.
 * - Non-throwing: errors are logged via console.warn.
 * - After a successful store, remove the credential from localStorage / Dexie.
 *
 * Legacy wrapper kept for fire-and-forget call sites (e.g. the vault
 * migration path). New call sites should prefer `storeCredentialWithStatus`.
 */
export async function storeCredential(
  credentialType: CredentialType,
  credentialId: string,
  secret: string
): Promise<void> {
  await storeCredentialWithStatus(credentialType, credentialId, secret)
}

/**
 * Checks if a credential is configured in Vault (without reading its value).
 *
 * - Returns false if the user is not authenticated or an error occurs.
 * - Safe to call on every render cycle (no secret data returned).
 */
export async function checkCredential(
  credentialType: CredentialType,
  credentialId: string
): Promise<boolean> {
  if (!supabase) return false
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return false

  try {
    const { data, error } = await supabase.functions.invoke(
      `${FUNCTION_NAME}/check-credential${buildQuery(credentialType, credentialId)}`,
      { method: 'GET' }
    )
    if (error) {
      console.warn('[vaultCredentials] checkCredential failed:', error)
      return false
    }
    return data?.configured === true
  } catch (err) {
    console.warn('[vaultCredentials] checkCredential error:', err)
    return false
  }
}

/**
 * Reads a credential from Vault (plaintext).
 *
 * Only call this at the point of making an API request — never persist or
 * display the returned value. Returns null if not found or on error.
 */
export async function readCredential(
  credentialType: CredentialType,
  credentialId: string
): Promise<string | null> {
  const result = await readCredentialWithStatus(credentialType, credentialId)
  return result.ok ? result.value : null
}

/**
 * Discriminated-result variant of `readCredential` used by E95-S05
 * resolvers so they can distinguish "not configured" from "auth failed"
 * and drive the 401 retry / `status: 'auth-failed'` flow.
 *
 * Status values:
 *   - `ok: true, value: string | null` — call succeeded; value may be null
 *     when no credential is configured for this `(type, id)` pair.
 *   - `ok: false, reason: 'unauthenticated'` — no Supabase user; callers
 *     should stop (we cannot read the vault without a JWT).
 *   - `ok: false, reason: 'auth-failed'` — the broker returned 401/403 or
 *     an auth-shaped `AuthError`; the resolver retries once after a session
 *     refresh before marking the row.
 *   - `ok: false, reason: 'error'` — network / unknown failure; resolver
 *     returns null but does NOT cache the miss.
 */
export type ReadCredentialResult =
  | { ok: true; value: string | null }
  | { ok: false; reason: 'unauthenticated' | 'auth-failed' | 'error'; message?: string }

export async function readCredentialWithStatus(
  credentialType: CredentialType,
  credentialId: string
): Promise<ReadCredentialResult> {
  if (!supabase) return { ok: false, reason: 'unauthenticated' }
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, reason: 'unauthenticated' }

  try {
    const { data, error } = await supabase.functions.invoke(
      `${FUNCTION_NAME}/read-credential${buildQuery(credentialType, credentialId)}`,
      { method: 'GET' }
    )
    if (error) {
      const status =
        (error as { status?: number; context?: { status?: number } }).status ??
        (error as { context?: { status?: number } }).context?.status
      if (status === 401 || status === 403) {
        return { ok: false, reason: 'auth-failed', message: error.message }
      }
      console.warn('[vaultCredentials] readCredential failed:', error)
      return { ok: false, reason: 'error', message: error.message }
    }
    const value = typeof data?.secret === 'string' ? data.secret : null
    return { ok: true, value }
  } catch (err) {
    console.warn('[vaultCredentials] readCredential error:', err)
    return { ok: false, reason: 'error', message: err instanceof Error ? err.message : String(err) }
  }
}

/**
 * Deletes a credential from Vault.
 *
 * - No-op if the user is not authenticated.
 * - Non-throwing: errors are logged via console.warn.
 * - Call after deleting the associated Dexie record.
 */
export async function deleteCredential(
  credentialType: CredentialType,
  credentialId: string
): Promise<void> {
  if (!supabase) return
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  try {
    const { error } = await supabase.functions.invoke(
      `${FUNCTION_NAME}/delete-credential${buildQuery(credentialType, credentialId)}`,
      { method: 'DELETE' }
    )
    if (error) {
      console.warn('[vaultCredentials] deleteCredential failed:', error)
    }
  } catch (err) {
    console.warn('[vaultCredentials] deleteCredential error:', err)
  }
}
