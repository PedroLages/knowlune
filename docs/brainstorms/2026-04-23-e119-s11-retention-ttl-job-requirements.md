# E119-S11: Retention TTL Enforcement Job — Requirements

**Date:** 2026-04-23
**Story:** E119-S11
**Depends on:** E119-S10 (retentionPolicy.ts)

---

## Problem Statement

Knowlune stores personal data for EU users across 39 Supabase tables, 4 Storage buckets, and client-side IndexedDB. The retention policy matrix (S10) defines the legal time-limits for each artefact, but without an enforcement mechanism, expired data simply accumulates — violating GDPR Art 5(1)(e) (storage limitation) and creating legal liability.

A daily scheduled job must read the retention policy, compute cutoff dates, purge expired rows/objects, and write an auditable log. The job must also finalise users past the 7-day soft-delete grace period (already partially implemented in the S03 skeleton) and purge `exports/` bucket objects after 7 days (AC-6 of the story).

The enforcement job lives in the existing Edge Function skeleton at `supabase/functions/retention-tick/index.ts` created in S03. S11 fleshes it out completely.

---

## Acceptance Criteria

| ID | Criterion |
|----|-----------|
| AC-1 | `retention-tick` iterates `RETENTION_POLICY` entries, computes cutoff dates, deletes expired rows/objects, and writes one `retention_audit_log` row per entry with `(run_id, entry, rows_affected, started_at, completed_at, error)`. |
| AC-2 | Function is idempotent: re-running on the same day finds nothing new to delete (deleted rows are already gone; cutoff window doesn't advance within a day). |
| AC-3 | If one table errors mid-iteration, other tables continue processing; the failed table is logged with the error; the function returns HTTP 207 (multi-status) for alerting when any entry failed. |
| AC-4 | Dead-letter purge: `syncQueue` rows (client-side Dexie only, noted in policy as no server table) — this is a no-op server-side; the policy entry for `sync_queue_dead_letter` is logged as `rows_affected: 0, skipped: true` with a note that it is client-side only. |
| AC-5 | Soft-delete grace finaliser: users whose `pending_deletion_at` is more than 7 days old are hard-deleted via S03's `hardDeleteUser()` cascade and receipt email is sent (existing logic in S03 skeleton, now extended). |
| AC-6 | `exports/` bucket objects older than 7 days are purged (satisfying S06 TTL requirement). |
| AC-7 | Cloudflare cron trigger configured to call `retention-tick` daily at 03:00 UTC; configuration documented in `docs/deployment/retention-cron-setup.md`. |
| AC-8 | Heartbeat alert: if no `retention_audit_log` row exists with `completed_at > now() - 48h`, a structured warning log fires and the function returns a sentinel that monitoring can detect. |
| AC-9 | Supabase migration creates `retention_audit_log` table with `run_id uuid`, `artefact text`, `rows_affected int`, `started_at timestamptz`, `completed_at timestamptz`, `error text nullable`, `skipped bool default false`. |
| AC-10 | E2E staging dry-run: with seeded expired data, manual invocation verifies correct rows deleted and audit log populated. |

---

## Out of Scope

- Operator compliance documents (S12).
- Annual review checklist (S13).
- Client-side IndexedDB enforcement (browser-side dead-letter purge — documented as client-only in policy; server cannot reach IndexedDB).
- Re-implementing `hardDeleteUser()` — S03's implementation is the authoritative cascade.
- pg_cron — self-hosted Supabase pg_cron availability is uncertain; Cloudflare cron is the chosen trigger (decided in story context).
- Multi-region Supabase — single EU deployment only.

---

## Technical Context

- **Skeleton:** `supabase/functions/retention-tick/index.ts` already handles soft-delete grace finalisation (the S03 portion). S11 must preserve that logic and wrap it within the broader per-entry iteration.
- **Retention policy source:** `src/lib/compliance/retentionPolicy.ts` — `RETENTION_POLICY` export, `RetentionEntry` type. Browser-only module (no Deno-compatible import path) — the Edge Function must re-declare or inline the policy entries or import from a Deno-compatible path. The `retentionPolicy.ts` file uses `import type { ConsentPurpose }` from a browser module; the Edge Function cannot import it directly. Solution: duplicate the essential data structure or move shared types to `supabase/functions/_shared/`.
- **Shared helpers:** `supabase/functions/_shared/hardDeleteUser.ts`, `sendEmail.ts`, `emailTemplates.ts` — already used by the skeleton.
- **Auth pattern:** service-role client with `RETENTION_TICK_SECRET` header for caller authentication.
- **Audit log:** new Supabase table `retention_audit_log` via a migration file. RLS: no user RLS (service-role only). Index on `completed_at` for heartbeat query.
- **Cloudflare cron:** wrangler.toml `[triggers] crons = ["0 3 * * *"]` pointing to the Supabase Edge Function URL with the shared secret in a secret env var.
- **Heartbeat check:** at function start, query `retention_audit_log` for any row with `completed_at > now() - interval '48 hours'`. If none and this is not the first run, emit structured warning log.
- **Storage purge (exports):** use `supabaseAdmin.storage.from('exports').list()` then `remove()` for objects with `created_at` older than 7 days. Handle pagination (Supabase Storage `list()` defaults to 100 items).
- **`chat_conversations` special case:** `period: null` (indefinite for pinned; 365d rolling for non-pinned). The Edge Function must query non-pinned conversations with `updated_at < now() - 365d` and delete them. "Pinned" flag — need to check schema. If no `is_pinned` column exists, log all as skipped for now and document the gap.

---

## Open Questions

| # | Question | Status |
|---|----------|--------|
| Q1 | Does `chat_conversations` table have an `is_pinned` column in Supabase? If not, 365d rolling delete cannot distinguish pinned conversations. | Resolve during implementation — check migration files. If absent, skip with logged note. |
| Q2 | Does the Cloudflare Worker / wrangler project already exist for this repo, or is this the first cron trigger? | Resolve during implementation — check for `wrangler.toml` in repo root. |
| Q3 | Should `retention_audit_log` rows themselves be purged after some period? | Deferred — add a 1-year rolling purge of audit logs in a future story. Not needed for S11 GDPR compliance. |
