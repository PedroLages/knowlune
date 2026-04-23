// E119-S03 / E119-S04: Retention Tick Edge Function (Skeleton)
// Handles: POST /functions/v1/retention-tick
// Auth: service-to-service (no user JWT — called by scheduler/cron)
//
// Skeleton for E119-S11 (full retention scheduling):
//   - Queries auth.users for accounts past the 7-day soft-delete grace period
//   - Reads pre-scrub email from pending_deletions table (E119-S04)
//   - Calls hardDeleteUser() to cascade-delete all application data
//   - Sends hard-delete receipt email using captured address (E119-S04)
//
// [TODO: S11] Wire the cron trigger:
//   Option A (pg_cron): SELECT cron.schedule('retention-tick', '0 3 * * *',
//     $$SELECT net.http_post('https://<project>.supabase.co/functions/v1/retention-tick', '{}')$$);
//   Option B (external cron): Point an external HTTP cron job at this endpoint
//   with a shared secret header for authentication.
//
// [TODO: S11] Add dead-letter queue purge:
//   - Dexie syncQueue rows with status='dead-letter' older than retention period
//   - Only applies to the local IndexedDB — no server-side syncQueue table.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { hardDeleteUser } from '../_shared/hardDeleteUser.ts'
import { sendEmail } from '../_shared/sendEmail.ts'
import { deletionCompleteEmail } from '../_shared/emailTemplates.ts'

// Env var validation — fail fast if misconfigured
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')
// RETENTION_TICK_SECRET: shared secret for service-to-service authentication.
// Set in the Edge Function env and also in the cron caller (pg_cron or external cron).
// If absent, the function is open — set this in production.
const RETENTION_TICK_SECRET = Deno.env.get('RETENTION_TICK_SECRET')
if (!SUPABASE_URL) throw new Error('SUPABASE_URL is required')
if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required')

// Service-role admin client
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

/** Grace period in days — must match SOFT_DELETE_GRACE_DAYS in delete-account and frontend */
const SOFT_DELETE_GRACE_DAYS = 7

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req: Request) => {
  // Accept POST or GET (cron triggers may use either)
  if (req.method !== 'POST' && req.method !== 'GET') {
    return json({ success: false, error: 'Method not allowed' }, 405)
  }

  // Service-to-service authentication via shared secret.
  // Set RETENTION_TICK_SECRET in Edge Function env and in the cron caller.
  // If the env var is not configured, log a warning but allow through (dev/test).
  // In production, RETENTION_TICK_SECRET must be set — otherwise unauthenticated
  // callers could trigger the retention tick.
  if (RETENTION_TICK_SECRET) {
    const callerSecret = req.headers.get('x-retention-secret')
    if (callerSecret !== RETENTION_TICK_SECRET) {
      console.warn('[retention-tick] rejected request: missing or invalid x-retention-secret')
      return json({ success: false, error: 'Unauthorized' }, 401)
    }
  } else {
    console.warn('[retention-tick] RETENTION_TICK_SECRET not set — endpoint is unprotected. Set in production.')
  }

  try {
    // Optional: initialise Stripe for anonymisation if key is configured
    let stripe: Parameters<typeof hardDeleteUser>[2] | undefined
    if (STRIPE_SECRET_KEY) {
      const { default: Stripe } = await import('https://esm.sh/stripe@14?target=deno')
      const stripeClient = new Stripe(STRIPE_SECRET_KEY, {
        apiVersion: '2024-04-10',
        httpClient: Stripe.createFetchHttpClient(),
      })
      // Narrow to the interface expected by hardDeleteUser
      stripe = {
        customers: {
          search: (q: unknown) => stripeClient.customers.search(q as Parameters<typeof stripeClient.customers.search>[0]),
          update: (id: string, data: unknown) => stripeClient.customers.update(id, data as Parameters<typeof stripeClient.customers.update>[1]),
        },
      }
    }

    // -------------------------------------------------------------------------
    // Query all users with an expired pending_deletion_at
    //
    // auth.admin.listUsers() paginates at 50 users per page by default.
    // We loop through all pages to catch all expired accounts.
    // -------------------------------------------------------------------------
    const graceCutoff = new Date(Date.now() - SOFT_DELETE_GRACE_DAYS * 24 * 60 * 60 * 1000)

    const expiredUserIds: string[] = []
    let page = 1
    const perPage = 50

    while (true) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage,
      })

      if (error) {
        console.error('[retention-tick] listUsers error:', error.message)
        break
      }

      if (!data?.users || data.users.length === 0) break

      for (const user of data.users) {
        const meta = user.user_metadata as Record<string, string | null> | null
        const pendingAt = meta?.pending_deletion_at

        if (pendingAt) {
          const pendingDate = new Date(pendingAt)
          if (!isNaN(pendingDate.getTime()) && pendingDate < graceCutoff) {
            expiredUserIds.push(user.id)
          }
        }
      }

      // If we got fewer users than the page size, we've reached the last page
      if (data.users.length < perPage) break
      page++
    }

    // -------------------------------------------------------------------------
    // Hard-delete each expired user
    // -------------------------------------------------------------------------
    let processed = 0
    const errors: Array<{ userId: string; error: string }> = []

    for (const userId of expiredUserIds) {
      try {
        // E119-S04: Read the pre-scrub email address before hard-deleting.
        // The pending_deletions row captures the email at soft-delete time,
        // before auth.users is permanently removed.
        let capturedEmail: string | null = null
        const { data: pendingRow } = await supabaseAdmin
          .from('pending_deletions')
          .select('email')
          .eq('user_id', userId)
          .maybeSingle()

        if (pendingRow?.email) {
          capturedEmail = pendingRow.email
        } else {
          console.warn(`[retention-tick] no pending_deletions row for ${userId} — receipt email will be skipped`)
        }

        const result = await hardDeleteUser(userId, supabaseAdmin, stripe)

        if (result.tableErrors.length > 0 || result.bucketErrors.length > 0) {
          console.warn(`[retention-tick] partial erasure for ${userId}:`, {
            tableErrors: result.tableErrors,
            bucketErrors: result.bucketErrors,
          })
        }

        processed++
        console.log(`[retention-tick] hard-deleted user ${userId}`, {
          tablesDeleted: result.tablesDeleted.length,
          bucketsCleared: result.bucketsCleared.length,
          stripeAnonymised: result.stripeAnonymised,
          authDeleted: result.authDeleted,
        })

        // E119-S04: Send the hard-delete receipt email (non-blocking).
        // AC-4: email failure must not prevent the deletion from being recorded.
        if (capturedEmail) {
          const template = deletionCompleteEmail()
          const _ = await sendEmail({ to: capturedEmail, ...template }).catch((err: unknown) => {
            console.error(`[retention-tick] email send failed for ${userId}:`, err)
            return null
          })
        }

        // E119-S04: Clean up the pending_deletions row after processing.
        // Non-fatal: if delete fails, the row lingers as an audit record.
        const { error: cleanupError } = await supabaseAdmin
          .from('pending_deletions')
          .delete()
          .eq('user_id', userId)

        if (cleanupError) {
          console.warn(`[retention-tick] failed to delete pending_deletions row for ${userId}:`, cleanupError.message)
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.error(`[retention-tick] failed to hard-delete ${userId}:`, message)
        errors.push({ userId, error: message })
        // Continue processing other users — don't abort the entire tick
      }
    }

    return json({
      success: true,
      processed,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[retention-tick] unexpected error:', message)
    return json({ success: false, error: 'Internal server error' }, 500)
  }
})
