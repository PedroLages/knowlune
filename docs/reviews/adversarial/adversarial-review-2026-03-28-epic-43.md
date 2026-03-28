# Adversarial Review: Epic 43 — Wave 1 Foundation Fixes

**Date:** 2026-03-28
**Reviewer:** Adversarial Review Agent (Opus 4.6)
**Epic:** E43 — Wave 1 Foundation Fixes (8 stories, 5 PRs)
**Verdict:** PASS WITH CONCERNS — 14 findings (3 critical, 5 high, 4 medium, 2 low)

---

## Executive Summary

Epic 43 is a "foundation fixes" epic that bundles three categories of work: test health restoration (S01-S03), new features (S04 session expiry, S06-S07 notifications), and UX polish (S05 completion %, S08 auth polish). The epic shipped in a single day, which is impressive velocity but raises questions about review depth. While individual stories are competently implemented, the epic as a whole has structural problems: scope creep disguised as "foundation," deferred test failures that were not actually resolved, and known issues left open without triage.

---

## Findings

### CRITICAL (3)

**C-01: Stories S01-S03 were never actually implemented — marked "done (E33)" without verification**

Stories E43-S01, S02, and S03 were the core test health stories (56 test failures). The tracking file says they were "resolved during E33 test paydown," but:
- Their story files still have `status: draft`, no `started`/`completed` dates, no review gates passed, empty "Challenges and Lessons Learned" sections
- The known issues register (KI-016 through KI-025) still shows ALL 10 issues as `status: open`
- Current test run shows 11 unit test failures (8 in `isPremium.test.ts`, 1 in `Courses.test.tsx`)
- The epic tracker claims "3,429 tests passing" but the current reality is 3,507 passed / 11 failed

This is the most serious finding: the epic's original raison d'etre (fix 56 test failures) was declared done by reference to another epic, but the known issues register was never updated and at least 11 failures persist. The foundation was not actually fixed.

**C-02: TypeScript compilation errors shipped to main**

`npx tsc --noEmit` reports 3 TypeScript errors in `src/services/__tests__/NotificationService.test.ts`:
- Line 10: `vi.fn<[], Promise<void>>()` has wrong type arguments
- Line 29: Spread argument type mismatch

These were documented as "pre-existing issues" in the epic tracker but are directly in files created by E43-S07. The epic introduced new TypeScript errors and left them unfixed. This breaks the project's own quality gates (`type-check` is listed as passed in S07's review gates).

**C-03: "View all notifications" button is a dead-end**

`NotificationCenter.tsx:219-222` has a "View all notifications" footer button that only calls `setOpen(false)` — it closes the popover and does nothing else. No `/notifications` route exists. This was already flagged as HIGH in the design review (`design-review-2026-03-26-notifications-profile-404-skeleton.md`, finding H-01) but was not addressed. Shipping a button that silently does nothing is worse than having no button — it teaches users their clicks are unreliable.

---

### HIGH (5)

**H-01: Scope creep — notifications system (S06-S07) is a new feature, not a "foundation fix"**

The epic is named "Wave 1 Foundation Fixes" but S06 and S07 introduce an entirely new notification infrastructure: Dexie v28 migration, ULID dependency, event bus, 5-store integration, NotificationService, and UI wiring. This is a 400+ line feature build, not a fix. It belongs in its own epic with proper product definition, not smuggled into a "fixes" epic. Consequence: the notification system received less scrutiny than a properly scoped feature epic would mandate (design review was skipped for S06, performance benchmark skipped for both S06 and S07).

**H-02: Notification cleanup sorts by ISO string comparison, not actual dates**

`useNotificationStore.ts:187` uses `.where('createdAt').below(cutoff)` where `cutoff` is an ISO 8601 string. Dexie's `below()` on strings does lexicographic comparison. ISO 8601 strings are lexicographically sortable for UTC timestamps, but if `createdAt` were ever stored with timezone offsets (e.g., `+05:30`), the comparison would silently produce wrong results. The same fragility was flagged in the code review for S07 (finding H2) for `hasReviewDueToday()` — indicating a systemic pattern of treating ISO strings as sortable without defensive validation.

**H-03: Event bus error handling swallows notification creation failures**

`NotificationService.ts:140` catches all errors from `handleEvent()` with only a `console.error`. If the Dexie database is corrupted, full, or the notifications table is missing, every notification silently fails. The user sees no feedback — no toast, no badge update, no indication that the notification system is broken. Combined with the `silent-catch-ok` comment, this is explicitly choosing to hide failures from the user.

**H-04: 10 known issues (KI-016 to KI-025) were not triaged during post-epic**

The story workflow mandates a "Known issues triage" step after epic completion. The epic tracker shows `Adversarial Review: pending`, `Retrospective: pending`, and the known issues register still has 10 items at `status: open` — all discovered during the production-readiness audit and all supposedly addressed by S01-S03. None were updated to `fixed`, `scheduled`, or `wont-fix`. This violates the project's own process.

**H-05: Session expiry banner dismissed state persists incorrectly**

`SessionExpiredBanner.tsx:21-23` initializes `dismissed` from `sessionStorage` in a `useState` initializer. If the session expires, the user dismisses the banner, then the session expires again (e.g., after re-auth and another expiry), the `sessionStorage` flag from the first dismissal is still present. The banner will never reappear for the entire browser session, even for genuinely new expiry events. The `SESSION_DISMISSED_KEY` should be cleared when `sessionExpired` transitions from `false` to `true`, not just when the user signs back in.

---

### MEDIUM (4)

