---
title: "feat: Large-Export Async Path + Signed URL (E119-S06)"
type: feat
status: active
date: 2026-04-23
origin: docs/brainstorms/2026-04-23-e119-s06-large-export-async-requirements.md
---

# feat: Large-Export Async Path + Signed URL (E119-S06)

## Overview

`export-data` already detects when a user's export would exceed 500 MB and returns `{ status: 'too-large', route: 'async' }`. Nothing currently handles that branch: no job is enqueued, no ZIP is built, no email is sent. This plan closes that gap by adding a Supabase `export_jobs` queue table, an `export-worker` Edge Function, two email templates, UI copy corrections, and a deployment doc stub — without changing any existing inline-export behaviour.

## Problem Frame

The inline export path (S05) is complete and handles typical users. Large-dataset users (>500 MB) hit the too-large guard and receive a misleading generic toast. This plan wires the async path end-to-end so those users receive a 7-day signed download URL via email, with de-duplication and one retry on failure. (See origin §Problem Statement.)

## Requirements Trace

- R1 (AC-1) — UI shows distinct "preparing your export" toast, not the previous generic message.
- R2 (AC-2) — `export-data` enqueues `(user_id, request_id, created_at, status='queued')` in `export_jobs` and returns 202 `{ status: 'queued', eta }`.
- R3 (AC-3) — `export-worker` builds ZIP, uploads to `exports/<user_id>/<request_id>.zip`, creates 7-day signed URL, emails user.
- R4 (AC-4) — Second request while job is `queued` or `processing` returns existing `request_id`; only one email sent.
- R5 (AC-5) — On worker failure: increment `attempt_count`; retry once; on second failure set `status='failed'`, email error notice.
- R6 (AC-6) — Signed URL TTL is 7 days; `retention-tick` (S11) is responsible for purging; this plan documents that dependency.
- R7 (AC-7) — `docs/deployment/retention-cron-setup.md` updated with `exports/` purge details.

## Scope Boundaries

- S11 retention-tick purge implementation is out of scope — only the doc stub is delivered here.
- Consent-gated export content (S08) is out of scope.
- Real-time progress UI (polling, WebSocket) is out of scope.

### Deferred to Separate Tasks

- Retention enforcement cron wiring (S11): separate story; this story produces only the doc hook.
- Consent-toggle integration (S08): separate story.

## Context & Research

### Relevant Code and Patterns

- `supabase/functions/export-data/index.ts` — size probe returns `{ status: 'too-large', route: 'async' }` at line 251. Extend this branch to enqueue job and return 202.
- `supabase/functions/_shared/sendEmail.ts` — shared email helper; never-throws, returns `{ sent: true | false }`. Pattern for all outbound email in Edge Functions.
- `supabase/functions/_shared/emailTemplates.ts` — re-exports from `src/lib/compliance/emailTemplates.ts` (note: _shared symlink or copy pattern — verify at implementation time). New templates go in `src/lib/compliance/emailTemplates.ts` and must be re-exported here.
- `supabase/migrations/20260429000001_pending_deletions.sql` — pattern for compliance tables: `BEGIN/COMMIT`, `IF NOT EXISTS`, RLS deny-all for `authenticated`+`anon`, service-role bypasses.
- `supabase/functions/delete-account/index.ts` — fire-and-forget pattern: inserts row then returns immediately.
- `src/app/components/settings/MyDataSummary.tsx` — already branches on `'status' in result` at line 56; shows generic toast. Change the message copy.
- `src/lib/compliance/exportBundle.ts` — `callExportDataFunction` — the client-side function that calls the Edge Function and returns either a blob or a status object.

### Institutional Learnings

- `reference_dexie_4_quirks.md` — not directly applicable (no Dexie in Edge Functions), but confirms sync patterns.
- `reference_supabase_unraid.md` — self-hosted Supabase; pg_cron availability uncertain. Edge Function + external trigger is the chosen retention path (S11). This plan's fire-and-forget avoids pg_cron entirely.
- `feedback_review_agent_model.md` — use opus for review agents.
- `reference_es2020_constraints.md` — ES2020 targets apply to the frontend; Deno Edge Functions are unrestricted.

