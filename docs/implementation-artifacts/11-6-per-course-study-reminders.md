---
story_id: E11-S06
story_name: "Per-Course Study Reminders"
status: done
started: 2026-03-16
completed: 2026-03-16
reviewed: true    # false | in-progress | true
review_started: 2026-03-16  # YYYY-MM-DD — set when /review-story begins
review_gates_passed: [build, lint, type-check, format-check, unit-tests, e2e-tests, design-review, code-review, code-review-testing, web-design-guidelines]  # tracks completed gates
burn_in_validated: false # true if burn-in testing (10 iterations) passed
---

# Story 11.6: Per-Course Study Reminders

## Story

As a learner,
I want to configure study reminders for each course with specific days and times,
So that I can maintain a consistent study schedule tailored to each course independently of my streak reminders.

## Acceptance Criteria

**AC1: Configure reminder with day/time selection**
**Given** a learner navigates to a course's settings
**When** they configure a study reminder
**Then** they can select one or more days of the week and a specific time for each selected day
**And** the reminder is saved independently from the global streak reminder

**AC2: Browser notification delivery with course deep-link**
**Given** a learner has configured a per-course study reminder
**When** the scheduled day and time arrives
**Then** a browser notification is delivered identifying the specific course
**And** the notification includes a direct link to resume studying that course

**AC3: Independence from streak reminders**
**Given** a learner has both a streak reminder and per-course reminders configured
**When** reminders are scheduled
**Then** each reminder fires independently at its configured time
**And** per-course reminders do not interfere with or suppress the streak reminder

**AC4: Notification permission prompt and graceful handling**
**Given** a learner has not granted browser notification permissions
**When** they attempt to configure a per-course reminder
**Then** the system prompts them to grant notification permissions
**And** explains that notifications are required for reminders to function
**And** the reminder configuration is saved regardless of permission status so it activates once permissions are granted

**AC5: Edit and disable reminders**
**Given** a learner wants to modify or remove a per-course reminder
**When** they edit the reminder settings for that course
**Then** they can change the days, times, or disable the reminder entirely
**And** changes take effect immediately for all future scheduled notifications

**AC6: Multi-course reminder overview**
**Given** a learner has configured reminders for multiple courses
**When** they view their reminder settings overview
**Then** all per-course reminders are listed with their schedules, organized by course
**And** each reminder shows its enabled or disabled status

## Tasks / Subtasks

- [ ] Task 1: Extend Dexie schema for per-course reminder storage (AC: 1, 5)
  - [ ] 1.1 Add `courseReminders` table with courseId, days[], time, enabled fields
  - [ ] 1.2 Create migration for schema version bump
- [ ] Task 2: Create Zustand store for course reminder state management (AC: 1, 5)
  - [ ] 2.1 Create `useCourseReminderStore` with CRUD operations
  - [ ] 2.2 Sync with Dexie persistence layer
- [ ] Task 3: Build reminder scheduling engine (AC: 2, 3)
  - [ ] 3.1 Implement scheduler that registers browser notification timers
  - [ ] 3.2 Ensure independence from streak reminder system (Story 5.5)
  - [ ] 3.3 Include course name and deep-link URL in notification payload
- [ ] Task 4: Build reminder configuration UI on course detail page (AC: 1, 4, 5)
  - [ ] 4.1 Day-of-week multi-select component
  - [ ] 4.2 Time picker for each selected day
  - [ ] 4.3 Enable/disable toggle
  - [ ] 4.4 Notification permission prompt flow
- [ ] Task 5: Build reminder overview panel (AC: 6)
  - [ ] 5.1 List all per-course reminders with status
  - [ ] 5.2 Organize by course with edit/delete actions
- [ ] Task 6: Handle notification permissions gracefully (AC: 4)
  - [ ] 6.1 Detect permission status and prompt if needed
  - [ ] 6.2 Save config regardless of permission state
  - [ ] 6.3 Activate reminders when permissions are later granted

## Design Guidance

### Layout Approach

Place a new **"Course Reminders"** Card (`data-testid="course-reminders-section"`) directly below the existing `<ReminderSettings />` (streak reminders) card in Settings.tsx. This creates a clear visual hierarchy: global streak reminders → per-course reminders. Use the same `max-w-2xl` constraint as all other Settings cards.

