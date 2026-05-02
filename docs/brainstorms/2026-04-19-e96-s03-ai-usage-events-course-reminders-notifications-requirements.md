# E96-S03 — AI Usage Events, Course Reminders, and Notifications Sync

**Status:** Draft (autopilot brainstorm)
**Date:** 2026-04-19
**Epic:** E96 (P3/P4 Sync Wire-Up)
**Prior context:** E96-S01 (migrations), E96-S02 (syncableWrite wiring)

## Problem

E96-S02 wired the Dexie stores for `aiUsageEvents`, `courseReminders`, and `notifications` through `syncableWrite`, and the Supabase tables + RLS exist from E96-S01. What remains is ensuring the **business logic** actually emits events and mutations at the right call sites so sync has something to push:

- **AI usage events** are append-only analytics. Today `aiEventTracking.ts` exists and is sync-wired, but we need to verify every AI call site (quiz generation, Q&A chat, AI summary, auto-analysis, course tagger, action suggestions, note organization) actually records an event with feature, provider/model, and token counts.
- **Course reminders** have a store and UI (`CourseReminderSettings.tsx`, `useCourseReminders.ts`, `lib/courseReminders.ts`). Snooze/dismiss state must mutate through the sync-wired path and surface consistently across devices.
- **Notifications** render via `Notifications.tsx` / `NotificationCenter.tsx` backed by `useNotificationStore`. Unread count and mark-read state must sync with LWW semantics.

This story is the final wiring + test pass for the P3/P4 event & notification features.

## Goals

- Every AI call site records a usage event via `aiEventTracking.ts`; events reach `syncQueue` and the `aiUsageEvents` Supabase table.
- Course reminder snooze/dismiss mutations flow through `syncableWrite`; state converges across devices via LWW.
- Notification create + mark-read operations flow through `syncableWrite`; unread count and read state converge across devices.
- Integration tests verify each of the above reaches the sync queue.

## Non-Goals (Out of Scope)

- Server-side reminder scheduling (stays client-side; no cron job / Edge Function).
- Push notification delivery (web-push, APNs, FCM) — in-app only.
- Redesigning the notification or reminder UI.
- New AI features or changes to AI provider selection.
- Aggregation/reporting on AI usage beyond what AIAnalyticsTab already does.

## Users & Value

- **Learner on multiple devices**: Dismissing a reminder on mobile should not re-surface on desktop five minutes later. Unread notification badge should match across devices.
- **Learner reviewing AI spend/usage**: `AIAnalyticsTab` needs reliable events to show accurate per-feature/token counts, and those counts should be consistent across devices.

## Scope

### In scope

1. **AI usage event coverage audit + wire-up**
   - Call sites to verify/instrument (repo-relative):
     - `src/ai/quizGenerationService.ts` (quiz generation)
     - `src/ai/courseTagger.ts` (course tagging)
     - `src/lib/aiSummary.ts` (AI summary)
     - `src/lib/autoAnalysis.ts` (auto analysis)
     - `src/lib/actionSuggestions.ts` (action suggestions)
     - `src/app/components/figma/QAChatPanel.tsx` (chat) — or the underlying service it calls
     - `src/app/components/notes/OrganizeNotesButton.tsx` (note organization)
   - For each call site, confirm an `aiEventTracking` call runs on both success and failure (failure events record `success: false` + error code; do not block the user flow).
   - Event payload minimum: `feature`, `provider`, `model`, `promptTokens`, `completionTokens`, `totalTokens`, `latencyMs`, `success`, `timestamp`.

2. **Course reminders sync**
   - Snooze and dismiss actions in `lib/courseReminders.ts` / `useCourseReminders.ts` mutate reminders through the sync-wired write path (already wired in S02 — verify).
   - Reminder scheduling remains client-side (`setTimeout` / visibility-based wake) but the `snoozedUntil`, `dismissedAt`, and status fields sync.
   - On a second device, a reminder that was dismissed on device A must not re-fire after pull.

3. **Notifications sync**
   - Notification creation (triggered by streak milestones, reminder fires, achievement unlocks, etc.) goes through `syncableWrite`.
   - Mark-read and mark-all-read mutations sync with LWW.
   - Unread count (`useNotificationStore` selector) reflects post-pull state.

4. **Integration tests**
   - Test that calling a representative AI feature enqueues an `aiUsageEvents` insert in `syncQueue`.
   - Test that snooze/dismiss on a course reminder enqueues a `courseReminders` update.
   - Test that create + mark-read on a notification enqueues `notifications` mutations.
   - Tests use existing sync test harness (pattern set in `src/lib/sync/__tests__/p3-lww-batch-b-sync.test.ts` and `p4-insert-only-sync.test.ts`).

### Explicitly deferred

- De-duplication of AI events if a retried API call emits two events (accept duplicates; `aiUsageEvents` is append-only and analytics tolerate it).
- Coalescing many "mark read" clicks into a single sync op.
- Rich notification categories / filtering UI.

## Acceptance Criteria

1. All seven AI call sites listed above emit an `aiEventTracking` event on success and failure paths; missing sites get wired in this story.
2. An integration test per table (`aiUsageEvents`, `courseReminders`, `notifications`) asserts the mutation lands in `syncQueue` after the user-facing action.
3. Two-device manual trace (or simulated test) confirms:
   - Dismissed reminder stays dismissed after pull.
   - Read notification stays read after pull; unread count matches.
4. No regression in `AIAnalyticsTab` — it continues to render events.
5. `aiEventTracking` failures never throw into the user-facing AI flow (wrap in try/catch, log via `errorTracking`).
6. Unit/integration test suites pass; E2E smoke + any touched spec stays green.

## Key Decisions (autopilot defaults)

- **AI event emission:** fire-and-forget (non-blocking) with internal try/catch. An event failure must never break the AI feature itself.
- **Failure events:** emit a best-effort event with `success: false` even if the AI call throws, so usage dashboards reflect real failure rates.
- **Reminder scheduling:** stays in-process; if the tab is closed when a reminder would fire, it fires on next open (existing behavior).
- **Notification creation origin:** client-side only (no server triggers in this story). Cross-device notifications arrive via the normal pull cycle.
- **LWW conflict:** last writer wins on `updatedAt` for reminders and notifications (matches E96-S02 contract).

## Risks & Open Questions

- **Risk:** Some AI call sites may already emit events; audit must avoid double-emitting. Mitigation: grep each call site for existing `trackAIEvent` / `aiEventTracking` use before adding calls.
- **Risk:** Dexie `syncableWrite` wrapping may have been missed on a specific branch (e.g., `markAllRead`). Mitigation: tests explicitly assert queue entries, not just DB state.
- **Open question:** Should dismissed reminders be garbage-collected eventually? Deferred — out of scope for S03.
- **Open question:** Cap on `aiUsageEvents` retention? Deferred — handled by later data-pruning story.

## Handoff Notes for Planning

Planning should produce tasks for:
1. Call-site audit table (per file: "already instrumented?" / "needs instrumentation") with a small code change per row.
2. Verification pass on `courseReminders` write paths — confirm all mutation functions use the sync-wired store method.
3. Integration test trio (one per table) following existing sync test harness.
4. Manual two-device smoke or deterministic multi-client sim in tests.

Implementation should prefer extending existing modules over introducing new ones; no new schemas, no new endpoints — tables already exist.
