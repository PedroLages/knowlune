import { supabase } from '@/lib/auth/supabase'
import { useAuthStore } from '@/stores/useAuthStore'

const DRIVE_READ_GRANTED_KEY = 'knowlune_drive_read_granted'

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

/**
 * Request the `drive.readonly` scope incrementally via a new OAuth flow.
 *
 * Called when the user wants to use the Drive folder browser but hasn't yet
 * granted read access to their Drive. This triggers a Google consent screen
 * redirect asking for the additional `drive.readonly` scope alongside the
 * existing `drive.file` scope.
 *
 * After successful auth, the session is updated with a new `provider_token`
 * that has both scopes, and `knowlune_drive_read_granted` is stored in
 * localStorage so subsequent checks skip the API verification.
 *
 * Note: This function triggers a page redirect and does NOT return.
 */
export async function requestDriveReadScope(): Promise<void> {
  if (!supabase) return

  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      scopes:
        'email profile https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly',
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  })
  // OAuth redirects — no return
}

/**
 * Check whether the current session has the `drive.readonly` scope.
 *
 * First checks a localStorage flag (set after successful incremental re-auth).
 * If the flag is set and a valid provider_token exists, returns true without
 * making a network call.
 *
 * If the flag is not set but the token exists, makes a lightweight Drive API
 * `about.get` call to verify read access. On success, sets the flag and
 * returns true. On 403/insufficient scopes, returns false.
 *
 * Returns `false` if no Drive token is available.
 */
export async function hasDriveReadScope(): Promise<boolean> {
  const token = await getDriveToken()
  if (!token) return false

  // Fast path: flag was set after a previous successful verification
  if (localStorage.getItem(DRIVE_READ_GRANTED_KEY) === 'true') {
    return true
  }

  // Verify by making a lightweight Drive API call that requires drive.readonly
  try {
    const response = await fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (response.ok) {
      localStorage.setItem(DRIVE_READ_GRANTED_KEY, 'true')
      return true
    }

    // 403 with insufficient scopes error
    return false
  } catch {
    // Network error — assume scope not granted to avoid false positives
    return false
  }
}

/**
 * Clear the `knowlune_drive_read_granted` flag from localStorage.
 * Called on sign-out to reset the read-scope state.
 */
export function clearDriveReadFlag(): void {
  localStorage.removeItem(DRIVE_READ_GRANTED_KEY)
}

/**
 * Clear the `knowlune_drive_read_granted` flag from localStorage.
 * Called when the user explicitly signs out so the next visit re-evaluates.
 * @deprecated Use `clearDriveReadFlag()` instead.
 */
export const clearDriveReadScope = clearDriveReadFlag
