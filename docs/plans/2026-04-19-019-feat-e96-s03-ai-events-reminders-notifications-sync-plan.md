---
title: E96-S03 — AI Usage Events, Course Reminders, and Notifications Sync
type: feat
status: active
date: 2026-04-19
origin: docs/brainstorms/2026-04-19-e96-s03-ai-usage-events-course-reminders-notifications-requirements.md
---

# E96-S03 — AI Usage Events, Course Reminders, and Notifications Sync

## Overview

E96-S01 landed the Supabase tables + RLS; E96-S02 wired the Dexie stores through `syncableWrite`. This story closes the loop on the P3/P4 event & notification tier by (1) auditing every AI call site to confirm it emits a `trackAIUsage` event (success + failure), (2) verifying the course-reminder snooze/dismiss write paths actually flow through the sync-wired store mutators, (3) verifying notification create + mark-read mutations enqueue `syncQueue` rows, and (4) adding three integration tests that lock the contracts in place.

This is primarily a verification + gap-fill story — no new tables, no new sync primitives, no UI redesign.

## Problem Frame

Per the origin doc: Dexie stores for `aiUsageEvents`, `courseReminders`, and `notifications` are sync-wired at the write layer, but the business logic that *invokes* those writes hasn't been audited end-to-end. Missing call sites produce silent data loss (unrecorded AI events, dismissed reminders re-firing on a second device, unread counts drifting). Without dedicated integration tests asserting `syncQueue` entries, future regressions go unnoticed until a beta user reports a phantom notification or a missing analytics row.

(see origin: `docs/brainstorms/2026-04-19-e96-s03-ai-usage-events-course-reminders-notifications-requirements.md`)

## Requirements Trace

- R1 (G1/AC1) — All seven AI call sites emit `trackAIUsage` on both success and failure paths; missing sites get instrumented.
- R2 (G2/AC3a) — Course reminder snooze/dismiss mutations flow through `syncableWrite`; dismissed reminders stay dismissed after pull on a second device.
- R3 (G3/AC3b) — Notification create + mark-read + mark-all-read mutations flow through `syncableWrite`; unread count converges across devices via LWW.
- R4 (AC2) — One integration test per table (`aiUsageEvents`, `courseReminders`, `notifications`) asserts the mutation lands in `syncQueue`.
- R5 (AC4) — No regression in `AIAnalyticsTab` — existing rendering continues to work.
- R6 (AC5) — `trackAIUsage` failures never throw into the user-facing AI flow (existing contract re-verified; `aiEventTracking.ts:76-79` already wraps in try/catch).
- R7 (AC6) — Unit + integration test suites pass; E2E smoke remains green.

## Scope Boundaries

- No new Supabase tables, columns, or RLS policies.
- No new sync primitives; `syncableWrite` + registry entries remain untouched.
- No push notification delivery (web-push / APNs / FCM) — in-app only.
- No server-side reminder scheduling (stays client-side `setTimeout` / visibility-based).
- No notification/reminder UI redesign.
- No AI feature changes or provider-selection work.
- No de-duplication of AI events on retry (append-only tolerated).
- No "mark-all-read" coalescing optimization.

### Deferred to Separate Tasks

- Dismissed-reminder garbage collection: future data-pruning story.
- `aiUsageEvents` retention cap: future data-pruning story.
- Rich notification filtering/categorization UI: future UX epic.

## Context & Research

### Relevant Code and Patterns

- **AI tracking entry point:** `src/lib/aiEventTracking.ts` — `trackAIUsage(featureType, options)` already routes through `syncableWrite('aiUsageEvents', 'add', ...)`. Fire-and-forget with internal try/catch (lines 76-79). Gated by `isFeatureEnabled('analytics')`.
- **Existing instrumented call sites (confirmed via grep):**
  - `src/lib/autoAnalysis.ts`
  - `src/app/components/figma/QAChatPanel.tsx`
  - `src/app/components/figma/AISummaryPanel.tsx`
  - `src/app/components/notes/OrganizeNotesButton.tsx`
  - `src/stores/useLearningPathStore.ts`
