---
story_id: E20-S03
story_name: "365 Day Activity Heatmap"
status: in-progress
started: 2026-03-23
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 20.3: 365 Day Activity Heatmap

## Story

As a learner who values consistency,
I want to see a GitHub-style contribution graph of my study activity for the past year,
so that I can visualize my learning habits and identify gaps.

## Acceptance Criteria

**AC1: 365-Day Heatmap Grid**
**Given** the user has study session data spanning at least one month
**When** the user views the Reports page (Study Analytics tab)
**Then** a GitHub-style heatmap grid displays the past 365 days of daily study activity (52 weeks × 7 days)
**And** each cell represents one day, with color intensity proportional to the total session duration for that day
**And** the heatmap uses 5 intensity levels (no activity, light, moderate, heavy, intense) plus a legend explaining the scale

**AC2: Tooltip Interaction**
**Given** the 365-day heatmap is visible
**When** the user hovers over or focuses on a cell
**Then** a tooltip shows the date and total study duration (formatted as hours and minutes)

**AC3: Accessibility**
**Given** the user views the activity heatmap
**When** the heatmap renders
**Then** intensity levels are differentiated by both color shade and opacity variation so they are distinguishable without color perception
**And** the heatmap includes alt text summarizing the overall activity pattern
**And** a "View as table" toggle is available showing monthly summary data in an accessible HTML table

**AC4: Empty State**
**Given** the user has no study session data
**When** the Activity Heatmap section loads
**Then** an appropriate empty state is displayed explaining what data is needed

**AC5: Design Token Usage**
**Given** the heatmap renders
**When** displaying intensity levels
**Then** it uses the existing `--heatmap-empty` through `--heatmap-level-4` design tokens from theme.css
**And** all colors support automatic light/dark mode switching

## Tasks / Subtasks

- [ ] Task 1: Create data aggregation utility for 365-day session data (AC: 1)
  - [ ] 1.1 `getDailyStudyDurations(days: number)` function in `src/lib/heatmapData.ts`
  - [ ] 1.2 Unit tests for aggregation logic
- [ ] Task 2: Build `ActivityHeatmap365` component (AC: 1, 2, 3, 5)
  - [ ] 2.1 52×7 grid layout with month labels and day-of-week labels
  - [ ] 2.2 5-level intensity mapping using heatmap design tokens
  - [ ] 2.3 Tooltip with date + formatted duration
  - [ ] 2.4 Accessibility: alt text, opacity variation, keyboard navigation
  - [ ] 2.5 "View as table" toggle with monthly summary
- [ ] Task 3: Integrate into Reports page (AC: 1, 4)
  - [ ] 3.1 Add heatmap section after existing content
  - [ ] 3.2 Empty state for no session data
- [ ] Task 4: E2E tests (AC: 1-5)
  - [ ] 4.1 Heatmap renders with seeded session data
  - [ ] 4.2 Tooltip shows date and duration
  - [ ] 4.3 Table view toggle works
  - [ ] 4.4 Empty state displays correctly

## Design Guidance

- Follows existing `StudyStreakCalendar` grid pattern but uses IndexedDB session durations instead of localStorage lesson counts
- Uses existing `--heatmap-*` design tokens (5 levels including empty)
- Card container with `rounded-[24px]` border matching Reports page design
- Horizontal scroll for narrow viewports
- Month labels above grid, day-of-week labels on left (odd rows only, matching StudyStreakCalendar)

## Implementation Plan

[Full plan](plans/e20-s03-365-day-activity-heatmap.md)

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
- [ ] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference
- [ ] If story calls external APIs: CSP allowlist configured (see engineering-patterns.md § CSP Configuration)

## Design Review Feedback

[Populated by /review-story — Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story — adversarial code review findings]

## Web Design Guidelines Review

[Populated by /review-story — Web Interface Guidelines compliance findings]

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]
