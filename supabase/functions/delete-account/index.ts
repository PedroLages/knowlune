// E19-S09 / B4 / E119-S03 / E119-S04: Delete Account Edge Function
// Handles: POST /functions/v1/delete-account
// Auth: requires Supabase JWT
//
// Two-phase deletion:
//   Phase 1 (immediate, this function): soft-delete
//     - Captures user email in pending_deletions table (E119-S04)
//     - Stamps pending_deletion_at in user metadata
//     - Sets deleted_at on auth.users (Supabase soft-delete)
//     - Sends "deletion scheduled" email with 7-day cancel link (E119-S04)
//     - Returns scheduledDeletionAt to the client
//     - User can still log in to cancel during the 7-day grace period
//
//   Phase 2 (triggered by retention-tick after 7-day grace):
//     - Calls hardDeleteUser() from _shared/hardDeleteUser.ts
//     - Cascades across all 38 sync tables + 4 Storage buckets
//     - Anonymises Stripe record (retains customer + invoices for tax)
//     - Permanently removes auth.users row
//     - Sends "data deleted" receipt email using pending_deletions address (E119-S04)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendEmail } from '../_shared/sendEmail.ts'
import { deletionScheduledEmail } from '../_shared/emailTemplates.ts'

// Env var validation — fail fast if misconfigured
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')
if (!SUPABASE_URL) throw new Error('SUPABASE_URL is required')
if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required')
if (!SUPABASE_ANON_KEY) throw new Error('SUPABASE_ANON_KEY is required')

// Service-role admin client — used for auth.admin.* calls (bypasses RLS)
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// CORS: match create-checkout pattern — restrict to APP_URL when set, fall back to localhost dev.
// Avoids '*' which is unsafe for authenticated endpoints.
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_URL') || 'http://localhost:5173',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

/** Grace period in days — must match SOFT_DELETE_GRACE_DAYS in frontend */
const SOFT_DELETE_GRACE_DAYS = 7

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

/** Authenticate the request using the caller's JWT. Returns userId + email or an error Response. */
async function authenticate(req: Request): Promise<{ userId: string; userEmail: string | null } | Response> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return json({ success: false, error: 'Unauthorized' }, 401)
  }

  // Verify JWT using the anon client (user-scoped — validates the token)
  const userClient = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const {
    data: { user },
    error,
  } = await userClient.auth.getUser()

  if (error || !user) {
    return json({ success: false, error: 'Unauthorized' }, 401)
  }

  return { userId: user.id, userEmail: user.email ?? null }
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: CORS_HEADERS })
  }

  // Only POST allowed
  if (req.method !== 'POST') {
    return json({ success: false, error: 'Method not allowed' }, 405)
  }

  try {
    const authResult = await authenticate(req)
    if (authResult instanceof Response) return authResult
    const { userId, userEmail } = authResult

    // -------------------------------------------------------------------------
    // Phase 1: Soft-delete (immediate)
    //
    // Step 1a: Capture user email in pending_deletions BEFORE any PII scrub.
    // This allows retention-tick to send a deletion receipt after hard-delete,
    // even when auth.users is no longer accessible.
    // Non-fatal: if the insert fails, log and continue — the deletion must not
    // be blocked. The receipt email will be skipped if the row is missing.
    // -------------------------------------------------------------------------
    if (userEmail) {
      const { error: pendingError } = await supabaseAdmin
        .from('pending_deletions')
        .upsert({ user_id: userId, email: userEmail, requested_at: new Date().toISOString() })

      if (pendingError) {
        // Non-fatal: log and continue. Deletion still proceeds.
        // The receipt email will not be sent if this row is missing.
        console.error('[delete-account] failed to insert pending_deletions row:', {
          message: pendingError.message,
        })
      }
    } else {
      console.warn('[delete-account] user has no email address — pending_deletions row not created')
    }

    // Step 1b: Stamp pending_deletion_at in user metadata so:
    //   - cancel-account-deletion can verify and clear it
    //   - retention-tick can query for users past the grace period
    //
    // Must be done BEFORE auth.admin.deleteUser while the user is still reachable.
    const pendingDeletionAt = new Date().toISOString()

    const { error: metaError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: { pending_deletion_at: pendingDeletionAt },
    })

    if (metaError) {
      // Fatal: without pending_deletion_at, retention-tick cannot find this user
      // for hard-delete after the grace period — a GDPR erasure gap.
      console.error('[delete-account] failed to stamp pending_deletion_at:', {
        message: metaError.message,
        status: metaError.status,
      })
      return json({ success: false, error: 'Failed to delete account. Please try again.' }, 500)
    }

    // Step 1b: Supabase soft-delete — sets deleted_at on auth.users.
    // shouldSoftDelete=true: does NOT permanently remove the row.
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId, true)

    if (deleteError) {
      // Redacted log — avoid leaking user PII into container logs.
      console.error('[delete-account] admin.deleteUser error:', {
        message: deleteError.message,
        status: deleteError.status,
      })

      // Idempotent: if user already has deleted_at set, the admin API returns a 422.
      // Treat this as a success — the deletion is already scheduled.
      if (
        deleteError.message?.includes('already been deleted') ||
        deleteError.status === 422
      ) {
        const scheduledDeletionAt = new Date(
          Date.now() + SOFT_DELETE_GRACE_DAYS * 24 * 60 * 60 * 1000
        ).toISOString()
        return json({ success: true, scheduledDeletionAt, alreadyScheduled: true })
      }

      return json({ success: false, error: 'Failed to delete account. Please try again.' }, 500)
    }

    const scheduledDeletionAt = new Date(
      Date.now() + SOFT_DELETE_GRACE_DAYS * 24 * 60 * 60 * 1000
    ).toISOString()

    // Phase 2 (hard-delete) will be triggered by retention-tick after the 7-day
    // grace period. See supabase/functions/retention-tick/index.ts and
    // supabase/functions/_shared/hardDeleteUser.ts.

    // Step 1c: Send deletion-scheduled notification email (non-blocking).
    // The cancel URL directs the user to the app Settings page to cancel.
    // AC-4: email failure must never block the deletion response.
    if (userEmail) {
      const appUrl = Deno.env.get('APP_URL') || 'https://knowlune.pedrolages.net'
      const cancelUrl = `${appUrl}/settings`
      const template = deletionScheduledEmail(cancelUrl)
      const _ = await sendEmail({ to: userEmail, ...template }).catch((err: unknown) => {
        console.error('[delete-account] email send failed:', err)
        return null
      })
    }

    return json({ success: true, scheduledDeletionAt })
  } catch (err) {
    // Redacted log — capture message/name only; stack is kept via Error.
    const message = err instanceof Error ? err.message : String(err)
    console.error('[delete-account] unexpected error:', message)
    return json({ success: false, error: 'Internal server error' }, 500)
  }
})
