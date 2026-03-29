---
story_id: E58-S01
story_name: "Notifications Page"
status: done
started: 2026-03-28
completed: 2026-03-28
reviewed: true
review_started: 2026-03-28
review_gates_passed: [build, lint, type-check, format-check, unit-tests, e2e-tests, design-review-skipped, code-review, code-review-testing, performance-benchmark-skipped, security-review, exploratory-qa-skipped]
burn_in_validated: false
---

# Story 58.1: Notifications Page

## Story

As a learner,
I want a dedicated notifications page where I can view, filter, and manage all my notifications,
so that I don't miss important updates about my learning progress.

## Background

The "View all notifications" button in `NotificationCenter.tsx:216-223` currently only closes the popover (`setOpen(false)`) — a dead-end UX flagged in Epic 43 adversarial review (C-03). The notification data layer is fully built (E43-S06 Dexie table, E43-S07 event bus + service). This story adds the UI page and wires the button.

## Acceptance Criteria

### AC1: Notifications route renders full-page list

**Given** a learner navigates to `/notifications`
**When** the page loads
**Then** a full-page list of all non-dismissed notifications is displayed, sorted newest-first, showing icon, title, message, relative time, and read/unread indicator.

### AC2: "View all" button navigates to notifications page

**Given** a learner has the NotificationCenter popover open
**When** they click "View all notifications"
**Then** the popover closes AND the browser navigates to `/notifications`.

### AC3: Filter by type and read status

**Given** a learner is on the notifications page
**When** they select a notification type filter (course-complete, streak-milestone, import-finished, achievement-unlocked, review-due) or read/unread filter
**Then** only matching notifications are displayed, with an active filter indicator.

### AC4: Individual and bulk actions

**Given** a learner is on the notifications page
**When** they click "Mark as read" on a notification, or "Mark all as read" in the header
**Then** the notification(s) update to read state immediately (optimistic UI backed by Dexie write).

### AC5: Dismiss notifications

**Given** a learner is on the notifications page
**When** they dismiss a notification (swipe or dismiss button)
**Then** the notification is soft-dismissed (removed from visible list, `dismissedAt` set in Dexie).

### AC6: Empty state

**Given** a learner has no notifications (or all are dismissed)
**When** they visit `/notifications`
**Then** a friendly empty state is shown with a bell icon and message (reuse pattern from NotificationCenter lines 151-154).

### AC7: Accessible and responsive

**Given** a learner uses keyboard navigation or a screen reader
**When** interacting with the notifications page
**Then** all actions are keyboard-accessible, ARIA labels are present on interactive elements, and the layout adapts to mobile/tablet/desktop viewports.

## Tasks / Subtasks

- [ ] Task 1: Create `Notifications.tsx` page component (AC: 1, 6, 7)
  - [ ] 1.1 Create `src/app/pages/Notifications.tsx` with notification list layout
  - [ ] 1.2 Reuse icon + color mapping from `NotificationCenter.tsx:23-41`
  - [ ] 1.3 Reuse `relativeTime()` helper from `NotificationCenter.tsx:45-59`
  - [ ] 1.4 Extract shared notification rendering into a `NotificationItem` component (or inline if simple)
  - [ ] 1.5 Add empty state matching NotificationCenter pattern (Bell icon + message)
  - [ ] 1.6 Ensure responsive layout (mobile stack, desktop card grid or list)

- [ ] Task 2: Add `/notifications` route (AC: 1)
  - [ ] 2.1 Add lazy import in `src/app/routes.tsx` following existing pattern
  - [ ] 2.2 Add route under Layout children: `{ path: 'notifications', element: <SuspensePage><Notifications /></SuspensePage> }`

- [ ] Task 3: Wire "View all" button (AC: 2)
  - [ ] 3.1 In `NotificationCenter.tsx:216-223`, replace `onClick={() => setOpen(false)}` with navigation to `/notifications` + close popover
  - [ ] 3.2 Import `useNavigate` from react-router and use `navigate('/notifications')` then `setOpen(false)`

