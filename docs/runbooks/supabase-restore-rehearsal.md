# Supabase Restore Rehearsal Runbook

**Last rehearsed:** 2026-04-22
**Rehearsed by:** Pedro
**Outcome:** ✅ Data recoverable — row counts match production exactly

## Purpose

Validates that Supabase database dumps in `/mnt/cache/appdata/supabase/db/dumps/` on titan can be restored into a throwaway Postgres container, and that the restored data matches production. Run this quarterly and any time the dump script or Postgres version changes.

## Dump Source

- **Location:** `titan:/mnt/cache/appdata/supabase/db/dumps/supabase_dumpall_YYYYMMDD_HHMMSS.sql`
- **Format:** Plain SQL from `pg_dumpall -U supabase_admin --clean --if-exists`
- **Produced by:** `/mnt/user/docker/scripts/pre-backup.sh` (cron nightly at 04:40)
- **Retention:** 7 days local, offsite via Kopia snapshot of `/snapshot/appdata`

## Procedure

All commands run via `ssh titan`.

### 1. Start a throwaway Postgres 15 container

```bash
docker run --rm -d --name pg-restore-test \
  -e POSTGRES_PASSWORD=test \
  -e POSTGRES_USER=postgres \
  postgres:15

# Wait for it to be ready
until docker exec pg-restore-test pg_isready -U postgres > /dev/null 2>&1; do
  sleep 2
done
```

### 2. Restore the latest dump

```bash
LATEST=$(ls -t /mnt/cache/appdata/supabase/db/dumps/supabase_dumpall_*.sql | head -1)
echo "Restoring $LATEST"
cat "$LATEST" | docker exec -i pg-restore-test psql -U postgres 2>&1 | tail -30
```

**Expected non-fatal errors:** event-trigger "permission denied" errors (e.g., `issue_graphql_placeholder`, `pgrst_ddl_watch`). These require the `supabase_admin` role which doesn't exist in stock Postgres — they do **not** affect data restoration.

### 3. Verify schemas and tables

```bash
docker exec pg-restore-test psql -U postgres -c '\dn'
# Expect: _realtime, auth, extensions, graphql, graphql_public, pgbouncer, public, realtime, storage, supabase_functions, vault

docker exec pg-restore-test psql -U postgres -c '\dt auth.*'
# Expect: 20 tables (users, sessions, identities, mfa_*, sso_*, etc.)

docker exec pg-restore-test psql -U postgres -c '\dt public.*'
# Expect: content_progress, study_sessions, video_progress (adjust as schema evolves)
```

### 4. Compare row counts against production

```bash
docker exec pg-restore-test psql -U postgres -c "
SELECT (SELECT COUNT(*) FROM auth.users) AS users,
       (SELECT COUNT(*) FROM public.content_progress) AS content_progress,
       (SELECT COUNT(*) FROM public.study_sessions) AS study_sessions,
       (SELECT COUNT(*) FROM public.video_progress) AS video_progress;"

docker exec supabase-db psql -U postgres -c "
SELECT (SELECT COUNT(*) FROM auth.users) AS users,
       (SELECT COUNT(*) FROM public.content_progress) AS content_progress,
       (SELECT COUNT(*) FROM public.study_sessions) AS study_sessions,
       (SELECT COUNT(*) FROM public.video_progress) AS video_progress;"
```

**Pass criterion:** counts match exactly. If they don't, investigate before trusting the dump.

### 5. Teardown

```bash
docker rm -f pg-restore-test
```

## 2026-04-22 Rehearsal Results

| Check | Restored | Production | Match? |
| --- | --- | --- | --- |
| auth.users | 1 | 1 | ✅ |
| public.content_progress | 0 | 0 | ✅ |
| public.study_sessions | 0 | 0 | ✅ |
| public.video_progress | 0 | 0 | ✅ |
| Schemas present | 11 | 11 | ✅ |
| auth tables | 20 | 20 | ✅ |

**Dump file used:** `supabase_dumpall_20260422_022853.sql` (1.4 MB, from hand-run of `pre-backup.sh` after patching fault-tolerant fix).

## Full-Fidelity Restore (for actual disaster recovery)

The above rehearsal verifies data recoverability. For an actual prod restore, use a Supabase-flavoured Postgres image so event triggers and `supabase_admin` role exist:

```bash
docker run --rm -d --name pg-restore-prod \
  -e POSTGRES_PASSWORD=<real-password> \
  supabase/postgres:15.8.1.085

# Then restore as above. Zero errors expected.
```

## Offsite Coverage (Kopia)

The dumps directory is included in `/snapshot/appdata`, which is snapshotted by Kopia as part of `pre-backup.sh` step 5. Verify coverage in two steps:

**1. Confirm a recent snapshot exists:**

```bash
docker exec kopia kopia snapshot list /snapshot/appdata | tail -5
# Latest snapshot should be dated today or yesterday.
# Copy the snapshot ID (k-prefixed hash) for step 2.
```

**2. Confirm today's dump is inside that snapshot (no mount required):**

```bash
SNAPSHOT_ID=<paste-id-from-step-1>
docker exec kopia kopia ls $SNAPSHOT_ID/supabase/db/dumps/
# Expect to see today's supabase_dumpall_YYYYMMDD_HHMMSS.sql listed.
```

**Last verified:** 2026-04-22 against snapshot `k2b2e8aa1c32a41c6cf155163318bdb6d` — confirmed `supabase_dumpall_20260422_022853.sql` present.

## Change log

- **2026-04-22** — First rehearsal. Dump verified recoverable after fixing fault-tolerant bug in `pre-backup.sh` (see [`docs/plans/2026-04-21-pre-beta-hardening-sprint.md`](../plans/2026-04-21-pre-beta-hardening-sprint.md) Unit 3).
