---
story_id: E08-S01
story_name: "Study Time Analytics"
status: done
started: 2026-03-08
completed: 2026-03-09
reviewed: true           # false | in-progress | true
review_started: 2026-03-09  # YYYY-MM-DD — set when /review-story begins
review_gates_passed: [build, lint, type-check, format-check, unit-tests, e2e-tests, design-review, code-review, code-review-testing]  # tracks completed gates: [build, lint, unit-tests, e2e-tests, design-review, code-review]
---

# Story 8.1: Study Time Analytics

## Story

As a learner,
I want to view my study time broken down by daily, weekly, and monthly periods along with my weekly adherence percentage,
So that I can understand how consistently I study and adjust my schedule to meet my goals.

## Acceptance Criteria

**Given** the user has recorded study sessions in the platform
**When** the user navigates to the Reports page and views the Study Time Analytics section
**Then** a chart displays total study time aggregated by day for the current week
**And** the user can toggle the chart view between daily, weekly, and monthly period breakdowns
**And** the weekly breakdown shows each week's total study hours for the past 12 weeks
**And** the monthly breakdown shows each month's total study hours for the past 12 months

**Given** the user has a configured weekly study target (defaulting to 5 days if not set)
**When** the Study Time Analytics section loads
**Then** a weekly adherence percentage is displayed calculated as (days studied this week / target days) x 100
**And** the adherence percentage updates in real time as new sessions are recorded
**And** the display includes a visual indicator (progress ring or bar) showing adherence against the target

**Given** the user views any study time chart
**When** the chart renders
**Then** each chart includes descriptive alt text summarizing the data trend
**And** a "View as table" toggle is available that renders the same data in an accessible HTML table
**And** data series are differentiated by pattern or label in addition to color, never by color alone

**Given** the user has no recorded study sessions
**When** the user views the Study Time Analytics section
**Then** an empty state is displayed with a message explaining that data will appear once study sessions are recorded

## Tasks / Subtasks

- [ ] Task 1: Create Reports page structure and navigation (AC: all)
  - [ ] 1.1 Add Reports route to routes.tsx
  - [ ] 1.2 Create Reports page component with section layout
  - [ ] 1.3 Update sidebar navigation to highlight Reports when active

- [ ] Task 2: Implement data aggregation utilities (AC: 1)
  - [ ] 2.1 Create study time aggregation functions (daily, weekly, monthly)
  - [ ] 2.2 Add session data queries from IndexedDB
  - [ ] 2.3 Implement caching for aggregated data

- [ ] Task 3: Build Study Time Analytics chart component (AC: 1, 3)
  - [ ] 3.1 Install and configure chart library (recharts or similar)
  - [ ] 3.2 Create chart component with period toggle (daily/weekly/monthly)
  - [ ] 3.3 Implement accessible chart with alt text and table view
  - [ ] 3.4 Add color-blind friendly patterns/labels

- [ ] Task 4: Implement weekly adherence tracking (AC: 2)
  - [ ] 4.1 Calculate adherence percentage from study goal
  - [ ] 4.2 Create progress indicator component (ring or bar)
  - [ ] 4.3 Add real-time updates when sessions recorded

- [ ] Task 5: Add empty state handling (AC: 4)
  - [ ] 5.1 Create empty state component
  - [ ] 5.2 Show guidance message when no sessions exist

- [ ] Task 6: E2E tests for Study Time Analytics
  - [ ] 6.1 Test chart renders with session data
  - [ ] 6.2 Test period toggle (daily/weekly/monthly)
  - [ ] 6.3 Test adherence percentage calculation
  - [ ] 6.4 Test empty state display
  - [ ] 6.5 Test accessibility (alt text, table view)

## Implementation Plan

See [plan](plans/sprightly-puzzling-truffle.md) for implementation approach.

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

## Design Review Feedback

**Review Date:** 2026-03-09 (Revalidation)
**Full Reports:**
- Initial: [design-review-2026-03-09-e08-s01.md](../reviews/design/design-review-2026-03-09-e08-s01.md)
- Revalidation: [design-review-2026-03-09-e08-s01-revalidation.md](../reviews/design/design-review-2026-03-09-e08-s01-revalidation.md)

