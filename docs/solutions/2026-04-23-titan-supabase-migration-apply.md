---
module: supabase
tags: [supabase, migration, self-hosted, titan, sync]
problem_type: infra
date: 2026-04-23
---

# Applying Knowlune migrations to titan's self-hosted Supabase

## Problem

Titan (Unraid) runs self-hosted Supabase in Docker. It had drifted to 3 public
tables while the Knowlune repo had 19 migrations defining ~40 tables. The sync
engine logged ~30 `PGRST205` / `PGRST204` errors on every `fullSync()` run,
plus `column study_sessions.updated_at does not exist`. Every authenticated
write silently no-oped because neither the table nor the column existed in
PostgREST's schema cache.

## Root Cause

Self-hosted Supabase does not auto-apply repo migrations — the Supabase CLI's
`db push` pipeline is Supabase-cloud-only unless you point it at a custom
connection string with credentials the team does not want in local shells. On
titan the chosen alternative is `docker exec supabase-db psql -f` against
files `docker cp`'d into the container.

## Solution (2026-04-23)

Apply all 19 migrations (001, 002, and the 17 timestamp-prefixed files under
[supabase/migrations/](../../supabase/migrations/)) in chronological order,
plus a post-migration `ALTER TABLE` to add `study_sessions.updated_at` which
`tableRegistry` expects as the default cursor field.

```bash
# 1. Stage the migrations on the host and copy into the container.
ssh titan 'mkdir -p /tmp/knowlune-migrations'
scp supabase/migrations/*.sql titan:/tmp/knowlune-migrations/
ssh titan 'for f in /tmp/knowlune-migrations/*.sql; do docker cp "$f" supabase-db:/tmp/; done'

# 2. Apply in chronological order, stopping on any hard error.
for mig in $(ssh titan 'ls /tmp/knowlune-migrations/' | sort); do
  ssh titan "docker exec supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/$mig"
done

# 3. Add the missing updated_at column the sync engine expects.
ssh titan "docker exec supabase-db psql -U postgres -d postgres -c \
  \"ALTER TABLE public.study_sessions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
    CREATE INDEX IF NOT EXISTS idx_study_sessions_user_updated ON public.study_sessions (user_id, updated_at);\""

# 4. Reload PostgREST's schema cache.
ssh titan "docker exec supabase-db psql -U postgres -d postgres -c \"NOTIFY pgrst, 'reload schema'\""
ssh titan 'docker restart supabase-rest'

# 5. Clean up.
ssh titan 'rm -rf /tmp/knowlune-migrations && docker exec supabase-db sh -c "rm -f /tmp/2026*.sql /tmp/00*.sql"'
```

## Verification

```sql
-- 41 public tables expected (as of 2026-04-23).
SELECT count(*) FROM pg_tables WHERE schemaname = 'public';
-- study_sessions.updated_at exists.
\d public.study_sessions
```

After applying: zero `PGRST205` / `PGRST204` errors in the Knowlune browser
console during a full sync run.

## Notes

- Migrations are mostly idempotent (`IF NOT EXISTS`, `CREATE POLICY IF NOT
  EXISTS`, `DROP POLICY IF EXISTS` then `CREATE POLICY`). Safe to re-run.
- If a migration hard-errors partway, stop and inspect before proceeding —
  partial application leaves the DB in a mixed state.
- Rollback SQL for each migration lives under
  [supabase/migrations/rollback/](../../supabase/migrations/rollback/).

## Related

- [reference_supabase_unraid.md](../../../../../.claude/memory/reference_supabase_unraid.md)
  (user memory — titan URL, anon keys).
- [project_supabase_sync_design.md](../../../../../.claude/memory/project_supabase_sync_design.md)
  (LWW sync design covering 26 tables + 4 Storage buckets).
