---
story_id: E60-S03
story_name: "Milestone Approaching Trigger"
status: done
started: 2026-04-04
completed: 2026-04-04
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 60.3: Milestone Approaching Trigger

## Story

As a learner,
I want to be notified when I am close to finishing a course,
So that I am motivated to complete the final lessons.

## Acceptance Criteria

**AC1: Event type and type system updates**
**Given** the event bus has no `milestone:approaching` event type
**When** the developer adds the new event type to `AppEvent` union
**Then** the TypeScript compiler accepts `{ type: 'milestone:approaching', courseId: string, courseName: string, remainingLessons: number, totalLessons: number }` as a valid event
**And** the `NotificationType` union includes `'milestone-approaching'`
**And** the `NotificationPreferences` interface includes `milestoneApproaching: boolean` (default `true`)

**AC2: Real-time trigger on lesson completion at threshold**
**Given** a course "Advanced TypeScript" has 10 total lessons and 8 are completed
**When** the user marks the 8th lesson as complete (2 remaining, at threshold)
**Then** a `milestone:approaching` event is emitted with `{ courseId, courseName: 'Advanced TypeScript', remainingLessons: 2, totalLessons: 10 }`
**And** a notification is created with title "Almost There!", message "Just 2 lessons left in Advanced TypeScript. Keep going!", and actionUrl to the course page

**AC3: No notification when above threshold**
**Given** a course has 10 total lessons and 5 are completed
**When** the user marks the 5th lesson as complete (5 remaining, above threshold)
**Then** no milestone notification is created

**AC4: No notification when course completed (0 remaining)**
**Given** a course has 10 total lessons and 10 are completed
**When** the last lesson is marked complete (0 remaining)
**Then** no milestone notification is created (0 remaining is not > 0; `course:completed` handles this case)

**AC5: Startup check for in-progress courses near completion**
**Given** the app starts with an in-progress course that has 1 lesson remaining
**When** `checkMilestoneApproachingOnStartup()` runs
**Then** a `milestone:approaching` event is emitted for that course

**AC6: Dedup prevents duplicate notification same day**
**Given** a `milestone:approaching` notification was already created today for courseId "advanced-ts"
**When** another milestone check runs for the same course on the same day
**Then** no duplicate notification is created

## Tasks / Subtasks

- [x] Task 1: Add `milestone:approaching` event type to `AppEvent` union (AC: 1)
  - [x] 1.1 Add `| { type: 'milestone:approaching'; courseId: string; courseName: string; remainingLessons: number; totalLessons: number }` to `AppEvent` in `src/lib/eventBus.ts`

- [x] Task 2: Add `milestone-approaching` to `NotificationType` union (AC: 1)
  - [x] 2.1 Add `| 'milestone-approaching'` to `NotificationType` in `src/data/types.ts`

- [x] Task 3: Add `milestoneApproaching` field to `NotificationPreferences` interface (AC: 1)
  - [x] 3.1 Add `milestoneApproaching: boolean` to `NotificationPreferences` in `src/data/types.ts`

- [x] Task 4: Update Dexie schema migration (AC: 1)
  - [x] 4.1 Coordinate with S01/S02 migration. Best approach: single v30 migration that adds all three preference fields (`knowledgeDecay`, `recommendationMatch`, `milestoneApproaching`) in one upgrade.

- [x] Task 5: Wire preference store with new type (AC: 1)
  - [x] 5.1 Add `'milestone-approaching': 'milestoneApproaching'` to `TYPE_TO_FIELD` in `src/stores/useNotificationPrefsStore.ts`
  - [x] 5.2 Add `milestoneApproaching: true` to `DEFAULTS`

- [x] Task 6: Add `EVENT_TO_NOTIF_TYPE` mapping + `handleEvent` case (AC: 2)
  - [x] 6.1 Add `'milestone:approaching': 'milestone-approaching'` to `EVENT_TO_NOTIF_TYPE`
  - [x] 6.2 Add `case 'milestone:approaching'` to `handleEvent()` switch
  - [x] 6.3 Register `'milestone:approaching'` in `initNotificationService()` eventTypes array

- [x] Task 7: Add dedup function `hasMilestoneApproachingToday(courseId)` (AC: 6)
  - [x] 7.1 Create `hasMilestoneApproachingToday(courseId: string): Promise<boolean>` in NotificationService
  - [x] 7.2 Call dedup check in the `milestone:approaching` case before creating notification

- [x] Task 8: Create `checkMilestoneApproachingOnStartup()` function (AC: 5)
  - [x] 8.1 Export `checkMilestoneApproachingOnStartup()` from NotificationService
  - [x] 8.2 Load all imported courses from `db.importedCourses`, load `db.contentProgress` for each, count total lessons vs completed lessons across all modules
  - [x] 8.3 For each course where `0 < remainingLessons <= MILESTONE_THRESHOLD`, emit `milestone:approaching` event
  - [x] 8.4 Define `export const MILESTONE_THRESHOLD = 2` at module level
  - [x] 8.5 Call from `initNotificationService()` after `checkKnowledgeDecayOnStartup()` with same fire-and-forget + catch pattern

