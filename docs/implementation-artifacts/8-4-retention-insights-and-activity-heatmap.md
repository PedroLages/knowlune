---
story_id: E08-S04
story_name: "Retention Insights And Activity Heatmap"
status: done
started: 2026-03-09
completed: 2026-03-09
reviewed: true
review_started: 2026-03-09
review_gates_passed: [build, unit-tests, e2e-smoke, e2e-story, design-review, code-review, code-review-testing]
burn_in_validated: false # true if burn-in testing (10 iterations) passed
---

# Story 8.4: Retention Insights & Activity Heatmap

## Story

As a learner,
I want to compare my study habits between completed and abandoned courses and see a heatmap of my daily learning activity,
so that I can identify patterns that lead to successful completion and maintain consistent study habits.

## Acceptance Criteria

**Given** the user has both completed courses and abandoned courses (no activity for 14+ days with less than 100% completion)
**When** the user navigates to the Reports page and views the Retention Insights section
**Then** a side-by-side comparison displays metrics for completed courses versus abandoned courses
**And** the metrics shown include average study frequency (sessions per week), average time-to-completion (or time before abandonment), and average notes-per-video ratio
**And** each metric is clearly labeled with the group it belongs to (Completed vs Abandoned)

**Given** the user has only completed courses and no abandoned courses
**When** the Retention Insights section loads
**Then** the completed courses metrics are displayed
**And** the abandoned courses column shows a positive message such as "No abandoned courses — keep it up!"

**Given** the user has only abandoned courses and no completed courses
**When** the Retention Insights section loads
**Then** the abandoned courses metrics are displayed
**And** the completed courses column shows an encouraging message with a suggestion to revisit a course

**Given** the user has study session data spanning at least one month
**When** the user views the Activity Heatmap section
**Then** a GitHub-style heatmap grid displays the past 12 months of daily study activity
**And** each cell represents one day, with color intensity proportional to the total session duration for that day
**And** the heatmap uses at least 4 intensity levels (no activity, light, moderate, heavy) plus a legend explaining the scale
**And** hovering over or focusing on a cell shows a tooltip with the date and total study duration

**Given** the user with color blindness views the Activity Heatmap
**When** the heatmap renders
**Then** intensity levels are differentiated by both color shade and a pattern or opacity variation so they are distinguishable without color perception
**And** the heatmap includes alt text summarizing the overall activity pattern
**And** a "View as table" toggle is available showing monthly summary data in an accessible HTML table

**Given** the user has no study session data
**When** the Retention Insights and Activity Heatmap sections load
**Then** both sections display appropriate empty states explaining what data is needed

## Tasks / Subtasks

- [ ] Task 1: Write E2E tests (ATDD — before implementation) (AC: 1-6)
  - [ ] 1.1 AC1: Side-by-side comparison with completed vs abandoned metrics
  - [ ] 1.2 AC2: Only completed courses — abandoned column shows positive message
  - [ ] 1.3 AC3: Only abandoned courses — completed column shows encouragement
  - [ ] 1.4 AC4: Heatmap grid displays 12 months, cells show tooltip on hover
  - [ ] 1.5 AC5: Color-blind accessibility (opacity variation), alt text, table toggle
  - [ ] 1.6 AC6: Empty state for both sections when no session data

- [ ] Task 2: Implement pure helper functions (AC: 1-6)
  - [ ] 2.1 `classifyCoursesForRetention()` — split courses into completed/abandoned
  - [ ] 2.2 `calculateRetentionMetrics()` — avg frequency, time, notes-per-video per group
  - [ ] 2.3 `buildHeatmapData()` — 365-day grid with duration buckets per cell
  - [ ] 2.4 `getIntensityLevel()` — map duration to level (0=none, 1=light, 2=moderate, 3=heavy)
  - [ ] 2.5 `generateHeatmapAltText()` — accessibility description of overall activity

- [ ] Task 3: Build RetentionInsights component (AC: 1-3, 6)
  - [ ] 3.1 Load data: importedCourses + studySessions + notes + importedVideos in parallel
  - [ ] 3.2 Loading state card
  - [ ] 3.3 Empty state: no data (AC6)
  - [ ] 3.4 Side-by-side metric cards: Completed vs Abandoned columns (AC1)
  - [ ] 3.5 Positive/encouraging empty column messages (AC2, AC3)
  - [ ] 3.6 Accessibility: data-testid, ARIA labels, keyboard navigable

- [ ] Task 4: Build ActivityHeatmap component (AC: 4-5, 6)
  - [ ] 4.1 Load studySessions from IndexedDB
  - [ ] 4.2 Loading + empty state (AC6)
  - [ ] 4.3 12-month heatmap grid with 4 intensity levels + legend (AC4)
  - [ ] 4.4 Tooltip on hover/focus: date + duration (AC4)
  - [ ] 4.5 Opacity variation for color-blind accessibility (AC5)
  - [ ] 4.6 Alt text for overall activity pattern (AC5)
  - [ ] 4.7 "View as table" toggle with monthly summary (AC5)
  - [ ] 4.8 Accessibility: data-testid, ARIA, keyboard navigable cells

- [ ] Task 5: Integrate into Reports page (AC: all)
  - [ ] 5.1 Import RetentionInsights and ActivityHeatmap in Reports.tsx
  - [ ] 5.2 Render below LearningVelocityTrends with consistent spacing

- [ ] Task 6: Run tests and fix (AC: all)
  - [ ] 6.1 Run E2E tests against implementation
  - [ ] 6.2 Fix any failures

## Implementation Plan

See [plan](plans/e08-s04-retention-insights-and-activity-heatmap.md) for full implementation details.

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
- [ ] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference

## Design Review Feedback

[Populated by /review-story — Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story — adversarial code review findings]

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]
