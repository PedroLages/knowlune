---
story_id: E08-S03
story_name: "Learning Velocity And Trends"
status: done
started: 2026-03-09
completed: 2026-03-09
reviewed: true
review_started: 2026-03-09
review_gates_passed:
  - build
  - lint (branch files)
  - unit-tests
  - e2e-smoke
  - e2e-story-spec
  - code-review
  - code-review-testing
  - design-review
burn_in_validated: false
---

# Story 8.3: Learning Velocity & Trends

## Story

As a learner,
I want to see how quickly I am progressing through content and whether my pace is accelerating or decelerating,
so that I can identify when I am losing momentum and take corrective action before falling behind.

## Acceptance Criteria

**Given** the user has watched videos across multiple weeks
**When** the user navigates to the Reports page and views the Learning Velocity section
**Then** a chart displays the number of videos completed per week for the past 12 weeks
**And** the current week's count updates as additional videos are completed

**Given** the user has recorded study sessions with content consumption data
**When** the Learning Velocity section loads
**Then** a metric card displays the average content consumed per study hour (calculated as total video minutes watched / total study hours)
**And** the metric shows the current value alongside the previous period's value for comparison

**Given** the user has at least 4 weeks of velocity data
**When** the trend analysis renders
**Then** a trend indicator shows whether learning velocity is accelerating, stable, or decelerating
**And** acceleration is determined by comparing the average velocity of the most recent 4 weeks against the prior 4 weeks
**And** the indicator uses an upward arrow for acceleration (>10% increase), a flat arrow for stable (within +/-10%), and a downward arrow for deceleration (>10% decrease)
**And** the trend indicator includes a text label (e.g., "Accelerating +15%") so the meaning is not conveyed by icon alone

**Given** the user has fewer than 2 weeks of data
**When** the Learning Velocity section loads
**Then** available metrics are displayed with a note that trend analysis requires at least 4 weeks of data
**And** no trend indicator is shown until sufficient data exists

**Given** the user views the velocity chart
**When** the chart renders
**Then** the chart includes alt text describing the overall velocity trend
**And** a "View as table" toggle is available showing weekly video counts in tabular format

## Tasks / Subtasks

- [x] Task 1: Write E2E tests (ATDD — before implementation) (AC: 1-5)
  - [x] 1.1 AC1: Chart displays videos completed per week for past 12 weeks
  - [x] 1.2 AC2: Metric card shows avg content per study hour with period comparison
  - [x] 1.3 AC3: Trend indicator renders with correct label for accelerating/stable/decelerating
  - [x] 1.4 AC4: Insufficient data state (< 2 weeks) shows note and no trend indicator
  - [x] 1.5 AC5: Chart alt text present + "View as table" toggle works

- [x] Task 2: Implement pure helper functions (AC: 1-5)
  - [x] 2.1 `buildWeeklyVideoCompletionData()` — 12 weeks of per-week video counts
  - [x] 2.2 `calculateAvgContentPerStudyHour()` — total video minutes / total study hours (current + previous 4-week period)
  - [x] 2.3 `calculateTrendIndicator()` — compare last-4-week vs prior-4-week avg velocity, return trend direction + percent change
  - [x] 2.4 `generateVelocityChartAltText()` — accessibility description of trend

- [x] Task 3: Build LearningVelocityTrends component (AC: 1-5)
  - [x] 3.1 Load data from IndexedDB in parallel (importedVideos + contentProgress + studySessions), ignore flag, event listeners
  - [x] 3.2 Loading state card
  - [x] 3.3 Empty / insufficient-data state with informational note
  - [x] 3.4 Bar chart for weekly video completion with alt text (AC1 + AC5)
  - [x] 3.5 "View as table" toggle showing weekly counts (AC5)
  - [x] 3.6 Metric card: avg content per study hour + previous period comparison (AC2)
  - [x] 3.7 Trend indicator: icon + text label, conditional on ≥4 weeks data (AC3 + AC4)
  - [x] 3.8 Accessibility: data-testid attributes, ARIA labels, keyboard navigable trend indicator