### External References

- Supabase Storage `createSignedUrl` docs — TTL is in seconds; 7 days = `7 * 24 * 3600 = 604800`.
- Supabase `FOR UPDATE SKIP LOCKED` pattern — standard advisory-lock-free queue dequeue for Postgres.
- GDPR Art 15/20 — portability right; async delivery with expiring link is compliant as long as access is granted within one month.

## Key Technical Decisions

- **Queue mechanism: Supabase table (`export_jobs`), not Cloudflare Queues.** Self-hosted Supabase already available; no extra infra. Simple enough for solo-operator scale. (See origin §Queue mechanism.)
- **Worker invocation: fire-and-forget `fetch` from `export-data` to `export-worker`.** `export-data` inserts the job, fires the worker URL with no `await`, and immediately returns 202. The worker runs independently. This avoids polling and extra infra.
- **De-duplication: query `export_jobs` for `status IN ('queued','processing')` before insert.** If found, return existing `request_id` with 202 without creating a new row.
- **Retry: `attempt_count` column + worker guard.** Worker increments `attempt_count` before starting. If it finds `attempt_count >= 2`, it sets `status='failed'` and sends error email without retrying.
- **`export-worker` endpoint auth: shared secret header (`X-Worker-Secret`) checked against a Supabase Edge Function env var.** Not a user JWT — this is an internal service-to-service call. No anon key needed.
- **ZIP logic: copy constants and build logic from `export-data/index.ts`** into a shared helper or duplicate within `export-worker`. Given Edge Function isolation, duplication is acceptable; a `_shared/exportZip.ts` module is preferred if it can be imported from both functions without circular deps.
- **`exports/` bucket already exists** (confirmed in `STORAGE_BUCKETS` list in `export-data/index.ts`). No bucket creation needed, but an RLS migration may be needed to allow service-role write and signed URL creation.

## Open Questions

### Resolved During Planning

- **Inline vs. polling invocation?** Inline fire-and-forget chosen (see origin §Open Questions Q1).
- **ETA string?** Return `"within a few minutes"` in the 202 body — no SLA committed.
- **`exports/` bucket existence?** Confirmed present. RLS sufficiency to be verified at implementation time.
- **`_shared/emailTemplates.ts` vs. `src/lib/compliance/emailTemplates.ts`?** The `_shared/` directory holds its own `emailTemplates.ts` (already confirmed). New templates must be added to `_shared/emailTemplates.ts` directly (Edge Functions cannot import from `src/`).

### Deferred to Implementation

- **`_shared/exportZip.ts` viability:** Verify whether the fflate import and ZIP build logic can be extracted without breaking either function's Deno module resolution. If not, duplicate within `export-worker/index.ts`.
- **RLS on `exports/` bucket:** Check current bucket policies at implementation time; add a migration only if service-role signed URL creation requires an explicit grant.
- **`export-worker` invocation URL construction:** Use `SUPABASE_URL` + `/functions/v1/export-worker` or a dedicated `EXPORT_WORKER_URL` env var — decide at implementation time based on whether the self-hosted setup routes internal calls differently.

## Output Structure