The card follows the same pattern as existing Settings cards:
- `CardHeader` with icon (`Bell` or `CalendarClock` from lucide-react) + title + description
- `CardContent` with the reminder list and "Add reminder" action

### Component Structure

```
Settings.tsx
├── ... existing cards ...
├── ReminderSettings           (streak — existing, data-testid="reminders-section")
├── CourseReminderSettings     (NEW — data-testid="course-reminders-section")
│   ├── Notification permission banner (conditional)
│   ├── CourseReminderList
│   │   └── CourseReminderRow  (per reminder, data-testid="course-reminder-{courseId}")
│   │       ├── Course name + schedule summary (Mon, Wed, Fri · 09:00)
│   │       ├── Enable/disable Switch
│   │       └── Edit button → opens inline edit form
│   ├── Empty state            (when no reminders configured)
│   └── "Add Reminder" Button → opens inline form
│       ├── Course Select      (data-testid="course-reminder-course-select")
│       ├── DaySelector        (data-testid="course-reminder-day-selector")
│       │   └── 7 Checkbox toggles (Mon–Sun), pill/chip style
│       ├── Time Input         (data-testid="course-reminder-time-input", type="time")
│       └── Save / Cancel buttons
```

### Component Files

- `src/app/components/figma/CourseReminderSettings.tsx` — main card (mirrors ReminderSettings.tsx pattern)
- `src/app/components/figma/CourseReminderRow.tsx` — individual reminder row with inline edit
- `src/app/components/figma/DaySelector.tsx` — reusable day-of-week multi-select (pill toggles)

### Design Token Usage

| Element | Token | Class |
|---------|-------|-------|
| Card header icon bg | brand-soft | `bg-brand-soft` |
| Card header icon | brand | `text-brand` |
| Day pill (selected) | brand, brand-foreground | `bg-brand text-brand-foreground` |
| Day pill (unselected) | border, muted-foreground | `border-border text-muted-foreground bg-background` |
| Enabled indicator dot | success | `bg-success` |
| Disabled state text | muted-foreground | `text-muted-foreground` |
| Permission warning | warning | `text-warning` (matches existing denied guidance) |
| Permission denied banner bg | warning/10 | `bg-warning/10 border-warning/20` |
| Add button | brand | Default `<Button>` with brand styling |
| Time input | input-background, border | Same as existing `input[type="time"]` in ReminderSettings |
| Reminder row hover | surface-elevated/80 | `hover:bg-surface-elevated/80` (matches Data Management rows) |

### Day Selector Component

Use **pill/chip toggles** (not standard checkboxes) for the 7 days — this is more tactile and compact:

- Each day is a small rounded pill showing abbreviated name (Mon, Tue, Wed, Thu, Fri, Sat, Sun)
- Selected: `bg-brand text-brand-foreground rounded-full px-3 py-1.5`
- Unselected: `bg-background border border-border text-muted-foreground rounded-full px-3 py-1.5`
- Lay out in a flex row with `gap-2`, wrapping on mobile
- Accessible: each pill is a `<button role="checkbox" aria-checked="true|false">` with `aria-label="Monday"` etc.
- Touch target: min 44x44px (use `min-h-[44px] min-w-[44px]`)

### Reminder Row Layout

Each `CourseReminderRow` in the list:

```
┌──────────────────────────────────────────────────────────┐
│ [●] TypeScript Fundamentals          [Switch] [Edit btn] │
│     Mon, Wed, Fri · 09:00                                │
└──────────────────────────────────────────────────────────┘
```

- Status dot: `bg-success` when enabled, `bg-muted` when disabled
- Course name: `text-sm font-medium`
- Schedule summary: `text-xs text-muted-foreground`
- Switch: shadcn `<Switch>` with `aria-label="Enable TypeScript Fundamentals reminder"`
- Edit button: ghost variant, `Pencil` icon from lucide-react

### Notification Permission Flow

When permission is `'default'` (not yet asked):
- Show a soft info banner at top of the card: `bg-brand-soft border border-brand/20 rounded-xl p-4`
- Icon: `Bell` with `text-brand`
- Text: "Enable browser notifications to receive study reminders"
- CTA: `<Button size="sm">Enable Notifications</Button>`
- `data-testid="course-reminder-permission-prompt"`