- [ ] Task 4: Add type and read status filters (AC: 3)
  - [ ] 4.1 Add filter state (selectedType, readStatus) using `useState` or URL search params
  - [ ] 4.2 Render filter chips/buttons for each of the 5 notification types
  - [ ] 4.3 Add "All" / "Unread" / "Read" toggle for read status
  - [ ] 4.4 Filter the `notifications` array from store based on active filters

- [ ] Task 5: Wire individual and bulk actions (AC: 4, 5)
  - [ ] 5.1 Call `useNotificationStore.getState().markRead(id)` on individual mark-as-read
  - [ ] 5.2 Call `useNotificationStore.getState().markAllRead()` for bulk action
  - [ ] 5.3 Call `useNotificationStore.getState().dismiss(id)` for dismiss action
  - [ ] 5.4 Add visual feedback (button states, transitions)

- [ ] Task 6: Accessibility pass (AC: 7)
  - [ ] 6.1 Add `aria-label` to all interactive elements
  - [ ] 6.2 Ensure focus management on filter changes
  - [ ] 6.3 Add `role="status"` or `aria-live="polite"` for dynamic content updates
  - [ ] 6.4 Touch targets >= 44x44px on mobile

- [ ] Task 7: E2E test (AC: 1-7)
  - [ ] 7.1 Create `tests/e2e/notifications-page.spec.ts`
  - [ ] 7.2 Test: page renders notification list
  - [ ] 7.3 Test: filters change visible notifications
  - [ ] 7.4 Test: mark-as-read and dismiss actions work
  - [ ] 7.5 Test: empty state shown when no notifications
  - [ ] 7.6 Test: "View all" button navigates from NotificationCenter

## Implementation Notes

### DO NOT rebuild — these already exist:
- `useNotificationStore` (`src/stores/useNotificationStore.ts`) — has create, markRead, markAllRead, dismiss, cleanup, load, init
- Dexie `notifications` table with TTL cleanup (30 days) and cap (100)
- Icon + color mapping for 5 types (`NotificationCenter.tsx:23-41`)
- `relativeTime()` timestamp helper (`NotificationCenter.tsx:45-59`)
- `NotificationService` + `EventBus` for event-to-notification mapping

### Key files to modify:
| File | Change |
|------|--------|
| `src/app/pages/Notifications.tsx` | NEW — full notifications page |
| `src/app/routes.tsx` | Add `/notifications` route |
| `src/app/components/figma/NotificationCenter.tsx:216-223` | Wire "View all" button navigation |

### Architecture notes:
- Follow existing route pattern: `React.lazy()` + `SuspensePage` wrapper
- Store is already initialized in `App.tsx` — just call `useNotificationStore()` in the page
- Notification type: `src/data/types.ts:424-443` (5 types: course-complete, streak-milestone, import-finished, achievement-unlocked, review-due)
- The `relativeTime()` helper and icon mapping should be extracted to a shared location if not already (avoid duplication between NotificationCenter and Notifications page)

### Design tokens:
- Use `bg-brand-soft/30` for unread notification backgrounds (matches NotificationCenter)
- Use `text-muted-foreground` for timestamps
- Use design token colors from icon mapping (brand, destructive, success, warning, muted)
- Never hardcode Tailwind colors — use design tokens from `src/styles/theme.css`

## Testing Notes

- E2E tests need IndexedDB seeding with notification records (use seeding helpers)
- Use `FIXED_DATE` pattern for deterministic time in tests
- Notification actions are async (Dexie writes) — use proper waitFor assertions
- No OAuth dependency — this page is fully testable with Playwright

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [ ] All changes committed (`git status` clean)
- [ ] No error swallowing — catch blocks log AND surface errors
- [ ] useEffect hooks have cleanup functions (ignore flags for async, event listener removal)
- [ ] No optimistic UI updates before persistence — state updates after DB write succeeds
- [ ] Type guards on all dynamic lookups (e.g., `LABELS[type]` when type can be empty)
- [ ] E2E afterEach cleanup uses `await` (not fire-and-forget)
- [ ] Date handling uses `toLocaleDateString('sv-SE')` pattern (not `toISOString().split('T')[0]`)
- [ ] Read [engineering-patterns.md](../../engineering-patterns.md) for full patterns reference

## Design Review Feedback

[Populated by /review-story]

## Code Review Feedback

[Populated by /review-story]

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]
