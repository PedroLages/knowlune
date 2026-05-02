---
title: Pre-Beta Hardening Sprint — Close R4-R8 Before Inviting Users
type: feat
status: complete
date: 2026-04-21
origin: docs/plans/2026-04-21-remaining-epics-execution-order.md
supersedes: 2026-04-18-011-feat-knowlune-online-beta-launch-plan.md (Gate 0 portion)
---

# Pre-Beta Hardening Sprint

## Overview

Knowlune is deployed at `knowlune.pedrolages.net` (bundled container on titan, not the split topology the original beta plan proposed). Deployment is live but **4 of 5 production-readiness gaps from the beta plan are open**, plus 3 new issues surfaced during a live audit on 2026-04-21. Close these before inviting any humans.

## Audit Results (2026-04-21 via SSH to titan)

| # | Gap | Status | Evidence |
|---|---|---|---|
| R4 | Restore rehearsal | ❌ Not done | Dumps exist at `/mnt/user/appdata/supabase/db/dumps/` (daily, 1.1-1.2 MB) but no restore has been rehearsed. |
| R5 | Kopia offsite covers dumps | ✅ Likely yes | Kopia snapshots `/snapshot/appdata` → includes `/mnt/user/appdata/supabase/db/dumps/`. Latest snapshot Apr 19. Not explicitly validated. |
| R6 | Postgres tuned for 31GB host | ❌ Not tuned | `shared_buffers=128MB`, `effective_cache_size=128MB` — container defaults. |
| R7 | Sentry DSN in production | ❌ Not configured | No `SENTRY_DSN` / `VITE_SENTRY_DSN` env in knowlune container. CSP allows `*.ingest.sentry.io` (code ready) but no DSN = errors go nowhere. |
| R8 | Privacy/Terms/Delete UI | ⚠ Routes return SPA shell | `/privacy`, `/terms` return 200 (SPA routing). Need end-to-end browser verification that content renders + delete flow works. |
| BONUS-1 | knowlune container unhealthy | ⚠ Cosmetic | Healthcheck `wget http://localhost/health` fails from inside container but `curl 172.23.0.46/health` returns `healthy` from host. Healthcheck command targets wrong interface. |
| BONUS-2 | Dumps 2 days stale | ❌ Dump cron broken | Last dump Apr 19. Today Apr 21. Cron may have stopped. |
| BONUS-3 | Titan load avg 17-18 sustained | ⚠ Capacity concern | 36-day uptime with consistent 17-18 load avg. May or may not be Knowlune. |

## Problem Frame

Inviting users with no error reporting (R7) and untuned Postgres (R6) is a self-inflicted wound. Sentry will be silent on the first bug, and Postgres will thrash on queries that should stay in memory. Restore rehearsal (R4) and stale dumps (BONUS-2) mean the backup story is untested — if Titan's disk dies tomorrow, you don't know if you can recover.

Fix all P0 items before the first invite. Document the P1 items as "known before launch, acceptable risk."

## Requirements Trace

- **R1.** Sentry production DSN configured; a forced error appears in Sentry dashboard within 60 seconds (R7).
- **R2.** Postgres tuned: `shared_buffers ≥ 8GB`, `effective_cache_size ≥ 24GB`, `work_mem=64MB`, `maintenance_work_mem=1GB`, verified via `SHOW` after restart (R6).
- **R3.** Supabase dump cron proven running: manual `pg_dumpall` execution writes to `/mnt/user/appdata/supabase/db/dumps/` with today's date (BONUS-2).
- **R4.** Restore rehearsal documented: a throwaway Postgres container successfully restores the latest dump; the runbook is committed to the repo (R4).
- **R5.** `/privacy`, `/terms` render actual content in the live app. Account deletion flow tested end-to-end by creating → deleting a throwaway account (R8).
- **R6.** `knowlune` container healthcheck returns healthy (BONUS-1). Fix healthcheck target or suppress if cosmetic.
- **R7.** Kopia restore of the Supabase dump path verified by listing files inside a snapshot (R5 validation).
- **R8.** Cause of titan load avg 17-18 identified; documented as accepted or mitigated (BONUS-3).

## Scope Boundaries

- **In scope:** The 5 beta-plan gaps + 3 audit findings above. Each has a clear verification criterion.
- **Not in scope:** Cloudflare Pages split, Express→Workers port, WAL-G PITR, Supabase Cloud migration. (All deferred per original beta plan.)
- **Not in scope:** E118 (in-app feedback) and E119 (GDPR full compliance) — those are separate epics in the roadmap; this sprint is purely infrastructure hardening.

## Implementation Plan

### Unit 1: Sentry Production DSN (R7) — P0

**Effort:** 30-60 min.

1. Create a Sentry project (React SPA) at sentry.io (or self-hosted if preferred).
2. Copy the DSN.
3. Add to titan env (wherever knowlune container is orchestrated — likely Unraid Docker template or docker-compose):
   - `VITE_SENTRY_DSN=<dsn>`
   - `VITE_SENTRY_ENVIRONMENT=production`
   - `VITE_SENTRY_TRACES_SAMPLE_RATE=0.1`
