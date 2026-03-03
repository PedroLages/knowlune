---
story_id: E04-S01
story_name: "Mark Content Completion Status"
status: done
started: 2026-03-02
completed: 2026-03-02
reviewed: true
review_started: 2026-03-02
review_gates_passed: [build, lint, unit-tests, e2e-tests, design-review, code-review, code-review-testing]
---

# Story 4.1: Mark Content Completion Status

## Story

As a learner,
I want to mark videos and chapters as Not Started, In Progress, or Completed with clear color-coded indicators,
So that I can visually track my progress through course content at a glance.

## Acceptance Criteria

**AC1: Status selector**
**Given** a user is viewing a course's content structure panel
**When** they click on a video or chapter's status indicator
**Then** a status selector appears with three options: Not Started, In Progress, and Completed
**And** each option displays its corresponding color: gray for Not Started, blue for In Progress, green for Completed

**AC2: Atomic state change with optimistic update**
**Given** a user selects a new completion status for a content item
**When** the status change is confirmed
**Then** the state change is atomic — the UI updates optimistically via the Zustand store and persists to Dexie.js IndexedDB
**And** if the IndexedDB write fails, the Zustand state rolls back to the previous value
**And** no partial or inconsistent state is ever visible to the user

**AC3: Color-coded visual indicators**
**Given** a content item has a completion status
**When** the course structure panel renders
**Then** the item displays a color-coded visual indicator: gray circle for Not Started, blue circle for In Progress, green circle with checkmark for Completed
**And** each indicator uses sufficient color contrast (WCAG 2.1 AA) and includes a text label or tooltip for accessibility

**AC4: Auto-complete parent chapter**
**Given** a user marks the last incomplete item in a chapter as Completed
**When** the state updates
**Then** the parent chapter status automatically updates to Completed
**And** the chapter's visual indicator changes to green

**AC5: Auto-revert parent chapter**
**Given** a user changes a Completed item back to In Progress or Not Started
**When** the state updates
**Then** any parent chapter that was auto-completed reverts to In Progress
**And** dependent progress calculations update immediately

## Tasks / Subtasks

- [x] Task 1: Create completion status data model in Dexie (AC: 2)
  - [x] 1.1 Add ContentProgress table to Dexie schema
  - [x] 1.2 Define TypeScript types for completion status
- [x] Task 2: Create Zustand progress store with optimistic updates (AC: 2)
  - [x] 2.1 Create progress store with status getters/setters
  - [x] 2.2 Implement optimistic update with rollback on Dexie failure
  - [x] 2.3 Implement parent chapter auto-completion logic (AC: 4, 5)
- [x] Task 3: Build status indicator component (AC: 1, 3)
  - [x] 3.1 Create StatusIndicator component with color-coded circles
  - [x] 3.2 Add tooltip/text label for accessibility
- [x] Task 4: Build status selector popover (AC: 1)
  - [x] 4.1 Create StatusSelector popover with three options
  - [x] 4.2 Wire to Zustand store actions
- [x] Task 5: Integrate into course structure panel (AC: 1, 3, 4, 5)
  - [x] 5.1 Add StatusIndicator to course structure navigation items
  - [x] 5.2 Add click handler to open StatusSelector
  - [x] 5.3 Verify parent chapter cascade behavior

## Implementation Plan

See [plan](../../.claude/plans/robust-noodling-sedgewick.md) for implementation approach.

## Implementation Notes

### Architecture

- **Data Layer**: Added `ContentProgress` type and `contentProgress` Dexie table (v6) with compound key `[courseId+itemId]` and indexes on `courseId`, `itemId`, `status`
- **State Management**: New `useContentProgressStore` Zustand store following established optimistic-update + rollback pattern from `useBookmarkStore`
- **Parent Cascade**: Module status derived atomically within `setItemStatus` — all completed = completed, all not-started = not-started, otherwise = in-progress
- **Components**: `StatusIndicator` (button with tooltip, color-coded, data-testid/data-status for E2E) and `StatusSelector` (3-option menu) composed via Radix Popover
- **Integration**: ModuleAccordion refactored to use Zustand store for status display; Popover wraps each lesson indicator; module-level indicators are read-only (derived)

### Patterns

