---
title: "feat: E119-S11 — Retention TTL Enforcement Job"
type: feat
status: active
date: 2026-04-23
origin: docs/brainstorms/2026-04-23-e119-s11-retention-ttl-job-requirements.md
---

# feat: E119-S11 — Retention TTL Enforcement Job

## Overview

Flesh out the `retention-tick` Edge Function skeleton (created in S03) into a full daily enforcement job that reads the retention policy from S10, purges expired data across Supabase tables and Storage, and writes an auditable log. Adds the `retention_audit_log` migration, Cloudflare cron configuration, a heartbeat alert, and a deployment runbook.

## Problem Frame

The retention policy matrix (S10) defines what to keep and for how long, but without an automated enforcement job, expired personal data accumulates — violating GDPR Art 5(1)(e). The S03 skeleton already handles the soft-delete grace finaliser; S11 wraps that in a full per-entry iteration loop, adds Storage bucket purge, audit logging, and cron scheduling. (see origin: docs/brainstorms/2026-04-23-e119-s11-retention-ttl-job-requirements.md)

## Requirements Trace

- **R1 (AC-1)** — Iterate `RETENTION_POLICY`, compute cutoffs, delete, write audit log per entry.
- **R2 (AC-2)** — Idempotent: re-running same day finds nothing new.
- **R3 (AC-3)** — Per-entry error isolation; HTTP 207 on partial failure; failed entry logged.
- **R4 (AC-4)** — Dead-letter entry is server-side no-op, logged as `skipped: true`.
- **R5 (AC-5)** — Soft-delete grace finaliser preserved from S03 skeleton.
- **R6 (AC-6)** — `exports/` bucket objects older than 7d purged.
- **R7 (AC-7)** — Cloudflare cron at 03:00 UTC; runbook at `docs/deployment/retention-cron-setup.md`.
- **R8 (AC-8)** — Heartbeat alert: warn + sentinel response if no audit log row within 48h.
- **R9 (AC-9)** — Migration creates `retention_audit_log` table.
- **R10 (AC-10)** — Manual dry-run staging verification documented in runbook.

## Scope Boundaries

- Client-side IndexedDB dead-letter purge is browser-only; server cannot reach it. Logged as skipped in audit log.
- `chat_conversations` has no `is_pinned` column — 365d rolling delete targets all non-NULL `updated_at` rows older than 365d (no pinning distinction possible). This is documented and accepted for S11.
- No pg_cron — Cloudflare cron is the chosen trigger.
- No re-implementing `hardDeleteUser()` — S03 implementation is authoritative.

### Deferred to Separate Tasks

- Pruning `retention_audit_log` rows after 1 year — future chore story.
- `is_pinned` column on `chat_conversations` — future story if UX requires it.

## Context & Research

### Relevant Code and Patterns

- `supabase/functions/retention-tick/index.ts` — existing skeleton; has auth check, Stripe lazy-load, pagination loop over `auth.users`, `hardDeleteUser()` call, `sendEmail()` after delete.
- `supabase/functions/_shared/hardDeleteUser.ts` — cascade delete; returns `{ tablesDeleted, bucketsCleared, tableErrors, bucketErrors, stripeAnonymised, authDeleted }`.
- `supabase/functions/_shared/sendEmail.ts`, `emailTemplates.ts` — email helpers.
- `src/lib/compliance/retentionPolicy.ts` — `RETENTION_POLICY` array, `RetentionEntry` type. **Cannot be imported in Deno** (imports from browser module `consentService.ts`). The Edge Function must inline the policy entries or re-export them from `supabase/functions/_shared/retentionPolicy.ts`.
- `supabase/migrations/20260430000001_export_jobs.sql` — pattern for recent migration file naming and structure.
- `supabase/migrations/20260429000001_pending_deletions.sql` — `pending_deletions` table used by the existing skeleton.
- `chat_conversations` table: no `is_pinned` column — 365d rolling delete applies to all rows older than `now() - 365d`.
- No `wrangler.toml` exists in repo root — this will be created new for Cloudflare cron configuration.

### Institutional Learnings

- Self-hosted Supabase on Unraid (memory: reference_supabase_unraid.md) — pg_cron availability uncertain; Cloudflare cron is the chosen alternative.
- Dexie 4 `syncQueue` terminal = 'dead-letter' (memory: reference_dexie_4_quirks.md) — server-side retention tick cannot reach client IndexedDB; document as skipped.
- ES2020 constraints (memory: reference_es2020_constraints.md) — Edge Functions run Deno, not ES2020 browser; `Promise.allSettled` and optional chaining are fine.

