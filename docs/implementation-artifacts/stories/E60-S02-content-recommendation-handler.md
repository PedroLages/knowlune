---
story_id: E60-S02
story_name: "Content Recommendation Notification Handler"
status: done
started: 2026-04-04
completed: 2026-04-04
reviewed: true
review_started: 2026-04-04
review_gates_passed: [build, lint, type-check, format-check, unit-tests, e2e-tests-skipped, design-review, code-review, code-review-testing, performance-benchmark, security-review, exploratory-qa, openai-code-review-skipped, glm-code-review-skipped]
burn_in_validated: false
---

# Story 60.2: Content Recommendation Notification Handler

## Story

As a learner,
I want to be notified when the system identifies content that matches my weak areas,
So that I can discover relevant courses without manually searching.

## Acceptance Criteria

**AC1: Event type and type system updates**
**Given** the event bus has no `recommendation:match` event type
**When** the developer adds the new event type to `AppEvent` union
**Then** the TypeScript compiler accepts `{ type: 'recommendation:match', courseId: string, courseName: string, reason: string }` as a valid event
**And** the `NotificationType` union includes `'recommendation-match'`
**And** the `NotificationPreferences` interface includes `recommendationMatch: boolean` (default `true`)
**And** the preference store `TYPE_TO_FIELD` map includes the new mapping

**AC2: Event handler creates notification**
**Given** a `recommendation:match` event is emitted with courseId "react-patterns", courseName "React Design Patterns", and reason "Matches your weak area: React Hooks"
**When** the NotificationService handles it
**Then** a notification is created with title "Recommended for You", message including the reason, and actionUrl `/courses/react-patterns`

**AC3: Dedup prevents duplicate notification same day**
**Given** a `recommendation:match` notification was already created today for courseId "react-patterns"
**When** another `recommendation:match` event fires for the same courseId on the same day
**Then** no duplicate notification is created (dedup by type + metadata.courseId + date)

**AC4: Preference suppression**
**Given** a user has disabled `recommendation-match` notifications in preferences
**When** a `recommendation:match` event fires
**Then** no notification is created

## Tasks / Subtasks

- [ ] Task 1: Add `recommendation:match` event type to `AppEvent` union (AC: 1)
  - [ ] 1.1 Add `| { type: 'recommendation:match'; courseId: string; courseName: string; reason: string }` to `AppEvent` in `src/lib/eventBus.ts`

- [ ] Task 2: Add `recommendation-match` to `NotificationType` union (AC: 1)
  - [ ] 2.1 Add `| 'recommendation-match'` to `NotificationType` in `src/data/types.ts`

- [ ] Task 3: Add `recommendationMatch` field to `NotificationPreferences` interface (AC: 1)
  - [ ] 3.1 Add `recommendationMatch: boolean` to `NotificationPreferences` in `src/data/types.ts`

- [ ] Task 4: Update Dexie schema migration (AC: 1)
  - [ ] 4.1 E60-S01 used Dexie v32 for `knowledgeDecay`. Add v33 migration with upgrade that sets `recommendationMatch: true` on existing `notificationPreferences` rows.

- [ ] Task 5: Wire preference store with new type (AC: 4)
  - [ ] 5.1 Add `'recommendation-match': 'recommendationMatch'` to `TYPE_TO_FIELD` in `src/stores/useNotificationPrefsStore.ts`
  - [ ] 5.2 Add `recommendationMatch: true` to `DEFAULTS`

- [ ] Task 6: Add `EVENT_TO_NOTIF_TYPE` mapping + `handleEvent` case (AC: 2, 4)
  - [ ] 6.1 Add `'recommendation:match': 'recommendation-match'` to `EVENT_TO_NOTIF_TYPE` in `src/services/NotificationService.ts`
  - [ ] 6.2 Add `case 'recommendation:match'` to `handleEvent()` switch -- create notification with title `"Recommended for You"`, message including the reason, actionUrl `/courses/${event.courseId}`
  - [ ] 6.3 Register `'recommendation:match'` in `initNotificationService()` eventTypes array

- [ ] Task 7: Add dedup function `hasRecommendationMatchToday(courseId)` (AC: 3)
  - [ ] 7.1 Create `hasRecommendationMatchToday(courseId: string): Promise<boolean>` in NotificationService -- query `db.notifications.where('type').equals('recommendation-match').filter(n => metadata.courseId === courseId && sameDay)`
  - [ ] 7.2 Call dedup check in the `recommendation:match` case before creating notification

## Implementation Notes

### Architecture Compliance

This story is **event-consumer only** -- no emitter is created. The `recommendation:match` event will be emitted by E52's tag-based recommendation engine when implemented. This story only adds:
1. The event type on the bus
2. The notification handler
3. The preference toggle wiring
4. Dedup logic

**Follow the exact same patterns established in E60-S01** for:
- `EVENT_TO_NOTIF_TYPE` mapping
- `handleEvent()` switch case
- Dedup function (but filter on `metadata.courseId` instead of `metadata.topic`)
- Preference store wiring

### Key Files to Modify

