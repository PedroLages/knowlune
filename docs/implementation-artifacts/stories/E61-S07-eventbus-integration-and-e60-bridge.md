---
story_id: E61-S07
story_name: "EventBus Integration and E60 Bridge"
status: ready-for-dev
started:
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 61.7: EventBus Integration and E60 Bridge

## Story

As a learner,
I want push notifications triggered by the same events that create in-app notifications,
so that I get consistent alerts across both channels.

## Acceptance Criteria

**Given** the NotificationService creates an in-app notification via `useNotificationStore.create()`
**When** the notification is persisted to IndexedDB
**And** Supabase sync is active (E44-E49)
**Then** the notification is synced to the Supabase `notifications` table
**And** the database webhook triggers the `push-notification` Edge Function

**Given** a `course:completed` event is emitted on the EventBus
**When** the NotificationService handles it
**Then** an in-app notification is created (existing behavior)
**And** when synced, a push notification is delivered with title "Course Completed!" and a deep link to the course page

**Given** a `streak:milestone` event is emitted for a milestone threshold (7, 14, 30, 60, 100, 365 days)
**When** the NotificationService handles it
**Then** a push notification is delivered with the streak count and encouragement message

**Given** an `srs:due` event is emitted
**When** the NotificationService handles it
**And** no SRS due notification has been sent today (dedup check)
**Then** a push notification is delivered with the due count and a deep link to `/flashcards`

**Given** the user has disabled a specific notification type (e.g., `streakMilestone: false`)
**When** an event of that type is emitted
**Then** neither an in-app notification nor a push notification is created for that type

**Given** the user is within quiet hours
**When** any notification event is emitted
**Then** neither in-app nor push notifications are created (existing behavior maintained)

**Given** push notifications are not available (permission denied or unsupported)
**When** any notification event is emitted
**Then** the in-app notification is still created normally
**And** no push dispatch is attempted
**And** no errors are logged

## Tasks / Subtasks

- [ ] Task 1: Verify `actionUrl` is included in notification data (AC: 1, 2, 3, 4)
  - [ ] 1.1 Audit `NotificationService.ts` event handlers for each event type
  - [ ] 1.2 Ensure `actionUrl` field is populated in each `useNotificationStore.create()` call:
    - `course:completed` -> `/courses/{courseId}`
    - `streak:milestone` -> `/` (Overview)
    - `import:finished` -> `/courses/{courseId}`
    - `achievement:unlocked` -> `/` (Overview)
    - `review:due` -> `/flashcards`
    - `srs:due` -> `/flashcards`
  - [ ] 1.3 If `actionUrl` is missing from any handler, add it
- [ ] Task 2: Verify notification metadata for push payload mapping (AC: 2, 3, 4)
  - [ ] 2.1 Confirm each notification's `title` and `message` are suitable for browser push display
  - [ ] 2.2 Confirm `type` field maps to push payload `tag` for notification dedup
  - [ ] 2.3 Ensure no notification title/message is too long for push (keep under 120 chars for body)
- [ ] Task 3: Validate type-level suppression (AC: 5)
  - [ ] 3.1 Verify existing `useNotificationPrefsStore` checks in NotificationService
  - [ ] 3.2 Confirm that when a type toggle is false, no notification row is created in Dexie
  - [ ] 3.3 This means no row syncs to Supabase, so no push is dispatched — correct behavior
- [ ] Task 4: Validate quiet hours suppression (AC: 6)
  - [ ] 4.1 Verify existing quiet hours check in NotificationService
  - [ ] 4.2 Confirm client-side quiet hours prevent notification creation (not just display)
  - [ ] 4.3 Edge Function also checks quiet hours (S05) as a server-side guard — dual protection
- [ ] Task 5: Validate graceful degradation (AC: 7)
  - [ ] 5.1 Confirm NotificationService does NOT import or call `pushManager.ts` directly
  - [ ] 5.2 Push dispatch happens entirely server-side via DB webhook — no client-side push sending
  - [ ] 5.3 If push permission is denied, in-app notifications still work normally
  - [ ] 5.4 If Supabase sync is not active yet, in-app notifications still work (no regression)
- [ ] Task 6: Add `actionUrl` to Notification interface if missing
  - [ ] 6.1 Check `src/data/types.ts` Notification interface — `actionUrl` already exists as optional field
  - [ ] 6.2 Ensure Dexie schema includes `actionUrl` in the notifications table
  - [ ] 6.3 Ensure Supabase `notifications` table schema includes `action_url` column