```
supabase/
  functions/
    export-worker/
      index.ts
      __tests__/
        export-worker.test.ts
  migrations/
    20260430000001_export_jobs.sql
docs/
  deployment/
    retention-cron-setup.md
src/
  lib/
    compliance/
      emailTemplates.ts   (modified — add exportReadyEmail, exportFailedEmail)
  app/
    components/
      settings/
        MyDataSummary.tsx  (modified — update toast copy)
```

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```
User clicks "Export ZIP"
  → callExportDataFunction (frontend)
      → POST /functions/v1/export-data
          → size probe > 500 MB?
              YES:
                → query export_jobs WHERE user_id AND status IN ('queued','processing')
                    → found? return 202 { status: 'queued', eta, request_id }
                    → not found?
                        → INSERT export_jobs (user_id, request_id=uuid(), status='queued')
                        → fire-and-forget fetch /functions/v1/export-worker (X-Worker-Secret)
                        → return 202 { status: 'queued', eta: 'within a few minutes', request_id }
              NO: stream ZIP inline (existing path — unchanged)

  ← 202 received by frontend
      → MyDataSummary.tsx: toast "We're preparing your export — you'll receive an email with a download link."

export-worker (triggered by fire-and-forget):
  → verify X-Worker-Secret
  → SELECT FROM export_jobs WHERE status='queued' ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED
  → found job:
      → attempt_count >= 2? → set status='failed', send exportFailedEmail, return
      → UPDATE status='processing', attempt_count += 1
      → build ZIP (tables + Storage objects)
      → upload to exports/<user_id>/<request_id>.zip
      → createSignedUrl (7-day TTL)
      → UPDATE export_jobs SET status='done', signed_url=..., completed_at=now()
      → send exportReadyEmail(user_email, signedUrl, expiresAt)
      → return 200
  → no job: return 200 (no-op)
  → on exception:
      → UPDATE export_jobs SET status='queued' (re-queue for retry if attempt_count < 2)
        OR set failed if attempt_count >= 2
```

## Implementation Units

- [ ] **Unit 1: `export_jobs` migration**

**Goal:** Create the `export_jobs` table with correct columns, constraints, indexes, and RLS.

**Requirements:** R2, R4, R5

**Dependencies:** None (standalone migration)

**Files:**
- Create: `supabase/migrations/20260430000001_export_jobs.sql`

**Approach:**
- Columns: `id uuid PK default gen_random_uuid()`, `user_id uuid NOT NULL`, `request_id uuid NOT NULL default gen_random_uuid()`, `status text NOT NULL CHECK (status IN ('queued','processing','done','failed')) default 'queued'`, `attempt_count int NOT NULL default 0`, `created_at timestamptz NOT NULL default now()`, `updated_at timestamptz NOT NULL default now()`, `completed_at timestamptz`, `signed_url text`
- Index on `(user_id, status)` for the de-duplication query
- RLS: users can `SELECT` their own rows (`user_id = auth.uid()`); no user `INSERT`/`UPDATE`/`DELETE` — only service-role. Deny anon.
- Follow `pending_deletions.sql` pattern: `BEGIN/COMMIT`, `IF NOT EXISTS`, `DROP POLICY IF EXISTS`

**Patterns to follow:**
- `supabase/migrations/20260429000001_pending_deletions.sql`

**Test scenarios:**
- Test expectation: none — pure DDL migration, no behavioral logic to unit-test. Verified by schema inspection in Unit 3 integration tests.

**Verification:**
- Migration applies without error; `export_jobs` table exists with all columns and index. RLS denies authenticated insert.

---

- [ ] **Unit 2: Email templates — `exportReadyEmail` and `exportFailedEmail`**

**Goal:** Add two new email template functions to the shared Edge Function email templates module.

**Requirements:** R3, R5

**Dependencies:** None

**Files:**
- Modify: `supabase/functions/_shared/emailTemplates.ts`

**Approach:**
- `exportReadyEmail(downloadUrl: string, expiresAt: string): EmailTemplate` — subject "Your Knowlune data export is ready", body includes the signed URL, expiry date, and note that the link expires in 7 days.
- `exportFailedEmail(): EmailTemplate` — subject "We couldn't build your data export", body instructs user to contact support.
- Follow exact same HTML inline-styles and plain-text pattern as `deletionScheduledEmail` and `deletionCompleteEmail`.
- `EmailTemplate` interface is already defined — no interface change needed.

**Patterns to follow:**
- `supabase/functions/_shared/emailTemplates.ts` — existing `deletionScheduledEmail` and `deletionCompleteEmail` functions.

**Test scenarios:**
- Happy path: `exportReadyEmail('https://example.com/signed', '2026-05-01')` returns object with `subject`, `html`, `text`; `html` contains the URL; `text` contains the URL.
- Happy path: `exportFailedEmail()` returns `subject`, `html`, `text`; `html` contains "contact support".
- Edge case: URL with special characters is not HTML-escaped in a way that breaks the anchor href.

**Verification:**
- Both functions importable from `_shared/emailTemplates.ts`; return shape matches `EmailTemplate` interface.

