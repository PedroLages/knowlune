---
story_id: E43-S07
story_name: "Notifications Data Layer — Triggers and Wiring"
status: in-progress
started: 2026-03-28
completed:
reviewed: in-progress
review_started: 2026-03-28
review_gates_passed: [build, lint, type-check, format-check, unit-tests, e2e-tests, code-review, code-review-testing, security-review, design-review-skipped, performance-benchmark-skipped, exploratory-qa-skipped]
review_scope: full
burn_in_validated: false
---

# Story 43.7: Notifications Data Layer — Triggers and Wiring

## Story

As a learner,
I want real notifications from app events replacing the hardcoded mock data,
so that my notification bell shows meaningful, actionable alerts.

## Acceptance Criteria

**Given** I complete the last lesson in a course
**When** `contentProgress` marks the final item as completed
**Then** a `course-complete` notification is created with the course name and a link to the course page

**Given** I reach a streak milestone (7, 14, 30, 60, 100, 365 days)
**When** the session store records a new study session extending the streak
**Then** a `streak-milestone` notification is created with the streak day count

**Given** a course import finishes (file or YouTube)
**When** the import pipeline completes successfully
**Then** an `import-finished` notification is created with the course name and lesson count

**Given** I unlock an achievement (challenge badge criteria met)
**When** the challenges store registers a completed challenge
**Then** an `achievement-unlocked` notification is created with the achievement name

**Given** flashcards are due for review (nextReviewDate <= today)
**When** the app starts up (or on a periodic check)
**Then** a `review-due` notification is created with the count of due cards
**And** deduplication prevents multiple `review-due` notifications on the same day

**Given** `NotificationCenter.tsx` renders
**When** the component mounts
**Then** it reads from `useNotificationStore` instead of `createMockNotifications()`
**And** the unread badge count reflects real unread notifications
**And** "Mark all as read" calls `useNotificationStore.getState().markAllRead()`

**Given** a notification with an `actionUrl` is clicked
**When** the user clicks the notification item
**Then** the popover closes and the user is navigated to the `actionUrl`

## Tasks / Subtasks

- [ ] Task 1: Create typed event bus (AC: 1, 2, 3, 4, 5)
  - [ ] 1.1 Create `src/lib/eventBus.ts` (~60 lines) — typed EventEmitter, no external dependency
  - [ ] 1.2 Define `AppEvent` union type:
    ```typescript
    type AppEvent =
      | { type: 'course:completed'; courseId: string; courseName: string }
      | { type: 'streak:milestone'; days: number }
      | { type: 'import:finished'; courseId: string; courseName: string; lessonCount: number }
      | { type: 'achievement:unlocked'; achievementId: string; achievementName: string }
      | { type: 'review:due'; dueCount: number }
    ```
  - [ ] 1.3 Export singleton `appEventBus` with `emit()`, `on()`, `off()` methods
- [ ] Task 2: Create NotificationService (AC: 1, 2, 3, 4, 5)
  - [ ] 2.1 Create `src/services/NotificationService.ts`
  - [ ] 2.2 Subscribe to event bus events, map domain events to `useNotificationStore.getState().create()` calls
  - [ ] 2.3 Implement `review-due` deduplication: check if already created today before creating another
  - [ ] 2.4 Hardcode streak milestone thresholds: `[7, 14, 30, 60, 100, 365]`
  - [ ] 2.5 Export `initNotificationService()` and `destroyNotificationService()` for lifecycle management
- [ ] Task 3: Emit events from existing stores (AC: 1, 2, 3, 4, 5)
  - [ ] 3.1 `src/stores/useContentProgressStore.ts` — emit `course:completed` when last lesson completed
  - [ ] 3.2 `src/stores/useSessionStore.ts` — emit `streak:milestone` when streak hits threshold
  - [ ] 3.3 `src/stores/useCourseImportStore.ts` — emit `import:finished` on successful import completion
  - [ ] 3.4 `src/stores/useChallengeStore.ts` — emit `achievement:unlocked` on challenge completion
  - [ ] 3.5 `src/stores/useReviewStore.ts` — emit `review:due` on startup check
  - [ ] 3.6 Each store change: ~2-5 lines (import eventBus + emit call at the right point)
- [ ] Task 4: Wire NotificationCenter.tsx to real data (AC: 6, 7)
  - [ ] 4.1 Remove `createMockNotifications()` (currently at line 67-121)
  - [ ] 4.2 Replace `useState(createMockNotifications)` with `useNotificationStore()` selectors
  - [ ] 4.3 Wire `markRead`, `markAllRead`, `dismiss` actions to store methods
  - [ ] 4.4 Update unread badge count to use `useNotificationStore` `unreadCount`
  - [ ] 4.5 Add click-to-navigate for notifications with `actionUrl` (close popover, navigate)