| File | Change |
|------|--------|
| `src/lib/eventBus.ts` | Add `recommendation:match` to `AppEvent` union |
| `src/data/types.ts` | Add `'recommendation-match'` to `NotificationType`, `recommendationMatch: boolean` to `NotificationPreferences` |
| `src/db/schema.ts` | Extend or add migration for new preference field |
| `src/stores/useNotificationPrefsStore.ts` | Add `TYPE_TO_FIELD` entry + DEFAULTS |
| `src/services/NotificationService.ts` | Add handler, dedup, EVENT_TO_NOTIF_TYPE entry |

### Critical Guardrails

- **No startup check needed** -- this trigger is event-driven only (emitted by future E52 engine)
- **Dedup must filter on `metadata.courseId`** -- one recommendation notification per course per day
- **Use `toLocaleDateString('sv-SE')` for date comparison** in dedup
- **actionUrl must use `/courses/${event.courseId}`** format -- matches existing course deep-link pattern
- **E60-S01 used Dexie v32** for `knowledgeDecay`. E60-S02 should add v33 for `recommendationMatch`. E60-S03 will use v34.

### Notification Shape

```typescript
await store.create({
  type: 'recommendation-match',
  title: 'Recommended for You',
  message: `${event.courseName}: ${event.reason}`,
  actionUrl: `/courses/${event.courseId}`,
  metadata: { courseId: event.courseId, courseName: event.courseName },
})
```

### Previous Story Intelligence

E60-S01 establishes the pattern for all three triggers. Reuse the same:
- Dedup function structure (copy `hasKnowledgeDecayToday` and adjust for courseId)
- handleEvent switch case structure
- EVENT_TO_NOTIF_TYPE mapping pattern

## Implementation Plan

See [plan](plans/e60-s02-recommendation-handler.md) for implementation approach.

## Testing Notes

Testing for this story is covered by E60-S05. During implementation verify:
- TypeScript compiles with no errors (`npx tsc --noEmit`)
- Build succeeds (`npm run build`)
- Existing tests still pass (`npm run test:unit`)

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [ ] All changes committed (`git status` clean)
- [ ] No error swallowing -- catch blocks log AND surface errors
- [ ] Type guards on all dynamic lookups
- [ ] Date handling uses `toLocaleDateString('sv-SE')` pattern
- [ ] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference

## Design Review Feedback

- **BLOCKER (fixed)**: Missing `recommendation-match` toggle in `NOTIFICATION_TOGGLES` array in `NotificationPreferencesPanel.tsx`. Added `Sparkles` icon entry with label "Content Recommendations". Fix committed.
- **MEDIUM (pre-existing)**: "All" filter button 41px wide on mobile (< 44px touch target minimum).
- All existing notification toggles have proper `aria-label` + `aria-describedby`.
- Dark mode contrast passes on both Notifications and Settings pages.

## Code Review Feedback

- **Architecture**: Clean — 0 findings. Exact pattern replication from E60-S01. All type system touchpoints wired correctly.
- **Security**: 0 blockers. XSS safe (React JSX escaping), no open redirect risk (React Router internal), metadata cast uses optional chaining.
- **Performance**: No regressions. Bundle +60 bytes. FCP within natural variance.
- **Testing (advisory)**: AC2/AC3/AC4 unit tests deferred to E60-S05 per story design. v33 migration upgrade test and preference store test recommended for S05.

## Challenges and Lessons Learned

- **Dexie version sequencing is now a critical dependency chain.** E60-S01 consumed v32 for `knowledgeDecay`, so E60-S02 must use v33 for `recommendationMatch`. The story explicitly called this out in the guardrails — this is a good pattern: always note the "next available version" in story notes so the author picks it up immediately without digging through schema history.

- **Pattern reuse from E60-S01 worked exactly as intended.** The `hasRecommendationMatchToday` dedup function is structurally identical to `hasKnowledgeDecayToday` — just filtering on `metadata.courseId` instead of `metadata.topic`. Keeping these side by side in `NotificationService.ts` makes it easy to see the pattern and add future triggers consistently.

- **The event-consumer-only architecture (no emitter) simplifies implementation but complicates testing.** There's no way to exercise the `recommendation:match` handler without either mocking the event bus or waiting for E52's recommendation engine. E60-S05 will need to use direct event bus emission (`eventBus.emit(...)`) in tests rather than triggering through product logic — this is a valid pattern but worth documenting so S05 doesn't try to simulate the full recommendation pipeline.

- **`toLocaleDateString('sv-SE')` as the canonical date comparison string.** This ISO-8601-like format (`YYYY-MM-DD`) avoids locale ambiguity in dedup comparisons. It's now used in both the `knowledge-decay` and `recommendation-match` dedup functions — worth adding to `engineering-patterns.md` as the project standard for date-string comparisons in storage queries.

- **The `Notifications.tsx` change was minimal (2 lines).** The page automatically picks up the new notification type via the shared notification rendering pipeline — no conditional rendering or type-specific UI was needed. This confirms the notification system's extensibility: adding a new event type requires zero UI changes.
