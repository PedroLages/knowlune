---
title: "feat: E119-S04 Deletion Verification + Confirmation Email"
type: feat
status: active
date: 2026-04-23
origin: docs/brainstorms/2026-04-23-e119-s04-deletion-verification-requirements.md
---

# feat: E119-S04 Deletion Verification + Confirmation Email

## Overview

Two capabilities are delivered together: (1) email notifications at soft-delete request and at hard-delete completion, using an email address captured before PII scrub; (2) a TypeScript CI probe that queries every erasure-registered table and Storage bucket for a given user ID and fails if any data survives, wired into GitHub Actions to run on PRs that touch the erasure surface.

## Problem Frame

Users receive no email acknowledgement when they request deletion or when their data is permanently erased. There is also no automated guard that catches a newly added table or bucket that was not registered for erasure — a silent GDPR compliance gap. Both gaps must be closed.

## Requirements Trace

- R1. Email sent within 30 s of soft-delete request with cancel link (AC-1)
- R2. Email sent when hard-delete completes with deletion receipt (AC-2)
- R3. Hard-delete receipt uses the email address recorded at request time — before PII scrub (AC-3)
- R4. Email delivery failure must not block deletion; failures are logged (AC-4)
- R5. `scripts/ci/deletion-probe.ts` queries all registered tables + 4 buckets; exits 1 and prints offenders on any row found (AC-5)
- R6. CI runs the probe on PRs whose diff touches `tableRegistry.ts`, `delete-account/`, or `retention-tick/` (AC-6)
- R7. Email templates in `src/lib/compliance/emailTemplates.ts`, plain-text + HTML, pure functions (AC-7)

## Scope Boundaries

- No full E2E test of actual email delivery (staging-only verification)
- No implementing the retention enforcement cron job (S11)
- No new SMTP provider SDK — use `fetch` with env-var-configured provider URL

### Deferred to Separate Tasks

- Retention enforcement cron scheduling: S11
- Breach-register pseudonymisation at hard-delete: S10

## Context & Research

### Relevant Code and Patterns

- `supabase/functions/delete-account/index.ts` — soft-delete flow; stamps `pending_deletion_at` in user metadata; the email call must be added here
- `supabase/functions/retention-tick/index.ts` — iterates expired users and calls `hardDeleteUser()`; the receipt email call must be added here, reading `pending_deletions` table for the address
- `supabase/functions/_shared/hardDeleteUser.ts` — exports `TABLE_NAMES` (38 tables) and `STORAGE_BUCKETS` (4 buckets); the probe script must import these same constants
- `supabase/functions/cancel-account-deletion/index.ts` — the cancel link in the deletion-scheduled email must route to this function
- `src/lib/compliance/` — already contains `noticeAck.ts` and `noticeVersion.ts`; `emailTemplates.ts` follows this pattern
- `supabase/functions/_shared/` — pattern for shared Deno modules; a new `sendEmail.ts` shared helper is the right home for the email dispatch logic
- `.github/workflows/test.yml` — existing CI pipeline (165 lines); the probe job should be appended as a new job with `paths` filter on the PR trigger

### Institutional Learnings

- Email delivery must be non-blocking throughout — use `try/catch` with `console.error`, never `throw`
- Env var validation pattern in existing Edge Functions: guard at module top, fail fast if required vars are absent
- CORS headers follow the pattern in `delete-account/index.ts`; email helpers are internal (no CORS needed)
- `pending_deletions` table approach is the correct design because `auth.users` rows may be wiped before the hard-delete receipt is sent

### External References

- Resend API: `POST https://api.resend.com/emails` with `Authorization: Bearer <key>`, JSON body `{ from, to, subject, html, text }`
- GitHub Actions `paths` filter on `pull_request` events limits job runs to PRs whose diff touches specific paths

## Key Technical Decisions

