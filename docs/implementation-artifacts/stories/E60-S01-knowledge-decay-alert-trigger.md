---
story_id: E60-S01
story_name: "Knowledge Decay Alert Trigger"
status: in-progress
started: 2026-04-03
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 60.1: Knowledge Decay Alert Trigger

## Story

As a learner,
I want to receive a notification when my retention for a topic drops below a safe threshold,
So that I can review weakening topics before the knowledge is lost.

## Acceptance Criteria

**AC1: Event type and type system updates**
**Given** the event bus has no `knowledge:decay` event type
**When** the developer adds the new event type to `AppEvent` union in `eventBus.ts`
**Then** the TypeScript compiler accepts `{ type: 'knowledge:decay', topic: string, retention: number, dueCount: number }` as a valid event
**And** the `NotificationType` union includes `'knowledge-decay'`
**And** the `NotificationPreferences` interface includes `knowledgeDecay: boolean` (default `true`)
**And** the Dexie schema is bumped with a migration that adds the new preference field to existing rows

**AC2: Startup decay check emits event and creates notification**
**Given** the app starts with notes where topic "React Hooks" has average retention of 35% (below 50% threshold)
**When** `checkKnowledgeDecayOnStartup()` runs
**Then** a `knowledge:decay` event is emitted with `{ topic: 'React Hooks', retention: 35, dueCount: N }`
**And** a notification is created with title "Knowledge Fading: React Hooks", a message about 35% retention, and actionUrl to the review page

**AC3: Dedup prevents duplicate notification same day**
**Given** a `knowledge:decay` notification was already created today for topic "React Hooks"
**When** another decay check runs for the same topic on the same day
**Then** no duplicate notification is created (dedup by type + metadata.topic + date)

**AC4: Preference suppression**
**Given** a user has disabled `knowledge-decay` notifications in preferences
**When** a `knowledge:decay` event fires
**Then** no notification is created

**AC5: Quiet hours suppression**
**Given** quiet hours are active (e.g., 22:00-07:00) and current time is 23:00
**When** `checkKnowledgeDecayOnStartup()` would fire a decay event
**Then** no notification is created (existing quiet hours logic applies)

**AC6: Empty data edge case**
**Given** a fresh install with no notes or review records
**When** `checkKnowledgeDecayOnStartup()` runs
**Then** no events are emitted and no errors are thrown

## Tasks / Subtasks

- [ ] Task 1: Add `knowledge:decay` event type to `AppEvent` union (AC: 1)
  - [ ] 1.1 Add `| { type: 'knowledge:decay'; topic: string; retention: number; dueCount: number }` to `AppEvent` in `src/lib/eventBus.ts`

- [ ] Task 2: Add `knowledge-decay` to `NotificationType` union (AC: 1)
  - [ ] 2.1 Add `| 'knowledge-decay'` to `NotificationType` in `src/data/types.ts`

- [ ] Task 3: Add `knowledgeDecay` field to `NotificationPreferences` interface (AC: 1)
  - [ ] 3.1 Add `knowledgeDecay: boolean` to `NotificationPreferences` in `src/data/types.ts`

- [ ] Task 4: Bump Dexie schema version with migration (AC: 1)
  - [ ] 4.1 Add new version (v32) in `src/db/schema.ts` with upgrade that sets `knowledgeDecay: true` on existing `notificationPreferences` rows
  - [ ] 4.2 Update `src/db/checkpoint.ts` -- do NOT bump `CHECKPOINT_VERSION`, only add the new version after the checkpoint gate in schema.ts

- [ ] Task 5: Wire preference store with new type (AC: 4)
  - [ ] 5.1 Add `'knowledge-decay': 'knowledgeDecay'` to `TYPE_TO_FIELD` in `src/stores/useNotificationPrefsStore.ts`
  - [ ] 5.2 Add `knowledgeDecay: true` to `DEFAULTS`

- [ ] Task 6: Add `EVENT_TO_NOTIF_TYPE` mapping + `handleEvent` case (AC: 2, 4, 5)
  - [ ] 6.1 Add `'knowledge:decay': 'knowledge-decay'` to `EVENT_TO_NOTIF_TYPE` in `src/services/NotificationService.ts`
  - [ ] 6.2 Add `case 'knowledge:decay'` to `handleEvent()` switch -- create notification with title `"Knowledge Fading: ${event.topic}"`, message about retention %, actionUrl `/review`
  - [ ] 6.3 Register `'knowledge:decay'` in `initNotificationService()` eventTypes array

- [ ] Task 7: Add dedup function `hasKnowledgeDecayToday(topic)` (AC: 3)
  - [ ] 7.1 Create `hasKnowledgeDecayToday(topic: string): Promise<boolean>` in NotificationService -- query `db.notifications.where('type').equals('knowledge-decay').filter(n => metadata.topic === topic && sameDay)`
  - [ ] 7.2 Call dedup check in the `knowledge:decay` case before creating notification