## Key Technical Decisions

- **Inline policy in `_shared/`**: Create `supabase/functions/_shared/retentionPolicy.ts` that re-exports a Deno-compatible copy of the policy data. The browser `retentionPolicy.ts` cannot be imported in Deno due to `import type { ConsentPurpose }` from a browser-only module. The shared file declares the interface inline and exports the same `RETENTION_POLICY` constant. This avoids modifying the browser module and keeps the Edge Function portable.
- **Per-entry audit log rows, single `run_id`**: Each `RETENTION_POLICY` entry gets its own `retention_audit_log` row keyed by a shared `run_id` (UUID generated at function start). This allows per-table error inspection while grouping runs for heartbeat queries.
- **HTTP 207 on partial failure**: If any entry errors, the function returns 207 rather than 500. This lets the cron caller distinguish "total crash" (500) from "ran but some tables failed" (207), enabling targeted alerting.
- **Storage list pagination**: Supabase Storage `list()` defaults to 100 items. The purge loop must paginate using `offset` until an empty page is returned.
- **Heartbeat check at function start**: Query `retention_audit_log` for `completed_at > now() - interval '48 hours'`. If none found and this is not literally the first run (check by total row count > 0), emit a structured `console.error` with `[HEARTBEAT_MISS]` prefix so log aggregators can alert on it.
- **`chat_conversations` 365d rolling delete**: Delete where `updated_at < now() - interval '365 days'` (no `is_pinned` distinction possible with current schema). Log `rows_affected` and a note in the audit entry.

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```
Cloudflare Cron (03:00 UTC)
  → POST /functions/v1/retention-tick
      x-retention-secret: <RETENTION_TICK_SECRET>

retention-tick/index.ts:
  1. Validate secret header
  2. Heartbeat check (query audit log for last 48h)
  3. Generate run_id = crypto.randomUUID()
  4. Soft-delete grace finaliser loop (existing S03 logic, unchanged)
     → hardDeleteUser(), sendEmail(), pending_deletions cleanup
  5. For each entry in RETENTION_POLICY (from _shared/retentionPolicy.ts):
     a. started_at = now()
     b. Dispatch to handler by artefact type:
        - "storage:exports"  → Storage purge (7d cutoff, paginated list+remove)
        - "storage:*"        → skip (account-lifetime; hardDeleteUser handles)
        - "sync_queue_dead_letter" → log as skipped (client-side only)
        - "chat_conversations" → time-bounded DELETE (365d rolling)
        - other db tables    → skip if period == "Account lifetime + 30d"
                               (handled by hardDeleteUser cascade; only special
                                periods need active TTL enforcement)
     c. Write retention_audit_log row (run_id, artefact, rows_affected,
        started_at, completed_at, error, skipped)
  6. Return 200 if no errors, 207 if any entry had errors
```

**Artefacts that need active TTL enforcement** (i.e., not "Account lifetime + 30d"):
- `storage:exports` — 7d
- `chat_conversations` — 365d rolling (non-pinned, no distinction yet)
- `embeddings`, `learner_models` — consent withdrawal (handled by consent service, not time-based; log as skipped with note)
- `auth_session_logs` — Supabase Auth managed; log as skipped
- `breach_register`, `invoices` — manual/offline; log as skipped
- `sync_queue_dead_letter` — client-side; log as skipped
- All other tables: "Account lifetime + 30d" → handled by hardDeleteUser; log as skipped with note

## Implementation Units

- [ ] **Unit 1: `_shared/retentionPolicy.ts` — Deno-compatible policy re-export**

**Goal:** Make `RETENTION_POLICY` importable from Deno Edge Functions without pulling in browser-only modules.

**Requirements:** R1

**Dependencies:** None

**Files:**
- Create: `supabase/functions/_shared/retentionPolicy.ts`

**Approach:**
- Declare a `RetentionEntry` interface inline (copy of the browser type, no imports).
- Export `RETENTION_POLICY` as a `readonly RetentionEntry[]` constant with the same data as `src/lib/compliance/retentionPolicy.ts`.
- Add a comment noting this file must be kept in sync with `src/lib/compliance/retentionPolicy.ts` and the parity test will catch browser-side drift.
- Only the fields needed by the enforcement job are strictly required (`artefact`, `period`, `deletionMechanism`), but export the full interface for completeness.

**Patterns to follow:**
- `supabase/functions/_shared/hardDeleteUser.ts` — self-contained Deno module, no browser imports.