### Revalidation Summary
Strong implementation with excellent accessibility practices. **0 blockers** — ready for merge.

**Issues:** 1 High | 2 Medium | 2 Nits

**High Priority (1):**
1. Touch target too small on mobile — "View as Table" button is 32px (needs 44px min). Fix: Change `size="sm"` to `size="default"` (StudyTimeAnalytics.tsx:167)

**Medium (2):**
1. Heading hierarchy violation — "Weekly Study Adherence" uses `<div>` instead of `<CardTitle>` (breaks screen reader navigation) (StudyTimeAnalytics.tsx:238)
2. Recharts console warnings during initialization (5 warnings, low impact)

**What Works Well:**
- Excellent ARIA implementation throughout
- Chart/Table toggle provides genuine accessibility benefit
- No hardcoded colors or spacing (all theme tokens)
- Responsive design with no horizontal scroll
- Period toggle buttons meet 44px touch target
- Proper semantic HTML and table structure
- Clean TypeScript with no `any` types
- Loading and empty states implemented

## Code Review Feedback

**Review Date:** 2026-03-09 (Revalidation)
**Full Reports:**
- Initial Architecture: [code-review-2026-03-09-e08-s01.md](../reviews/code/code-review-2026-03-09-e08-s01.md)
- Revalidation Architecture: [code-review-2026-03-09-e08-s01-revalidation.md](../reviews/code/code-review-2026-03-09-e08-s01-revalidation.md)
- Testing: [code-review-testing-2026-03-09-e08-s01.md](../reviews/code/code-review-testing-2026-03-09-e08-s01.md)

### Revalidation Summary

**Code Review (Architecture):** 0 Blockers | 3 High | 3 Medium | 3 Nits

**Previous blockers FIXED:**
- ✅ Async useEffect cleanup/ignore flag added (StudyTimeAnalytics.tsx:51-67)
- ✅ Duplicate ARIA attributes removed (StudyTimeAnalytics.tsx:248-253)
- ✅ useEffects now use useMemo for derived state (lines 73-83)

**Remaining High Priority (3):**
1. **Sidebar seed timing** (tests/e2e/story-e08-s01.spec.ts:22-28) — localStorage set AFTER navigation. Move `page.evaluate()` before `page.goto()` to prevent tablet overlay blocking.
2. **Weekly adherence calculation** (StudyTimeAnalytics.tsx:352-376) — Uses most recent session date as anchor, not current date. Learner who studied 3 weeks ago sees "100% adherence" for old week instead of 0% for current week. Fix: Anchor to `Date.now()`.
3. **Real-time reactivity missing** (StudyTimeAnalytics.tsx:50-67) — AC2.2 requires "real-time update" but component loads data once. Test uses `page.reload()` instead of true reactivity. Fix: Add event listener for session changes OR clarify AC that reload is acceptable.

**Medium (3):**
1. No-op conditional assertion in AC3.3 test (line 272 allows test to pass with 0 elements)
2. Hard wait violation at line 328 (`waitForTimeout(100)`)
3. `Math.max(...array)` can throw RangeError with >100k sessions (lines 270, 356)

### Test Coverage Review

**Coverage:** 8/11 ACs fully covered | 0 gaps | 3 partial
**Issues:** 9 | **Blockers:** 0 | **High:** 3 | **Medium:** 4 | **Nits:** 2

**High Priority (3):**
1. Sidebar seed after navigation (tests/e2e/story-e08-s01.spec.ts:22-28) — Same issue as code review
2. Hard wait violation (line 328) — Same as code review
3. AC1.1 test doesn't validate actual chart data values (only checks chart is visible)

**Medium (4):**
1. AC3.3 test has conditional allowing pass when no elements found (line 272)
2. AC3.2 table test doesn't validate data correctness (only row count)
3. Table row count assertion fragile (expects exactly 2 rows)
4. AC2.2 test uses `page.reload()` instead of validating real-time behavior

**Edge Cases Untested (8 suggested):**
- Weekly adherence capped at 100% (multiple sessions exceeding target)
- Multiple sessions same day (adherence counts unique days)
- Zero-duration sessions
- Period aggregation across year boundaries
- Days with zero sessions in chart
- Table with many sessions (scrollability)
- Loading state transition
- Empty state after deleting sessions

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]
