// E19-S09: GDPR Account Deletion Service
// Handles the full account deletion sequence with transactional safety.
// Sequence: re-auth check → cancel Stripe sub → delete Stripe customer →
//           delete Supabase auth → clear local cache → sign out

import { supabase } from '@/lib/auth/supabase'
import { useAuthStore } from '@/stores/useAuthStore'
import { db } from '@/db/schema'

const NOT_CONFIGURED = 'Account service is not configured. Please check your Supabase setup.'

/** Steps in the deletion pipeline, used for progress UI */
export type DeletionStep =
  | 'verifying'
  | 'cancelling-subscription'
  | 'deleting-customer'
  | 'deleting-auth'
  | 'clearing-cache'
  | 'signing-out'
  | 'complete'

export const DELETION_STEP_LABELS: Record<DeletionStep, string> = {
  verifying: 'Verifying your identity...',
  'cancelling-subscription': 'Cancelling subscription...',
  'deleting-customer': 'Removing payment data...',
  'deleting-auth': 'Deleting account...',
  'clearing-cache': 'Clearing local data...',
  'signing-out': 'Signing out...',
  complete: 'Account deletion scheduled',
}

export const DELETION_STEP_PROGRESS: Record<DeletionStep, number> = {
  verifying: 10,
  'cancelling-subscription': 25,
  'deleting-customer': 45,
  'deleting-auth': 65,
  'clearing-cache': 80,
  'signing-out': 95,
  complete: 100,
}

/** Grace period for soft-delete in days */
export const SOFT_DELETE_GRACE_DAYS = 7

/** Session age threshold for re-authentication (5 minutes) */
const REAUTH_THRESHOLD_MS = 5 * 60 * 1000

export interface DeletionResult {
  success: boolean
  error?: string
  /** If true, the error is about open invoices — user must resolve them first */
  invoiceError?: boolean
  /** If true, auth deletion failed after Stripe — flagged for admin review */
  flaggedForAdmin?: boolean
}

export interface AccountData {
  email: string
  createdAt: string
  subscriptionStatus?: string
  subscriptionPlan?: string
  subscriptionStartDate?: string
}

/**
 * Checks whether the current session requires re-authentication.
 * Returns true if the session is older than 5 minutes.
 */
export function sessionRequiresReauth(): boolean {
  const session = useAuthStore.getState().session
  if (!session) return true

  // Use iat (issued at) from the access token JWT, fallback to current time
  const iat = session.token_type === 'bearer' ? extractIat(session.access_token) : null
  if (!iat) return true

  const sessionAge = Date.now() - iat * 1000
  return sessionAge > REAUTH_THRESHOLD_MS
}

/**
 * Extracts the `iat` (issued at) claim from a JWT access token.
 * Returns seconds since epoch, or null if parsing fails.
 */
function extractIat(token: string): number | null {
  try {
    const payload = token.split('.')[1]
    if (!payload) return null
    const decoded = JSON.parse(atob(payload))
    return typeof decoded.iat === 'number' ? decoded.iat : null
  } catch {
    return null
  }
}

/**
 * Re-authenticates the user with their password.
 * This refreshes the session, resetting the `iat` timestamp.
 */
export async function reauthenticate(password: string): Promise<{ error?: string }> {
  if (!supabase) return { error: NOT_CONFIGURED }

  const user = useAuthStore.getState().user
  if (!user?.email) return { error: 'No active session.' }

  try {
    const { error } = await supabase.auth.signInWithPassword({
      email: user.email,
      password,
    })
    if (error) return { error: 'Incorrect password. Please try again.' }
    return {}
  } catch {
    return { error: 'Unable to verify password. Check your connection and try again.' }
  }
}

/**
 * Fetches the user's account data summary for the "My Data" panel.
 */
export async function getAccountData(): Promise<AccountData | null> {
  const user = useAuthStore.getState().user
  if (!user) return null

  const data: AccountData = {
    email: user.email ?? 'Unknown',
    createdAt: user.created_at ?? new Date().toISOString(),
  }

  // Try to fetch subscription info from entitlements
  if (supabase) {
    try {
      const { data: entitlement } = await supabase
        .from('entitlements')
        .select('tier, plan_id, created_at')
        .eq('user_id', user.id)
        .single()

      if (entitlement) {
        data.subscriptionStatus = entitlement.tier
        data.subscriptionPlan = entitlement.plan_id ?? undefined
        data.subscriptionStartDate = entitlement.created_at ?? undefined
      }
    } catch {
      // Non-critical — just show what we have
    }
  }

  return data
}