4. Rebuild the Docker image (DSN is baked at build time for Vite).
5. Redeploy `knowlune` container.
6. **Verify:** open the live app, trigger an intentional error (e.g., browser console: `throw new Error('sentry-smoke-test')`), confirm it appears in Sentry within 60s.

**Files to reference:**
- `src/lib/errorTracking.ts` — existing Sentry wiring (no-op without DSN)
- `Dockerfile` — check how VITE_* env vars are passed during build

### Unit 2: Postgres Tuning (R6) — P0

**Effort:** 1-2 hours (including brief supabase-db restart).

Config volume: `/var/lib/docker/volumes/supabase_supabase-db-config/_data` → mounted at `/etc/postgresql-custom`.

1. Back up current config: `cp /etc/postgresql-custom/postgresql.conf{,.bak-2026-04-21}`
2. Append tuned settings to `postgresql.conf`:
   ```
   shared_buffers = 8GB
   effective_cache_size = 24GB
   work_mem = 64MB
   maintenance_work_mem = 1GB
   max_connections = 100
   random_page_cost = 1.1
   effective_io_concurrency = 200
   ```
3. **Before restart:** manual dump: `docker exec supabase-db pg_dumpall -U postgres > dump-before-tuning.sql`
4. Restart: `docker restart supabase-db` (expect ~30s downtime)
5. **Verify:** `docker exec supabase-db psql -U postgres -c "SHOW shared_buffers; SHOW effective_cache_size;"` returns the new values.
6. **Smoke-test:** app loads; a search query still works.

**Rollback:** restore `postgresql.conf.bak-2026-04-21`, restart supabase-db.

### Unit 3: Fix Dump Script Fail-Fast Bug (BONUS-2) — P0

**Effort:** 20-30 min. **Root cause identified during audit 2026-04-21.**

**Problem:** `/mnt/user/docker/scripts/pre-backup.sh` uses `set -euo pipefail`. Step 3 (postgres-shared) fails with `Error response from daemon: No such container: postgres-shared` because the container was recreated with a prefixed ID (now `f82cb851b692_postgres-shared`). Script aborts BEFORE reaching step 3c (Supabase dump). This has been silently broken since Apr 19.

**Additional finding:** A dedicated `/mnt/user/docker/scripts/supabase-db-backup.sh` exists (clean, focused, gzips output) but nothing calls it — its logic was inlined into `pre-backup.sh` step 3c.

**Recommended fix (all three):**

**(a) Make each dump step tolerant of missing containers** (matches the Immich pattern already in the same script):

```bash
# In pre-backup.sh, wrap each docker exec block:
if docker exec postgres-shared pg_dumpall -U admin > "$SHARED_BACKUP_DIR/pg_shared_dumpall_${TIMESTAMP}.sql" 2>/dev/null; then
  echo "$LOG_PREFIX pg_dumpall complete: postgres-shared"
else
  echo "$LOG_PREFIX postgres-shared dump skipped (container missing or error)"
fi
```

Apply the same pattern to the Supabase step (3c) and the Vaultwarden SQLite step.

**(b) Rename the orphaned container back** so today's shared-postgres dump works:

```bash
ssh titan "docker rename f82cb851b692_postgres-shared postgres-shared"
```

**(c) Optional cleanup** — delete the orphaned `supabase-db-backup.sh` since its logic is inlined in `pre-backup.sh`. (Or replace step 3c with a call to it, but (a) is simpler.)

**Verify:**
1. After fix, manually run: `ssh titan /mnt/user/docker/scripts/pre-backup.sh`
2. Confirm new file: `ls -lh /mnt/user/appdata/supabase/db/dumps/supabase_dumpall_$(date +%Y%m%d)*`
3. Tomorrow (Apr 22), confirm cron ran without intervention.

### Unit 4: Restore Rehearsal (R4) — P0

**Effort:** 1-2 hours. Do this AFTER Unit 3 confirms fresh dumps.

1. Pull latest Supabase dump file.
2. `docker run --rm -d --name pg-restore-test -e POSTGRES_PASSWORD=test postgres:15.8`
3. `docker exec -i pg-restore-test psql -U postgres < /path/to/latest-dump.sql`
4. `docker exec pg-restore-test psql -U postgres -c "\dt"` — verify tables exist.
5. Pick 3 key tables: `SELECT COUNT(*) FROM auth.users; SELECT COUNT(*) FROM public.courses; SELECT COUNT(*) FROM public.notes;` — verify counts match production.
6. `docker rm -f pg-restore-test`.
7. **Deliverable:** write `docs/runbooks/supabase-restore-rehearsal.md` with the exact steps that worked.

### Unit 5: Kopia Coverage Verification (R5) — P0

**Effort:** 15 min.