**Test scenarios:**
- Test expectation: none — this is a pure data/type file with no logic. Coverage provided by the tick integration tests in Unit 4 which import it.

**Verification:**
- `deno check supabase/functions/retention-tick/index.ts` passes after this file is created.

---

- [ ] **Unit 2: `retention_audit_log` migration**

**Goal:** Create the database table that stores per-run, per-entry enforcement results.

**Requirements:** R9

**Dependencies:** None (independent migration)

**Files:**
- Create: `supabase/migrations/20260501000001_retention_audit_log.sql`

**Approach:**
- Table columns: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`, `run_id uuid NOT NULL`, `artefact text NOT NULL`, `rows_affected int NOT NULL DEFAULT 0`, `started_at timestamptz NOT NULL`, `completed_at timestamptz`, `error text`, `skipped bool NOT NULL DEFAULT false`.
- Index on `completed_at DESC` for the heartbeat query (`SELECT 1 FROM retention_audit_log WHERE completed_at > now() - interval '48 hours' LIMIT 1`).
- Index on `run_id` for grouping a full run's entries.
- RLS: disabled (service-role only; no user RLS needed).
- No `updated_at` trigger needed — rows are write-once.
- Follow idempotency pattern: `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`.

**Patterns to follow:**
- `supabase/migrations/20260429000001_pending_deletions.sql` — recent migration structure.

**Test scenarios:**
- Test expectation: none — DDL migration, covered by integration test in Unit 4 which verifies rows can be inserted and queried.

**Verification:**
- Migration applies cleanly with `supabase db push` (or equivalent on self-hosted Unraid instance).
- `\d retention_audit_log` shows expected columns and indexes.

---

- [ ] **Unit 3: `retention-tick/index.ts` — full enforcement job**

**Goal:** Flesh out the S03 skeleton into the complete daily enforcement job covering all AC-1 through AC-8.

**Requirements:** R1, R2, R3, R4, R5, R6, R8

**Dependencies:** Unit 1 (retentionPolicy.ts), Unit 2 (migration must exist before writing audit rows in production)

**Files:**
- Modify: `supabase/functions/retention-tick/index.ts`

**Approach:**
- Preserve the existing auth check, Stripe lazy-load, and soft-delete grace finaliser loop verbatim — do not refactor what works.
- Add at function start (after auth check, before grace finaliser loop): heartbeat check query. If `SELECT COUNT(*) FROM retention_audit_log WHERE completed_at > now() - interval '48 hours'` returns 0 and total row count > 0, emit `console.error('[HEARTBEAT_MISS] retention-tick has not run successfully in 48h')`.
- Generate `run_id = crypto.randomUUID()` once at the start of a tick run.
- After the grace finaliser loop, iterate `RETENTION_POLICY` entries from `_shared/retentionPolicy.ts`:
  - **`storage:exports`**: list `exports/` bucket objects, filter by `created_at < now() - 7d`, batch-remove. Log `rows_affected` = objects deleted.
  - **`chat_conversations`**: execute `DELETE FROM public.chat_conversations WHERE updated_at < now() - interval '365 days'`. Log `rows_affected` from result count.
  - All other artefacts: log as `skipped: true, rows_affected: 0` with `error: null`. Include a descriptive note (e.g., "handled by hardDeleteUser cascade", "client-side only", "manually managed").
- Wrap each entry's logic in try/catch. On error: write audit row with `error` populated, push entry to `failedEntries[]`, continue to next entry.
- After all entries processed: write all audit rows via `supabaseAdmin.from('retention_audit_log').insert(auditRows)`.
- Return 200 if `failedEntries.length === 0`, 207 if any failed. Response body includes `{ success, run_id, processed, skipped, failed }`.
- Idempotency: deleting already-deleted rows is a no-op; cutoff is computed from `now()` each run so same-day re-runs find nothing new past the cutoff.

**Technical design:**
```
// Directional — not implementation specification
const auditRows = []
for (const entry of RETENTION_POLICY) {
  const started_at = new Date().toISOString()
  let rows_affected = 0, error = null, skipped = false
  try {
    switch (entry.artefact) {
      case 'storage:exports': { /* list + remove with pagination */ break }
      case 'chat_conversations': { /* time-bounded DELETE */ break }
      default: { skipped = true; break }
    }
  } catch (err) { error = err.message; failedEntries.push(entry.artefact) }
  auditRows.push({ run_id, artefact: entry.artefact, rows_affected,
    started_at, completed_at: new Date().toISOString(), error, skipped })
}
await supabaseAdmin.from('retention_audit_log').insert(auditRows)
return json({ ... }, failedEntries.length > 0 ? 207 : 200)
```

**Patterns to follow:**
- Existing S03 skeleton error handling pattern (try/catch per user, continue loop, collect errors array).
- `hardDeleteUser.ts` — returns structured result; never throws; accumulates errors internally.

**Test scenarios:**
- Happy path: invoke with no expired data → all entries skipped, audit log populated with `rows_affected: 0`, returns 200.
- Happy path: invoke with an `exports/` bucket object older than 7d → object deleted, audit log row shows `rows_affected: 1`.
- Happy path: invoke with a `chat_conversations` row with `updated_at` 400 days ago → row deleted, audit log shows `rows_affected: 1`.
- Happy path: invoke with a user whose `pending_deletion_at` is 8 days ago → `hardDeleteUser` called, receipt email sent.
- Idempotency: invoke twice in the same day → second run shows `rows_affected: 0` for all entries.
- Error isolation (AC-3): mock the `chat_conversations` DELETE to throw → other entries still processed, audit log row for chat_conversations has `error` set, function returns 207.
- Heartbeat miss: no audit log rows with `completed_at` in last 48h → `[HEARTBEAT_MISS]` appears in structured log output.
- Dead-letter entry: `sync_queue_dead_letter` in policy → logged as `skipped: true, rows_affected: 0`, no server-side deletion attempted.
- Storage pagination: `exports/` bucket has 150 objects older than 7d → all 150 deleted across two paginated list calls.
- Auth rejection: request with wrong `x-retention-secret` → 401 returned, no data touched.

**Verification:**
- Manual invocation against staging with seeded expired data deletes correct rows.
- Audit log table has one row per `RETENTION_POLICY` entry after a run.
- Function returns 200 on clean run, 207 if any entry errored.
- Heartbeat log fires when audit table is empty.

---

- [ ] **Unit 4: Unit tests for the enforcement job**

**Goal:** Cover the enforcement logic with focused unit tests that mock Supabase and Storage clients.

**Requirements:** R1, R2, R3, R4

**Dependencies:** Unit 1, Unit 3

**Files:**
- Create: `supabase/functions/retention-tick/__tests__/tick.test.ts`

**Approach:**
- Use the existing `supabase/functions/_shared/__tests__/` pattern as reference.
- Mock `supabaseAdmin` methods: `.from().delete()`, `.from().insert()`, `.storage.from().list()`, `.storage.from().remove()`, `.auth.admin.listUsers()`.
- Test the per-entry dispatch logic, error isolation, audit row shape, and heartbeat check logic in isolation.
- Tests run with Deno test runner (`deno test`).

**Patterns to follow:**
- `supabase/functions/_shared/__tests__/` — existing test structure for shared Edge Function helpers.

**Test scenarios:**
- Happy path: all entries dispatched, audit rows inserted with correct shape (`run_id` present, `artefact` matches entry, `rows_affected` is number, `completed_at` is set).
- Error isolation: one entry throws → `failedEntries` contains that artefact, other entries have `error: null`, function returns 207.
- Idempotency signal: DELETE returns `count: 0` → `rows_affected: 0` in audit row.
- Storage purge: mock `list()` returning 2 old objects → `remove()` called with both paths, `rows_affected: 2`.
- Dead-letter skip: `sync_queue_dead_letter` entry → `skipped: true` in audit row, no DB delete attempted.
- Heartbeat miss detection: mock `retention_audit_log` query to return empty → `[HEARTBEAT_MISS]` emitted in console output.

**Verification:**
- `deno test supabase/functions/retention-tick/__tests__/tick.test.ts` passes.
- All 6 scenario groups have at least one assertion.

---

- [ ] **Unit 5: Cloudflare cron configuration and deployment runbook**

**Goal:** Configure the Cloudflare cron trigger and document the full operational setup.

**Requirements:** R7

**Dependencies:** Unit 3 (function must exist before cron is configured)

**Files:**
- Create: `wrangler.toml` (repo root)
- Create: `docs/deployment/retention-cron-setup.md`

**Approach:**
- `wrangler.toml`: Cloudflare Workers config with `[triggers] crons = ["0 3 * * *"]`. The Worker is a thin pass-through that calls the Supabase Edge Function URL with the `x-retention-secret` header from a Cloudflare Worker secret env var. This avoids exposing the secret in wrangler.toml itself.
- Alternatively: If Pedro does not want a separate Cloudflare Worker, the runbook documents using a Cloudflare Cron Trigger that calls an HTTP endpoint directly (using Cloudflare's "Scheduled Events" with a fetch to the Edge Function URL). Document both options; default to the simpler HTTP fetch approach.
- `docs/deployment/retention-cron-setup.md`: step-by-step runbook covering:
  - Prerequisites (Cloudflare account, wrangler CLI)
  - Setting `RETENTION_TICK_SECRET` in Cloudflare Worker secrets and in Supabase Edge Function env
  - Deploying / updating the cron trigger
  - Verifying the cron fired (check Cloudflare Worker logs + `retention_audit_log` rows)
  - Manual dry-run procedure (invoke the Edge Function directly with curl, verify audit log)
  - Heartbeat monitoring: how to detect `[HEARTBEAT_MISS]` in logs
  - Rollback: how to disable the cron trigger

**Test scenarios:**
- Test expectation: none — configuration and docs; coverage provided by manual dry-run procedure documented in runbook.

**Verification:**
- `wrangler.toml` parses without errors (`wrangler validate`).
- `docs/deployment/retention-cron-setup.md` exists and covers all steps.
- Manual dry-run with curl succeeds and leaves audit log rows.

---

## System-Wide Impact

- **Interaction graph:** `retention-tick` calls `hardDeleteUser` (existing), `sendEmail` (existing), and new `supabaseAdmin.storage` list/remove calls. The cron caller (Cloudflare Worker) interacts only via HTTP.
- **Error propagation:** Per-entry errors are caught and logged; they never propagate to abort the whole run. The caller receives 207 to signal partial failure. No user-facing impact.
- **State lifecycle risks:** The function deletes data permanently. The idempotency design (cutoff computed from `now()`) means same-day re-runs are safe but not instantaneous — a re-run within the same second could theoretically find the same rows if the previous run failed mid-delete. Acceptable risk given the 03:00 UTC scheduling.
- **`retention_audit_log` write ordering:** Audit rows are batch-inserted at the end of the run. If the function crashes after all deletes but before the insert, rows are lost. Trade-off accepted: individual entry `console.log` lines still exist in Edge Function logs as a secondary audit trail.
- **Unchanged invariants:** `hardDeleteUser()` behaviour, `pending_deletions` table structure, and the soft-delete grace period of 7 days are not changed by S11.
- **Integration coverage:** The manual dry-run documented in the runbook (AC-10) is the integration gate — automated E2E tests for a cron job against live Supabase are impractical in CI.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `_shared/retentionPolicy.ts` drifts from `src/lib/compliance/retentionPolicy.ts` | Add a comment in both files directing maintainers to update both simultaneously. The existing parity test (`retentionParity.test.ts`) catches browser-side drift; add a note in that test to also check the Deno copy. |
| `exports/` bucket has thousands of old objects — Storage `list()` times out | Paginated list loop with 100 items per page; cap total objects removed per run at 500 with a logged warning if cap hit. |
| Cloudflare cron secret exposed in logs | Use Cloudflare Worker secrets (env vars), never log the secret value. The wrangler.toml references the secret by name only. |
| `chat_conversations` 365d delete removes "pinned" conversations | No `is_pinned` column exists; behaviour is documented and accepted. Future story adds the column. |
| Self-hosted Supabase clock skew | UTC timestamps used throughout; `now()` is always Supabase-server time, not client time. |

## Documentation / Operational Notes

- `docs/deployment/retention-cron-setup.md` is the primary operational runbook.
- After deployment, verify the first cron run via Cloudflare Worker logs and `SELECT * FROM retention_audit_log ORDER BY completed_at DESC LIMIT 40`.
- Heartbeat monitoring: set up log alerting on `[HEARTBEAT_MISS]` in Cloudflare Worker or Supabase Edge Function log stream.

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-23-e119-s11-retention-ttl-job-requirements.md](../brainstorms/2026-04-23-e119-s11-retention-ttl-job-requirements.md)
- **Story file:** [docs/implementation-artifacts/stories/E119-S11.md](../implementation-artifacts/stories/E119-S11.md)
- **Retention policy (browser):** `src/lib/compliance/retentionPolicy.ts`
- **Existing skeleton:** `supabase/functions/retention-tick/index.ts`
- **Shared helpers:** `supabase/functions/_shared/hardDeleteUser.ts`
- **Umbrella plan:** [docs/plans/2026-04-22-003-feat-e119-gdpr-full-compliance-plan.md](2026-04-22-003-feat-e119-gdpr-full-compliance-plan.md)