- **Call sites to audit (listed in origin; no current import of `trackAIUsage`):**
  - `src/ai/quizGenerationService.ts`
  - `src/ai/courseTagger.ts`
  - `src/lib/aiSummary.ts` (may be indirect via AISummaryPanel — verify)
  - `src/lib/actionSuggestions.ts`
  - `src/ai/knowledgeGaps/` (if referenced by any audited site)
- **Course reminders:** `src/lib/courseReminders.ts`, `src/stores/useCourseReminders.ts` (or equivalent), `src/app/components/.../CourseReminderSettings.tsx`. Expect snooze/dismiss to call a store mutator that internally uses `syncableWrite('courseReminders', 'put', ...)` per E96-S02.
- **Notifications:** `src/stores/useNotificationStore.ts`, `src/app/components/.../NotificationCenter.tsx`, `src/app/components/figma/Notifications.tsx`. Expect `add`, `markRead`, `markAllRead` to route through `syncableWrite('notifications', ...)`.
- **Integration test harness (primary reference):** `src/lib/sync/__tests__/p4-insert-only-sync.test.ts` (157 lines — insert-only pattern for `aiUsageEvents`/`quizAttempts`), and `src/lib/sync/__tests__/p3-lww-batch-b-sync.test.ts` (260 lines — LWW pattern with device simulation).

### Institutional Learnings

- E93 retrospective: echo loops are the top regression vector. Hydration paths must NOT call `syncableWrite`. This story only audits *user-initiated* write paths — hydration is out of scope, but tests should confirm pull-path writes don't double-enqueue.
- `syncableWrite` stamps `updatedAt` itself — callers must not pre-stamp. Audit should flag any pre-stamping in reminder/notification mutators.
- Fire-and-forget tracking calls must use internal try/catch; never `await` in a way that would propagate to the user flow. `aiEventTracking.trackAIUsage` already does this — new call sites should invoke it unawaited OR catch errors locally.

### External References

- None required — all patterns are internal and already proven in E92/E93/E95/E96-S02.

## Key Technical Decisions

- **Audit-first approach:** Before instrumenting any AI call site, grep for existing `trackAIUsage` / `aiEventTracking` usage in that file to avoid double-emission. Produce a tri-state audit table per Unit 1 (instrumented / missing-on-success / missing-on-failure).
- **Fire-and-forget AI event emission:** New call sites adopt the same pattern as `autoAnalysis.ts` — invoke `trackAIUsage(...)` without awaiting, or await with local try/catch. Never let a tracking failure bubble into the AI feature.
- **Failure events record `status: 'error'`:** Pass `status: 'error'` + `metadata: { errorCode }` on catch, so `AIAnalyticsTab` reflects true failure rates. Matches the existing `AIUsageEvent` shape in `aiEventTracking.ts:61-69`.
- **Reminder snooze/dismiss:** Verify the store mutator is sync-wired; do not bypass the store from UI components. If a direct `db.courseReminders.put` is found in UI or hook code, replace with the store mutator.
- **Notification mutations:** `markRead` and `markAllRead` each enqueue one sync op per record (no coalescing — explicitly deferred). `markAllRead` may enqueue N ops; accept this for S03.
- **LWW resolution:** Reuses the registry entries from E96-S02 — no changes here. Last writer wins on `updatedAt`.
- **Test scope:** Three integration tests (one per table) using the existing sync test harness. Each asserts the user-facing action produces the expected `syncQueue` row(s) with the correct operation and payload shape.

## Open Questions

### Resolved During Planning

- **Should new AI instrumentation include token counts?** Origin doc lists them as "minimum payload" but current `AIUsageEvent` shape uses `durationMs` + `metadata`. Resolution: preserve existing `AIUsageEvent` shape (no schema change); pass token counts through `metadata.tokens` when the provider returns them. A schema expansion is a future story.
- **Double-emission risk?** Resolution: audit grep per file before adding any call; document findings in the audit table.
- **Should `markAllRead` be one op or many?** Resolution: many (one per record) — coalescing is explicitly deferred in the origin doc.

### Deferred to Implementation

