---
module: compliance
tags: [e119, gdpr, supabase, titan, migration, storage, beta-prep]
problem_type: infra
date: 2026-04-24
---

# E119 pre-beta titan deployment — migrations + Storage buckets

## Problem

Epic E119 (GDPR compliance, 13 PRs #403–#415) shipped 5 new Supabase migrations
and referenced a private Storage bucket, but none of them had been applied to
titan's self-hosted Supabase. Titan still had the 2026-04-23 baseline (41
public tables, zero Storage buckets). Beta launch needed the data layer in
place before any compliance feature could run.

The five migrations and the single bucket were documented across the E119
stories but had no atomic "apply to titan" runbook entry; the spec even
drifted on the bucket name (brief said `user-exports`; every code reference
— retention-tick, export-worker, export-data, hardDeleteUser — uses `exports`).
Separately, titan was missing three other buckets (`avatars`, `course-media`,
`audio`) that the beta code paths depend on.

## Root Cause

Self-hosted Supabase does not auto-apply repo migrations or create Storage
buckets — neither are tracked by Supabase CLI when the deployment is a local
Docker stack (not Supabase Cloud). Both need explicit operator action:
SQL via `docker exec supabase-db psql -f`, buckets via direct `INSERT INTO
storage.buckets`.

## Solution (2026-04-24)

Applied all 5 E119 migrations in chronological timestamp order, created 4
private Storage buckets in one statement, reloaded the PostgREST schema cache,
and confirmed the TypeScript parity tests still pass against the refreshed
schema.

### 1. Apply the 5 E119 migrations

```bash
# Stage on host, then copy into the supabase-db container.
ssh titan 'mkdir -p /tmp/knowlune-e119-migrations'
scp supabase/migrations/20260423000002_user_consents.sql \
    supabase/migrations/20260428000001_notice_acknowledgements.sql \
    supabase/migrations/20260429000001_pending_deletions.sql \
    supabase/migrations/20260430000001_export_jobs.sql \
    supabase/migrations/20260501000001_retention_audit_log.sql \
    titan:/tmp/knowlune-e119-migrations/
ssh titan 'for f in /tmp/knowlune-e119-migrations/*.sql; do docker cp "$f" supabase-db:/tmp/; done'

# Apply in timestamp order with ON_ERROR_STOP=1 (halts on first hard error).
ssh titan 'for f in 20260423000002_user_consents.sql \
                   20260428000001_notice_acknowledgements.sql \
                   20260429000001_pending_deletions.sql \
                   20260430000001_export_jobs.sql \
                   20260501000001_retention_audit_log.sql; do
  docker exec supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/$f
done'
```

All five migrations use `BEGIN/COMMIT` and idempotent guards (`IF NOT EXISTS`,
`DROP POLICY IF EXISTS`). The first-run NOTICEs about non-existent policies
being skipped are benign.

### 2. Create the 4 private Storage buckets

```bash
ssh titan "docker exec supabase-db psql -U postgres -d postgres -c \
  \"INSERT INTO storage.buckets (id, name, public) VALUES
      ('exports','exports',false),
      ('avatars','avatars',false),
      ('course-media','course-media',false),
      ('audio','audio',false)
    ON CONFLICT (id) DO NOTHING;\""
```

All four are required by the shipped code (see
[supabase/functions/_shared/hardDeleteUser.ts](../../supabase/functions/_shared/hardDeleteUser.ts)
`STORAGE_BUCKETS` constant). All four are private; export-worker signs
download URLs via `storage.createSignedUrl()` which works on private buckets.

### 3. Reload PostgREST schema cache

```bash
ssh titan "docker exec supabase-db psql -U postgres -d postgres -c \
  \"NOTIFY pgrst, 'reload schema';\" && docker restart supabase-rest"
```

### 4. Clean up staging files

```bash
ssh titan 'rm -rf /tmp/knowlune-e119-migrations && \
           docker exec supabase-db sh -c "rm -f /tmp/2026*.sql"'
```

## Verification

| Check | Expected | Actual |
| --- | --- | --- |
| Public table count | 41 → 46 (+5 E119 tables) | **46** ✅ |
| RLS enabled on all 5 new tables | `rowsecurity = t` | **t on all 5** ✅ |
| RLS policy counts | consents 5, acks 2, deletions 2, jobs 3, audit 2 | **exact match** ✅ |
| Storage buckets | 4 rows, `public = f` for all | **4, all private** ✅ |
| `npx vitest run retentionParity.test.ts consentSync.test.ts` | all pass | **23/23 passed** ✅ |

## Notes

- Apply order was chronological but inter-migration dependencies are zero —
  no FK between the 5 tables. Any order would have worked.
- The brief listed `user-exports` as the bucket name but every code reference
  uses `exports`. Always verify bucket names against the shipped code, not
  the spec text.
- Three deferred gaps captured as `KI-E119-POST-001/002/003` in
  [docs/known-issues.yaml](../known-issues.yaml):
  1. `RETENTION_TICK_SECRET` needs to be set on Supabase Edge + Cloudflare
     Worker (Cloudflare side blocked on `wrangler login`).
  2. `chat_conversations` retention policy inconsistency — code deletes
     pinned conversations, policy says don't. Resolved in a follow-up story.
  3. `ip_hash` Edge Function — defence-in-depth, deferred to post-beta.

## Related

- [2026-04-23-titan-supabase-migration-apply.md](2026-04-23-titan-supabase-migration-apply.md)
  — the runbook pattern this deployment followed.
- [reference_supabase_unraid.md](../../../../../.claude/memory/reference_supabase_unraid.md)
  — user memory with titan URL and anon key.
- [supabase/functions/_shared/hardDeleteUser.ts](../../supabase/functions/_shared/hardDeleteUser.ts)
  — source of truth for the `STORAGE_BUCKETS` list.