- [x] Task 4: Integrate into Reports page (AC: all)
  - [x] 4.1 Import LearningVelocityTrends in Reports.tsx
  - [x] 4.2 Render below StudyTimeAnalytics with consistent spacing

- [x] Task 5: Run tests and fix (AC: all)
  - [x] 5.1 Run E2E tests against implementation
  - [x] 5.2 Fix any failures

## Implementation Plan

See [plan](plans/e08-s03-learning-velocity-and-trends.md) for full implementation details.

## Implementation Notes

### Architecture Decisions

- **Component structure**: Follows `StudyTimeAnalytics.tsx` pattern exactly — single component with `useEffect` for async data loading and `useMemo` for all derived state. No useEffect for derived state.
- **Weekly slots**: Anchored to `new Date()` (mocked to FIXED_DATE in tests), not most-recent event. Slot start = Monday of each week using `getStartOfWeek()`.
- **Video ID cross-reference**: `importedVideos` table → `Set<string>` of video IDs → used to filter both `contentProgress` and `studySessions`.
- **Data states**: 4 distinct states: loading, empty (0 weeks), insufficient (1 week), partial (2-3 weeks, no trend), full (≥4 weeks, all features).
- **Trend calculation**: `slice(-4)` for recent, `slice(-8, -4)` for prior; handles `prior4Avg === 0` edge case.
- **Metric formula**: Uses 30-min/video estimate to convert video watch time to "videos per hour".

### Key Lesson Learned: IndexedDB Compound PK in Tests

`contentProgress` uses `[courseId+itemId]` as compound primary key. Seeding the same `(courseId, itemId)` pair twice in different "weeks" causes the second `put()` to overwrite the first, collapsing all completions to the latest week. Tests must use **unique video IDs per completion event** — the `buildTestData()` helper in the spec generates fresh video IDs for each entry.

## Testing Notes

- **E2E spec**: `tests/e2e/story-e08-s03.spec.ts` — 13 tests covering all 5 ACs
- **Key pattern**: `buildTestData(weekCompletionCounts)` generates unique `(courseId, itemId)` pairs to avoid IndexedDB PK collision
- **Date mocking**: Full `Date` constructor + `Date.now()` override matching E08-S01 pattern
- **All 13 tests pass** (Chromium, local), smoke suite passes (no regressions)

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [x] All changes committed (`git status` clean)
- [x] No error swallowing — catch blocks log AND surface errors
- [x] useEffect hooks have cleanup functions (ignore flags for async, event listener removal)
- [x] No optimistic UI updates before persistence — state updates after DB write succeeds
- [x] Type guards on all dynamic lookups (e.g., `LABELS[type]` when type can be empty)
- [x] E2E afterEach cleanup uses `await` (not fire-and-forget)
- [x] Date handling uses `toLocaleDateString('sv-SE')` pattern (not `toISOString().split('T')[0]`)
- [x] Sidebar state seeded BEFORE `page.goto()` (context.addInitScript pattern)
- [x] `Math.max()` replaced with `.reduce()` for large arrays (E08-S01 lesson)
- [x] Weekly chart anchored to current date (FIXED_DATE in tests), not most-recent event
- [x] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference

## Design Review Feedback

[Populated by /review-story — Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story — adversarial code review findings]

## Challenges and Lessons Learned

### IndexedDB Compound PK Collision in E2E Tests

The `contentProgress` table uses `[courseId+itemId]` as a compound primary key. When tests seed multiple completions for the same video across different weeks, only the last `put()` survives — all completions collapse to a single week. Fixed by generating unique video IDs per completion event using a `buildTestData()` helper.

This pattern applies to any Dexie table with a compound primary key where you want to simulate history across time.