- [x] Task 9: Add real-time milestone check in content progress store (AC: 2, 3, 4)
  - [x] 9.1 In `src/stores/useContentProgressStore.ts`, in `setItemStatus()`, after a lesson is marked `completed` and before the existing `course:completed` check:
    - Count total lessons across all modules
    - Count completed lessons (including the one just marked)
    - Calculate `remaining = total - completed`
    - If `remaining > 0 && remaining <= MILESTONE_THRESHOLD`, emit `milestone:approaching` event
  - [x] 9.2 Import `MILESTONE_THRESHOLD` from NotificationService (or define locally as 2)
  - [x] 9.3 Only emit when transitioning TO `completed` status (not when marking incomplete)

## Implementation Notes

### Architecture Compliance

This story has two trigger points unlike S01 and S02:
1. **Startup check** -- `checkMilestoneApproachingOnStartup()` scans all in-progress courses
2. **Real-time check** -- hooks into `useContentProgressStore.setItemStatus()` after each lesson completion

**Content Progress Store Integration** (`src/stores/useContentProgressStore.ts`):
- `setItemStatus()` already emits `course:completed` when all modules are complete (around line 134-142)
- The milestone check must go BEFORE the `course:completed` check
- Only trigger for `status === 'completed'` transitions (not incomplete/in-progress)
- The store has access to `modules: Module[]` parameter which provides total lesson count

**Lesson Counting Logic**:
```typescript
// Count total lessons across all modules
const totalLessons = modules.reduce((sum, m) => sum + m.lessons.length, 0)
// Count completed lessons from statusMap (after current update)
const completedLessons = modules.reduce((sum, m) =>
  sum + m.lessons.filter(l => updatedStatusMap[`${courseId}:${l.id}`] === 'completed').length, 0)
const remaining = totalLessons - completedLessons
```

### Key Files to Modify

| File | Change |
|------|--------|
| `src/lib/eventBus.ts` | Add `milestone:approaching` to `AppEvent` union |
| `src/data/types.ts` | Add `'milestone-approaching'` to `NotificationType`, `milestoneApproaching: boolean` to `NotificationPreferences` |
| `src/db/schema.ts` | Extend migration for new preference field |
| `src/stores/useNotificationPrefsStore.ts` | Add `TYPE_TO_FIELD` entry + DEFAULTS |
| `src/services/NotificationService.ts` | Add handler, dedup, startup check, EVENT_TO_NOTIF_TYPE entry, export MILESTONE_THRESHOLD |
| `src/stores/useContentProgressStore.ts` | Add real-time milestone check in `setItemStatus()` |

### Critical Guardrails

- **remaining must be > 0** -- when remaining is 0, the `course:completed` event handles it; do not emit both
- **Milestone check goes BEFORE `course:completed` check** in `setItemStatus()` -- if course is fully complete, remaining is 0, so milestone won't fire (by the > 0 guard)
- **Only on `completed` transitions** -- don't trigger when status changes to `in-progress` or back to incomplete
- **Startup check must resolve course name** from `db.importedCourses` -- the `courseName` field is required on the event payload
- **Dedup filters on `metadata.courseId`** -- one milestone notification per course per day
- **Import `appEventBus` in content progress store** -- it is already imported there for `course:completed`

### Notification Shape

```typescript
await store.create({
  type: 'milestone-approaching',
  title: 'Almost There!',
  message: `Just ${event.remainingLessons} lesson${event.remainingLessons === 1 ? '' : 's'} left in ${event.courseName}. Keep going!`,
  actionUrl: `/courses/${event.courseId}`,
  metadata: { courseId: event.courseId, remainingLessons: event.remainingLessons, totalLessons: event.totalLessons },
})
```

### Previous Story Intelligence

Builds on patterns from E60-S01 (dedup, handler, type wiring) and E60-S02 (courseId-based dedup). The `useContentProgressStore` integration is the unique challenge -- study how `course:completed` is emitted for the exact insertion point.

## Testing Notes

Testing for this story is covered by E60-S05. During implementation verify:
- TypeScript compiles with no errors (`npx tsc --noEmit`)
- Build succeeds (`npm run build`)
- Existing tests still pass (`npm run test:unit`)
- Manually test: mark lessons complete in a course with 2 remaining, verify milestone notification appears

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [ ] All changes committed (`git status` clean)
- [ ] No error swallowing -- catch blocks log AND surface errors
- [ ] Milestone check only fires for `completed` status transitions
- [ ] Remaining > 0 guard prevents overlap with `course:completed`
- [ ] Date handling uses `toLocaleDateString('sv-SE')` pattern
- [ ] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference

## Design Review Feedback

[Populated by /review-story -- Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story -- adversarial code review findings]

## Challenges and Lessons Learned

- `ImportedCourse` type lacks a `modules` field — used `importedVideos` and `importedPdfs` tables to count lessons per course in the startup scan, while the real-time check uses the `modules` parameter already present in `setItemStatus`.
- Milestone check must sit outside the progress try/catch (or in its own nested try/catch) — if it throws it should not roll back lesson completion, which is the primary operation.
- Daily per-course dedup (`hasMilestoneApproachingToday`) filters on `metadata.courseId` + same-day `createdAt`; prevents duplicate notifications when startup check and real-time trigger both fire on the same day.
- The `remaining > 0` guard is essential: when all lessons are complete `remaining` is 0, so the milestone event is correctly suppressed and only `course:completed` fires.