**M-01: `new Date().toISOString()` used throughout notification store without deterministic time**

`useNotificationStore.ts` uses `new Date().toISOString()` at lines 80, 114, 133, and 162. The ESLint rule `test-patterns/deterministic-time` catches `new Date()` in test files, but the production code itself is not using any injectable clock. This makes the notification system untestable at the integration level without mocking `Date` globally. If the project ever needs to verify time-dependent notification behavior (TTL cleanup, dedup windows), this will require refactoring.

**M-02: Notification store `init()` swallows cleanup failures silently**

`useNotificationStore.ts:56-58` catches cleanup/load errors in `init()` with only `console.error`. If the `notifications` Dexie table doesn't exist (migration failure) or is corrupted, the store silently enters a broken state with empty `notifications[]` and `unreadCount: 0`. The NotificationCenter will show "No notifications yet" — a false negative that masks database corruption.

**M-03: Completion percentage still hardcoded to 0% on Authors and AuthorProfile pages**

The S05 story file explicitly documents: "Secondary pages (AuthorProfile, Authors) still show 0%". This was deferred as "future stories could wire them up" but no follow-up story was created. Users who navigate to author profiles will see 0% completion on all courses, contradicting the correct percentages shown on the Courses page. This is a data consistency issue across views.

**M-04: Multiple review gates routinely skipped across the epic**

Examining the `review_gates_passed` fields:
- S05: 4 gates skipped (e2e, design review, performance benchmark, exploratory QA)
- S06: 4 gates skipped (e2e, design review, performance benchmark, exploratory QA)
- S07: 3 gates skipped (design review, performance benchmark, exploratory QA)
- S08: 4 gates skipped (design review, performance benchmark, security review, exploratory QA)

The design review was skipped for every story except implicitly via S07. Performance benchmarks were skipped for every story. Adding a new Dexie migration (v28), a ULID dependency, and event bus infrastructure without any performance measurement means regressions could exist undetected.

---

### LOW (2)

**L-01: ULID package added as production dependency for notifications only**

`ulid` was added as a runtime dependency solely for notification IDs. The package is small (~3KB) but adds to the supply chain surface. Given notifications are capped at 100 and purged after 30 days, a simpler approach (crypto.randomUUID() + ISO timestamp prefix) would have avoided the dependency entirely while still achieving time-sortable uniqueness.

**L-02: Streak milestone threshold duplicated in two locations**

`STREAK_MILESTONES` is defined in both `NotificationService.ts:18` and `useSessionStore.ts:223`. If these arrays diverge, the session store will emit events that the service ignores, or vice versa. The code review (H1) flagged this and the fix was applied (store now filters before emitting), but the duplication remains — the service still checks `STREAK_MILESTONES.includes()` defensively.

---

## Process Observations

1. **Single-day epic execution**: 8 stories (3 retroactive, 5 new) completed in one day including reviews. This is unusually fast and explains the number of skipped review gates.

2. **Stories S01-S03 accounting fiction**: Marking stories as "done (E33)" without updating their story files, review gates, or known issues register creates a false picture of completion. If S01-S03 were truly done in E33, they should have been removed from E43's scope or their story files updated.

3. **Pre-existing failures growing**: The epic started with documented pre-existing failures (isPremium 8 failures, Courses.test 1 failure) and ended without addressing them. These are now entrenched as "acceptable" broken tests.

4. **Missing retrospective**: The retrospective is still `pending` per the tracker. The lessons learned sections are populated for S04, S05, S06, S07 but empty for S01, S02, S03, S08. The epic shipped without the team reflection that would catch these process gaps.

---

## Recommendations

1. **Immediately update known issues register** — Close KI-016 through KI-025 as `fixed` with correct `fixed_by` references (E33), or mark as `open` with accurate notes about what is still broken.
2. **Fix TypeScript errors in NotificationService.test.ts** — 3 TS errors on main is unacceptable. This is a 5-minute fix.
3. **Remove or disable "View all notifications" button** until a notifications page exists.
4. **Create follow-up stories** for: completion % on Authors pages (M-03), session dismissed state bug (H-05), and injectable clock for notification store (M-01).
5. **Run the retrospective** — the epic tracker shows it as pending. The lessons from this epic (especially the scope creep and skipped gates) should be captured.

---

## Findings Summary

| ID | Severity | Category | Description |
|----|----------|----------|-------------|
| C-01 | CRITICAL | Process | S01-S03 marked done without implementation or KI triage |
| C-02 | CRITICAL | Quality | TypeScript errors shipped to main in new files |
| C-03 | CRITICAL | UX | "View all notifications" button is a dead-end |
| H-01 | HIGH | Scope | Notifications system is a feature, not a "fix" |
| H-02 | HIGH | Architecture | ISO string comparison for date-based cleanup is fragile |
| H-03 | HIGH | Resilience | Event bus swallows notification creation failures |
| H-04 | HIGH | Process | 10 known issues not triaged post-epic |
| H-05 | HIGH | UX | Session expiry banner dismiss persists across new expiry events |
| M-01 | MEDIUM | Testability | Non-deterministic `new Date()` in production notification code |
| M-02 | MEDIUM | Resilience | Notification store init silently fails on DB corruption |
| M-03 | MEDIUM | UX | Completion % still 0% on Authors/AuthorProfile pages |
| M-04 | MEDIUM | Process | Multiple review gates routinely skipped |
| L-01 | LOW | Dependencies | ULID package could be replaced with built-in APIs |
| L-02 | LOW | Maintainability | Streak milestone thresholds duplicated in two files |
