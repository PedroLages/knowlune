---
title: "feat: E119-S13 Annual Review Checklist + ICO SME Checklist + Beta User Re-ack"
type: feat
status: active
date: 2026-04-23
origin: docs/brainstorms/2026-04-23-e119-s13-annual-review-ico-requirements.md
---

# feat: E119-S13 Annual Review Checklist + ICO SME Checklist + Beta User Re-ack

## Overview

This is the final story in E119 (GDPR Full Compliance). It closes the epic with three interlocking
deliverables that transform twelve stories of compliance infrastructure into a verified, documented,
and user-acknowledged compliance posture:

1. **Compliance documentation suite** — `annual-review.md`, `ico-sme-checklist-2026.md`, and
   `docs/compliance/README.md` that cross-links all eleven compliance documents.
2. **Notice version bump** — `CURRENT_NOTICE_VERSION` bumped to `2026-05-01.1`, triggering
   `LegalUpdateBanner` re-ack flow for all existing beta users via the S02 infrastructure.
3. **Ack-rate reporting + E2E coverage** — a weekly ack-rate report script, a beta re-ack E2E spec,
   and the crown-jewel lifecycle E2E spec that ties every E119 story into one regression harness.

No new runtime infrastructure is introduced. This story produces documentation, a one-line constant
bump, a read-only CLI script, and two E2E specs.

## Problem Frame

E119 built GDPR compliance infrastructure across 12 stories. Without annual review, ICO evidence,
and a user re-acknowledgement flow, the infrastructure satisfies technical requirements but lacks:
- A repeatable process for Pedro to verify the compliance machinery still works each year
- Documented ICO SME self-assessment evidence (regulatory due diligence)
- A mechanism to inform existing beta users of their new rights and obtain fresh consent records
- An end-to-end regression harness that would catch regressions across the entire compliance stack

## Requirements Trace

- R1. `docs/compliance/annual-review.md` — annual review checklist (AC-1)
- R2. `docs/compliance/ico-sme-checklist-2026.md` — ICO SME checklist with pass/fail/NA (AC-2)
- R3. `docs/compliance/README.md` — cross-links all 11 compliance docs (AC-3)
- R4. `CURRENT_NOTICE_VERSION` bumped to `2026-05-01.1`; LegalUpdateBanner fires for existing users (AC-4)
- R5. `scripts/compliance/ack-rate-report.ts` — weekly ack-rate reporting script (AC-5)
- R6. `tests/e2e/compliance/beta-reack.spec.ts` — beta re-ack E2E (AC-6, AC-7)
- R7. `tests/e2e/compliance/lifecycle.spec.ts` — end-to-end lifecycle E2E (AC-9)
- R8. Soft-block after 30 days — documented in `annual-review.md` (AC-8, built in S02)

## Scope Boundaries

- Executing the first annual review is out of scope (scheduled 2027-Q2)
- Multi-locale notice translation is deferred
- Sending actual emails to unacked users is out of scope (ack-rate report identifies them; campaign is separate)
- Real Supabase connection in E2E tests — all mocked via `page.route()`
- ICO submission automation — manual process; this story produces documentation evidence

## Context & Research

### Relevant Code and Patterns

- `src/lib/compliance/noticeVersion.ts` — `CURRENT_NOTICE_VERSION = '2026-04-23.1'`; bump to `2026-05-01.1`
- `src/app/pages/legal/LegalUpdateBanner.tsx` — `mode="reack"` path calls `writeNoticeAck(CURRENT_NOTICE_VERSION)`; `onAcknowledged()` triggers re-fetch; dismiss (X) does NOT write ack
- `src/app/components/SoftBlockGate.tsx` — shown after 30-day stale ack; already built in S02
- `src/app/components/Layout.tsx` — mounts `LegalUpdateBanner` controlled by `useNoticeAcknowledgement`
- `src/lib/compliance/noticeAck.ts` — `writeNoticeAck(version)` inserts into `notice_acknowledgements`
- `scripts/compliance/verify-subprocessors.ts` — exact pattern to follow for the ack-rate-report script (ESM, `tsx`, `repoRoot` resolution, exit codes)
- `tests/e2e/compliance/data-export.spec.ts` — two-phase auth injection pattern (`addInitScript` + `evaluate` after nav) to use for beta-reack and lifecycle specs
- `tests/e2e/compliance/notice-acknowledgement.spec.ts` — `page.route()` mocking patterns for Supabase endpoints, clock usage
- `tests/e2e/compliance/consent-withdrawal.spec.ts` — IndexedDB interaction pattern, `injectAuthSession` helper
- `tests/support/fixtures.ts` — base fixture; all E2E specs import from here
- `tests/utils/test-time.ts` — `FIXED_DATE`, `FIXED_TIMESTAMP` for deterministic clocks