---

- [ ] **Unit 3: `export-worker` Edge Function**

**Goal:** Implement the async worker that dequeues a job, builds the ZIP, uploads it, generates a signed URL, and emails the user.

**Requirements:** R3, R4, R5

**Dependencies:** Unit 1 (table exists), Unit 2 (email templates)

**Files:**
- Create: `supabase/functions/export-worker/index.ts`
- Create: `supabase/functions/export-worker/__tests__/export-worker.test.ts`

**Approach:**
- Auth: check `X-Worker-Secret` header against `Deno.env.get('EXPORT_WORKER_SECRET')`. Reject with 401 if mismatch.
- Dequeue: `SELECT ... FROM export_jobs WHERE status='queued' ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED` via Supabase RPC or raw SQL through the admin client. If no job found, return 200 `{ status: 'no-op' }`.
- Guard: if `attempt_count >= 2`, set `status='failed'`, send `exportFailedEmail`, return 200.
- Mark processing: `UPDATE export_jobs SET status='processing', attempt_count=attempt_count+1, updated_at=now()`.
- Build ZIP: replicate the table-fetch + Storage-download + fflate ZIP logic from `export-data/index.ts`. If a `_shared/exportZip.ts` extraction is viable, use it; otherwise inline the logic.
- Upload: `supabaseAdmin.storage.from('exports').upload('<user_id>/<request_id>.zip', zipBuffer, { contentType: 'application/zip', upsert: true })`.
- Signed URL: `supabaseAdmin.storage.from('exports').createSignedUrl('<user_id>/<request_id>.zip', 604800)`.
- Fetch user email: `supabaseAdmin.auth.admin.getUserById(user_id)` → `user.email`.
- Email: `sendEmail({ to: email, ...exportReadyEmail(signedUrl, expiresAtIso) })`.
- Update job: `UPDATE export_jobs SET status='done', signed_url=..., completed_at=now(), updated_at=now()`.
- On exception: if `attempt_count < 2` (i.e., this was attempt 1), set `status='queued'` to allow retry. If `attempt_count >= 2`, set `status='failed'` and send failure email. Log error always.

**Patterns to follow:**
- `supabase/functions/export-data/index.ts` — ZIP build, Storage download, auth helper, env validation.
- `supabase/functions/_shared/sendEmail.ts` — never-throws email dispatch.
- `supabase/functions/retention-tick/index.ts` — service-to-service auth pattern, service-role client.

**Test scenarios:**
- Happy path: mock job in `queued` state, `attempt_count=0` → worker processes, uploads ZIP, creates signed URL, sends exportReadyEmail, sets `status='done'`.
- De-duplication (AC-4): no direct test here — tested at the `export-data` level. Worker always processes the job it dequeues.
- Retry (AC-5): mock job with `attempt_count=1` that throws during ZIP build → worker catches, sets `status='queued'` (allowing retry). Separate mock with `attempt_count=2` → worker sets `status='failed'`, sends exportFailedEmail.
- No job: empty queue → worker returns 200 `{ status: 'no-op' }` without error.
- Auth failure: missing or wrong `X-Worker-Secret` → returns 401.
- Storage upload error: upload fails → exception caught, job re-queued (if attempt_count < 2).
- Email send skipped: `EMAIL_API_KEY` absent → worker still completes job (signed URL still available in DB), logs warning.

**Verification:**
- All test scenarios pass; function deploys without Deno type errors; happy path e2e traceable from enqueue to status=done.

---

- [ ] **Unit 4: Extend `export-data` — enqueue + de-duplicate + fire-and-forget**

**Goal:** Replace the current no-op too-large branch in `export-data` with real job enqueue, de-duplication check, and fire-and-forget worker invocation.

**Requirements:** R2, R4

**Dependencies:** Unit 1 (table exists), Unit 3 (worker URL configured)

**Files:**
- Modify: `supabase/functions/export-data/index.ts`

