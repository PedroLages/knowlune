---
title: Manual-apply scripts vs migrations — the storage-setup.sql lesson
date: 2026-05-06
category: workflow-issues
module: supabase
problem_type: workflow_issue
component: database
severity: high
applies_when:
  - Adding infrastructure resources beyond standard table schemas (storage buckets, auth config, extensions)
  - Any time a SQL file is created outside the supabase/migrations/ directory
  - Onboarding new developers who might not know about non-migration infrastructure scripts
tags:
  - manual-apply
  - migrations
  - supabase
  - storage-buckets
  - infrastructure-drift
---

# Manual-apply scripts vs migrations — the storage-setup.sql lesson

## Context

The `supabase/storage-setup.sql` file defined a `learning-path-covers` Storage bucket along with its RLS policies, but it was a **manual-apply script** — not a numbered migration in `supabase/migrations/`. It was never executed against the production Supabase instance. Users got a "Bucket not found" error when trying to upload a cover image for a learning path.

A secondary issue: the `learning_paths` table had TypeScript types and local Dexie fields for `cover_image_url` and `cover_preset`, but no corresponding columns existed in the Supabase `learning_paths` table. These columns were silently dropped during sync because they were never provisioned as a migration.

The app code was correct. The issue was purely infrastructure provisioning — resources defined in a manual script that never ran.

## Guidance

**All database and storage infrastructure changes must go through numbered migrations.** Manual-apply scripts are an anti-pattern because:

1. They have no automatic execution path — someone must remember to run them
2. There is no traceability — no record of whether they were applied, when, or against which environment
3. They create infrastructure drift — local, staging, and production environments diverge
4. Onboarding new developers misses these steps — they won't know about undiscoverable scripts

### What to do instead

**For database schema changes** (tables, columns, indexes, enums, extensions):
Create a numbered migration in `supabase/migrations/` following the existing naming convention: `YYYYMMDDHHMMSS_description.sql`. Apply it with `supabase db push`.

**For storage buckets and RLS policies**:
Include the bucket creation and RLS policy SQL directly in a numbered migration. Storage buckets are database resources — `INSERT INTO storage.buckets` works just as well from a migration as from a manual script.

**When a manual-apply script already exists**:
- Create a migration that captures the current intended state (using `IF NOT EXISTS` / `ON CONFLICT DO NOTHING` for idempotency)
- Delete the manual-apply script or mark it clearly as superseded
- Add the migration to `supabase/migrations/` and apply it

## Why This Matters

A manual-apply script is effectively dead code. Every hour spent debugging a "Bucket not found" or "column does not exist" error is time that a five-line migration would have saved. The cost compounds as the project grows — more manual scripts mean more forgotten steps, more drift, more debugging sessions.

Numbered migrations provide:
- **Deterministic application**: Applied in order, once, against every environment
- **Audit trail**: Git history shows exactly what was provisioned and when
- **Idempotency**: Safely re-runnable when deployed to fresh environments
- **Discoverability**: New developers see all infra changes by reading `supabase/migrations/`

## When to Apply

- **Always** when creating or altering database schema, storage buckets, auth settings, or extensions
- When adding any SQL resource that should exist in all environments (production, staging, local)
- When reviewing PRs that include `.sql` files outside `supabase/migrations/` — flag them as a potential issue
- During onboarding: point new developers to `supabase/migrations/` as the single source of truth for infrastructure

## Examples

**Before (anti-pattern) — manual-apply script that never ran:**
`supabase/storage-setup.sql` (outside migrations directory, no automatic execution):
```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('learning-path-covers', 'learning-path-covers', true, 2097152)
ON CONFLICT (id) DO NOTHING;
```

**After (correct) — numbered migration that runs automatically:**
`supabase/migrations/20260506000001_learning_path_cover_columns.sql`:
```sql
ALTER TABLE public.learning_paths
  ADD COLUMN IF NOT EXISTS cover_image_url TEXT,
  ADD COLUMN IF NOT EXISTS cover_preset TEXT;
```

**Converting an existing manual script to a migration:**
```sql
-- supabase/migrations/20260506000002_storage_bucket_learning_path_covers.sql
-- Idempotent — safe to run even if the bucket already exists

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('learning-path-covers', 'learning-path-covers', true, 2097152)
ON CONFLICT (id) DO NOTHING;

-- RLS policies (dropped and recreated for idempotency)
DROP POLICY IF EXISTS "Anyone can read learning path covers" ON storage.objects;
CREATE POLICY "Anyone can read learning path covers"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'learning-path-covers');

-- ... remaining policies
```

## Related

- [PR #523](https://github.com/PedroLages/knowlune/pull/523) — The fix that prompted this lesson
- `supabase/storage-setup.sql` — The manual-apply script that should be converted or deleted
- `docs/solutions/` — Other documented solutions and lessons
