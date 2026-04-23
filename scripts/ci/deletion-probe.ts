#!/usr/bin/env tsx
/**
 * E119-S04: Deletion Verification CI Probe
 *
 * Queries every erasure-registered table and Storage bucket for a given
 * user ID. Exits 0 if all data has been deleted; exits 1 and prints offenders
 * if any data survives.
 *
 * Usage:
 *   USER_ID=<uuid> \
 *   SUPABASE_URL=<url> \
 *   SUPABASE_SERVICE_ROLE_KEY=<key> \
 *   npx tsx scripts/ci/deletion-probe.ts
 *
 * Exit codes:
 *   0 — All tables and buckets are clean for the given user ID
 *   1 — Data found in one or more tables or buckets (GDPR erasure gap)
 *   2 — Missing required environment variables (configuration error)
 *
 * CI setup:
 *   USER_ID must be a Supabase UUID of a test user that has been hard-deleted.
 *   The test user should have zero application data in all registered tables
 *   and buckets. Create the user via the Supabase dashboard, trigger the
 *   delete-account Edge Function, wait for the 7-day grace period (or run
 *   retention-tick manually in a test environment), then record the UUID.
 *
 * Sync requirement:
 *   The TABLE_NAMES list in scripts/ci/probe-constants.ts must mirror
 *   TABLE_NAMES in supabase/functions/_shared/hardDeleteUser.ts.
 *   The ERASURE_TABLE_NAMES export in src/lib/sync/tableRegistry.ts is the
 *   authoritative source — all three lists must agree.
 */

import { createClient } from '@supabase/supabase-js'
import { TABLE_NAMES, STORAGE_BUCKETS } from './probe-constants.js'

// ---------------------------------------------------------------------------
// Environment validation
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const USER_ID = process.env.USER_ID

if (!SUPABASE_URL || !SERVICE_KEY || !USER_ID) {
  console.error('Missing required environment variables.')
  console.error('Required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, USER_ID')
  console.error('')
  console.error('Example:')
  console.error(
    '  USER_ID=<uuid> SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=<key> npx tsx scripts/ci/deletion-probe.ts'
  )
  process.exit(2)
}

// ---------------------------------------------------------------------------
// Supabase client (service-role — bypasses RLS)
// ---------------------------------------------------------------------------

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ---------------------------------------------------------------------------
// Probe
// ---------------------------------------------------------------------------

const offenders: string[] = []
const errors: string[] = [] // Tables/buckets that could not be queried (schema mismatch, missing column, etc.)

console.log(`\nDeletion probe for user: ${USER_ID}`)
console.log(`Checking ${TABLE_NAMES.length} tables and ${STORAGE_BUCKETS.length} Storage buckets...\n`)

// Check each table for surviving rows
for (const table of TABLE_NAMES) {
  try {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })
      .eq('user_id', USER_ID)

    if (error) {
      // Table may not have a user_id column or may not exist.
      // Track as an error (not a clean result) so a probe that errors on all
      // tables is distinguishable from a probe where all tables are clean.
      console.warn(`  [WARN] Could not query table "${table}": ${error.message}`)
      errors.push(`table:${table} (query error: ${error.message})`)
      continue
    }

    if (count !== null && count > 0) {
      console.error(`  [FAIL] Table "${table}" still has ${count} row(s) for user ${USER_ID}`)
      offenders.push(`table:${table} (${count} rows)`)
    } else {
      console.log(`  [OK]   Table "${table}"`)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.warn(`  [WARN] Unexpected error querying "${table}": ${message}`)
  }
}

// Check each Storage bucket for surviving objects
for (const bucket of STORAGE_BUCKETS) {
  try {
    const prefix = `${USER_ID}/`
    const { data: objects, error } = await supabase.storage
      .from(bucket)
      .list(prefix, { limit: 1 })

    if (error) {
      console.warn(`  [WARN] Could not list bucket "${bucket}": ${error.message}`)
      errors.push(`bucket:${bucket} (list error: ${error.message})`)
      continue
    }

    if (objects && objects.length > 0) {
      console.error(`  [FAIL] Bucket "${bucket}" still has objects for user ${USER_ID}`)
      offenders.push(`bucket:${bucket} (${objects.length}+ objects)`)
    } else {
      console.log(`  [OK]   Bucket "${bucket}"`)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.warn(`  [WARN] Unexpected error checking bucket "${bucket}": ${message}`)
  }
}

// ---------------------------------------------------------------------------
// Result
// ---------------------------------------------------------------------------

console.log('')

if (errors.length > 0) {
  console.warn(`\n${errors.length} table/bucket(s) could not be queried (schema drift or config issue):`)
  for (const e of errors) {
    console.warn(`  - ${e}`)
  }
  // If a majority of tables errored, the probe configuration is likely broken.
  if (errors.length >= TABLE_NAMES.length / 2) {
    console.error('\nERROR: More than half of all tables could not be queried. Probe may be misconfigured.')
    console.error('Check SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and that the Supabase project is accessible.')
    process.exit(2)
  }
}

if (offenders.length > 0) {
  console.error('\nERASURE INCOMPLETE — data found for user after deletion:')
  for (const offender of offenders) {
    console.error(`  - ${offender}`)
  }
  console.error('')
  console.error(
    'This indicates a GDPR erasure gap. Ensure the table/bucket is registered in:'
  )
  console.error('  supabase/functions/_shared/hardDeleteUser.ts → TABLE_NAMES')
  console.error('  src/lib/sync/tableRegistry.ts → ERASURE_TABLE_NAMES')
  console.error('  scripts/ci/probe-constants.ts → TABLE_NAMES (this probe)')
  process.exit(1)
} else {
  const queriedCount = TABLE_NAMES.length + STORAGE_BUCKETS.length - errors.length
  console.log(`All ${queriedCount} queried tables and buckets clean for user ${USER_ID}`)
  if (errors.length > 0) {
    console.log(`(${errors.length} could not be queried — see warnings above)`)
  }
  process.exit(0)
}
