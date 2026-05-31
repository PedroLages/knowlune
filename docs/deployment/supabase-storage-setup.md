# Supabase Storage Setup Runbook

## Overview

This document describes how to set up Supabase Storage buckets and RLS policies when provisioning a new Supabase project or after a migration cutover. Follow it to ensure `learning-path-covers` (and other buckets) are properly configured with owner-scoped RLS policies.

**Why this exists:** After the self-hosted to Supabase Cloud migration in May 2026, the storage bucket `learning-path-covers` existed but had zero RLS policies, causing authenticated uploads to fail with 403 ("Not authorized to upload covers"). This runbook closes the "manual step without verification" gap.

## Prerequisites

- Access to the Supabase project dashboard or a `SUPABASE_SERVICE_ROLE_KEY`
- `psql` (optional, for direct SQL access)
- Node.js (for the verification script)

## Quick Start (After Creating a New Supabase Project)

1. Apply the storage bucket + policies migration:

   ```bash
   # Via Supabase CLI (if linked)
   supabase db push

   # Or via psql
   psql "$SUPABASE_DB_URL" -f supabase/migrations/20260507000001_learning_path_cover_storage_policies.sql

   # Or via Supabase Dashboard > SQL Editor — paste and execute the contents of the migration file
   ```

2. Run the verification script to confirm everything is in place:

   ```bash
   SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<key> npm run verify:storage
   ```

   Expected output:

   ```
   === Supabase Storage Config Verification ===
   Project: https://<ref>.supabase.co

   [1/3] Checking bucket "learning-path-covers"...
     OK: Bucket "learning-path-covers" exists, public, size limit OK
   [2/3] Checking columns on public.learning_paths...
     OK: Columns cover_image_url and cover_preset exist
   [3/3] Checking RLS policies for "learning-path-covers"...
     OK: "learning-path-covers: public select" — Public SELECT (anyone can read)
     OK: "learning-path-covers: owner insert" — Authenticated INSERT (owner-scoped)
     OK: "learning-path-covers: owner update" — Authenticated UPDATE (owner-scoped)
     OK: "learning-path-covers: owner delete" — Authenticated DELETE (owner-scoped)

   RESULT: ALL CHECKS PASSED
   ```

## Detailed Setup

### Option A: Supabase MCP (recommended for automated workflows)

Use `apply_migration` to apply `20260507000001` directly to the cloud project:

```sql
-- Content of supabase/migrations/20260507000001_learning_path_cover_storage_policies.sql
-- (Apply via MCP or SQL Editor)
```

### Option B: Supabase Dashboard SQL Editor

1. Log in to `https://supabase.com/dashboard/project/<PROJECT_REF>`
2. Navigate to **SQL Editor**
3. Open a new query tab
4. Paste the contents of `supabase/migrations/20260507000001_learning_path_cover_storage_policies.sql`
5. Execute
6. Verify: navigate to **Storage** > `learning-path-covers` > **Policies** to confirm the four policies are listed

### Option C: psql (for scripting and CI)

```bash
psql "$SUPABASE_DB_URL" -f supabase/migrations/20260507000001_learning_path_cover_storage_policies.sql
```

## Verification

Run the verification script (see [scripts/verify-storage-config.mjs](./scripts/verify-storage-config.mjs)):

```bash
# Set credentials
export SUPABASE_URL=https://<ref>.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>

# Run verification
npm run verify:storage
```

The script checks:

| Check | What it asserts | Failure message |
|-------|----------------|----------------|
| Bucket exists | `learning-path-covers` is present, public, >= 2MB limit | `BUCKET_MISSING` or `BUCKET_MISCONFIGURED` |
| Cover columns | `cover_image_url`, `cover_preset` on `public.learning_paths` | `COLUMNS_CHECK_ERROR` |
| RLS policies | 4 policies present (public SELECT, owner INSERT/UPDATE/DELETE) | `POLICY_MISSING` |

### Manual Verification (if the script cannot query `pg_policies`)

```sql
-- Check bucket
SELECT id, name, public, file_size_limit, allowed_mime_types
FROM storage.buckets
WHERE id = 'learning-path-covers';

-- Check cover columns
SELECT column_name
FROM information_schema.columns
WHERE table_schema='public'
  AND table_name='learning_paths'
  AND column_name IN ('cover_image_url','cover_preset');

-- Check RLS policies
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname ILIKE '%learning-path-covers%';
```

## In-Browser Smoke Test

1. Sign in to the app
2. Navigate to `/learning-tracks`
3. Open any track > **Change Cover**
4. Select an image file and click **Save**
5. Expected: success toast, card shows the uploaded image
6. Replace the cover with another image — should also succeed (exercises the 409 delete+re-insert path)

## Applying to a New Environment

After provisioning a new Supabase project or after a migration cutover:

1. Ensure `20260506000001` (cover columns migration) and `20260507000001` (storage policies migration) are listed in the migration history
2. Run the verification script
3. Perform the browser smoke test

## Other Storage Buckets

The same gap that affected `learning-path-covers` may affect other buckets (`course-thumbnails`, `avatars`, `book-covers`, etc.). Verify them in the dashboard or extend the verification script. See also `supabase/migrations/20260424130556_storage_rls_policies_remaining_buckets.sql` and `20260424130635_storage_rls_policies_avatars.sql`.