- [ ] Task 5: Initialize NotificationService on app mount (AC: all)
  - [ ] 5.1 Call `initNotificationService()` from `App.tsx` or `Layout.tsx` on mount
  - [ ] 5.2 Call `destroyNotificationService()` on unmount (cleanup subscriptions)
- [ ] Task 6: Unit tests (AC: all)
  - [ ] 6.1 Test event bus: emit -> subscriber receives typed event
  - [ ] 6.2 Test NotificationService: each event type creates correct notification
  - [ ] 6.3 Test `review-due` deduplication: only one per day
  - [ ] 6.4 Test streak milestone: only fires for threshold values
  - [ ] 6.5 Test NotificationCenter reads from store instead of mock data
  - [ ] 6.6 Test click-to-navigate closes popover and routes to `actionUrl`

## Implementation Notes

- **Depends on:** E43-S06 (notification store must exist before wiring triggers)
- **Event bus is synchronous and typed** — no external dependencies (NFR-4)
- **NotificationCenter.tsx** at `src/app/components/figma/NotificationCenter.tsx` has full UI with mock data at line 67 — replace data source only, not UI
- **Minimal store changes:** Each store emits 1 event at the right point (~2-5 lines per store)
- **Key files to modify:**
  - `src/lib/eventBus.ts` (new)
  - `src/services/NotificationService.ts` (new)
  - `src/stores/useContentProgressStore.ts` (add emit)
  - `src/stores/useSessionStore.ts` (add emit)
  - `src/stores/useCourseImportStore.ts` (add emit)
  - `src/stores/useChallengeStore.ts` (add emit)
  - `src/stores/useReviewStore.ts` (add emit)
  - `src/app/components/figma/NotificationCenter.tsx` (replace mock data)
  - `App.tsx` or `Layout.tsx` (initialize service)
- **Deduplication for `review-due`:** Check if a `review-due` notification was already created today before creating another (query by type + createdAt date)

## Testing Notes

- Unit test event bus in isolation (typed emit/subscribe/unsubscribe)
- Unit test NotificationService with mock event bus and mock store
- Unit test NotificationCenter component renders from store state
- E2E test: import a course and verify notification appears (if feasible)
- Verify no console errors from removed mock data references

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
- [ ] If story calls external APIs: CSP allowlist configured (see engineering-patterns.md CSP Configuration)

## Design Review Feedback

- NotificationCenter UI unchanged structurally -- only data source replaced (mock -> store)
- Icon mapping updated to match new NotificationType enum (GraduationCap, Flame, Download, Trophy, Clock)
- Fallback icon/color for unknown types is defensive but harmless
- Click-to-navigate properly closes popover before routing
- Accessibility: aria-live region preserved for screen reader announcements

## Code Review Feedback

- **H1:** Streak milestone emitted for every positive streak, not just thresholds -- filter should be in store
- **H2:** Date dedup in `hasReviewDueToday()` uses ISO string comparison which is fragile across timezones
- **M1:** `getCurrentStreak()` is synchronous localStorage read in async chain -- acceptable but worth noting
- **M2:** Module-level mutable state in NotificationService -- works but fragile for testing
- **M3:** `console.log` in production code (NotificationService init) should be `console.debug`
- **M4:** Record type + fallback is redundant but harmless
- **TESTING:** 0/7 ACs have test coverage -- Task 6 unit tests were not implemented

## Challenges and Lessons Learned

- **Event bus pattern works well for decoupling stores from notification logic.** Each store emits a single domain event at the right point (2-5 lines per store), and the NotificationService maps events to notifications independently. This keeps stores focused on their domain and avoids circular dependencies.

- **Deduplication for review-due requires careful date handling.** The `hasReviewDueToday()` function queries Dexie by type and date, but ISO string comparison for "today" boundaries is fragile. The `toLocaleDateString('sv-SE')` pattern from engineering-patterns.md would be more reliable for day-boundary comparisons.

- **Streak milestone filtering is split across two layers.** The store emits for any positive streak, and the service filters for milestone values. This creates unnecessary event traffic and could confuse future subscribers. Better pattern: emit only at thresholds, keeping the event semantically meaningful.

- **Mock data removal was clean because the UI was well-separated from data.** The NotificationCenter component had its data source isolated in `createMockNotifications()`, making the swap to `useNotificationStore` straightforward. Good separation of concerns in the original Figma component.

- **No tests were written despite Task 6 being defined.** The unit test subtasks (6.1-6.6) were planned but not implemented. This is a significant gap given the story introduces new infrastructure (event bus, notification service) that should be tested in isolation.