- Exact location of the `trackAIUsage` call in each newly-instrumented file (before/after the AI SDK call site; depends on local structure).
- Whether `src/lib/aiSummary.ts` already emits via its caller (`AISummaryPanel.tsx`) — resolve by reading both files during Unit 1.
- Store method names for reminders — the E96-S02 plan references a mutator but the exact symbol (`snoozeReminder`, `dismissReminder`, etc.) is verified at implementation time.

## Implementation Units

- [ ] **Unit 1: AI call-site audit + instrumentation**

**Goal:** Every AI call site listed in the origin doc emits a `trackAIUsage` event on both success and failure paths.

**Requirements:** R1, R6

**Dependencies:** None

**Files:**
- Audit/modify: `src/ai/quizGenerationService.ts`
- Audit/modify: `src/ai/courseTagger.ts`
- Audit/modify: `src/lib/aiSummary.ts`
- Audit/modify: `src/lib/actionSuggestions.ts`
- Audit/modify: `src/app/components/figma/QAChatPanel.tsx` (already instrumented — verify success + failure both covered)
- Audit/modify: `src/app/components/notes/OrganizeNotesButton.tsx` (already instrumented — verify)
- Audit/modify: `src/lib/autoAnalysis.ts` (already instrumented — verify failure path)
- Reference (no change): `src/lib/aiEventTracking.ts`

**Approach:**
- Produce a tri-state audit table (done / needs-success / needs-failure) for all seven call sites.
- For each gap, add `trackAIUsage(featureType, { status, durationMs, metadata })` in a fire-and-forget pattern (invoke unawaited or wrap in local try/catch).
- On failure paths, emit `status: 'error'` with `metadata: { errorCode, errorMessage }` before rethrowing or surfacing the UI error.
- Map each call site to its `AIFeatureType`:
  - `quizGenerationService.ts` → no existing enum match; use closest fit (`knowledge_gaps` or extend via `metadata.subFeature`); document choice in code comment.
  - `courseTagger.ts` → same — use `metadata.subFeature: 'course_tagging'`.
  - `aiSummary.ts` → `summary`.
  - `actionSuggestions.ts` → use `metadata.subFeature: 'action_suggestions'`.
  - Existing instrumented files → verify current mappings match this table.
- Do NOT add new `AIFeatureType` enum values in this story (would require schema changes); use `metadata.subFeature` for granularity.

**Patterns to follow:**
- `src/lib/autoAnalysis.ts` — existing success/error emission shape.
- `src/app/components/figma/QAChatPanel.tsx` — UI-component-side emission pattern.
- `src/lib/aiEventTracking.ts:49-80` — `trackAIUsage` signature and options.

**Test scenarios:**
- Happy path: `quizGenerationService` success path emits a `trackAIUsage('knowledge_gaps', { status: 'success', metadata: { subFeature: 'quiz_generation' } })` call (spy-based unit test).
- Error path: `courseTagger` throwing provider calls emits `trackAIUsage(..., { status: 'error', metadata: { errorCode } })` before propagating the error.
- Integration: `trackAIUsage` rejecting internally (simulate `syncableWrite` throw) does NOT throw out of the AI call site — the AI feature still returns/raises as normal.
- Edge case: when `isFeatureEnabled('analytics')` is false, `trackAIUsage` is a no-op and does not enqueue a `syncQueue` row (already covered by `aiEventTracking.test.ts` — verify).

**Verification:**
- Grep `rg "trackAIUsage|aiEventTracking" src/ai src/lib/aiSummary.ts src/lib/actionSuggestions.ts` returns a hit in every audited file.
- Unit tests covering newly-instrumented files pass.
- `AIAnalyticsTab` renders events for all instrumented features in a manual smoke.

---

- [ ] **Unit 2: Course reminder sync-path verification + gap fix**

**Goal:** Every user-facing snooze/dismiss path for course reminders flows through `syncableWrite('courseReminders', ...)`.

**Requirements:** R2

**Dependencies:** None (E96-S02 provides the wired store)