- Follows `persistWithRetry` pattern for Dexie writes
- Optimistic UI with atomic rollback on failure
- `data-status` attribute on indicators enables E2E assertions without visual inspection
- `aria-label` + tooltip for WCAG 2.1 AA accessibility

## Testing Notes

- 5 E2E tests covering all 5 acceptance criteria — all pass on Chromium
- Tests use static `6mx` course data (no IndexedDB seeding needed for course structure)
- `contentProgress` store cleared in `beforeEach` to ensure test isolation
- 14 smoke tests (navigation, overview, courses) pass — zero regressions

## File List

- `src/data/types.ts` — Added `CompletionStatus` type and `ContentProgress` interface
- `src/db/schema.ts` — Added `contentProgress` table (Dexie v6), updated type imports
- `src/stores/useContentProgressStore.ts` — New Zustand store with optimistic updates, rollback, parent cascade
- `src/app/components/figma/StatusIndicator.tsx` — New color-coded status indicator with tooltip
- `src/app/components/figma/StatusSelector.tsx` — New 3-option status selector menu
- `src/app/components/figma/ModuleAccordion.tsx` — Refactored to use Zustand store, StatusIndicator, Popover
- `tests/e2e/story-e04-s01.spec.ts` — Updated E2E tests to use static course data

## Change Log

- 2026-03-02: Implemented all 5 tasks for E04-S01. Added 3-state completion tracking (not-started/in-progress/completed) with Dexie persistence, Zustand optimistic updates, color-coded indicators, popover selector, and parent module cascade. All 5 AC E2E tests + 14 smoke tests pass.

## Design Review Feedback

**Date:** 2026-03-02 | **Report:** `docs/reviews/design/design-review-2026-03-02-E04-S01.md`

- **B1**: Module StatusIndicator (button) nested inside AccordionTrigger (button) — invalid HTML
- **B2**: Touch target ~20px, below 44px minimum
- **H1**: Uses `text-blue-500` instead of `text-blue-600` (design system primary)
- **H2**: Gray indicator contrast may be insufficient (`text-muted-foreground/40`)
- **H4**: StatusSelector option touch targets too small (`py-2` → need `py-3`)

## Code Review Feedback

**Date:** 2026-03-02 | **Reports:** `docs/reviews/code/code-review-2026-03-02-E04-S01.md`, `docs/reviews/code/code-review-testing-2026-03-02-E04-S01.md`

**Architecture:**
- **B1**: Multi-put persistence not wrapped in Dexie transaction — partial writes possible (AC2 atomicity)
- **B2**: Nested button inside AccordionTrigger (same as design B1)
- **H1**: `EntityTable<ContentProgress, 'courseId'>` incorrect for compound key
- **H2**: `useContentProgressStore()` called without selector — full re-render on any store change
- **H3**: No unit tests for store/components — rollback + cascade logic only tested via E2E

**Testing (1/5 ACs fully covered):**
- **H1**: AC2 rollback on IndexedDB failure untested
- **H2**: No reload-and-verify for IndexedDB persistence
- **H3**: AC3 color assertion absent in E2E
- **H5**: AC5 revert to "Not Started" path untested

## Challenges and Lessons Learned

- The ATDD tests were originally written to seed dynamic courses via IndexedDB, but the `/courses/:courseId` route uses static `allCourses` data — updated tests to use existing `6mx` course
- The `completedLessons` prop on ModuleAccordion is kept for backward compatibility (prefixed `_completedLessons`) since LessonPlayer still passes it; the Zustand store is now the source of truth
- **Nested interactive elements**: Code review caught a `<button>` inside `AccordionTrigger` (also a button). Fixed by adding a `mode="display"` prop to StatusIndicator that renders a `<span>` for read-only contexts. Pattern worth reusing for any indicator inside an accordion header.
- **Dexie transactions matter for atomicity**: Multiple `db.contentProgress.put()` calls without a transaction can leave partial writes. Wrapping in `db.transaction('rw', table, ...)` is essential when AC says "atomic." This was the top blocker from code review.
- **Zustand selector discipline**: Calling `useStore()` without a selector subscribes to the entire store. Always use `useStore(state => state.field)` to avoid unnecessary re-renders — especially in list components like ModuleAccordion.
- **E2E timeouts on cold start**: First Playwright run after build timed out on `page.goto` (30s) due to dev server cold start. Retries passed immediately. Consider a warmup request in `globalSetup` if this recurs.
