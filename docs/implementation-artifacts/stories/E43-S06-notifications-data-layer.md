---
story_id: E43-S06
story_name: "Notifications Data Layer — Infrastructure"
status: in-progress
started: 2026-03-28
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 43.6: Notifications Data Layer — Infrastructure

## Story

As a developer,
I want a persistent notification storage layer with Zustand store,
so that notifications survive page refreshes and support read/dismiss state.

## Acceptance Criteria

**Given** a fresh database or an existing database at v27
**When** the app initializes
**Then** Dexie v28 migration creates the `notifications` table with indexes on `id`, `type`, `createdAt`, `readAt`, `dismissedAt`

**Given** `useNotificationStore.getState().create({ type, title, message, actionUrl?, metadata? })` is called
**When** the notification is created
**Then** a ULID `id` is generated (time-sortable, unique)
**And** `createdAt` is set to the current ISO 8601 timestamp
**And** `readAt` and `dismissedAt` are set to `null`
**And** the notification is persisted in the Dexie `notifications` table

**Given** `markRead(notificationId)` is called
**When** the update completes
**Then** `readAt` is set to the current ISO 8601 timestamp
**And** `unreadCount` in the store decreases by 1

**Given** `markAllRead()` is called
**When** the update completes
**Then** all notifications with `readAt === null` get `readAt` set to the current timestamp
**And** `unreadCount` becomes 0

**Given** `dismiss(notificationId)` is called
**When** the update completes
**Then** `dismissedAt` is set to the current ISO 8601 timestamp
**And** the notification is hidden from the visible list (but not deleted)

**Given** the app starts with 120 notifications, 30 of which are older than 30 days
**When** the startup cleanup runs
**Then** the 30 expired notifications are deleted (TTL rule)
**And** if remaining count exceeds 100, the oldest are deleted to bring count to 100 (cap rule)
**And** cleanup completes in < 50ms for typical load

## Tasks / Subtasks

- [x] Task 1: Dexie v28 migration (AC: 1)
  - [x] 1.1 Add `notifications` table to `src/db/schema.ts` with schema: `'id, type, createdAt, readAt, dismissedAt'`
  - [x] 1.2 Bump Dexie version from 27 to 28
  - [x] 1.3 Add `notifications` to sync skip-list alongside `embeddings`, `courseThumbnails`, `youtubeVideoCache`
- [x] Task 2: Update sync-architecture.md version numbering (AC: 1)
  - [x] 2.1 Update `docs/plans/sync-architecture.md` sections 4.1, 9.1, 9.3, 10, and 14
  - [x] 2.2 Shift v28->v29, v29->v30, v30->v31 in sync migration plan
- [x] Task 3: Define Notification type (AC: 2)
  - [x] 3.1 Create or add to `src/data/types.ts`:
    ```typescript
    interface Notification {
      id: string                    // ULID
      type: NotificationType
      title: string
      message: string
      createdAt: string             // ISO 8601
      readAt: string | null
      dismissedAt: string | null
      actionUrl?: string            // Deep link (e.g., '/courses/react-101')
      metadata?: Record<string, unknown>
    }
    type NotificationType = 'course-complete' | 'streak-milestone' | 'import-finished' | 'achievement-unlocked' | 'review-due'
    ```
- [x] Task 4: Create `useNotificationStore` (AC: 2, 3, 4, 5)
  - [x] 4.1 Create `src/stores/useNotificationStore.ts` — Zustand store wrapping Dexie table
  - [x] 4.2 Implement `create({ type, title, message, actionUrl?, metadata? })` — generates ULID, persists to Dexie
  - [x] 4.3 Implement `markRead(id)` — sets `readAt`, decrements `unreadCount`
  - [x] 4.4 Implement `markAllRead()` — bulk update all unread
  - [x] 4.5 Implement `dismiss(id)` — sets `dismissedAt`, hides from visible list
  - [x] 4.6 Implement `load()` — reads from Dexie, populates store state
  - [x] 4.7 Expose `notifications` (visible, non-dismissed), `unreadCount` as derived state