### Existing `docs/compliance/` Documents (8 of 11 exist)

- `privacy-notice.md` — ✓ exists (S01)
- `consent-inventory.md` — ✓ exists (S07)
- `ropa.md` — ✓ exists (S12)
- `dpa-supabase.md` — ✓ exists (S12)
- `subprocessors.md` — ✓ exists (S12)
- `retention.md` — ✓ exists (S10)
- `breach-runbook.md` — ✓ exists (S12)
- `breach-register.md` — ✓ exists (S12)
- `annual-review.md` — ✗ this story (R1)
- `ico-sme-checklist-2026.md` — ✗ this story (R2)
- `README.md` — ✗ this story (R3)

### Script Pattern to Follow

`scripts/compliance/verify-subprocessors.ts` provides the exact ESM + `tsx` pattern:
- `fileURLToPath(import.meta.url)` for `__filename` equivalent
- `resolve(__filename, '../../..')` for `repoRoot`
- Structured `console.log` report + exit codes (0 = pass, 1 = failure)
- Reads from `src/lib/compliance/` via dynamic import
- Supabase admin calls require `SUPABASE_SERVICE_KEY` env var

### Unit Test Impact of Version Bump

Tests that mock `noticeVersion` module (e.g., `LegalUpdateBanner.reack.test.tsx`) hardcode
`CURRENT_NOTICE_VERSION: '2026-04-23.1'`. These mocks are inline `vi.mock()` calls and do not
import the real constant — they will not break when the constant is bumped. No unit test changes
needed for the version bump itself.

## Key Technical Decisions

- **Version bump date `2026-05-01.1`**: Use the date specified in AC-4. This represents the beta
  launch date, which is in the future as of 2026-04-23. The format is valid per `parseNoticeVersion()`.
- **Ack-rate script is read-only**: Script uses Supabase service-role key (env var) to read
  `notice_acknowledgements` and auth user list. No writes. Exit 0 always; warn to console when < 95%.
- **ICO SME checklist self-assessed**: All items are recorded based on actual E119 implementation
  evidence (story references, doc links, code paths). Blockers documented as accepted risk or
  resolved. No external submission.
- **Lifecycle E2E scope**: "Verify zero rows" means verifying the deletion was triggered (edge
  function call intercepted), not querying a real DB. Auth user deletion is async — we mock and
  assert the trigger event.
- **Dismiss != ack in banner**: The existing `LegalUpdateBanner` `mode="reack"` already handles
  this — dismiss (X) only writes to `localStorage`, not `notice_acknowledgements`. The test must
  verify no Supabase insert call is made on dismiss.

## Open Questions

### Resolved During Planning

- **Which tables to "verify zero rows" for in lifecycle test?** Verify deletion trigger was called
  (intercept the Edge Function call). Assertion: `hardDeleteUser` Edge Function was invoked with
  the correct user ID. Not querying a real DB.
- **Should ack-rate script exit non-zero when < 95%?** No — exit 0 always. Print warning to
  stdout when `ackPct < 95`. CI friendliness matters; this is a reporting tool.
- **ICO SME checklist version?** Reference canonical ICO URL + note "accessed 2026-04-23". Do not
  freeze to a specific PDF version.

### Deferred to Implementation

- **Exact Supabase admin API path for auth users** — implementer to verify
  `/auth/v1/admin/users` pagination shape at runtime.
- **Whether `SoftBlockGate` appears in lifecycle spec** — depends on test clock advance
  implementation; use `page.clock` to simulate 31-day advance.

