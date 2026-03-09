---
story_id: E08-S02
story_name: "Course Completion Tracking"
status: done
started: 2026-03-09
completed: 2026-03-09
reviewed: true
review_started: 2026-03-09
review_gates_passed: [build, lint, unit-tests, e2e-smoke, e2e-story, prettier, code-review, code-review-testing, design-review]
---

# Story 8.2: Course Completion Tracking

## Story

As a learner,
I want to track my course completion rates over time and see a history of completed courses,
so that I can measure my progress and stay motivated by seeing how many courses I have finished.

## Acceptance Criteria

**Given** the user has enrolled in one or more courses with progress data
**When** the user navigates to the Reports page and views the Course Completion Tracking section
**Then** a line or area chart displays overall completion rate over time (percentage of enrolled courses completed, plotted weekly)
**And** the chart x-axis shows weeks and the y-axis shows completion rate percentage from 0 to 100

**Given** the user has completed at least one course
**When** the Course Completion Tracking section loads
**Then** a per-course completion history list is displayed showing each course name, enrollment date, completion date, and total time spent
**And** the list is sorted by completion date descending (most recent first)

**Given** the user views the completion tracking chart
**When** the user hovers over or focuses on a data point
**Then** a tooltip displays the exact completion rate and the number of courses completed out of total enrolled for that period

**Given** the user has completed courses over multiple months
**When** the section renders
**Then** a visual timeline shows course completion milestones plotted chronologically
**And** each milestone shows the course name and completion date
**And** the timeline is keyboard navigable with each milestone focusable

**Given** the user has no completed courses
**When** the user views the Course Completion Tracking section
**Then** an empty state is displayed encouraging the user to continue their in-progress courses
**And** if the user has in-progress courses, a summary of current progress percentages is shown

## Tasks / Subtasks

- [ ] Task 1: Extend IndexedDB seeding helpers (AC: all — needed for tests)
  - [ ] 1.1 Add `seedImportedCourses()` to `tests/support/helpers/indexeddb-seed.ts`
  - [ ] 1.2 Add `seedContentProgress()` to `tests/support/helpers/indexeddb-seed.ts`

- [ ] Task 2: Write E2E tests (ATDD — before implementation) (AC: 1-5)
  - [ ] 2.1 AC1: Chart renders with weekly completion rate data
  - [ ] 2.2 AC2: History list sorted by completion date desc
  - [ ] 2.3 AC3: Tooltip shows rate + count on hover
  - [ ] 2.4 AC4: Timeline renders + keyboard navigation
  - [ ] 2.5 AC5a: Empty state with in-progress summary
  - [ ] 2.6 AC5b: Empty state with no courses at all

- [ ] Task 3: Implement pure helper functions (AC: 1-4)
  - [ ] 3.1 `deriveCourseCompletionDate()` — max updatedAt when all items complete
  - [ ] 3.2 `buildWeeklyCompletionRateData()` — 12 weeks of rate snapshots
  - [ ] 3.3 `buildCompletionHistory()` — per-course sorted list
  - [ ] 3.4 `formatDuration()` — seconds → "Xh Ym"
  - [ ] 3.5 `generateChartAltText()` — accessibility description

- [ ] Task 4: Build CourseCompletionTracking component (AC: 1-5)
  - [ ] 4.1 Load data from IndexedDB (parallel queries, ignore flag, event listeners)
  - [ ] 4.2 Loading state card
  - [ ] 4.3 Empty state (no completions) with in-progress summary
  - [ ] 4.4 Area chart with recharts (AC1 + AC3 tooltip)
  - [ ] 4.5 Completion history list/table (AC2)
  - [ ] 4.6 Visual timeline with keyboard navigation (AC4)
  - [ ] 4.7 Accessibility: alt text, data-testid attributes, ARIA

- [ ] Task 5: Integrate into Reports page (AC: all)
  - [ ] 5.1 Import CourseCompletionTracking in Reports.tsx
  - [ ] 5.2 Render below StudyTimeAnalytics with spacing

- [ ] Task 6: Run tests and fix (AC: all)
  - [ ] 6.1 Run E2E tests against implementation
  - [ ] 6.2 Fix any failures

## Implementation Plan

See [plan](plans/e08-s02-course-completion-tracking.md) for full implementation details.

## Implementation Notes

[Architecture decisions, patterns used, dependencies added]

## Testing Notes

[Test strategy, edge cases discovered, coverage notes]

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [ ] All changes committed (`git status` clean)
- [ ] No error swallowing — catch blocks log AND surface errors
- [ ] useEffect hooks have cleanup functions (ignore flags for async, event listener removal)
- [ ] No optimistic UI updates before persistence — state updates after DB write succeeds
- [ ] Type guards on all dynamic lookups (e.g., `LABELS[type]` when type can be empty)
- [ ] E2E afterEach cleanup uses `await` (not fire-and-forget)
- [ ] Date handling uses `toLocaleDateString('sv-SE')` pattern (not `toISOString().split('T')[0]`)
- [ ] Sidebar state seeded BEFORE `page.goto()` (context.addInitScript pattern)
- [ ] `Math.max()` replaced with `.reduce()` for large arrays (E08-S01 lesson)
- [ ] Weekly chart anchored to current date, not most-recent event (E08-S01 lesson)
- [ ] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference

## Design Review Feedback

[Populated by /review-story — Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story — adversarial code review findings]

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]