**Files:**
- Audit/modify: `src/lib/courseReminders.ts`
- Audit/modify: `src/stores/useCourseReminders.ts` (or equivalent — locate during audit)
- Audit/modify: `src/app/components/.../CourseReminderSettings.tsx`
- Reference: `src/lib/sync/syncableWrite.ts`
- Reference: `src/lib/sync/tableRegistry.ts` (courseReminders entry — no changes)

**Approach:**
- Locate every mutation of reminder state: snooze, dismiss, create, status change (`active` → `completed`).
- Confirm each mutation calls the store mutator, and the store mutator uses `syncableWrite('courseReminders', 'put'|'delete', ...)`.
- If a UI component or hook calls `db.courseReminders.put/delete` directly, replace with the store mutator.
- Do NOT introduce pre-stamped `updatedAt` — `syncableWrite` owns that field.

**Patterns to follow:**
- `src/stores/useNoteStore.ts` — LWW collection mutation pattern.
- E96-S02 plan's Course Reminders unit.

**Test scenarios:**
- Happy path: calling `snoozeReminder(id, snoozedUntil)` enqueues exactly one `syncQueue` row with `op: 'put'` and `tableName: 'courseReminders'`.
- Happy path: calling `dismissReminder(id)` enqueues a `syncQueue` row with `dismissedAt` set.
- Integration (cross-device): a dismissed reminder hydrated from a simulated second client does not re-surface locally (LWW chooses the dismissed version when `updatedAt` is newer).
- Edge case: snoozing an already-snoozed reminder with an earlier `snoozedUntil` still enqueues — the engine's LWW logic is not the call site's concern.

**Verification:**
- `rg "db\.courseReminders\.(put|add|delete)" src/` returns results only inside `useCourseReminders.ts` store internals or tests — no UI/hook direct writes.
- Unit tests for the store confirm `syncableWrite` is called on each mutator.

---

- [ ] **Unit 3: Notification sync-path verification + gap fix**

**Goal:** Notification creation, mark-read, and mark-all-read mutations flow through `syncableWrite('notifications', ...)`; unread count converges across devices.

**Requirements:** R3

**Dependencies:** None (E96-S02 provides the wired store)

**Files:**
- Audit/modify: `src/stores/useNotificationStore.ts`
- Audit/modify: `src/app/components/.../NotificationCenter.tsx`
- Audit/modify: `src/app/components/figma/Notifications.tsx`
- Reference: `src/lib/sync/syncableWrite.ts`
- Reference: `src/lib/sync/tableRegistry.ts` (notifications entry — no changes)

**Approach:**
- Audit `useNotificationStore` for `add`, `markRead`, `markAllRead`, and any `delete` paths. Confirm each calls `syncableWrite('notifications', 'put'|'add'|'delete', ...)`.
- `markAllRead` iterates unread notifications and enqueues one op per record (coalescing deferred).
- Confirm notification creators (streak milestones, reminder fires, achievement unlocks) go through the store, not direct Dexie writes. Expected creator sites:
  - `src/lib/streakManager.ts` (or equivalent)
  - `src/lib/courseReminders.ts` (when a reminder fires, it creates a notification)
  - `src/stores/useAchievementStore.ts` (or equivalent)
- Unread-count selector is a pure derived read — no sync wiring needed, but verify it reads post-pull state (no stale cache).

**Patterns to follow:**
- `src/stores/useNoteStore.ts` — LWW collection pattern.
- E96-S02 plan's Notifications unit.

