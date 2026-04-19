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
 * Stores (or updates) a credential in Supabase Vault.
 *
 * - No-op if the user is not authenticated.
 * - Non-throwing: errors are logged via console.warn.
 * - After a successful store, remove the credential from localStorage / Dexie.
 */
export async function storeCredential(
  credentialType: CredentialType,
  credentialId: string,
  secret: string
): Promise<void> {
  if (!supabase) return
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  try {
    const { error } = await supabase.functions.invoke(`${FUNCTION_NAME}/store-credential`, {
      method: 'POST',
      body: { credentialType, credentialId, secret },
    })
    if (error) {
      console.warn('[vaultCredentials] storeCredential failed:', error)
    }
  } catch (err) {
    console.warn('[vaultCredentials] storeCredential error:', err)
  }
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
  if (!supabase) return null
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  try {
    const { data, error } = await supabase.functions.invoke(
      `${FUNCTION_NAME}/read-credential${buildQuery(credentialType, credentialId)}`,
      { method: 'GET' }
    )
    if (error) {
      console.warn('[vaultCredentials] readCredential failed:', error)
      return null
    }
    return typeof data?.secret === 'string' ? data.secret : null
  } catch (err) {
    console.warn('[vaultCredentials] readCredential error:', err)
    return null
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
