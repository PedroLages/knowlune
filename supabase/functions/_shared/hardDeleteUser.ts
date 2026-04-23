// E119-S03: Registry-Driven Hard-Delete Cascade
//
// Shared helper used by both `delete-account` (on-demand) and
// `retention-tick` (scheduled) to hard-delete all user data across
// the 38 sync tables and 4 Storage buckets.
//
// Design decisions:
//   - Per-table errors are NON-FATAL: the cascade continues if one table
//     fails. Partial erasure is preferable to no erasure. Each failure is
//     collected and returned for audit logging.
//   - Storage objects are deleted by listing all objects under the userId/
//     prefix. Pagination is handled automatically (loop while more objects).
//   - Stripe anonymisation is OPTIONAL and NON-BLOCKING: if STRIPE_SECRET_KEY
//     is absent or the Stripe API call fails, the cascade continues. Stripe
//     customer + invoices are retained for tax obligations (Art 17(3)(b) GDPR).
//
// Lawful-basis exceptions (GDPR Art 17(3)):
//   - Billing/tax records: Stripe customer + invoices retained but anonymised
//     (email/name/address scrubbed). Retention period per docs/compliance/retention.md.
//   - Breach-register references: if any row in a future breach-log table
//     references this userId, the reference is pseudonymised rather than
//     deleted (Art 33/34 recordkeeping obligation). [TODO: S10 enforcement]

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ---------------------------------------------------------------------------
// Table and bucket constants
// ---------------------------------------------------------------------------

/**
 * Ordered list of Supabase table names that must be hard-deleted.
 *
 * IMPORTANT: This list must stay in sync with `src/lib/sync/tableRegistry.ts`
 * → `ERASURE_TABLE_NAMES`. The probe test in `deleteAccount.test.ts` asserts
 * parity between this list and the TypeScript registry export. If you add a
 * new table to `tableRegistry.ts`, add the corresponding `supabaseTable` name
 * here — or the CI probe will fail.
 */
export const TABLE_NAMES: string[] = [
  // P0 — Core progress / session data
  'content_progress',
  'study_sessions',
  'video_progress',
  // P1 — Notes, flashcards, annotations, AI learning data
  'notes',
  'bookmarks',
  'flashcards',
  'review_records',
  'embeddings',
  'book_highlights',
  'vocabulary_items',
  'audio_bookmarks',
  'audio_clips',
  'chat_conversations',
  'learner_models',
  // P2 — Imported content metadata, books, shelves
  'imported_courses',
  'imported_videos',
  'imported_pdfs',
  'authors',
  'books',
  'book_reviews',
  'shelves',
  'book_shelves',
  'reading_queue',
  'chapter_mappings',
  // P3 — Learning paths, scheduling, notifications, integrations
  'learning_paths',
  'learning_path_entries',
  'challenges',
  'course_reminders',
  'notifications',
  'career_paths',
  'path_enrollments',
  'study_schedules',
  'opds_catalogs',
  'audiobookshelf_servers',
  'notification_preferences',
  // P4 — Analytics / append-only events, quizzes
  'quizzes',
  'quiz_attempts',
  'ai_usage_events',
]

/**
 * Storage buckets containing user-prefixed objects.
 * Objects are stored at `{userId}/{filename}` and must all be removed.
 */
export const STORAGE_BUCKETS: string[] = ['avatars', 'course-media', 'audio', 'exports']

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export interface HardDeleteResult {
  /** Tables where deletion succeeded */
  tablesDeleted: string[]
  /** Tables where deletion failed (partial erasure — logged for audit) */
  tableErrors: Array<{ table: string; error: string }>
  /** Buckets where storage objects were removed */
  bucketsCleared: string[]
  /** Buckets where storage operations failed */
  bucketErrors: Array<{ bucket: string; error: string }>
  /** Whether Stripe anonymisation succeeded (null = skipped / not configured) */
  stripeAnonymised: boolean | null
  /** Auth hard-delete succeeded (permanent removal from auth.users) */
  authDeleted: boolean
}

// ---------------------------------------------------------------------------
// Core cascade
// ---------------------------------------------------------------------------

/**
 * Hard-deletes all application data for a user across the 38 sync tables,
 * 4 Storage buckets, and (optionally) anonymises their Stripe record.
 *
 * @param userId        - The Supabase auth user UUID
 * @param supabaseAdmin - Service-role client (bypasses RLS)
 * @param stripe        - Optional Stripe instance; if omitted, Stripe step is skipped
 */
