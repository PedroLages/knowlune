---
title: "Supabase Cloud migration silently drops storage bucket RLS policies due to missing deployment verification"
date: 2026-05-31
category: workflow-issues
module: supabase-storage
problem_type: workflow_issue
component: development_workflow
severity: high
applies_when:
  - Migrating a Supabase project from self-hosted to Cloud (or any environment cutover)
  - Setting up storage buckets with RLS policies on a new Supabase project
  - Adding a manual deployment step that has no automated verification after it runs
  - Writing ESLint flat config for Node.js scripts (secondary lesson)
tags:
  - supabase-storage
  - cloud-migration
  - rls-policies
  - deployment-verification
  - supabase
  - learning-path-covers
---

# Supabase Cloud migration silently drops storage bucket RLS policies due to missing deployment verification

## Context

After migrating Knowlune from a self-hosted Supabase instance (on Unraid) to Supabase Cloud in early May 2026, authenticated users on the Learning Tracks page could not upload cover images. Opening Change Cover, selecting an image, and pressing Save failed with `"Not authorized to upload covers. Try signing out and back in."` Gradient presets worked fine — only image upload was broken.

The application code and SQL definitions in the repo were already correct. Prior plans (005, 012) had:
- Removed `upsert` and added 409 delete+re-insert for replacement uploads
- Added user-scoped keys (`{userId}/{pathId}.jpg`)
- Implemented folder-prefix RLS using `(storage.foldername(name))[1] = auth.uid()::text`
- Created migration `20260507000001_learning_path_cover_storage_policies.sql` with a fully idempotent bucket + 4 policies definition
- Created migration `20260506000001_learning_path_cover_columns.sql` adding `cover_image_url` and `cover_preset` to `public.learning_paths`

Despite all of this being correct in the repo, the live Supabase Cloud project `chyvhrbtttpumsyuhgbu` was rejecting authenticated storage writes with HTTP 403. The bucket existed (public, so SELECT/display worked), but the four RLS policies for INSERT, UPDATE, DELETE, and SELECT were absent. The migrations had never been applied to the cloud database.

The root cause was a process gap: the self-hosted to Cloud migration transferred the database contents but did not apply the repo's migration files to the new project. `supabase/migrations/` files are not auto-applied in Cloud — they must be explicitly applied via `supabase db push`, the dashboard SQL editor, or `psql`. Because this manual step had no verification check, the absence of the policies went undetected.

MCP-based diagnosis confirmed the root cause immediately: `execute_sql` queries against the cloud project showed the bucket existed but migration `20260507000001` was not recorded in `supabase_migrations.schema_migrations`, and the four expected RLS policies were absent in `pg_policies` for schema `storage`.

## Guidance

### 1. Every manual deployment step must have an automated post-step verification

When an environment migration, cutover, or deployment involves a manual SQL application step (dashboard SQL editor, `psql`, etc.), that step MUST be followed by an automated verification that exits non-zero if the expected state is not present. Do not rely on "we'll know if it breaks" — the absence of storage policies is silent until a user tries to upload, and the error message ("Try signing out and back in") actively misleads debugging.

**Pattern:** write a verification script that uses the service-role key to assert the expected state:

```javascript
// scripts/verify-storage-config.mjs (abbreviated)
import { createClient } from '@supabase/supabase-js'

const bucket = await supabase.storage.listBuckets()
// Assert bucket exists and is public
// Assert cover columns exist (try a SELECT with those columns)
// Assert RLS policies exist (query pg_policies via PostgREST)
// Exit 0 if all pass, non-zero with precise diagnostic otherwise
```

Wire it as an npm script so it is easy to run:

```json
"verify:storage": "node scripts/verify-storage-config.mjs"
```

### 2. Make SQL migrations idempotent to allow safe re-application

Every statement in a migration should be safe to re-run against an existing database. Use `IF NOT EXISTS`, `DROP POLICY IF EXISTS` + `CREATE POLICY`, and `INSERT … ON CONFLICT DO NOTHING` so that the same migration can be applied repeatedly without errors:

```sql
-- Idempotent bucket creation
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('learning-path-covers', 'learning-path-covers', true, 2097152, null)
ON CONFLICT (id) DO NOTHING;

-- Idempotent policy creation (drop if exists, then create)
DROP POLICY IF EXISTS "learning-path-covers: owner insert" ON storage.objects;
CREATE POLICY "learning-path-covers: owner insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'learning-path-covers' AND (storage.foldername(name))[1] = auth.uid()::text);
```

This property means the same migration can be applied to a fresh project or re-applied to a project that partially has the objects without errors.

### 3. Use Supabase MCP for diagnosis before applying repairs

When debugging a Supabase issue, start with read-only queries through the Supabase MCP before making any changes. The MCP can execute read-only SQL to inspect:
- Bucket existence and configuration: `SELECT … FROM storage.buckets`
- RLS policies: `SELECT … FROM pg_policies WHERE schemaname = 'storage'`
- Column presence: `SELECT … FROM information_schema.columns`
- Migration history: via `list_migrations` MCP tool

This eliminates guesswork and targets the repair at the real failure mode.