- **Email provider abstraction via env vars**: `EMAIL_PROVIDER_URL` (default: `https://api.resend.com/emails`), `EMAIL_API_KEY`, `EMAIL_FROM`. If any are absent, skip silently with a `console.warn`. This avoids hard-coding a provider and allows testing without real credentials.
- **`pending_deletions` table for pre-scrub email capture**: `(user_id UUID PK, email TEXT NOT NULL, requested_at TIMESTAMPTZ NOT NULL DEFAULT now())`. Populated in `delete-account` before the soft-delete; read by `retention-tick` for the receipt address; retained 90 days for audit then purged by S11.
- **Shared `sendEmail.ts` Deno module**: Centralises the fetch call and failure logging; imported by both `delete-account` and `retention-tick`. Avoids duplicating error handling.
- **`scripts/ci/deletion-probe.ts` as a tsx/Node script**: Imports `TABLE_NAMES` and `STORAGE_BUCKETS` from `supabase/functions/_shared/hardDeleteUser.ts` via a local re-export shim (since the source uses Deno URL imports). The shim exports the same constants as plain arrays. Probe reads `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from env; accepts `USER_ID` env var.
- **CI probe job with `paths` filter**: A separate job `deletion-probe` in `test.yml` runs only when the PR diff touches `src/lib/sync/tableRegistry.ts`, `supabase/functions/delete-account/**`, or `supabase/functions/retention-tick/**`. The probe requires `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` secrets; if absent the job skips gracefully.
- **Cancel link construction**: The cancel link in the deletion-scheduled email is `${SUPABASE_URL}/functions/v1/cancel-account-deletion` — the same pattern used by the frontend; users must include their JWT to authenticate the cancel.

## Open Questions

### Resolved During Planning

- **Should `pending_deletions` rows be retained after receipt?** Yes — retain 90 days as deletion audit trail. S11 will purge.
- **Should cancel link require auth or use a token?** The cancel link routes to the Edge Function, which already requires a Bearer JWT. For a clickable email link, a one-time signed token would be better UX — but that is out of scope for this story. For now the email instructs the user to open the app and cancel from Settings, and the link is included as a secondary option. This aligns with the S03 function design.
- **Which email provider?** Default to Resend as the simplest API. Provider is fully env-var driven — no code change needed to switch.

### Deferred to Implementation

- Exact migration timestamp prefix (format `YYYYMMDD000001`) to avoid collision with existing migrations
- Whether `pending_deletions` needs an index on `user_id` — implementer decides based on expected query patterns

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```
Soft-delete flow (delete-account/index.ts):
  1. Authenticate user
  2. INSERT INTO pending_deletions (user_id, email, requested_at)   ← NEW
  3. Stamp pending_deletion_at in user metadata
  4. Supabase soft-delete (admin.deleteUser, shouldSoftDelete=true)
  5. sendEmail(to=email, template=deletionScheduled, cancelUrl)      ← NEW (non-blocking)
  6. Return { success, scheduledDeletionAt }

Hard-delete flow (retention-tick/index.ts, per-user loop):
  1. SELECT email FROM pending_deletions WHERE user_id = $1           ← NEW
  2. hardDeleteUser(userId, supabaseAdmin, stripe)
  3. sendEmail(to=capturedEmail, template=deletionComplete)          ← NEW (non-blocking)
  4. DELETE FROM pending_deletions WHERE user_id = $1                ← NEW

CI probe (scripts/ci/deletion-probe.ts):
  USER_ID=<test-uuid>
  For each table in TABLE_NAMES: SELECT count(*) WHERE user_id = USER_ID
  For each bucket in STORAGE_BUCKETS: LIST objects under USER_ID/
  If any count > 0 or any objects found: print offenders, exit 1
  Else: exit 0
```

## Implementation Units

- [ ] **Unit 1: `pending_deletions` migration and types**

**Goal:** Create the `pending_deletions` Supabase table that captures user email at deletion request time, before PII scrub.

**Requirements:** R3

**Dependencies:** None (schema change only)

**Files:**
- Create: `supabase/migrations/<timestamp>_pending_deletions.sql`

**Approach:**
- Table columns: `user_id UUID PRIMARY KEY`, `email TEXT NOT NULL`, `requested_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- RLS: service-role only (no user-facing reads). Policy: `USING (false)` for non-service roles.
- No FK to `auth.users` — the user row may be deleted before the pending_deletions row is cleaned up.
- Migration file must follow the existing timestamp naming convention.

**Patterns to follow:**
- `supabase/migrations/20260426000001_notification_preferences.sql` — structure and RLS pattern

**Test scenarios:**
- Test expectation: none — pure schema migration; covered by integration behavior in Unit 2 and 3 tests.

**Verification:**
- Migration applies cleanly without error
- Table exists with correct columns and service-role-only RLS

---

- [ ] **Unit 2: `sendEmail` shared Deno module**

**Goal:** Centralise email dispatch logic in a shared Deno module imported by both `delete-account` and `retention-tick`.

**Requirements:** R1, R2, R4

**Dependencies:** None

**Files:**
- Create: `supabase/functions/_shared/sendEmail.ts`
- Create: `supabase/functions/_shared/__tests__/sendEmail.test.ts` (Deno test)

**Approach:**
- Reads `EMAIL_PROVIDER_URL`, `EMAIL_API_KEY`, `EMAIL_FROM` from `Deno.env`
- If any env var is absent: `console.warn` and return `{ sent: false, skipped: true }`
- Makes a `fetch` POST to the provider URL with JSON body `{ from, to, subject, html, text }`
- On HTTP error or network failure: `console.error` and return `{ sent: false, error: string }`
- On success: return `{ sent: true }`
- Never throws — all errors are caught and returned as result

**Patterns to follow:**
- Env var guard pattern in `supabase/functions/delete-account/index.ts`
- Non-blocking error handling: `try/catch` with `console.error`

**Test scenarios:**
- Happy path: all env vars present, fetch returns 200 → returns `{ sent: true }`
- Skipped path: `EMAIL_API_KEY` absent → returns `{ sent: false, skipped: true }`, no fetch call made
- Error path: fetch throws network error → returns `{ sent: false, error: <message> }`, does not rethrow
- Error path: provider returns 4xx → returns `{ sent: false, error: <status text> }`, does not rethrow

**Verification:**
- Module is importable from other Edge Functions
- All error paths return results without throwing

---

- [ ] **Unit 3: Email templates**

**Goal:** Define plain-text and HTML email templates for both notification types as pure functions.

**Requirements:** R7

**Dependencies:** None

**Files:**
- Create: `src/lib/compliance/emailTemplates.ts`
- Create: `src/lib/compliance/__tests__/emailTemplates.test.ts`

**Approach:**
- Export two functions: `deletionScheduledEmail(cancelUrl: string): { subject, html, text }` and `deletionCompleteEmail(): { subject, html, text }`
- HTML uses inline styles only (email client compatibility) — no Tailwind
- Cancel URL is injected as a parameter; no env var access inside templates (pure functions)
- Plain text must be a readable fallback with no HTML tags
- Subject lines: "Your Knowlune account is scheduled for deletion" and "Your Knowlune data has been deleted"

**Patterns to follow:**
- `src/lib/compliance/noticeAck.ts` — pure function export style

**Test scenarios:**
- Happy path: `deletionScheduledEmail('https://example.com/cancel')` → subject contains "scheduled", html contains the cancel URL, text contains the cancel URL
- Happy path: `deletionCompleteEmail()` → subject contains "deleted", html is non-empty, text is non-empty
- Edge case: cancel URL with special characters → URL appears unescaped in output (no double-encoding)

**Verification:**
- Functions are importable and return correct shape
- Cancel URL appears in both html and text output

---

- [ ] **Unit 4: Wire email into `delete-account` Edge Function**

**Goal:** Populate `pending_deletions` at soft-delete time and send the deletion-scheduled email.

**Requirements:** R1, R3, R4

**Dependencies:** Unit 1 (migration), Unit 2 (sendEmail), Unit 3 (templates)

**Files:**
- Modify: `supabase/functions/delete-account/index.ts`

**Approach:**
- After authenticating the user, fetch `user.email` from the auth response (already available from `userClient.auth.getUser()`)
- INSERT INTO `pending_deletions (user_id, email)` using `supabaseAdmin` before stamping `pending_deletion_at`
- If the INSERT fails: log with `console.error` but do NOT abort the deletion — the email will be skipped and logged
- After the soft-delete succeeds, call `sendEmail` with `deletionScheduledEmail(cancelUrl)` — non-blocking (do not `await` in the error path; use `void sendEmail(...)` or `sendEmail(...).catch(...)`)
- `cancelUrl` = the frontend settings page URL or the cancel Edge Function URL (construct from `APP_URL` env var)

**Patterns to follow:**
- Existing error-and-continue pattern in `delete-account/index.ts` (`metaError` handling)
- Env var access: `Deno.env.get('APP_URL')`

**Test scenarios:**
- Integration: soft-delete succeeds → `pending_deletions` row inserted with correct email
- Integration: `sendEmail` would be called with deletion-scheduled template and cancel URL after soft-delete
- Error path: INSERT to `pending_deletions` fails → deletion still completes, error logged
- Error path: `sendEmail` throws → deletion still completes, error logged

**Verification:**
- After invoking the function locally, a row exists in `pending_deletions` for the test user
- Response is `{ success: true, scheduledDeletionAt }` regardless of email send result

---

- [ ] **Unit 5: Wire email into `retention-tick` Edge Function**

**Goal:** Read the pre-scrub email from `pending_deletions` and send the deletion receipt after hard-delete completes.

**Requirements:** R2, R3, R4

**Dependencies:** Unit 1 (migration), Unit 2 (sendEmail), Unit 3 (templates)

**Files:**
- Modify: `supabase/functions/retention-tick/index.ts`

**Approach:**
- In the per-user hard-delete loop, before calling `hardDeleteUser()`, query `SELECT email FROM pending_deletions WHERE user_id = $1`
- After `hardDeleteUser()` completes (regardless of partial errors), call `sendEmail` with `deletionCompleteEmail()` using the captured address — non-blocking
- After sending, DELETE the `pending_deletions` row (cleanup)
- If the `pending_deletions` SELECT returns no row (e.g., row was never inserted), log a warning and skip the receipt email — do not abort the hard-delete

**Patterns to follow:**
- Per-user error-and-continue pattern already in `retention-tick/index.ts`

**Test scenarios:**
- Integration: pending_deletions row exists → email sent with captured address, row deleted after
- Edge case: no pending_deletions row → hard-delete still completes, warning logged, no email sent
- Error path: `sendEmail` throws → hard-delete still completes, error logged
- Error path: DELETE of pending_deletions row fails → logged, does not abort

**Verification:**
- After a full retention-tick run, `pending_deletions` has no rows for processed users
- Logs show email send attempt for each processed user

---

- [ ] **Unit 6: CI deletion probe script**

**Goal:** Create a Node.js/tsx script that queries all registered tables and Storage buckets for a given user ID and exits non-zero if any data survives.

**Requirements:** R5

**Dependencies:** None (standalone script)

**Files:**
- Create: `scripts/ci/deletion-probe.ts`
- Create: `scripts/ci/probe-constants.ts` (re-export shim for TABLE_NAMES and STORAGE_BUCKETS as plain arrays, avoiding Deno URL imports)

**Approach:**
- `probe-constants.ts` exports `TABLE_NAMES` and `STORAGE_BUCKETS` as plain TypeScript arrays matching the values in `hardDeleteUser.ts` — this avoids transpiling Deno URL imports in a Node context
- `deletion-probe.ts` reads `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `USER_ID` from `process.env`; if any absent, print usage and exit 2
- Uses `@supabase/supabase-js` (already in `package.json`) to create a service-role client
- For each table: `SELECT count(*) FROM <table> WHERE user_id = $USER_ID`; collect any with count > 0
- For each bucket: list objects under `USER_ID/` prefix; collect any with objects found
- If any offenders: print table/bucket names, exit 1
- If all clean: print "All tables and buckets clean for user <id>", exit 0
- Script is run with `npx tsx scripts/ci/deletion-probe.ts`

**Patterns to follow:**
- `scripts/` pattern: plain TypeScript, no build step needed (tsx)

**Test scenarios:**
- Test expectation: none — the probe is a CI integration script, not a unit-testable module. Its correctness is validated by the CI job in Unit 7 and by manual invocation against a test user.

**Verification:**
- `USER_ID=<uuid> SUPABASE_URL=<url> SUPABASE_SERVICE_ROLE_KEY=<key> npx tsx scripts/ci/deletion-probe.ts` exits 0 for a clean user and exits 1 for a user with remaining data
- Script prints the name of each offending table/bucket

---

- [ ] **Unit 7: Wire CI probe into GitHub Actions**

**Goal:** Add a `deletion-probe` job to `test.yml` that runs the probe on PRs touching the erasure surface.

**Requirements:** R6

**Dependencies:** Unit 6 (probe script exists)

**Files:**
- Modify: `.github/workflows/test.yml`

**Approach:**
- Add a new job `deletion-probe` after the existing `e2e-tests` job
- Job condition: `if: github.event_name == 'pull_request'`
- Add `paths` filter to the job's `on: pull_request` by using a dedicated step: `dorny/paths-filter` action to detect if any changed file matches `src/lib/sync/tableRegistry.ts`, `supabase/functions/delete-account/**`, or `supabase/functions/retention-tick/**`
- If paths match: run `npx tsx scripts/ci/deletion-probe.ts`
- Env vars from secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `USER_ID` (a permanent test user UUID pre-seeded with zero application data)
- If secrets are absent (forks, non-privileged PRs): skip with `continue-on-error: true` and print a message — do not block the PR
- Add `deletion-probe` to the `test-report` job's `needs` list

**Patterns to follow:**
- Existing `test.yml` job structure — checkout, Node setup, npm ci, then run script
- `dorny/paths-filter@v3` for path-scoped job triggering

**Test scenarios:**
- Test expectation: none — workflow correctness is validated by the CI run itself.

**Verification:**
- A PR touching `tableRegistry.ts` triggers the probe job
- A PR not touching those paths skips the job
- Job passes when the probe script exits 0

---

## System-Wide Impact

- **Interaction graph**: `delete-account` now writes to `pending_deletions` before the soft-delete. `retention-tick` reads from `pending_deletions` before `hardDeleteUser()`. Both call the shared `sendEmail` helper. No other functions are affected.
- **Error propagation**: Email delivery failure is caught in `sendEmail` and returned as `{ sent: false, error }`. Callers log the error and continue. The deletion operation is never blocked.
- **State lifecycle risks**: If `pending_deletions` INSERT fails in `delete-account`, the row is missing and the hard-delete receipt email will not be sent (warning logged). This is acceptable — the deletion still completes.
- **API surface parity**: No frontend API changes. The cancel link in the email routes to the existing `cancel-account-deletion` Edge Function.
- **Integration coverage**: The key cross-layer scenario is: soft-delete → `pending_deletions` row present → retention-tick reads row → hard-delete → receipt email → row deleted. This chain cannot be proven by unit tests alone; the CI probe partially validates the erasure side.
- **Unchanged invariants**: `hardDeleteUser()` signature and behavior are unchanged. `cancel-account-deletion` is unchanged. `tableRegistry.ts` and `ERASURE_TABLE_NAMES` are unchanged by this story.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `pending_deletions` INSERT fails silently → no receipt email | Log at `console.error` level; the deletion completes. Acceptable per AC-4. |
| Email provider credentials absent in CI → probe job fails | `continue-on-error: true` on the email send step; probe job itself is not blocked by email. Secrets absence skips gracefully. |
| `probe-constants.ts` diverges from `hardDeleteUser.ts` TABLE_NAMES | Add a comment in both files noting they must be kept in sync. S03's existing `tableRegistry.test.ts` parity assertion covers the authoritative registry. |
| CI `USER_ID` test user has existing data | The probe exits 1 — alerting the team that the test user was not clean. The CI job description should document how to create/reset the test user. |
| Cancel link in email is not clickable (requires auth) | Documented limitation for this story. Full one-time-token cancel link is deferred. Email instructs user to open app Settings. |

## Documentation / Operational Notes

- The `USER_ID` secret in GitHub Actions must be a Supabase UUID of a test user with zero application data in all 38 tables and 4 buckets. Document this setup in the CI job comments.
- `EMAIL_PROVIDER_URL`, `EMAIL_API_KEY`, and `EMAIL_FROM` must be set in Supabase Edge Function environment variables in production. If absent, deletion emails are silently skipped — no user impact on the deletion flow itself.
- `pending_deletions` rows are retained for 90 days as an audit trail. S11 will add the purge step.

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-23-e119-s04-deletion-verification-requirements.md](docs/brainstorms/2026-04-23-e119-s04-deletion-verification-requirements.md)
- Related code: `supabase/functions/_shared/hardDeleteUser.ts`, `supabase/functions/delete-account/index.ts`, `supabase/functions/retention-tick/index.ts`
- Related plan: `docs/plans/2026-04-23-004-feat-e119-s03-erasure-cascade-plan.md`
- Story: `docs/implementation-artifacts/stories/E119-S04.md`