## Output Structure

    docs/compliance/
    ├── README.md                          # new (R3)
    ├── annual-review.md                   # new (R1)
    ├── ico-sme-checklist-2026.md          # new (R2)
    └── [8 existing docs unchanged]
    
    scripts/compliance/
    └── ack-rate-report.ts                 # new (R5)
    
    src/lib/compliance/
    └── noticeVersion.ts                   # modify: bump CURRENT_NOTICE_VERSION (R4)
    
    tests/e2e/compliance/
    ├── beta-reack.spec.ts                 # new (R6, R7)
    └── lifecycle.spec.ts                  # new (R9)

## Implementation Units

- [ ] **Unit 1: Compliance Documentation Suite**

**Goal:** Create `annual-review.md`, `ico-sme-checklist-2026.md`, and `docs/compliance/README.md`.

**Requirements:** R1, R2, R3

**Dependencies:** None (pure documentation; references existing docs)

**Files:**
- Create: `docs/compliance/annual-review.md`
- Create: `docs/compliance/ico-sme-checklist-2026.md`
- Create: `docs/compliance/README.md`

**Approach:**

`annual-review.md` must contain:
- A dated checklist for each of these annual tasks:
  1. Re-read `privacy-notice.md` and compare against actual features
  2. Verify the retention job (`scripts/jobs/retention-tick.ts`) ran every day — check audit log
  3. Verify `subprocessors.md` is current against `subprocessorRegistry.ts`
  4. Refresh DPA addenda for each sub-processor (check renewal dates)
  5. Count `user_consents` rows vs. auth user count — flag discrepancies
  6. Review `breach-register.md` for any open items; close or escalate
  7. Run `scripts/compliance/ack-rate-report.ts`; document result
  8. Confirm current `CURRENT_NOTICE_VERSION` is current; bump if notice changed materially
- Follow-up process: unacked users after 30 days → `SoftBlockGate` enforces soft-block; document
  the email follow-up process for users who haven't acknowledged after 30 days.
- Next review date (2027-Q2)

`ico-sme-checklist-2026.md` must contain ICO SME self-assessment across these categories:
- **Data Protection Principles** (accuracy, minimisation, purpose limitation) — assess against ROPA
- **Lawful Basis** — each processing purpose in `consent-inventory.md`
- **Rights of Individuals** (access, erasure, portability, objection) — link to export/delete flows
- **Data Transfers** — `dpa-supabase.md`, sub-processor register
- **Security** — Supabase RLS, encryption at rest, soft-block gate
- **Records of Processing** — ROPA completeness
- **Breach Notification** — `breach-runbook.md`, ICO 72-hour window

Format: Markdown table per category — `| Item | Status | Evidence | Notes |`
Status values: `PASS`, `N/A`, `ACCEPTED RISK (rationale)`

`README.md` must list all 11 docs with one-sentence summary each and link.

**Test scenarios:**
Test expectation: none — pure documentation artifacts with no runtime behavior.

**Verification:**
- All three files exist in `docs/compliance/`
- `README.md` links to all 11 docs
- `ico-sme-checklist-2026.md` has no `FAIL` items (all resolved or N/A)
- `annual-review.md` references `scripts/compliance/ack-rate-report.ts`

---

- [ ] **Unit 2: Notice Version Bump**

**Goal:** Bump `CURRENT_NOTICE_VERSION` from `2026-04-23.1` to `2026-05-01.1` to trigger
`LegalUpdateBanner` re-ack flow for existing users.

**Requirements:** R4

**Dependencies:** Unit 1 (documentation should exist before the bump is committed, so operators
can link to the updated notice from the banner)

**Files:**
- Modify: `src/lib/compliance/noticeVersion.ts`

**Approach:**
- One-line change: `CURRENT_NOTICE_VERSION = '2026-05-01.1' as const`
- Update the file-level JSDoc comment to reference the new version date
- No other code changes needed — S02 infrastructure handles the rest

**Patterns to follow:**
- `src/lib/compliance/noticeVersion.ts` — existing file structure

**Test scenarios:**
- Happy path: `parseNoticeVersion('2026-05-01.1')` returns `{ isoDate: '2026-05-01', revision: 1 }`
- Edge case: verify `formatNoticeEffectiveDate('2026-05-01.1')` returns `'Effective 2026-05-01 (rev 1)'`
  (existing unit tests in `noticeVersion.test.ts` should still pass after the bump)

**Verification:**
- `CURRENT_NOTICE_VERSION === '2026-05-01.1'`
- `npm run test:unit` passes (existing noticeVersion unit tests)
- Running the app shows `LegalUpdateBanner` in `mode="reack"` for a user whose last ack was `2026-04-23.1`