**Approach:**
- After `estimatedBytes > MAX_EXPORT_BYTES` check, query `export_jobs` for `status IN ('queued','processing')` for this `user_id`.
- If found: return 202 `{ status: 'queued', eta: 'within a few minutes', request_id: existing.request_id }`.
- If not found: insert new row using `INSERT INTO export_jobs (...) ON CONFLICT ON CONSTRAINT export_jobs_active_unique DO NOTHING RETURNING *`. If the insert returns no row (conflict), re-query for the existing active job and return its `request_id`. This handles the concurrent-call race (two requests passing the check before either inserts). The constraint is a partial unique index `(user_id) WHERE status IN ('queued','processing')` added in Unit 1. Fire-and-forget `fetch(workerUrl, { method: 'POST', headers: { 'X-Worker-Secret': secret } })`. Do not await. Return 202 `{ status: 'queued', eta: 'within a few minutes', request_id: newRow.request_id }`.
- Worker URL: `${SUPABASE_URL}/functions/v1/export-worker` (or env var `EXPORT_WORKER_URL`).
- `EXPORT_WORKER_SECRET` env var must be set; warn and skip fire-and-forget if absent (prevents dead-lock, job stays in queue for future pickup).
- Status code change: was implicit 200 with `{ status: 'too-large' }`, now explicit 202 with `{ status: 'queued' }`. The frontend `callExportDataFunction` must handle 202 as well as the current 200-with-status check.

**Patterns to follow:**
- Existing dequeue logic in `export-data/index.ts` lines 219–253 (size probe).
- `supabase/functions/delete-account/index.ts` — insert + return immediately pattern.

**Test scenarios:**
- Happy path: size probe over threshold, no existing job → inserts row, fires worker (no await), returns 202 `{ status: 'queued' }`.
- De-duplication: existing `queued` job for user → no insert, returns 202 with existing `request_id`.
- De-duplication: existing `processing` job → same as above.
- No-op when worker secret absent: job inserted, fetch skipped, log warning, 202 returned (job will be retried by next trigger).
- Size under threshold: inline path unchanged — 200 ZIP stream returned.

**Verification:**
- 202 returned on over-threshold path; 200 ZIP on under-threshold; no double-insert for concurrent calls.

---

- [ ] **Unit 5: Frontend — update `MyDataSummary.tsx` toast copy**

**Goal:** Replace the generic "too large" toast with the AC-1 message, and handle the new 202 response shape.

**Requirements:** R1

**Dependencies:** Unit 4 (202 response shape confirmed)

**Files:**
- Modify: `src/app/components/settings/MyDataSummary.tsx`

**Approach:**
- In `handleExport`: `if ('status' in result)` branch currently shows a generic `toastSuccess.exported(...)`. Replace the message with: `"We're preparing your export — you'll receive an email with a download link."`.
- If the response shape changes from `{ status: 'too-large' }` to `{ status: 'queued' }`, update the branch guard to handle both `'too-large'` and `'queued'` status values (or check `result.status !== undefined`).
- No other UI changes needed — no polling, no progress bar.

**Patterns to follow:**
- `src/app/components/settings/MyDataSummary.tsx` — existing `toastSuccess.exported` call pattern.

**Test scenarios:**
- Happy path: mock `callExportDataFunction` returns `{ status: 'queued', eta: '...' }` → component shows "We're preparing your export — you'll receive an email with a download link." toast; `exporting` spinner stops.
- Backward compat: mock returns `{ status: 'too-large', route: 'async' }` (old shape, if still possible) → same toast shown (no crash).
- Inline export unchanged: mock returns `{ zipBlob: Blob }` → download triggered, success toast shown.

**Verification:**
- Component renders correct toast copy for async path; no TypeScript errors; existing inline-export behaviour unchanged.

---

- [ ] **Unit 6: Deployment doc — `docs/deployment/retention-cron-setup.md`**

**Goal:** Create the retention cron setup documentation with a section on `exports/` bucket purge details (AC-7).

**Requirements:** R6, R7

**Dependencies:** None

**Files:**
- Create: `docs/deployment/retention-cron-setup.md`