- [ ] Task 8: Create `checkKnowledgeDecayOnStartup()` function (AC: 2, 5, 6)
  - [ ] 8.1 Export `checkKnowledgeDecayOnStartup()` from NotificationService
  - [ ] 8.2 Load all notes + reviewRecords from Dexie, call `getTopicRetention()` from `retentionMetrics.ts`, emit `knowledge:decay` for each topic with `retention < DECAY_THRESHOLD` (50%)
  - [ ] 8.3 Define `DECAY_THRESHOLD = 50` constant at module level (export for tests)
  - [ ] 8.4 Call from `initNotificationService()` after existing `checkSrsDueOnStartup()` with same fire-and-forget + catch pattern

## Implementation Plan

See [plan](plans/plan-e60-s01-knowledge-decay-alert-trigger.md) for implementation approach.

### Architecture Compliance

**Event Bus Pattern**: Add variant to `AppEvent` union in `src/lib/eventBus.ts` (line ~13). Follow existing naming convention `namespace:action` (e.g., `knowledge:decay`).

**NotificationService Pattern**: Follow exact patterns from existing handlers:
- `EVENT_TO_NOTIF_TYPE` maps event type to notification type (line ~94)
- `handleEvent()` switch case creates notification via `useNotificationStore.getState().create()` (line ~104)
- Dedup functions follow `hasReviewDueToday()` pattern: query `db.notifications.where('type').equals(...)` with `.filter()` on date + metadata key
- Startup check follows `checkSrsDueOnStartup()` pattern: async, fire-and-forget, catch + console.error

**Retention Metrics**: Use `getTopicRetention()` from `src/lib/retentionMetrics.ts` (line ~66). It accepts `(notes, reviews, now)` and returns `TopicRetention[]` with `retention` percentage and `dueCount`. The `FADING_THRESHOLD = 50` constant is already defined there but not exported -- define `DECAY_THRESHOLD = 50` in NotificationService (matching the same value).

**Preference Store**: Add to `TYPE_TO_FIELD` map in `src/stores/useNotificationPrefsStore.ts` (line ~8). `isTypeEnabled()` will automatically work once mapping is added.

**Dexie Schema**: Current checkpoint is v29 (`src/db/checkpoint.ts`). Add v30 in `src/db/schema.ts` after the checkpoint gate. Migration must iterate `notificationPreferences` table and add `knowledgeDecay: true` to existing rows. Do NOT update CHECKPOINT_VERSION -- that only changes when cutting a new checkpoint.

### Key Files to Modify

| File | Change |
|------|--------|
| `src/lib/eventBus.ts` | Add `knowledge:decay` to `AppEvent` union |
| `src/data/types.ts` | Add `'knowledge-decay'` to `NotificationType`, `knowledgeDecay: boolean` to `NotificationPreferences` |
| `src/db/schema.ts` | Add v30 migration for new preference field |
| `src/stores/useNotificationPrefsStore.ts` | Add `TYPE_TO_FIELD` entry + DEFAULTS |
| `src/services/NotificationService.ts` | Add handler, dedup, startup check, EVENT_TO_NOTIF_TYPE entry |

### Critical Guardrails

- **Do NOT modify `src/db/checkpoint.ts`** -- checkpoint stays at v29; only add v30 in schema.ts
- **Use `toLocaleDateString('sv-SE')` for date comparison** in dedup (not `toISOString().split('T')[0]`) -- this is the project-wide pattern
- **Pass `new Date()` as `now` parameter** to `getTopicRetention()` -- the function requires it for deterministic testing
- **Dedup must filter on `metadata.topic`** not just type -- one decay notification per topic per day is allowed
- **Import `getTopicRetention` from `@/lib/retentionMetrics`** -- do not reimplement retention calculation
- **The `knowledge:decay` event handler must check dedup BEFORE creating notification** (same as `review:due` pattern)
- **Quiet hours suppression is automatic** -- `handleEvent()` already checks `prefsStore.isInQuietHours()` at the top

### Notification Shape

```typescript
await store.create({
  type: 'knowledge-decay',
  title: `Knowledge Fading: ${event.topic}`,
  message: `Your retention for "${event.topic}" has dropped to ${event.retention}%. Review now to strengthen your memory.`,
  actionUrl: '/review',
  metadata: { topic: event.topic, retention: event.retention },
})
```

## Testing Notes

Testing for this story is covered by E60-S05. However, during implementation verify:
- TypeScript compiles with no errors (`npx tsc --noEmit`)
- Build succeeds (`npm run build`)
- Existing tests still pass (`npm run test:unit`)

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [ ] All changes committed (`git status` clean)
- [ ] No error swallowing -- catch blocks log AND surface errors
- [ ] useEffect hooks have cleanup functions (ignore flags for async, event listener removal)
- [ ] No optimistic UI updates before persistence -- state updates after DB write succeeds
- [ ] Type guards on all dynamic lookups (e.g., `LABELS[type]` when type can be empty)
- [ ] E2E afterEach cleanup uses `await` (not fire-and-forget)
- [ ] Date handling uses `toLocaleDateString('sv-SE')` pattern (not `toISOString().split('T')[0]`)
- [ ] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference

## Design Review Feedback

[Populated by /review-story -- Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story -- adversarial code review findings]

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]