- [ ] Task 7: Document Supabase sync integration points
  - [ ] 7.1 If E44-E49 (Supabase sync) is not complete: document integration points as TODO comments
  - [ ] 7.2 Add comments in NotificationService.ts explaining the push delivery path
  - [ ] 7.3 Create stub/placeholder code if sync infrastructure doesn't exist yet
- [ ] Task 8: End-to-end flow validation tests
  - [ ] 8.1 Unit test: `course:completed` event creates notification with correct `actionUrl`
  - [ ] 8.2 Unit test: `streak:milestone` event creates notification with correct title/message
  - [ ] 8.3 Unit test: `srs:due` event respects daily dedup check
  - [ ] 8.4 Unit test: disabled notification type prevents creation
  - [ ] 8.5 Unit test: quiet hours prevent notification creation
  - [ ] 8.6 Integration test (if Supabase sync available): event -> Dexie -> Supabase -> webhook -> Edge Function -> push delivery

## Design Guidance

No UI components in this story. This is an integration/validation story.

## Implementation Notes

### Architecture Compliance (from ADR-4)

- **Push dispatch is server-side only** — the client (NotificationService) creates notifications in Dexie, the Supabase sync (E44-E49) copies them to the server, and the database webhook triggers the Edge Function
- **No changes needed to EventBus or event handling logic** — the existing event-to-notification mapping is preserved
- **The "bridge" is implicit:** notification stored in Dexie -> synced to Supabase -> webhook -> Edge Function -> push
- **NotificationService does NOT directly invoke push** — this is a clean architectural separation

### Existing Files Context

- `src/services/NotificationService.ts` — already maps EventBus events to notifications via `useNotificationStore.create()`
- `src/lib/eventBus.ts` — defines all event types: `course:completed`, `streak:milestone`, `import:finished`, `achievement:unlocked`, `review:due`, `srs:due`
- `src/data/types.ts` — `Notification` interface already has `actionUrl?: string` field
- `src/stores/useNotificationStore.ts` — Dexie-backed store for notifications
- `src/stores/useNotificationPrefsStore.ts` — per-type toggles and quiet hours

### Existing NotificationService Event Handlers

The current handlers in `NotificationService.ts`:
- `STREAK_MILESTONES = [7, 14, 30, 60, 100, 365]` — only these values trigger streak notifications
- `hasReviewDueToday()` / `hasSrsDueToday()` — daily dedup using Dexie query with `toLocaleDateString('sv-SE')` pattern
- Quiet hours check via `useNotificationPrefsStore.getState()`
- Type-level toggle check before creating any notification

### Key Technical Details

- **If Supabase sync (E44-E49) is NOT complete:** This story should still be implemented as validation/documentation work. Add TODO comments indicating where sync will bridge the gap. The existing in-app notification flow is unaffected.
- **`actionUrl` must be included** in every notification for push deep linking to work. The Edge Function reads `action_url` from the synced notification row and passes it as `url` in the push payload.
- **No performance impact** — no additional processing on the client side. Push delivery is entirely async and server-side.

### Dependencies

- Depends on S02: Service Worker handles push events and click deep linking
- Depends on S05: Edge Function exists and is triggered by webhook
- Depends on E44-E49: Supabase sync copies notifications from Dexie to Supabase (soft dependency — story can be completed as documentation/validation without sync)
- Uses existing E58 notification infrastructure (already complete)
- Uses existing E60 smart triggers via EventBus (already complete)

## Testing Notes

- Most tests are unit tests verifying NotificationService creates correct notification data
- Integration test of the full flow requires Supabase sync — mark as optional/manual if sync not ready
- Verify no regressions: existing notification tests should still pass with any changes
- Check `src/services/__tests__/NotificationService.test.ts` for existing test patterns

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [ ] All changes committed (`git status` clean)
- [ ] No error swallowing — catch blocks log AND surface errors
- [ ] useEffect hooks have cleanup functions (ignore flags for async, event listener removal)
- [ ] No optimistic UI updates before persistence — state updates after DB write succeeds
- [ ] Type guards on all dynamic lookups (e.g., `LABELS[type]` when type can be empty)
- [ ] E2E afterEach cleanup uses `await` (not fire-and-forget)
- [ ] Date handling uses `toLocaleDateString('sv-SE')` pattern (not `toISOString().split('T')[0]`)
- [ ] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference
- [ ] If story calls external APIs: CSP allowlist configured (see engineering-patterns.md CSP Configuration)

## Design Review Feedback

[Populated by /review-story — Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story — adversarial code review findings]

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]