- [x] Task 5: Startup cleanup (AC: 6)
  - [x] 5.1 Implement TTL cleanup: delete notifications older than 30 days
  - [x] 5.2 Implement cap cleanup: if > 100 remaining, delete oldest to bring to 100
  - [x] 5.3 Run cleanup on store initialization (before `load()` populates state)
- [x] Task 6: ULID implementation (AC: 2)
  - [x] 6.1 Use `ulid` package or inline implementation for time-sortable IDs
  - [x] 6.2 Add dependency if using external package: `npm install ulid`
- [x] Task 7: Unit tests (AC: all)
  - [x] 7.1 Test `create()` generates ULID and persists with correct fields
  - [x] 7.2 Test `markRead()` sets `readAt` and updates `unreadCount`
  - [x] 7.3 Test `markAllRead()` updates all unread notifications
  - [x] 7.4 Test `dismiss()` sets `dismissedAt` and hides from visible list
  - [x] 7.5 Test TTL cleanup deletes old notifications
  - [x] 7.6 Test cap cleanup enforces 100-item limit
  - [x] 7.7 Test cleanup completes in < 50ms with 120 records

## Implementation Notes

- **Dexie schema source of truth:** `src/db/schema.ts`
- **No `userId` field:** Notifications are local-only per brainstorming Decision 6
- **Sync skip-list:** Notifications join `embeddings`, `courseThumbnails`, `youtubeVideoCache` as local-only tables
- **Sync version re-numbering required:** Sync architecture doc references v28-v30 for sync migrations. Notifications claim v28, so sync versions shift to v29-v31.
- **Store pattern:** Follow existing Zustand + Dexie stores (e.g., `useFlashcardStore`, `useReviewStore`) for consistency
- **NFR:** Cleanup must complete in < 50ms for typical load (< 100 records)
- **This story is infrastructure only** — no UI changes, no event triggers. Story 43.7 wires triggers and UI.

## Testing Notes

- Unit test the store in isolation with mock Dexie
- Test cleanup performance with 120 records (30 expired + 90 current)
- Verify ULID generation produces time-sortable, unique IDs
- No E2E tests needed — this is a data layer story

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [x] All changes committed (`git status` clean)
- [x] No error swallowing -- catch blocks log AND surface errors
- [x] useEffect hooks have cleanup functions (ignore flags for async, event listener removal)
- [x] No optimistic UI updates before persistence -- state updates after DB write succeeds
- [x] Type guards on all dynamic lookups (e.g., `LABELS[type]` when type can be empty)
- [x] E2E afterEach cleanup uses `await` (not fire-and-forget)
- [x] Date handling uses `toLocaleDateString('sv-SE')` pattern (not `toISOString().split('T')[0]`)
- [x] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference
- [x] If story calls external APIs: CSP allowlist configured (see engineering-patterns.md CSP Configuration)

## Design Review Feedback

[Populated by /review-story -- Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story -- adversarial code review findings]

## Challenges and Lessons Learned

1. **Dexie v28 migration pattern:** Adding a new table in a new version requires only declaring the schema in `_declareLegacyMigrations` — no upgrade callback needed for fresh tables with no existing data. The version bump itself triggers Dexie to create the table on next open.

2. **Null-index workaround (toArray + filter):** Dexie cannot index `null` values, so queries like `.where('dismissedAt').equals(null)` fail silently. The workaround is `toArray()` followed by `.filter(n => n.dismissedAt === null)`. This is acceptable for notification volumes (capped at 100) but would not scale for larger tables.

3. **ULID for time-sortable IDs:** The `ulid` package generates 26-character IDs that are lexicographically sortable by creation time. This eliminates the need for a separate `createdAt` index for ordering — sorting by `id` gives the same result. However, we keep `createdAt` as a human-readable field and for TTL cleanup queries.

4. **Sync architecture version renumbering:** When claiming a Dexie version (v28) for a local-only table, all downstream sync migration versions must shift (v28->v29, v29->v30, v30->v31). This is a coordination cost that grows with the number of planned migrations — worth batching local-only table additions when possible.