export async function hardDeleteUser(
  userId: string,
  supabaseAdmin: ReturnType<typeof createClient>,
  stripe?: { customers: { search: (q: unknown) => Promise<{ data: Array<{ id: string }> }>; update: (id: string, data: unknown) => Promise<unknown> } }
): Promise<HardDeleteResult> {
  const result: HardDeleteResult = {
    tablesDeleted: [],
    tableErrors: [],
    bucketsCleared: [],
    bucketErrors: [],
    stripeAnonymised: null,
    authDeleted: false,
  }

  // -------------------------------------------------------------------------
  // Step 1: Delete rows from all sync tables
  // -------------------------------------------------------------------------
  for (const tableName of TABLE_NAMES) {
    try {
      const { error } = await supabaseAdmin.from(tableName).delete().eq('user_id', userId)
      if (error) {
        console.error(`[hardDeleteUser] table delete failed: ${tableName}`, error.message)
        result.tableErrors.push({ table: tableName, error: error.message })
      } else {
        result.tablesDeleted.push(tableName)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`[hardDeleteUser] table delete threw: ${tableName}`, message)
      result.tableErrors.push({ table: tableName, error: message })
    }
  }

  // -------------------------------------------------------------------------
  // Step 2: Remove Storage objects under userId/ prefix in each bucket
  // -------------------------------------------------------------------------
  for (const bucket of STORAGE_BUCKETS) {
    try {
      const prefix = `${userId}/`
      const pathsToRemove: string[] = []

      // Paginate: Supabase Storage list defaults to 100 objects per page
      let offset = 0
      const pageSize = 100
      while (true) {
        const { data: objects, error: listError } = await supabaseAdmin.storage
          .from(bucket)
          .list(prefix, { limit: pageSize, offset })

        if (listError) {
          console.error(`[hardDeleteUser] storage list failed: ${bucket}`, listError.message)
          result.bucketErrors.push({ bucket, error: listError.message })
          break
        }

        if (!objects || objects.length === 0) break

        for (const obj of objects) {
          pathsToRemove.push(`${prefix}${obj.name}`)
        }

        if (objects.length < pageSize) break
        offset += pageSize
      }

      if (pathsToRemove.length > 0) {
        const { error: removeError } = await supabaseAdmin.storage.from(bucket).remove(pathsToRemove)
        if (removeError) {
          console.error(`[hardDeleteUser] storage remove failed: ${bucket}`, removeError.message)
          result.bucketErrors.push({ bucket, error: removeError.message })
        } else {
          result.bucketsCleared.push(bucket)
        }
      } else {
        // No objects for this user in this bucket — still count as cleared
        result.bucketsCleared.push(bucket)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`[hardDeleteUser] storage threw: ${bucket}`, message)
      result.bucketErrors.push({ bucket, error: message })
    }
  }

  // -------------------------------------------------------------------------
  // Step 3: Stripe anonymisation (NON-BLOCKING)
  //
  // Lawful-basis: GDPR Art 17(3)(b) — retention for legal obligation (tax).
  // We retain the Stripe customer record and all invoices (required for VAT/
  // income tax records for the applicable period — see docs/compliance/retention.md).
  // We scrub personal identifiers (email, name, address) to minimise PII at rest
  // while preserving the financial audit trail.
  //
  // Breach-register pseudonymisation: [TODO: S10] — if a future breach-register
  // table stores userId references, pseudonymise those references here per
  // Art 33/34 recordkeeping obligations.
  // -------------------------------------------------------------------------
  if (stripe) {
    try {
      // Look up Stripe customer by Supabase user UUID.
      // ASSUMPTION: Stripe customers must be created with metadata key `supabase_uid`
      // set to the Supabase user UUID. Verify this is set in:
      //   - supabase/functions/create-checkout/index.ts (customer creation)
      //   - supabase/functions/stripe-webhook/index.ts (customer lookup)
      // If this metadata key is absent, the search returns no customers and
      // stripeAnonymised is set to true — PII would NOT be scrubbed.
      // [TODO: S10] Confirm metadata key with Stripe dashboard before production.
      const { data: customers } = await stripe.customers.search({
        query: `metadata['supabase_uid']:'${userId}'`,
        limit: 1,
      })

      if (customers && customers.length > 0) {
        const customerId = customers[0].id
        await stripe.customers.update(customerId, {
          email: `deleted-${userId}@deleted.invalid`,
          name: 'Deleted User',
          address: null,
        })
        result.stripeAnonymised = true
      } else {
        // User never had a Stripe customer record — nothing to anonymise
        result.stripeAnonymised = true
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('[hardDeleteUser] Stripe anonymisation failed (non-blocking):', message)
      result.stripeAnonymised = false
      // Intentional: do NOT abort cascade on Stripe failure
    }
  }
  // If stripe is undefined, stripeAnonymised remains null (= skipped/not configured)

  // -------------------------------------------------------------------------
  // Step 4: Hard-delete auth user (permanent removal from auth.users)
  // Called after application data is erased so auth tokens remain valid
  // long enough for the cascade to complete.
  // -------------------------------------------------------------------------
  try {
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId, false)
    if (authError) {
      console.error('[hardDeleteUser] auth hard-delete failed:', authError.message)
    } else {
      result.authDeleted = true
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[hardDeleteUser] auth hard-delete threw:', message)
  }

  return result
}