When permission is `'denied'`:
- Show warning banner: `bg-warning/10 border border-warning/20 rounded-xl p-4`
- Icon: `AlertTriangle` with `text-warning`
- Text: "Notifications are blocked. Please enable them in your browser settings."
- Also show "Continue without notifications" link
- `data-testid="course-reminder-permission-denied"`

When permission is `'granted'`: no banner needed.

### Empty State

When no course reminders exist:
- Centered illustration area (optional: `CalendarClock` icon at `size-12` in `text-muted-foreground/30`)
- "No course reminders yet" in `text-sm text-muted-foreground`
- "Add a reminder to stay on track with specific courses" helper text
- Primary "Add Reminder" button below

### Responsive Strategy

- **Mobile (< 640px)**: Stack reminder rows vertically. Day selector pills wrap to 2 rows. Time input full width. Edit/switch controls stack below course name.
- **Tablet (640-1024px)**: Standard card layout. Day selector in single row. Side-by-side switch + edit.
- **Desktop (> 1024px)**: Same as tablet (constrained by `max-w-2xl`).

### Accessibility Requirements

- All interactive elements reachable via Tab key
- Day selector pills: `role="checkbox"` with `aria-checked`, grouped in `role="group" aria-label="Days of the week"`
- Switch toggles: `aria-label` includes course name (e.g., "Enable TypeScript Fundamentals reminder")
- Time input: `<label>` association via `htmlFor`/`id`
- Permission prompt: `role="alert"` with `aria-live="polite"`
- Course select: keyboard navigable (use shadcn `<Select>` or `<Command>`)
- Focus management: after adding a reminder, focus moves to the new reminder row
- Minimum 4.5:1 contrast ratio on all text

### Animation

- New reminder rows: `animate-in fade-in-0 slide-in-from-top-1 duration-300` (matches existing Settings patterns)
- Permission banner transitions: same fade-in pattern
- Day pill selection: `transition-colors duration-150` for snappy feedback

## Implementation Plan

See [plan](plans/e11-s06-per-course-study-reminders.md) for implementation approach.

## Implementation Notes

**Dependencies:** Story 5.5 (notification permission and scheduling infrastructure), Epic 1 (course entities)
**Complexity:** Medium (3-5 hours)
**FR:** FR100

## Testing Notes

Unit tests for per-course scheduling logic and independence from streak reminders, E2E for reminder configuration, notification delivery, permission flow, and multi-course reminder overview.

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
- [ ] If story calls external APIs: CSP allowlist configured (see engineering-patterns.md § CSP Configuration)

## Design Review Feedback

**Verdict: PASS** — No blockers. 1 medium (orphaned label), 1 medium (pre-existing contrast issue), 3 nits.
Report: docs/reviews/design/design-review-2026-03-16-e11-s06.md

## Code Review Feedback

**Verdict: BLOCKED** — 2 blockers (missing notification click handler, unhandled async in handleSaveNew), 3 high, 4 medium, 3 nits.
Report: docs/reviews/code/code-review-2026-03-16-e11-s06.md

## Web Design Guidelines Review

**Verdict: PASS** — 8 PASS, 2 LOW warnings (keyboard nav ergonomics, loading state).
Report: docs/reviews/design/web-design-guidelines-2026-03-16-e11-s06.md

## Challenges and Lessons Learned

- **Notification click handlers are not automatic.** `new Notification()` with `data: { url }` does nothing on click — you must attach an `onclick` handler explicitly. The `data` property is inert storage, not a behavior trigger. Caught by code review as a blocker.
- **Async event handlers need try/catch without exception.** Five async handlers were missing error handling. Dexie writes can fail (quota, corruption), and without try/catch the promise rejection is silent. Pattern: wrap every async onClick/onChange in try/catch and surface errors.
- **Permission re-activation gap.** The scheduler initially gated on `Notification.permission === 'granted'` at mount time only. If a user saves reminders without permission (AC4 allows this), then grants permission later, the scheduler never starts until full page reload. Fix: re-check permission on each interval tick.
- **`shouldFireReminder` window must exceed interval.** A 1-minute check window with a 60-second interval can miss reminders if the JS event loop delays a tick. Widened to 2-minute tolerance for background tab throttling.
- **Clean component decomposition pays off.** Splitting into DaySelector, CourseReminderRow, and CourseReminderSettings kept each file under 200 lines and made review findings easy to address in isolation.