---

- [ ] **Unit 3: Ack-Rate Report Script**

**Goal:** Create `scripts/compliance/ack-rate-report.ts` — a read-only CLI script that reports
ack% across all users for the current notice version.

**Requirements:** R5

**Dependencies:** Unit 2 (reads `CURRENT_NOTICE_VERSION`; must reflect the bumped version)

**Files:**
- Create: `scripts/compliance/ack-rate-report.ts`

**Approach:**

Script structure (follow `verify-subprocessors.ts` exactly for ESM/tsx patterns):
1. Read `CURRENT_NOTICE_VERSION` from `src/lib/compliance/noticeVersion.ts` via dynamic import
2. Read Supabase connection from env: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` (service-role key
   required for admin user list)
3. Fetch all rows from `notice_acknowledgements` where `version = CURRENT_NOTICE_VERSION`
4. Fetch total user count from Supabase admin API (`/auth/v1/admin/users` with pagination)
5. Compute: `ackedCount`, `totalUsers`, `ackPct`, list of `unackedUserIds`
6. Print structured report to stdout
7. Exit 0 always; print warning line when `ackPct < 95`

Output format:
```
[ack-rate-report] Notice acknowledgement rate
Version:       2026-05-01.1
Total users:   <N>
Acknowledged:  <N> (<ack%>%)
Unacknowledged: <N>

[WARN] Ack rate below 95% target. Review unacked user list.

Unacknowledged user IDs:
  - <user-id-1>
  - <user-id-2>
