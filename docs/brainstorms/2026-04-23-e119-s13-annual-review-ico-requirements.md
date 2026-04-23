# E119-S13: Annual Review + ICO Checklist + Beta User Re-ack — Requirements

**Date:** 2026-04-23
**Story:** E119-S13
**Epic:** E119 — GDPR Full Compliance

---

## Problem Statement

E119 (twelve stories, now complete) built the full GDPR compliance stack for Knowlune: notice versioning, re-ack banners, erasure cascade, deletion emails, data export, consent ledger, AI provider re-consent, retention policy, retention enforcement, and operator artifacts. E119-S13 closes the epic with three interlocking deliverables:

1. **Annual review checklist** — a single document that Pedro (controller) runs each year to verify the compliance machinery still operates correctly. Without it, the elaborate infrastructure from S01–S12 can silently rot between reviews.

2. **ICO SME checklist walk** — the UK Information Commissioner's Office provides a structured self-assessment for SMEs. Completing it against Knowlune's current state provides documented regulatory evidence that all ICO requirements are addressed or explicitly noted as N/A. This is the formal sign-off that closes E119 as "compliant".

3. **Beta user re-acknowledgement** — because the notice was updated during E119 development, all existing beta users must see the LegalUpdateBanner and re-acknowledge before their 30-day window closes. An ack-rate report and a soft-block enforcement path ensure no user slips through. An E2E lifecycle test ties all nine compliance stories into one regression harness.

---

## Acceptance Criteria

### AC-1: Annual Review Document
- `docs/compliance/annual-review.md` created.
- Contains checklist items: re-read privacy notice, verify retention job ran daily (check audit log), verify sub-processor list is current, refresh DPA addenda, count consent records vs. user count, review breach register for open items.
- Documents follow-up process when unacked users exceed threshold after 30 days.

### AC-2: ICO SME Checklist
- `docs/compliance/ico-sme-checklist-2026.md` created.
- Each ICO SME checklist item (Data Protection Principles, Lawful Basis, Rights of Individuals, Data Transfers, Security, Accountability) recorded as **PASS** / **FAIL** / **N/A** with evidence link pointing to existing compliance docs or code.
- All FAIL items resolved or documented as accepted risk before E119 closes.

### AC-3: Compliance README
- `docs/compliance/README.md` created.
- Cross-links all 11 compliance documents: `privacy-notice.md`, `consent-inventory.md`, `ropa.md`, `dpa-supabase.md`, `subprocessors.md`, `retention.md`, `breach-runbook.md`, `breach-register.md`, `annual-review.md`, `ico-sme-checklist-2026.md`, and itself.
- Includes a short "what lives here" summary paragraph for each doc.

### AC-4: Notice Version Bump → Re-ack Trigger
- `CURRENT_NOTICE_VERSION` in `src/lib/compliance/noticeVersion.ts` bumped to `2026-05-01.1` (first version after beta launch).
- Existing users who have acked `2026-04-23.1` will see `LegalUpdateBanner` on next load (S02 hook detects version mismatch).
- No code changes required beyond the constant bump — S02 infrastructure handles the rest.

### AC-5: Ack-Rate Report Script
- `scripts/compliance/ack-rate-report.ts` created.
- Reads `notice_acknowledgements` table (Supabase) + auth user list.
- Outputs: total users, acked count, ack%, list of unacked user IDs, target version.
- Runnable via `npx tsx scripts/compliance/ack-rate-report.ts`.
- Designed to run weekly (documented in `annual-review.md`).

### AC-6: Beta Re-ack E2E
- `tests/e2e/compliance/beta-reack.spec.ts` created.
- Scenario 1: Beta user with old ack version opens app → `LegalUpdateBanner` fires → user reads notice → acknowledges → banner disappears → re-ack recorded in `notice_acknowledgements`.
- Scenario 2: User dismisses banner (does not ack) → banner state is NOT written as acked → next session re-prompts.

### AC-7: Dismiss Without Ack Behavior
- Covered in AC-6 Scenario 2 above.
- Dismissal via close/X or clicking away does NOT write a `notice_acknowledgements` record for the new version.

### AC-8: Soft-Block After 30 Days
- Covered by S02 `SoftBlockGate` (already built). `annual-review.md` references this mechanism and documents the follow-up email process for unacked users post-30-days.

