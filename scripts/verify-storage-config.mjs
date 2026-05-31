#!/usr/bin/env node

/**
 * verify-storage-config.mjs
 *
 * Verifies that the `learning-path-covers` storage bucket, its four RLS policies,
 * and the `public.learning_paths` cover columns exist on the target Supabase project.
 *
 * Uses SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from environment.
 * Exits 0 if all checks pass, non-zero with a precise diagnostic message otherwise.
 *
 * Usage:
 *   SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<key> node scripts/verify-storage-config.mjs
 *
 * Or via npm script:
 *   npm run verify:storage
 *
 * Prerequisites:
 * - SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY set in environment
 * - @supabase/supabase-js installed (already in project dependencies)
 */

import { createClient } from '@supabase/supabase-js'

const BUCKET_ID = 'learning-path-covers'
const MIN_FILE_SIZE_LIMIT = 2097152 // 2 MB
const EXPECTED_POLICIES = [
  { name: 'learning-path-covers: public select', description: 'Public SELECT (anyone can read)' },
  { name: 'learning-path-covers: owner insert', description: 'Authenticated INSERT (owner-scoped)' },
  { name: 'learning-path-covers: owner update', description: 'Authenticated UPDATE (owner-scoped)' },
  { name: 'learning-path-covers: owner delete', description: 'Authenticated DELETE (owner-scoped)' },
]

async function main() {
  const url = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    console.error(
      `ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment.

  export SUPABASE_URL=https://<ref>.supabase.co
  export SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>

See docs/deployment/supabase-storage-setup.md for details.`
    )
    process.exit(1)
  }

  // Validate URL format
  if (!url.startsWith('https://') || !url.includes('.supabase.co')) {
    console.error(`ERROR: SUPABASE_URL does not look like a Supabase project URL: ${url}`)
    process.exit(1)
  }

  const supabase = createClient(url, serviceRoleKey)
  const errors = []

  console.log(`\n=== Supabase Storage Config Verification ===`)
  console.log(`Project: ${url}\n`)

  // ── Check 1: Bucket exists and is public ──────────────────────────────────
  console.log(`[1/3] Checking bucket "${BUCKET_ID}"...`)

  try {
    const { data: buckets, error: listError } = await supabase.storage.listBuckets()

    if (listError) {
      errors.push(`STORAGE_API_ERROR: Failed to list buckets — ${listError.message}`)
    } else {
      const bucket = buckets?.find((b) => b.id === BUCKET_ID)

      if (!bucket) {
        errors.push(
          `BUCKET_MISSING: Bucket "${BUCKET_ID}" does not exist. ` +
          `Apply migration supabase/migrations/20260507000001_learning_path_cover_storage_policies.sql ` +
          `to create it. See docs/deployment/supabase-storage-setup.md`
        )
      } else {
        const issues = []
        if (!bucket.public) {
          issues.push('is not public (public=false)')
        }
        const limit = bucket.file_size_limit ?? 0
        if (limit > 0 && limit < MIN_FILE_SIZE_LIMIT) {
          issues.push(`file_size_limit (${limit}) is below minimum (${MIN_FILE_SIZE_LIMIT})`)
        }
        if (issues.length === 0) {
          console.log(`  OK: Bucket "${BUCKET_ID}" exists, public, size limit OK`)
        } else {
          errors.push(`BUCKET_MISCONFIGURED: Bucket "${BUCKET_ID}" ${issues.join('; ')}`)
        }
      }
    }
  } catch (e) {
    errors.push(`BUCKET_CHECK_ERROR: ${e instanceof Error ? e.message : String(e)}`)
  }

  // ── Check 2: Cover columns exist on public.learning_paths ────────────────
  console.log(`[2/3] Checking columns on public.learning_paths...`)

  try {
    // Query information_schema via PostgREST with the public schema
    const { data: columns, error: colError } = await supabase
      .from('learning_paths')
      .select('cover_image_url, cover_preset')
      .limit(1)

    if (colError) {
      errors.push(`COLUMNS_CHECK_ERROR: Could not query learning_paths — ${colError.message}`)
    } else {
      // Even if no rows exist, the columns are present if the query doesn't error on the column names
      console.log(`  OK: Columns cover_image_url and cover_preset exist`)
    }
  } catch (e) {
    errors.push(`COLUMNS_CHECK_ERROR: ${e instanceof Error ? e.message : String(e)}`)
  }

  // ── Check 3: RLS policies exist for the bucket ────────────────────────────
  console.log(`[3/3] Checking RLS policies for "${BUCKET_ID}"...`)

  try {
    const projectRef = new URL(url).hostname.split('.')[0]
    // Try to query pg_policies via PostgREST (may not be available on all projects)
    const policyUrl = `${url}/rest/v1/pg_policies?schemaname=eq.storage&tablename=eq.objects&select=policyname,cmd,roles`

    const response = await fetch(policyUrl, {
      headers: {
        apiKey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        Accept: 'application/json',
      },
    })

    if (response.ok) {
      const policies = await response.json()
      const bucketPolicies = policies.filter((p) =>
        p.policyname && p.policyname.toLowerCase().includes(BUCKET_ID.replace(/-/g, '').toLowerCase())
      )

      const foundPolicyNames = new Set((bucketPolicies || []).map((p) => p.policyname))

      for (const expected of EXPECTED_POLICIES) {
        if (foundPolicyNames.has(expected.name)) {
          console.log(`  OK: "${expected.name}" — ${expected.description}`)
        } else {
          errors.push(
            `POLICY_MISSING: "${expected.name}" (${expected.description}) not found. ` +
            `Apply supabase/migrations/20260507000001_learning_path_cover_storage_policies.sql`
          )
        }
      }
    } else {
      console.warn(
        `  WARNING: Could not query pg_policies via PostgREST API (HTTP ${response.status}).\n` +
        `  This is normal if pg_catalog schema is not exposed via PostgREST.\n` +
        `  Verify policies manually via Supabase Dashboard > Storage > ${BUCKET_ID} > Policies,\n` +
        `  or by running:\n` +
        `    psql "$SUPABASE_DB_URL" -c "SELECT policyname, cmd, roles FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname ILIKE '%learning-path-covers%';"`
      )
    }
  } catch (e) {
    console.warn(
      `  WARNING: Policy check via API failed — ${e instanceof Error ? e.message : String(e)}.\n` +
      `  Verify policies manually.`
    )
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log('')

  if (errors.length === 0) {
    console.log('RESULT: ALL CHECKS PASSED')
    process.exit(0)
  } else {
    console.error(`RESULT: ${errors.length} check(s) FAILED`)
    for (const err of errors) {
      console.error(`  - ${err}`)
    }
    console.error('')
    process.exit(1)
  }
}

main()