```

**Patterns to follow:**
- `scripts/compliance/verify-subprocessors.ts` — `fileURLToPath`, `repoRoot`, `FAIL`/`PASS` pattern, exit codes
- Dynamic import for TS source files
- `SUPABASE_SERVICE_KEY` env pattern (consistent with other admin scripts)

**Test scenarios:**
Test expectation: none — CLI script; verified by manual invocation and code review. Unit test
would require mocking Supabase admin API; deferred as documented in `annual-review.md` (verify
weekly during beta window by running manually).

**Verification:**
- `npx tsx scripts/compliance/ack-rate-report.ts` runs without error (with valid env vars)
- Without env vars, script exits with a clear error message (not a stack trace)
- Output format matches the spec above

---

- [ ] **Unit 4: Beta Re-ack E2E Test**

**Goal:** `tests/e2e/compliance/beta-reack.spec.ts` covering AC-6 (ack flow works) and AC-7
(dismiss without ack leaves user unacked).

**Requirements:** R6

**Dependencies:** Unit 2 (version bump must exist so the test can import `CURRENT_NOTICE_VERSION`)

**Files:**
- Create: `tests/e2e/compliance/beta-reack.spec.ts`

**Approach:**

Auth injection: use the two-phase pattern from `data-export.spec.ts` — `addInitScript` to seed
localStorage, then `evaluate` after navigation to call `window.__authStore.setSession()`.

Supabase route mocks needed:
- `**/auth/v1/user` → return mock user
- `**/rest/v1/notice_acknowledgements?select=*` → GET: return row with old version `2026-04-23.1`
  (triggers re-ack banner); in Scenario 2, same GET but no POST expected
- `**/rest/v1/notice_acknowledgements` → POST: capture and assert body in Scenario 1

Scenario 1 — Re-ack happy path:
1. Inject auth (user with old ack version)
2. Mock GET `notice_acknowledgements` to return `[{ version: '2026-04-23.1', ... }]`
3. Navigate to `/` (Layout mounts `LegalUpdateBanner` in `mode="reack"`)
4. Assert banner is visible: `page.getByRole('alert')` with "Privacy Notice has been updated" text
5. Set up route intercept for POST to `notice_acknowledgements`
6. Click "View Privacy Notice" link — verify it navigates to `/legal/privacy`
7. Navigate back, click "Acknowledge" button
8. Assert POST was made with `{ version: '2026-05-01.1', ... }`
9. Assert banner disappears after successful ack
10. Assert mock GET re-called (refetch triggered) and returns new version — banner stays hidden

Scenario 2 — Dismiss without ack (AC-7):
1. Same auth + mock GET setup (old version)
2. Navigate to `/`, assert banner visible
3. Assert NO POST route is set (or intercept and assert it is never called)
4. Click X (dismiss button) on banner
5. Assert banner disappears
6. Assert no POST to `notice_acknowledgements` was made
7. Reload page (simulate new session) — assert banner reappears (localStorage dismiss ≠ ack)

**Patterns to follow:**
- `tests/e2e/compliance/data-export.spec.ts` — two-phase auth, `page.route()` interceptors
- `tests/e2e/compliance/notice-acknowledgement.spec.ts` — banner assertion patterns, clock usage
- `tests/support/fixtures.ts` — import base test fixture
- `tests/utils/test-time.ts` — `FIXED_TIMESTAMP` for `expires_at`

**Test scenarios:**
- Happy path: beta user with stale ack → banner visible → clicks Acknowledge → POST made with new version → banner gone
- Happy path: banner shows "View Privacy Notice" link pointing to `/legal/privacy`
- Edge case: dismiss (X) → banner gone → no POST → reload → banner reappears
- Error path: POST to `notice_acknowledgements` returns error → banner stays visible → toast.error shown
- Integration: `onAcknowledged()` callback triggers re-fetch (GET called twice: initial + post-ack)

**Verification:**
- `npx playwright test tests/e2e/compliance/beta-reack.spec.ts --project=chromium` passes
- Both scenarios pass deterministically across 3 runs

---

- [ ] **Unit 5: End-to-End Lifecycle E2E Test**

**Goal:** `tests/e2e/compliance/lifecycle.spec.ts` — the crown-jewel regression harness covering
the full compliance lifecycle from signup through account deletion.

**Requirements:** R7

**Dependencies:** Unit 4 (similar auth and mock patterns; can reference)

**Files:**
- Create: `tests/e2e/compliance/lifecycle.spec.ts`

**Approach:**

This is one long-running test covering the full user lifecycle in a single browser context.
Use `test.step()` to label each phase — this improves failure isolation in Playwright reports.

Mock infrastructure needed (all `page.route()`):
- `**/auth/v1/token?grant_type=password` → return mock session (signup)
- `**/auth/v1/user` → return mock user
- `**/rest/v1/notice_acknowledgements*` → GET + POST
- `**/rest/v1/user_consents*` → GET + POST (grant ai_tutor consent)
- `**/functions/v1/export-data` → return minimal ZIP (see `data-export.spec.ts` for zip builder)
- `**/rest/v1/user_consents*` → DELETE (consent withdrawal)
- `**/functions/v1/hard-delete-user` → capture call, return 200 (account deletion)

Test steps:

**Step 1 — Signup + Notice Ack:**
1. Navigate to `/auth/login`, click "Create account"
2. Fill email + password, check privacy checkbox
3. Mock POST to `auth/v1/token`, POST to `notice_acknowledgements`
4. Submit → assert user is signed in and at dashboard
5. Assert `notice_acknowledgements` POST was called with `CURRENT_NOTICE_VERSION`

**Step 2 — Use AI Feature (consent gate):**
1. Grant `ai_tutor` consent via mock POST to `user_consents`
2. Navigate to a page with AI feature
3. Assert AI feature is accessible (not blocked)

**Step 3 — Export Data:**
1. Navigate to Settings → Privacy
2. Mock `functions/v1/export-data` to return ZIP
3. Click "Export my data"
4. Assert download was triggered (Playwright `download` event)
5. Assert success toast shown

**Step 4 — Withdraw AI Consent:**
1. Navigate to Settings → Privacy → Consent toggles
2. Mock DELETE to `user_consents` for `ai_tutor`
3. Toggle off `ai_tutor` consent → confirm dialog → confirm withdrawal
4. Assert consent row deleted
5. Assert AI feature now shows consent-required state

**Step 5 — Delete Account + Verify Trigger:**
1. Navigate to Settings → Account
2. Mock `functions/v1/hard-delete-user` to return 200; capture the request
3. Trigger account deletion flow
4. Assert `hard-delete-user` Edge Function was called with correct user ID
5. Assert user is signed out and redirected to auth page

**Clock usage:** Use `page.clock.install({ time: FIXED_TIMESTAMP })` for deterministic behavior.
For the soft-block scenario (AC-8 test coverage), advance clock by 31 days before Step 5 to
verify `SoftBlockGate` would appear. Keep this as a separate `test.step` within the same spec.

**File size:** This test will be large. If it exceeds 400 lines, split into
`lifecycle.spec.ts` (Steps 1-3) and `lifecycle-deletion.spec.ts` (Steps 4-5).

**Patterns to follow:**
- `tests/e2e/compliance/data-export.spec.ts` — ZIP builder, two-phase auth
- `tests/e2e/compliance/consent-withdrawal.spec.ts` — consent mock patterns
- `tests/e2e/compliance/notice-acknowledgement.spec.ts` — banner + soft-block patterns

**Test scenarios:**
- Happy path: full lifecycle completes without errors across all 5 steps
- Happy path (Step 1): notice ack POST called with `CURRENT_NOTICE_VERSION` at signup
- Happy path (Step 3): export ZIP download triggered; success toast shown
- Happy path (Step 4): consent withdrawal DELETE called; AI feature shows blocked state
- Happy path (Step 5): `hard-delete-user` Edge Function called with correct `userId`; user signed out
- Integration (Step 5): verify deletion trigger fires even after consent withdrawal in Step 4
- Edge case (soft-block): advancing clock 31 days shows `SoftBlockGate` for unacked user

**Verification:**
- `npx playwright test tests/e2e/compliance/lifecycle.spec.ts --project=chromium` passes
- All 5 steps report as passed in Playwright output
- Test completes in < 60 seconds

---

## System-Wide Impact

- **Interaction graph:** `CURRENT_NOTICE_VERSION` bump triggers `useNoticeAcknowledgement` hook in `Layout.tsx` → `LegalUpdateBanner` appears for all authenticated users whose latest ack version is `2026-04-23.1`. No other components affected.
- **Error propagation:** Ack-rate script propagates errors to stderr + exits non-zero only for infrastructure failures (missing env vars, Supabase unreachable). Business-level observations (< 95% ack rate) exit 0.
- **State lifecycle risks:** Version bump is a deploy-time change. Users mid-session will see the banner on next page load. No data loss risk.
- **API surface parity:** No API surface changes. All changes are documentation, a constant, a CLI script, and test files.
- **Integration coverage:** `lifecycle.spec.ts` provides the first end-to-end regression harness covering all nine E119 stories in sequence.
- **Unchanged invariants:** `LegalUpdateBanner` `mode="info"` behavior is unchanged. `SoftBlockGate` logic is unchanged. All existing compliance lib functions are unchanged.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Lifecycle E2E exceeds 400 lines | Split into two files at Step 3/4 boundary as documented in Unit 5 |
| Supabase admin API pagination shape unknown at plan time | Implementer reads `/auth/v1/admin/users` API docs at runtime; ack-rate script handles pagination loop |
| `page.clock` advancing 31 days causes other mocked routes to expire | Scope clock advance to a sub-test within soft-block step only; reset after |
| ICO checklist has items that expose compliance gaps | All items must be PASS or N/A; any FAIL must be resolved or documented as accepted risk before epic closes |
| Version bump `2026-05-01.1` date is in the future | This is intentional (beta launch marker); `parseNoticeVersion` validates format, not recency |

## Documentation / Operational Notes

- `annual-review.md` doubles as the runbook for Pedro's annual compliance review — it must be actionable enough to complete without referring to story files.
- `ico-sme-checklist-2026.md` is evidence for ICO accountability obligations — it should be written as if a regulator will read it.
- `docs/compliance/README.md` is the entry point for any future compliance work — keep summaries concise.
- The ack-rate report script is designed to run weekly during the 30-day beta window. `annual-review.md` documents how to invoke it.

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-23-e119-s13-annual-review-ico-requirements.md](../brainstorms/2026-04-23-e119-s13-annual-review-ico-requirements.md)
- `src/lib/compliance/noticeVersion.ts` — version constant
- `src/app/pages/legal/LegalUpdateBanner.tsx` — re-ack banner component
- `scripts/compliance/verify-subprocessors.ts` — script pattern to follow
- `tests/e2e/compliance/data-export.spec.ts` — two-phase auth + ZIP pattern
- `tests/e2e/compliance/notice-acknowledgement.spec.ts` — banner mock patterns
- ICO SME Web Hub: https://ico.org.uk/for-organisations/sme-web-hub/checklists/