### 4. ESLint flat config: declare Node.js globals with `/* global */` in .mjs scripts

The old `/* eslint-env node */` directive does not work in ESLint flat config (eslint.config.js). If a `.mjs` script uses Node.js globals like `URL`, `fetch`, or `process`, declare them at the top of the file:

```javascript
#!/usr/bin/env node
/* global URL, fetch */

import { createClient } from '@supabase/supabase-js'
// ...
```

## Why This Matters

The storage policy gap was a **double-whammy of silent failure**:

1. **The migration step was silent** — no error or warning indicated that the migration files had not been applied to the new cloud project.
2. **The failure symptom was misleading** — the client mapped HTTP 401 and 403 to the same user-facing message ("Try signing out and back in"), which is correct for 401 (bad session) but actively wrong for 403 (missing policy — a server configuration problem the user cannot fix).

The combination meant:
- An operator deploying the cloud project would see no errors during setup
- A user encountering the upload failure would be told to re-login, which does not help
- The developer investigating would need to dig into the network logs to discover the status code

Three layers of defense now prevent this:
1. The idempotent migration can be safely re-applied (immediate fix)
2. The verification script catches any future gap (prevention)
3. The client now distinguishes 401 vs 403 vs 404 vs 413 with distinct messages (diagnostic clarity)

## When to Apply

- **During any Supabase environment cutover** (self-hosted to Cloud, Cloud to staging, etc.): after provisioning the new project, run the verification script before declaring the migration complete. Add it to the deployment runbook.
- **When creating a new storage bucket with RLS policies**: include an idempotent migration in `supabase/migrations/` AND verify via the script.
- **When debugging a 401/403 storage upload failure**: first check whether the bucket and policies exist on the live project (MCP/dashboard), rather than debugging the client code.
- **When writing a Node.js script for the repo (`.mjs`)**: remember that flat config requires `/* global */` declarations instead of `/* eslint-env node */`.

## Examples

### Before: no verification after cloud migration

```
Provision Supabase Cloud project    (no check after this step)
  ↳ Copy application data           (done)
  ↳ Point app at new project        (done)
  ↳ ...user tries to upload cover   (FAILS — 403, no one knew)
```

### After: verification-gated deployment

```
Provision Supabase Cloud project
  ↳ Copy application data
  ↳ Apply all repo migrations (supabase db push or SQL editor)
  ↳ npm run verify:storage         (FAILS if anything missing)
  ↳ Point app at new project       (only after verification passes)
  ↳ Browser smoke test             (final confirmation)
```

### Verification script output (passing)

```
=== Supabase Storage Config Verification ===
Project: https://chyvhrbtttpumsyuhgbu.supabase.co

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

### Client-side diagnostic hardening (before/after)

```typescript
// Before: 401 and 403 mapped to same message
const DIAGNOSTIC = {
  STORAGE_UNAUTHORIZED: 'Not authorized to upload covers. Try signing out and back in.',
  // ...
}
// if (status === 401 || status === 403) { diagnostic = DIAGNOSTIC.STORAGE_UNAUTHORIZED }

// After: split 401 vs 403 with distinct, actionable messages
const DIAGNOSTIC = {
  STORAGE_UNAUTHORIZED: 'Session expired. Try signing out and back in.',
  STORAGE_FORBIDDEN: 'Cover uploads are not enabled for your account yet. This is a server configuration issue.',
  STORAGE_NOT_FOUND: 'Cover storage not configured. Please contact support.',
  STORAGE_TOO_LARGE: 'Image is too large. Use an image under 2 MB.',
  // ...
}
// if (status === 401) { diagnostic = DIAGNOSTIC.STORAGE_UNAUTHORIZED }
// else if (status === 403) { diagnostic = DIAGNOSTIC.STORAGE_FORBIDDEN }
```

## Related

- PR [#582](https://github.com/PedroLages/knowlune/pull/582) — the PR that shipped the fix (idempotent migration re-apply, verification script, hardened diagnostics, runbook)
- Plan: `docs/plans/2026-05-31-001-fix-learning-track-cover-upload-rls-cloud-plan.md`
- `docs/deployment/supabase-storage-setup.md` — runbook for setting up storage buckets and policies on a new Supabase project
- `scripts/verify-storage-config.mjs` — verification script (npm run verify:storage)
- `supabase/migrations/20260507000001_learning_path_cover_storage_policies.sql` — idempotent bucket + policies migration
- `supabase/migrations/20260506000001_learning_path_cover_columns.sql` — cover columns migration
- `docs/solutions/best-practices/learning-paths-card-navigation-cover-rls-timeline-lessons-2026-05-06.md` — RLS policy design patterns for learning path covers (folder-prefix approach, auth.uid() checks)
- `docs/solutions/2026-04-23-titan-supabase-migration-apply.md` — earlier migration application process for self-hosted Supabase on titan
- `docs/plans/2026-05-07-012-fix-learning-path-card-progress-ring-and-cover-rls-plan.md` — prior plan that created the migration but whose deploy step was the gap
- `docs/plans/2026-05-06-005-fix-learning-path-cover-gradient-preset-and-upload-rls-plan.md` — earlier plan that identified deploy/session as probable cause
