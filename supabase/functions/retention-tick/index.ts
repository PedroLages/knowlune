// E119-S11: Retention TTL Enforcement Job (Full Implementation)
//
// Handles: POST /functions/v1/retention-tick
// Auth: service-to-service via x-retention-secret header
// Schedule: Cloudflare cron daily at 03:00 UTC
//
// What this function does on each invocation:
//   1. Validates x-retention-secret header
//   2. Heartbeat check: warns if no audit log row in last 48h (HEARTBEAT_MISS)
//   3. Generates a run_id UUID for this invocation
//   4. Soft-delete grace finaliser: hard-deletes users whose pending_deletion_at
//      is >7 days old (S03 logic, preserved verbatim)
//   5. Per-entry retention enforcement loop over RETENTION_POLICY:
//      - storage:exports → purge objects older than 7d from the exports bucket
//      - chat_conversations → DELETE rows with updated_at < now() - 365d
//      - all other entries → skipped (handled by hardDeleteUser cascade,
//        client-side only, or manually managed)
//   6. Batch-inserts audit rows to retention_audit_log
//   7. Returns 200 (all clean) or 207 (partial failures)
//
// Design decisions:
//   - Per-entry errors are non-fatal: the loop continues on error and the
//     failed entry is captured in the audit log. Returns HTTP 207 on partial failure.
//   - Audit rows are batch-inserted at the end of the run. Individual console.log
//     lines serve as a secondary audit trail if the batch insert fails.
//   - Storage purge uses paginated list() with a 500-object cap per run to avoid
//     timeouts on large buckets. A warning is logged if the cap is reached.
//   - chat_conversations 365d rolling delete: no is_pinned column exists in the
//     current schema, so all conversations older than 365d are deleted regardless
//     of pinned state. This is documented and accepted for S11. Future story adds
//     the is_pinned column.
//   - Idempotency: cutoffs are computed from now() at runtime; re-running on the
//     same day finds nothing new to delete (already-deleted rows don't exist).
//
// See: docs/deployment/retention-cron-setup.md for operational runbook.
// See: supabase/functions/_shared/retentionPolicy.ts for the policy data.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { hardDeleteUser } from '../_shared/hardDeleteUser.ts'
import { sendEmail } from '../_shared/sendEmail.ts'
import { deletionCompleteEmail } from '../_shared/emailTemplates.ts'
import { RETENTION_POLICY } from '../_shared/retentionPolicy.ts'

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')
const RETENTION_TICK_SECRET = Deno.env.get('RETENTION_TICK_SECRET')

if (!SUPABASE_URL) throw new Error('SUPABASE_URL is required')
if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required')

// Service-role admin client
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Grace period in days — must match SOFT_DELETE_GRACE_DAYS in delete-account and frontend */
const SOFT_DELETE_GRACE_DAYS = 7

/** Maximum Storage objects to remove per run to avoid timeouts on large buckets */
const EXPORTS_PURGE_CAP = 500

/** Rolling retention window for chat_conversations (days) */
const CHAT_RETENTION_DAYS = 365

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AuditRow {
  run_id: string
  artefact: string
  rows_affected: number
  started_at: string
  completed_at: string
  error: string | null
  skipped: boolean
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000)
}

// ---------------------------------------------------------------------------
// Heartbeat check
// ---------------------------------------------------------------------------

/**
 * Checks whether retention-tick has run successfully in the last 48 hours.
 * If not (and this is not the first-ever run), logs a HEARTBEAT_MISS error
 * that log aggregators can alert on.
 *
 * Does not throw — heartbeat failure is advisory, not blocking.
 */