1. `ssh titan "docker exec kopia kopia snapshot list /snapshot/appdata | head -5"` — pick the latest snapshot.
2. Browse the snapshot contents: `docker exec kopia kopia mount <snapshot-id> /tmp/mnt` then `ls /tmp/mnt/supabase/db/dumps/`.
3. Verify the most recent dump file is present.
4. Unmount: `docker exec kopia kopia unmount /tmp/mnt`.
5. **Deliverable:** a 3-line note in `docs/runbooks/supabase-restore-rehearsal.md` confirming offsite coverage.

### Unit 6: Privacy/Terms/Delete UI Verification (R8) — P0

**Effort:** 20 min — pure manual browser testing.

1. Open `https://knowlune.pedrolages.net/privacy` — confirm legal content renders (not just SPA shell).
2. Open `https://knowlune.pedrolages.net/terms` — same check.
3. Sign up with a throwaway email.
4. Settings → Account → Delete Account — execute the flow.
5. Confirm:
   - Confirmation email (if any) arrives.
   - User is logged out.
   - Signing in again fails (user deleted from Supabase Auth).
   - Data actually deleted from Supabase tables (spot-check via `docker exec supabase-db psql -U postgres -c "SELECT COUNT(*) FROM auth.users WHERE email='<throwaway>';"`).
6. **If any step fails:** file as a BLOCKER and fix before P1 work.

### Unit 7: Fix knowlune Healthcheck (BONUS-1) — P1

**Effort:** 15 min.

Problem: healthcheck runs `wget http://localhost/health` inside the container, but Nginx inside the container is not listening on loopback for that path.

Options:
- **(a)** Change healthcheck to probe the actual IP: `wget --spider http://172.23.0.46/health` (brittle).
- **(b)** Change healthcheck command to probe a path Nginx actually serves: `wget --spider http://localhost/` — any 200.
- **(c)** Add a `/health` location to the container's Nginx config that returns 200 regardless of backend.

**Recommended:** (b) — simplest, most resilient.

### Unit 8: Investigate Titan Load Average (BONUS-3) — P1

**Effort:** 30-60 min (triage).

1. `ssh titan "docker stats --no-stream --format 'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}'" | sort -k2 -r | head -15`
2. Identify the top 3 CPU-consuming containers.
3. If `knowlune` or `supabase-db` is near the top, link to Postgres tuning (Unit 2) outcome.
4. If unrelated (e.g., `immich`, `jellyfin`), document as "acceptable shared-server baseline" and move on.
5. **Deliverable:** one-liner in `docs/known-issues.yaml` about the load avg source.

## Execution Order

```
P0 (serial):
  Unit 1 (Sentry) ────────────────┐
  Unit 2 (Postgres tuning) ───────┤
  Unit 3 (Dump cron) ─────────────┤→ Unit 4 (Restore rehearsal) → Unit 5 (Kopia) → Unit 6 (UI check)
                                  │
P1 (parallel, after P0):
  Unit 7 (Healthcheck)
  Unit 8 (Load avg triage)
```

- **Units 1-3 can run in parallel** (different systems, no interdependency).
- **Unit 4 blocks on Unit 3** (needs fresh dump).
- **Unit 6 blocks on Unit 1** (you want Sentry capturing errors during the test).

**Estimated total P0 time:** 4-6 hours of focused work, plus 24h wait for the next dump cron to prove Unit 3.

## Verification — Go/No-Go Checklist

Before the first user invite:

- [x] Sentry receives a forced error from production (2026-04-22: DSN configured via GHA secret VITE_SENTRY_DSN, EU ingest added to CSP)
- [x] Postgres shows tuned values via `SHOW` (2026-04-22: shared_buffers=8GB, effective_cache_size=24GB, work_mem=64MB via custom-overrides.conf)
- [x] A fresh dump exists dated today/yesterday (2026-04-22: pre-backup.sh fault-tolerant fix; dump at supabase_dumpall_20260422_022853.sql)
- [x] Restore rehearsal runbook committed to repo and executed successfully (2026-04-22: docs/runbooks/supabase-restore-rehearsal.md; all row counts match)
- [x] Kopia snapshot of `/mnt/user/appdata/supabase/db/dumps/` validated (2026-04-22: snapshot k2b2e8aa1c32a41c6cf155163318bdb6d confirmed)
- [x] `/privacy`, `/terms` render content; delete-account flow end-to-end tested (2026-04-22: delete-account Edge Function deployed, user hard-deleted from auth.users after confirming dialog)
- [ ] Container healthcheck green (optional — P1, deferred)
- [ ] Titan load avg source documented (optional — P1, deferred)

## Post-Sprint

After all P0 items pass the Go/No-Go checklist, update:

1. `docs/plans/2026-04-21-remaining-epics-execution-order.md` → mark Gate 0 complete
2. `docs/known-issues.yaml` → any deferred issues from this sprint
3. Start **Gate 1** (E118 feedback, E119 GDPR, E66 WCAG, E64a bundle perf, E99 view modes)

## Context

This sprint exists because the 2026-04-18 beta launch plan assumed a Cloudflare Pages split that never happened — the plan was written before Pedro chose to deploy the bundled Dockerfile directly to titan. The deployment works, but the plan's §4 "Pre-Launch Gaps" work was never formally executed. This document closes the loop.