### AC-9: End-to-End Lifecycle E2E
- `tests/e2e/compliance/lifecycle.spec.ts` created.
- Covers full user lifecycle: signup → notice ack → use AI feature → export data → withdraw consent → delete account → verify zero rows in key tables.
- All Supabase calls mocked via `page.route()`.
- Uses deterministic clock for time-dependent checks.

---

## Technical Context

### Existing Infrastructure (S01–S12)
- `src/lib/compliance/noticeVersion.ts` — `CURRENT_NOTICE_VERSION = '2026-04-23.1'`
- `src/lib/compliance/noticeAck.ts` — `writeNoticeAck()`, `readLatestNoticeAck()`
- `src/app/components/Layout.tsx` — mounts `LegalUpdateBanner` conditionally
- `src/app/pages/legal/LegalUpdateBanner.tsx` — banner component with re-ack flow
- `src/app/components/SoftBlockGate.tsx` — 30-day soft-block enforcement
- `src/lib/compliance/consentService.ts` — consent ledger writes
- `src/lib/compliance/retentionPolicy.ts` — RETENTION_POLICY typed export
- `tests/e2e/compliance/` — existing: `notice-acknowledgement.spec.ts`, `consent-withdrawal.spec.ts`, `data-export.spec.ts`, `provider-change.spec.ts`
- `docs/compliance/` — existing: `privacy-notice.md`, `consent-inventory.md`, `ropa.md`, `dpa-supabase.md`, `subprocessors.md`, `retention.md`, `breach-runbook.md`, `breach-register.md`
- `tests/e2e/support/fixtures.ts` — Playwright fixtures with `FIXED_DATE` and mock helpers

### Ack-Rate Report
- Requires Supabase service-role key from env (`SUPABASE_SERVICE_KEY` or `SUPABASE_SECRET_KEY`)
- Reads `notice_acknowledgements` table: `user_id`, `notice_version`, `acked_at`
- Reads auth users via Supabase admin API (`/auth/v1/admin/users`)
- Script is read-only; no writes

### Version Bump Impact
- Bumping `CURRENT_NOTICE_VERSION` from `2026-04-23.1` to `2026-05-01.1` is a one-line change
- S02's `useNoticeAcknowledgement` hook compares stored ack version to `CURRENT_NOTICE_VERSION` — mismatch triggers banner
- Tests that mock `noticeVersion` module must be updated to reflect new version

### ICO SME Checklist Source
- Reference: https://ico.org.uk/for-organisations/sme-web-hub/checklists/
- Key categories: Lawful Basis, Transparency, Data Subject Rights, Data Transfers, Security, Records of Processing, Breach Notification

### E2E Test Patterns (from test-patterns.md)
- All date-sensitive tests use `page.clock.install({ time: FIXED_DATE })`
- Supabase endpoints mocked via `page.route('**/auth/v1/**', ...)`
- Use `tests/e2e/support/fixtures.ts` helpers, not manual `page.context()` setup

---

## Out of Scope

- Executing the first annual review (scheduled 2027-Q2) — this story creates the checklist, not runs it
- Multi-locale notice translation (deferred per plan)
- Automated ICO submission (manual process; checklist is documentation evidence)
- Real Supabase connection in E2E tests (all mocked)
- Sending actual emails to beta users (ack-rate report identifies who needs follow-up; email campaign is out of scope)

---

## Open Questions

1. **ICO checklist version**: The ICO SME Hub URL above references the 2024/2025 checklist. Should we reference a specific published version for evidence stability? → Default: link to canonical ICO URL + note "accessed 2026-04-23".

2. **Ack-rate threshold**: AC-5 calls for weekly runs during 30-day beta window. Should the script exit non-zero when ack% < 95%? → Default: exit 0 always (reporting tool), log warning when < 95%.

3. **Lifecycle test scope**: AC-9 mentions "verify zero rows". Which tables? → `user_consents`, `notice_acknowledgements`, `export_jobs`, `user_profiles` (soft-deleted → hard-deleted). Auth user record deletion is async (Edge Function) — lifecycle test should verify deletion was triggered, not row count directly.

4. **New version date**: AC-4 specifies `2026-05-01.1` as the bumped version. This date is in the future relative to today (2026-04-23). Is this intentional to mark the beta launch date? → Default: use `2026-05-01.1` as specified in story AC-4.