async function checkHeartbeat(): Promise<void> {
  try {
    // Check for any row completed in the last 48 hours
    const { count: recentCount, error: recentError } = await supabaseAdmin
      .from('retention_audit_log')
      .select('id', { count: 'exact', head: true })
      .gt('completed_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())

    if (recentError) {
      console.warn('[retention-tick] heartbeat check query failed:', recentError.message)
      return
    }

    if (recentCount && recentCount > 0) {
      // Recent run found — heartbeat healthy
      return
    }

    // No recent run — check if this is the first-ever run
    const { count: totalCount, error: totalError } = await supabaseAdmin
      .from('retention_audit_log')
      .select('id', { count: 'exact', head: true })

    if (totalError) {
      console.warn('[retention-tick] heartbeat total-count query failed:', totalError.message)
      return
    }

    if (totalCount && totalCount > 0) {
      // Rows exist but none are recent — this is a genuine miss
      console.error(
        '[HEARTBEAT_MISS] retention-tick has not run successfully in 48h. ' +
        'Check Cloudflare cron trigger and Edge Function logs. ' +
        `Last known total rows: ${totalCount}.`
      )
    }
    // If totalCount === 0, this is the first run — no heartbeat miss to report
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.warn('[retention-tick] heartbeat check threw:', message)
  }
}

// ---------------------------------------------------------------------------
// Storage: exports bucket purge
// ---------------------------------------------------------------------------

/**
 * Purges exports/ bucket objects older than 7 days.
 * Lists objects with pagination (100 per page), capped at EXPORTS_PURGE_CAP
 * total removals per run to avoid timeouts.
 *
 * Returns the number of objects removed.
 * Throws on Storage API failure.
 */
async function purgeExportsBucket(): Promise<number> {
  const cutoff = daysAgo(7)
  const pathsToRemove: string[] = []
  let offset = 0
  const pageSize = 100

  while (pathsToRemove.length < EXPORTS_PURGE_CAP) {
    const { data: objects, error: listError } = await supabaseAdmin.storage
      .from('exports')
      .list('', { limit: pageSize, offset, sortBy: { column: 'created_at', order: 'asc' } })

    if (listError) {
      throw new Error(`Storage list failed: ${listError.message}`)
    }

    if (!objects || objects.length === 0) break

    for (const obj of objects) {
      // created_at may be a string (ISO 8601) or null depending on the Supabase version
      const createdAt = obj.created_at ? new Date(obj.created_at) : null
      if (createdAt && createdAt < cutoff) {
        pathsToRemove.push(obj.name)
      }
    }

    if (objects.length < pageSize) break
    offset += pageSize
  }

  if (pathsToRemove.length >= EXPORTS_PURGE_CAP) {
    console.warn(
      `[retention-tick] exports bucket purge cap reached (${EXPORTS_PURGE_CAP} objects). ` +
      'Some objects older than 7d may remain. Next run will continue purging.'
    )
  }

  if (pathsToRemove.length === 0) {
    return 0
  }

  const { error: removeError } = await supabaseAdmin.storage
    .from('exports')
    .remove(pathsToRemove)

  if (removeError) {
    throw new Error(`Storage remove failed: ${removeError.message}`)
  }

  console.log(`[retention-tick] exports bucket: removed ${pathsToRemove.length} expired objects`)
  return pathsToRemove.length
}

// ---------------------------------------------------------------------------
// DB: chat_conversations rolling delete
// ---------------------------------------------------------------------------

/**
 * Deletes chat_conversations rows with updated_at older than 365 days.
 *
 * NOTE: The chat_conversations table has no is_pinned column (S11 scope).
 * All conversations older than 365d are deleted regardless of pinned state.
 * A future story will add is_pinned support.
 *
 * Returns the number of rows deleted.
 * Throws on DB failure.
 */
async function purgeChatConversations(): Promise<number> {
  const cutoff = daysAgo(CHAT_RETENTION_DAYS)

  // Count eligible rows first so we can report rows_affected accurately.
  // Supabase JS v2 delete() does not return affected row count.
  const { count: eligibleCount, error: countError } = await supabaseAdmin
    .from('chat_conversations')
    .select('id', { count: 'exact', head: true })
    .lt('updated_at', cutoff.toISOString())

  if (countError) {
    throw new Error(`chat_conversations count failed: ${countError.message}`)
  }

  const rowsToDelete = eligibleCount ?? 0

  if (rowsToDelete === 0) {
    return 0
  }

  const { error: deleteError } = await supabaseAdmin
    .from('chat_conversations')
    .delete()
    .lt('updated_at', cutoff.toISOString())

  if (deleteError) {
    throw new Error(`chat_conversations delete failed: ${deleteError.message}`)
  }

  console.log(
    `[retention-tick] chat_conversations: deleted ${rowsToDelete} rows older than ${CHAT_RETENTION_DAYS}d`
  )
  return rowsToDelete
}

// ---------------------------------------------------------------------------
// Per-entry dispatch
// ---------------------------------------------------------------------------

/**
 * Dispatches enforcement for a single RETENTION_POLICY entry.
 *
 * Returns { rowsAffected, skipped, skipReason }.
 * Throws on enforcement error — callers wrap in try/catch.
 */
async function enforceEntry(
  artefact: string,
  period: string | null,
  deletionMechanism: string,
): Promise<{ rowsAffected: number; skipped: boolean; skipReason?: string }> {
  switch (artefact) {
    case 'storage:exports':
      return { rowsAffected: await purgeExportsBucket(), skipped: false }

    case 'chat_conversations':
      return { rowsAffected: await purgeChatConversations(), skipped: false }

    // Storage buckets other than exports are managed by hardDeleteUser — skip
    case 'storage:audio':
    case 'storage:covers':
    case 'storage:attachments':
      return {
        rowsAffected: 0,
        skipped: true,
        skipReason: 'Account-lifetime bucket — managed by hardDeleteUser cascade on account deletion',
      }

    // Client-side only — server cannot reach IndexedDB
    case 'sync_queue_dead_letter':
      return {
        rowsAffected: 0,
        skipped: true,
        skipReason: 'Client-side IndexedDB only; no server table to purge',
      }

    // Supabase Auth manages its own session log rotation
    case 'auth_session_logs':
      return {
        rowsAffected: 0,
        skipped: true,
        skipReason: 'Managed by Supabase Auth automatic rotation; no app-level action needed',
      }

    // Manual offline management
    case 'breach_register':
      return {
        rowsAffected: 0,
        skipped: true,
        skipReason: 'Maintained offline; pseudonymised within 30d per GDPR Art 33',
      }

    // Stripe + manual per legal obligation
    case 'invoices':
      return {
        rowsAffected: 0,
        skipped: true,
        skipReason: 'Financial records retained per legal obligation; Stripe anonymisation on account deletion',
      }

    // Consent-withdrawal artefacts — time-based TTL not applicable; handled by consentService
    case 'embeddings':
    case 'learner_models':
      return {
        rowsAffected: 0,
        skipped: true,
        skipReason: `Consent-withdrawal artefact; purged on consent withdrawal via consentService, not by time-based TTL. deletionMechanism: ${deletionMechanism}`,
      }

    default:
      // All remaining entries have period = 'Account lifetime + 30d' and
      // are handled by hardDeleteUser cascade. No active TTL enforcement needed.
      return {
        rowsAffected: 0,
        skipped: true,
        skipReason: `period='${period ?? 'indefinite'}'; handled by hardDeleteUser cascade on account deletion`,
      }
  }
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  // Accept POST or GET (cron triggers may use either)
  if (req.method !== 'POST' && req.method !== 'GET') {
    return json({ success: false, error: 'Method not allowed' }, 405)
  }

  // Service-to-service authentication via shared secret.
  // Guard: empty string is falsy — treat it the same as not-set to prevent misconfigured env
  // from silently bypassing authentication.
  if (RETENTION_TICK_SECRET && RETENTION_TICK_SECRET.length > 0) {
    const callerSecret = req.headers.get('x-retention-secret')
    if (callerSecret !== RETENTION_TICK_SECRET) {
      console.warn('[retention-tick] rejected request: missing or invalid x-retention-secret')
      return json({ success: false, error: 'Unauthorized' }, 401)
    }
  } else {
    console.warn(
      '[retention-tick] RETENTION_TICK_SECRET not set or empty — endpoint is unprotected. ' +
      'Set a non-empty secret in production.'
    )
  }

  try {
    // -------------------------------------------------------------------------
    // Step 1: Heartbeat check
    // -------------------------------------------------------------------------
    await checkHeartbeat()

    // -------------------------------------------------------------------------
    // Step 2: Generate run_id
    // -------------------------------------------------------------------------
    const runId = crypto.randomUUID()
    console.log(`[retention-tick] starting run ${runId}`)

    // -------------------------------------------------------------------------
    // Step 3: Optional Stripe client (for soft-delete grace finaliser)
    // -------------------------------------------------------------------------
    let stripe: Parameters<typeof hardDeleteUser>[2] | undefined
    if (STRIPE_SECRET_KEY) {
      const { default: Stripe } = await import('https://esm.sh/stripe@14?target=deno')
      const stripeClient = new Stripe(STRIPE_SECRET_KEY, {
        apiVersion: '2024-04-10',
        httpClient: Stripe.createFetchHttpClient(),
      })
      stripe = {
        customers: {
          search: (q: unknown) =>
            stripeClient.customers.search(
              q as Parameters<typeof stripeClient.customers.search>[0]
            ),
          update: (id: string, data: unknown) =>
            stripeClient.customers.update(
              id,
              data as Parameters<typeof stripeClient.customers.update>[1]
            ),
        },
      }
    }

    // -------------------------------------------------------------------------
    // Step 4: Soft-delete grace finaliser
    // (S03 logic — preserved verbatim)
    //
    // Queries all users with an expired pending_deletion_at, hard-deletes them,
    // sends the deletion receipt email, and cleans up pending_deletions rows.
    // -------------------------------------------------------------------------
    const graceCutoff = daysAgo(SOFT_DELETE_GRACE_DAYS)

    const expiredUserIds: string[] = []
    let page = 1
    const perPage = 50

    while (true) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage })

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

      if (data.users.length < perPage) break
      page++
    }

    let graceProcessed = 0
    const graceErrors: Array<{ userId: string; error: string }> = []

    for (const userId of expiredUserIds) {
      try {
        let capturedEmail: string | null = null
        const { data: pendingRow } = await supabaseAdmin
          .from('pending_deletions')
          .select('email')
          .eq('user_id', userId)
          .maybeSingle()

        if (pendingRow?.email) {
          capturedEmail = pendingRow.email
        } else {
          console.warn(
            `[retention-tick] no pending_deletions row for ${userId} — receipt email will be skipped`
          )
        }

        const result = await hardDeleteUser(userId, supabaseAdmin, stripe)

        if (result.tableErrors.length > 0 || result.bucketErrors.length > 0) {
          console.warn(`[retention-tick] partial erasure for ${userId}:`, {
            tableErrors: result.tableErrors,
            bucketErrors: result.bucketErrors,
          })
        }

        graceProcessed++
        console.log(`[retention-tick] hard-deleted user ${userId}`, {
          tablesDeleted: result.tablesDeleted.length,
          bucketsCleared: result.bucketsCleared.length,
          stripeAnonymised: result.stripeAnonymised,
          authDeleted: result.authDeleted,
        })

        if (capturedEmail) {
          const template = deletionCompleteEmail()
          await sendEmail({ to: capturedEmail, ...template }).catch((err: unknown) => {
            console.error(`[retention-tick] email send failed for ${userId}:`, err)
          })
        }

        const { error: cleanupError } = await supabaseAdmin
          .from('pending_deletions')
          .delete()
          .eq('user_id', userId)

        if (cleanupError) {
          console.warn(
            `[retention-tick] failed to delete pending_deletions row for ${userId}:`,
            cleanupError.message
          )
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.error(`[retention-tick] failed to hard-delete ${userId}:`, message)
        graceErrors.push({ userId, error: message })
      }
    }

    // -------------------------------------------------------------------------
    // Step 5: Per-entry retention enforcement loop
    // -------------------------------------------------------------------------
    const auditRows: AuditRow[] = []
    const failedEntries: string[] = []

    for (const entry of RETENTION_POLICY) {
      const startedAt = new Date().toISOString()
      let rowsAffected = 0
      let error: string | null = null
      let skipped = false

      try {
        const result = await enforceEntry(entry.artefact, entry.period, entry.deletionMechanism)
        rowsAffected = result.rowsAffected
        skipped = result.skipped

        if (skipped) {
          console.log(
            `[retention-tick] skipped ${entry.artefact}: ${result.skipReason ?? 'no active TTL enforcement needed'}`
          )
        } else if (rowsAffected > 0) {
          console.log(`[retention-tick] enforced ${entry.artefact}: ${rowsAffected} rows/objects affected`)
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.error(`[retention-tick] enforcement failed for ${entry.artefact}:`, message)
        error = message
        failedEntries.push(entry.artefact)
      }

      auditRows.push({
        run_id: runId,
        artefact: entry.artefact,
        rows_affected: rowsAffected,
        started_at: startedAt,
        completed_at: new Date().toISOString(),
        error,
        skipped,
      })
    }

    // -------------------------------------------------------------------------
    // Step 6: Batch-insert audit rows
    // -------------------------------------------------------------------------
    const { error: auditError } = await supabaseAdmin
      .from('retention_audit_log')
      .insert(auditRows)

    if (auditError) {
      // Non-fatal — log lines above serve as secondary audit trail
      console.error('[retention-tick] failed to insert audit rows:', auditError.message)
    } else {
      console.log(`[retention-tick] inserted ${auditRows.length} audit rows for run ${runId}`)
    }

    // -------------------------------------------------------------------------
    // Step 7: Return result
    // -------------------------------------------------------------------------
    const processedEntries = auditRows.filter(r => !r.skipped && r.error === null).length
    const skippedEntries = auditRows.filter(r => r.skipped).length
    const status = failedEntries.length > 0 ? 207 : 200

    console.log(`[retention-tick] run ${runId} complete`, {
      graceProcessed,
      graceErrors: graceErrors.length,
      processedEntries,
      skippedEntries,
      failedEntries: failedEntries.length,
    })

    return json(
      {
        success: failedEntries.length === 0,
        run_id: runId,
        grace_processed: graceProcessed,
        grace_errors: graceErrors.length > 0 ? graceErrors : undefined,
        processed: processedEntries,
        skipped: skippedEntries,
        failed: failedEntries.length > 0 ? failedEntries : undefined,
      },
      status,
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[retention-tick] unexpected error:', message)
    return json({ success: false, error: 'Internal server error' }, 500)
  }
})