**Approach:**
- Document the planned `retention-tick` cron trigger approach (Cloudflare cron → Edge Function POST, per plan decision in E119 umbrella plan).
- Include a section "Exports bucket purge" describing: objects in `exports/<user_id>/<request_id>.zip` older than 7 days should be purged; `retention-tick` (S11) is responsible; implementation deferred to S11.
- Include the signed URL TTL (7 days = 604800 seconds) as context for the purge window.
- Note `RETENTION_TICK_SECRET` env var requirement (already documented in `retention-tick/index.ts`).

**Test scenarios:**
- Test expectation: none — documentation file, no executable logic.

**Verification:**
- File exists at `docs/deployment/retention-cron-setup.md`; exports purge section present; no broken internal links.

## System-Wide Impact

- **Interaction graph:** `export-data` → (fire-and-forget) → `export-worker` → Supabase Storage → `sendEmail`. No callbacks or observers triggered in the frontend; the user receives the result via email, not websocket.
- **Error propagation:** Worker errors are caught internally; `export-data` always returns 202 once the job is inserted (worker failure does not surface to the caller). Failed jobs surface to the user via email only.
- **State lifecycle risks:** Concurrent calls to `export-data` for the same user could both pass the de-duplication check before either inserts. Mitigate with a `UNIQUE INDEX ON export_jobs (user_id) WHERE status IN ('queued', 'processing')` partial index, or handle the insert conflict with `ON CONFLICT DO NOTHING` and re-query. Decide at implementation time.
- **API surface parity:** `callExportDataFunction` in `src/lib/compliance/exportBundle.ts` must handle HTTP 202. Verify its current response handling does not assume 200 only.
- **Integration coverage:** The full flow (enqueue → worker picks up → ZIP uploaded → signed URL → email) cannot be proven by unit tests alone. A manual smoke test against a staging Supabase instance with a seeded large user is the appropriate integration gate.
- **Unchanged invariants:** The inline ZIP path (under 500 MB) is fully unchanged. The `exports/` bucket already exists and is listed in `STORAGE_BUCKETS` — no bucket creation or naming change.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Concurrent `export-data` calls bypass de-duplication | Add partial unique index `ON export_jobs(user_id) WHERE status IN ('queued','processing')` or use `INSERT ... ON CONFLICT DO NOTHING` + re-query |
| `export-worker` times out mid-ZIP for very large exports | Edge Function wall-clock limit (~60s on most Supabase configs); if hit, job re-queues on retry. Document as known limitation. |
| `FOR UPDATE SKIP LOCKED` in Supabase JS client | Requires raw SQL via `supabaseAdmin.rpc()` or `.from().select()` with Postgres hint — verify at implementation time; may need a simple RPC function |
| Fire-and-forget fetch fails (network issue) | Job remains `queued`; S11 cron can pick it up, or user can retry from UI. Not catastrophic. |
| `exports/` bucket RLS may block signed URL creation | Verify at implementation; add migration if service-role needs explicit storage grant |
| `_shared/emailTemplates.ts` is not the same file as `src/lib/compliance/emailTemplates.ts` | Confirm import path at implementation time; may need to duplicate templates in `_shared/` |

## Documentation / Operational Notes

- `docs/deployment/retention-cron-setup.md` (created in Unit 6) is the canonical deployment reference for the S11 retention-tick operator; link to it from `docs/compliance/` once that directory is created by a later story.
- New env vars required on the Supabase Edge Function runtime: `EXPORT_WORKER_SECRET` (shared secret for internal worker calls). Add to deployment runbook.

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-23-e119-s06-large-export-async-requirements.md](docs/brainstorms/2026-04-23-e119-s06-large-export-async-requirements.md)
- Umbrella plan: [docs/plans/2026-04-22-003-feat-e119-gdpr-full-compliance-plan.md](docs/plans/2026-04-22-003-feat-e119-gdpr-full-compliance-plan.md)
- Related code: `supabase/functions/export-data/index.ts`, `supabase/functions/_shared/sendEmail.ts`, `supabase/functions/_shared/emailTemplates.ts`, `supabase/migrations/20260429000001_pending_deletions.sql`
- Related stories: E119-S05 (inline export, dependency), E119-S11 (retention tick, downstream consumer)