**Test scenarios:**
- Happy path: `addNotification(payload)` enqueues one `syncQueue` row with `op: 'add'`, `tableName: 'notifications'`.
- Happy path: `markRead(id)` enqueues one `syncQueue` row with `op: 'put'` and `readAt` set.
- Edge case: `markAllRead()` with N unread notifications enqueues N `syncQueue` rows (not one coalesced row).
- Integration: after simulated pull where a notification was marked read on "device B", local unread count decrements accordingly when the LWW merge resolves.
- Edge case: creating a notification while `userId` is null does not enqueue (respects `syncableWrite`'s no-userId guard — already covered in syncableWrite tests; verify no regression).

**Verification:**
- `rg "db\.notifications\.(put|add|delete)" src/` returns results only inside the store and tests — no direct writes from UI or domain modules.
- Unit tests for `useNotificationStore` confirm `syncableWrite` is called on each mutator.

---

- [ ] **Unit 4: Integration test trio (aiUsageEvents, courseReminders, notifications)**

**Goal:** One integration test per table asserts the user-facing action produces the expected `syncQueue` entry/entries.

**Requirements:** R4, R7

**Dependencies:** Units 1, 2, 3

**Files:**
- Create: `src/lib/sync/__tests__/e96-s03-ai-usage-events-sync.test.ts`
- Create: `src/lib/sync/__tests__/e96-s03-course-reminders-sync.test.ts`
- Create: `src/lib/sync/__tests__/e96-s03-notifications-sync.test.ts`

**Approach:**
- Follow the existing harness shape from `p4-insert-only-sync.test.ts` (for `aiUsageEvents`) and `p3-lww-batch-b-sync.test.ts` (for `courseReminders` + `notifications`).
- Each test: arrange Dexie + sync engine stubs, invoke the user-level action (e.g. `trackAIUsage(...)`, `snoozeReminder(...)`, `markRead(...)`), then assert `db.syncQueue` contains the expected row(s) with the correct `tableName`, `op`, and record keys.
- `aiUsageEvents` test: use `insert-only` assertion (one queue row per event, no updates/deletes).
- `courseReminders` + `notifications` tests: use LWW assertion (queue row has `op: 'put'`, record carries stamped `updatedAt`).
- Reuse existing test helpers/fixtures (device identity, sync state reset) from `src/lib/sync/__tests__/` rather than re-inventing.

**Patterns to follow:**
- `src/lib/sync/__tests__/p4-insert-only-sync.test.ts:1-157` — insert-only test shape.
- `src/lib/sync/__tests__/p3-lww-batch-b-sync.test.ts:1-260` — LWW test shape with multi-operation sequences.

**Test scenarios:**
- `aiUsageEvents`: calling `trackAIUsage('summary', { status: 'success' })` enqueues exactly one `syncQueue` row with `tableName: 'aiUsageEvents'`, `op: 'add'`, and the event payload in `record`.
- `aiUsageEvents`: calling `trackAIUsage` when `isFeatureEnabled('analytics')` is false does NOT enqueue.
- `courseReminders`: `snoozeReminder(id, date)` enqueues one row with `op: 'put'` and `record.snoozedUntil === date`.
- `courseReminders`: `dismissReminder(id)` enqueues one row with `record.dismissedAt` set.
- `notifications`: `addNotification(...)` enqueues one row with `op: 'add'`.
- `notifications`: `markRead(id)` enqueues one row with `op: 'put'` and `record.readAt` set.
- `notifications`: `markAllRead()` with 3 unread notifications enqueues 3 rows.
- Integration: none of the above tests trigger the hydrate path (no echo-loop enqueue) — assert `syncQueue.count() === expected` precisely, not `>= expected`.

**Verification:**
- All three test files run in CI green (`npm run test:unit`).
- Assertions catch the specific `syncQueue` row count and payload keys — a regression that drops one of these call sites from the sync path fails the test.

---

- [ ] **Unit 5: Manual two-device smoke + documentation update**

**Goal:** End-to-end sanity check across two logged-in browser sessions, plus documentation of the S03 contract for future stories.

**Requirements:** R2, R3, R5

**Dependencies:** Units 1–4

**Files:**
- Modify: `docs/implementation-artifacts/stories/E96-S03-*.md` (story closeout notes — path TBD at implementation time)
- Reference (no change): `docs/implementation-artifacts/sprint-status.yaml`

**Approach:**
- Manual two-device trace:
  - Device A: dismiss a reminder → sync push → Device B pulls → reminder does not re-fire.
  - Device A: mark one of three notifications read → sync push → Device B pulls → unread count reads 2 (not 3).
  - Device A: trigger an AI summary → sync push → verify `AIAnalyticsTab` on Device B shows the event after pull.
- Document any edge cases discovered (e.g. race between `setTimeout` reminder fire and a pull that already dismissed it — expected behavior: pull-path dismissal wins; reminder's in-process timer checks dismissedAt before firing).
- Update the story closeout section with:
  - Call-site audit table (Unit 1 output)
  - Integration test coverage summary
  - Any known issues discovered (file to `docs/known-issues.yaml` if needed).

**Patterns to follow:**
- E93-S02 / E93-S08 closeout artifacts in `docs/implementation-artifacts/stories/`.

**Test scenarios:**
- Test expectation: none — this is a documentation/verification unit with no behavioral code change.

**Verification:**
- Two-device trace matches expected behavior (dismissed reminder stays dismissed; unread count converges; AI event appears cross-device).
- Story closeout artifact committed with audit table.
- No new entries in `docs/known-issues.yaml` caused by this story (or, if any, they are triaged per the epic-closeout checklist).

## System-Wide Impact

- **Interaction graph:** `trackAIUsage` is invoked from 7+ call sites across `src/ai/`, `src/lib/`, and `src/app/components/`. It flows into `syncableWrite` → Dexie → `syncQueue`. Reminder and notification store mutators fan in from UI (CourseReminderSettings, NotificationCenter) and domain triggers (streakManager, achievement hooks, reminder fires).
- **Error propagation:** Tracking failures must be swallowed locally; user-facing AI flows keep their existing error contract. Reminder/notification mutator failures surface to the caller (normal store-API behavior) — `syncableWrite` already swallows queue-enqueue failures after the Dexie write succeeds.
- **State lifecycle risks:** None net-new. `updatedAt` stamping is owned by `syncableWrite`; pre-stamping would break LWW (audit guards against it). Hydration path is untouched — no echo-loop risk unless a refactor accidentally routes hydrate through `syncableWrite`.
- **API surface parity:** No public API changes — internal instrumentation + test coverage only.
- **Integration coverage:** Unit 4's three integration tests cover the cross-layer proof (action → queue). Unit 5's two-device trace covers the cross-device proof.
- **Unchanged invariants:** `tableRegistry` entries for the three tables are unchanged; `syncableWrite` signature is unchanged; `AIUsageEvent` shape is unchanged. This story touches only call sites and test files.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Double-emission of AI events after adding a new `trackAIUsage` call to a site that already emitted via a caller | Unit 1 audit grep is a pre-check; if ambiguous, read both files before adding the call. |
| `markAllRead` N-op enqueue causes queue bloat on users with 100+ unread notifications | Explicitly out of scope per origin doc; note in story closeout as a future coalescing story. |
| Hidden direct `db.courseReminders.put` or `db.notifications.put` call in an untested code path (e.g. a background handler) | Unit 2/3 audit uses `rg` across the full `src/` tree; any hit outside the store triggers a fix. |
| Test flakiness from shared Dexie state between integration tests | Reuse test-harness reset helpers from `src/lib/sync/__tests__/` (they already handle cleanup). |
| `isFeatureEnabled('analytics')` gating hides missed instrumentation during local dev | Unit 4 tests enable analytics explicitly and assert queue rows; also test the disabled path asserts zero rows. |

## Documentation / Operational Notes

- Update the E96-S03 story artifact (`docs/implementation-artifacts/stories/E96-S03-*.md`) with the final audit table and test coverage summary.
- No monitoring changes; `syncQueue` already has dead-letter instrumentation from E92.
- No feature flags; analytics consent is already gated by `isFeatureEnabled('analytics')`.

## Sources & References

- **Origin document:** `docs/brainstorms/2026-04-19-e96-s03-ai-usage-events-course-reminders-notifications-requirements.md`
- Prior plan: `docs/plans/2026-04-19-018-feat-e96-s02-wire-p3-p4-stores-plan.md`
- Reference test harnesses: `src/lib/sync/__tests__/p4-insert-only-sync.test.ts`, `src/lib/sync/__tests__/p3-lww-batch-b-sync.test.ts`
- Tracking entry point: `src/lib/aiEventTracking.ts`
- Write-path primitive: `src/lib/sync/syncableWrite.ts`
- Registry: `src/lib/sync/tableRegistry.ts`
