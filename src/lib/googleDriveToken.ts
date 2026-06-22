import { supabase } from '@/lib/auth/supabase'
import { useAuthStore } from '@/stores/useAuthStore'

/**
 * Get a valid Google Drive access token from the current auth session.
 *
 * Returns `null` when:
 * - Supabase is not configured
 * - No session exists
 * - The session has no `provider_token` (user hasn't granted Drive scope — needs re-auth)
 *
 * On 401, call `refreshDriveToken()` to obtain a fresh token after
 * the session has been refreshed via Supabase.
 */
export async function getDriveToken(): Promise<string | null> {
  if (!supabase) return null

  const session = useAuthStore.getState().session
  if (!session) return null

  // If we already have a provider_token, return it.
  if (session.provider_token) {
    return session.provider_token
  }

  // No provider_token — the user hasn't granted Drive scope.
  // Try a session refresh in case the token arrived after the last check
  // (e.g. after a re-auth in another tab).
  try {
    const { data, error } = await supabase.auth.refreshSession()
    if (error || !data.session?.provider_token) {
      return null
    }

    return data.session.provider_token
  } catch {
    return null
  }
}

/**
 * Refresh the current Supabase session and return the updated provider_token.
 * Designed to be called when a Drive API call returns 401.
 *
 * Returns null if the refreshed session still has no provider_token.
 */
export async function refreshDriveToken(): Promise<string | null> {
  if (!supabase) return null

  try {
    const { data, error } = await supabase.auth.refreshSession()
    if (error || !data.session?.provider_token) {
      return null
    }

    return data.session.provider_token
  } catch {
    return null
  }
}