/**
 * Executes the full account deletion sequence.
 * Uses a Supabase Edge Function for the server-side operations
 * (Stripe cancellation, customer deletion, auth deletion).
 *
 * The Edge Function implements a 7-day soft-delete grace period.
 * If any step fails, the entire operation is aborted (no partial state).
 *
 * @param onStep - Callback invoked as each step begins, for progress UI
 */
export async function deleteAccount(
  onStep?: (step: DeletionStep) => void
): Promise<DeletionResult> {
  if (!supabase) return { success: false, error: NOT_CONFIGURED }

  const session = useAuthStore.getState().session
  if (!session) return { success: false, error: 'You must be signed in to delete your account.' }

  try {
    // Step 1: Verify session freshness
    onStep?.('verifying')
    if (sessionRequiresReauth()) {
      return { success: false, error: 'Please re-enter your password to continue.' }
    }

    // Step 2: Call the delete-account Edge Function
    // The Edge Function handles: cancel sub → delete customer → soft-delete auth
    onStep?.('cancelling-subscription')

    const { data, error } = await supabase.functions.invoke('delete-account', {
      body: {},
    })

    if (error) {
      console.error('delete-account invoke error:', error)

      // Check for specific error types from the Edge Function
      const errorMessage =
        typeof error === 'object' && 'message' in error ? error.message : String(error)

      if (errorMessage.includes('open invoice') || errorMessage.includes('unpaid')) {
        return {
          success: false,
          error:
            'Cannot delete account: you have open invoices. Please resolve them in billing settings first.',
          invoiceError: true,
        }
      }

      if (errorMessage.includes('auth_deletion_failed')) {
        return {
          success: false,
          error:
            'Account deletion partially completed. Your account has been flagged for admin review. You will receive an email confirmation when deletion is complete.',
          flaggedForAdmin: true,
        }
      }

      return {
        success: false,
        error: 'Unable to delete account. Please try again later.',
      }
    }

    // Guard: Edge Function boot-crash returns HTTP 200 with error in body (error field is null).
    // data?.error is set when Deno runtime crashes before the function can return a real response.
    if (data?.error || data?.success === false) {
      console.error('delete-account body error:', data)
      return {
        success: false,
        error: 'Account deletion failed. Please try again or contact support.',
      }
    }

    // Track progress through the steps the Edge Function completed
    if (data?.step === 'subscription_cancelled') {
      onStep?.('deleting-customer')
    }
    if (data?.step === 'customer_deleted') {
      onStep?.('deleting-auth')
    }

    // Step 3: Clear local entitlement cache
    onStep?.('clearing-cache')
    try {
      const user = useAuthStore.getState().user
      if (user) {
        await db.entitlements.delete(user.id)
      }
    } catch {
      // Non-critical — continue with sign-out
    }

    // Step 4: Sign out locally
    onStep?.('signing-out')
    const signOutResult = await useAuthStore.getState().signOut()
    if (signOutResult.error) {
      console.warn('Sign-out after deletion failed:', signOutResult.error)
      // Force clear local state even if sign-out API fails
      useAuthStore.setState({ user: null, session: null })
    }

    onStep?.('complete')

    return {
      success: true,
    }
  } catch (err) {
    console.error('deleteAccount error:', err)
    return {
      success: false,
      error: 'Unable to delete account. Please check your connection and try again.',
    }
  }
}

/**
 * Cancels a pending account deletion (during the 7-day grace period).
 * Called when the user signs back in during the grace period.
 */
export async function cancelAccountDeletion(): Promise<{ error?: string }> {
  if (!supabase) return { error: NOT_CONFIGURED }

  const session = useAuthStore.getState().session
  if (!session) return { error: 'You must be signed in to cancel deletion.' }

  try {
    const { error } = await supabase.functions.invoke('cancel-account-deletion', {
      body: {},
    })

    if (error) {
      console.error('cancel-account-deletion error:', error)
      return { error: 'Unable to cancel deletion. Please contact support.' }
    }

    return {}
  } catch {
    return { error: 'Unable to cancel deletion. Check your connection and try again.' }
  }
}
