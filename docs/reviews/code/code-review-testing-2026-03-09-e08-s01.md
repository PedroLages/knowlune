# Test Coverage Review: E08-S01 — Study Time Analytics
**Date:** 2026-03-09
**Reviewer:** Code Review Testing Agent
**Story:** E08-S01 Study Time Analytics

## Executive Summary

Test coverage review mapped all acceptance criteria to E2E tests. Coverage: 7/11 ACs fully covered, 1 gap (AC2.2 real-time update), 3 partial. Primary concerns: incomplete AC2.2 test with TODO, weak data validation assertions, hard wait violation, and 8 untested edge cases.

## AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| AC1.1 | Chart displays total study time aggregated by day for current week | None | story-e08-s01.spec.ts:22-54 | **Partial** |
| AC1.2 | User can toggle chart view between daily, weekly, and monthly period breakdowns | None | story-e08-s01.spec.ts:56-89 | **Partial** |
| AC1.3 | Weekly breakdown shows each week's total study hours for past 12 weeks | None | story-e08-s01.spec.ts:56-89 | **Partial** |
| AC1.4 | Monthly breakdown shows each month's total study hours for past 12 months | None | story-e08-s01.spec.ts:56-89 | **Partial** |
| AC2.1 | Weekly adherence percentage displayed, calculated as (days studied / target days) × 100 | None | story-e08-s01.spec.ts:91-129 | ✅ Covered |
| AC2.2 | Adherence percentage updates in real time as new sessions recorded | None | story-e08-s01.spec.ts:131-161 | **❌ Gap** |
| AC2.3 | Display includes visual indicator (progress ring or bar) showing adherence | None | story-e08-s01.spec.ts:91-129 | ✅ Covered |
| AC3.1 | Chart includes descriptive alt text summarizing data trend | None | story-e08-s01.spec.ts:163-189 | ✅ Covered |
| AC3.2 | "View as table" toggle renders same data in accessible HTML table | None | story-e08-s01.spec.ts:191-227 | ✅ Covered |
| AC3.3 | Data series differentiated by pattern or label, not color alone | None | story-e08-s01.spec.ts:229-256 | **Partial** |
| AC4 | Empty state displayed when no study sessions recorded | None | story-e08-s01.spec.ts:258-272 | ✅ Covered |

**Coverage:** 7/11 ACs fully covered | 1 gap | 3 partial

---

## Findings by Severity

### Blockers (1)

**B1: AC2.2 "real-time update" has incomplete test coverage**
- **Location:** `tests/e2e/story-e08-s01.spec.ts:131-161`
- **Confidence:** 92
- **Issue:** Test for "adherence percentage updates in real time as new sessions recorded" verifies initial 40% adherence but contains TODO comment at line 157 stating "Add session recording simulation once implemented". The commented assertion at line 160 is never executed. This means AC2.2's real-time requirement is not verified.
- **Fix:** Complete the existing test by seeding a third session via `seedStudySessions()` followed by `page.reload()`, then assert 60% adherence. This matches the pattern used in AC2.1 test.

### High Priority (3)

**H1: AC1.1 test has TODO for data validation**
- **Location:** `tests/e2e/story-e08-s01.spec.ts:53`
- **Confidence:** 88
- **Issue:** Test has TODO comment "Add assertions for specific data points once chart is implemented". Test verifies chart visibility but doesn't validate that the chart displays the actual aggregated study time data.
- **Fix:** Assert chart data points by querying rendered bars or inspecting the chart's data via `page.evaluate()` to access the React component state. Verify that 2 sessions seeded (1h + 1.5h) appear as separate daily bars.

**H2: AC1.2-1.4 test has TODOs for period toggle validation**
- **Location:** `tests/e2e/story-e08-s01.spec.ts:84-88`
- **Confidence:** 85
- **Issue:** Test has two TODO comments for verifying chart updates after period toggle. Test clicks weekly/monthly toggles but doesn't assert that chart data changes appropriately.
- **Fix:** After each toggle click, assert specific period labels appear in the chart. For weekly: verify "Week 1", "Week 12" labels present. For monthly: verify month labels like "Jan 2025", "Dec 2024" appear. Use `expect(chart.locator('text=Week')).toHaveCount(12)` pattern.

**H3: Hard wait violation**
- **Location:** `tests/e2e/story-e08-s01.spec.ts:305`
- **Confidence:** 72
- **Issue:** Test uses `await page.waitForTimeout(100)` which is an arbitrary 100ms wait after keyboard press to allow "state update". This violates the "No Hard Waits" quality criterion from test-quality.md.
- **Fix:** Replace with deterministic wait like `await expect(monthlyButton).toHaveClass(/bg-primary/)` with Playwright's built-in auto-retry. The 100ms wait is unnecessary since `expect()` already polls with timeout.

### Medium Priority (4)

**M1: AC3.3 test has weak assertion logic**
- **Location:** `tests/e2e/story-e08-s01.spec.ts:246-255`
- **Confidence:** 68
- **Issue:** Test for color-blind accessibility queries for elements with `role="img"` or `role="graphics-symbol"` but Recharts bars may not have these roles. The conditional `if (count > 0)` allows test to pass even when no elements are found, violating the "No Conditionals" quality rule.
- **Fix:** Remove conditional and assert that at least one bar element has an aria-label. Use a more reliable selector like `chart.locator('[data-testid="study-time-chart"] .recharts-bar-rectangle')` and verify each has accessible text or pattern fill.

**M2: AC3.2 table test doesn't validate data correctness**
- **Location:** `tests/e2e/story-e08-s01.spec.ts:226`
- **Confidence:** 65
- **Issue:** Test asserts 2 rows exist (matching 2 sessions) but doesn't validate that the period labels and study time values are correct.
- **Fix:** Add assertions verifying specific table cell contents. For example, check that table contains "Jan 13" row with "60" minutes and "Jan 14" row with "90" minutes (derived from test sessions).

**M3: Table row count assertion may be fragile**
- **Location:** `tests/e2e/story-e08-s01.spec.ts:207-213`
- **Confidence:** 62
- **Issue:** Test expects exactly 2 rows (line 226) but the aggregation logic filters rows with `studyTime > 0` (StudyTimeAnalytics.tsx:207). If daily view includes empty days from 7-day window, the count will exceed 2. This test passes currently because it seeds sessions on recent dates, but could break if seed dates change.
- **Fix:** Assert on visible rows containing specific data rather than exact count. Use `await expect(table.locator('tbody tr').filter({ hasText: 'Jan' })).toHaveCount(2)` to verify only non-zero rows appear.

**M4: Test data has inconsistent date handling**
- **Location:** `tests/e2e/story-e08-s01.spec.ts:31`
- **Confidence:** 62
- **Issue:** Test comment says "// 2 days ago" but uses `getRelativeDate(-2)` which calculates date relative to FIXED_DATE (2025-01-15). The comment assumes FIXED_DATE is "today" but this isn't clear to readers unfamiliar with test-time.ts.
- **Fix:** Clarify comment: "// 2 days before FIXED_DATE (2025-01-13)".

### Nits (2)

**N1: Test couples to implementation details**
- **Location:** `tests/e2e/story-e08-s01.spec.ts:309`
- **Confidence:** 50
- **Issue:** Test verifies monthly button becomes active by checking for `bg-primary` CSS class. This couples test to implementation details (Tailwind classes). While acceptable for button variant testing, consider adding a `data-active` attribute to Button component when variant="default" for more stable selector.

**N2: Incomplete TODO comments**
- **Location:** Multiple locations (lines 53, 84, 88, 157)
- **Confidence:** 45
- **Issue:** Multiple TODO comments left in test assertions indicate incomplete test coverage.

## Edge Cases (Untested)

1. **Weekly adherence boundary case:** Tests seed 1-3 sessions but don't verify adherence calculation when days studied exceeds target (e.g., 7 days studied / 5 target = 100%, not 140%). Implementation caps at 100% (StudyTimeAnalytics.tsx:365) but no test validates this edge case.

2. **Period aggregation across year boundaries:** Monthly view test seeds 20 sessions across 20 weeks but doesn't verify correct handling when data spans multiple years (e.g., Dec 2024 vs Jan 2025). Implementation formats with year (StudyTimeAnalytics.tsx:316) but no test validates this label format.

3. **Zero-duration session handling:** Factory creates sessions with duration 3600 (1 hour) but implementation converts to minutes (`Math.round(session.duration / 60)`). No test validates that zero-duration or sub-minute sessions are handled correctly.

4. **Chart render with loading state:** Tests seed data and call `page.reload()` to trigger component re-render, but don't verify that chart displays loading state before data appears. Implementation has `loading` state (StudyTimeAnalytics.tsx:46) but no test exercises the transition from loading=true to loaded.

5. **Weekly adherence with sessions on same day:** All tests seed sessions on different days. No test validates adherence calculation when multiple sessions occur on the same day (should count as 1 day studied, not 2).

6. **Table view with many sessions:** Test seeds 2 sessions and verifies 2 rows. No test validates table rendering with 20+ sessions across 12 weeks/months to ensure table is scrollable and doesn't overflow viewport.

7. **Chart data when period has no sessions:** Daily view shows 7 days, but tests seed sessions on only 2-3 days. No explicit test validates that chart displays 0-minute bars for days without sessions (implementation sets missing days to 0, lines 270-271).

8. **Real-time update without page reload:** AC2.2 specifies "updates in real time" but test uses `page.reload()` to simulate new session. This doesn't verify that component listens to IndexedDB changes without reload. Implementation loads data once in useEffect (lines 53-66) with no subscription to DB changes.

## Test Quality Assessment

### What Works Well ✅
- Uses deterministic time utilities (`FIXED_DATE`, `getRelativeDate`, `addMinutes`) correctly
- Uses shared seeding helper (`seedStudySessions`) with retry logic
- Tests are isolated (no shared state between tests)
- Uses data-testid selectors appropriately
- Proper use of Playwright locators and role-based queries

### Areas for Improvement ⚠️
- Multiple TODO comments indicate incomplete assertions
- One hard wait violation (`waitForTimeout(100)`)
- Several tests verify presence but not data correctness
- No edge case coverage for boundary conditions
- No unit tests for data aggregation or calculation logic

## Recommendations

1. **First:** Complete AC2.2 test implementation (Blocker) - this is the only untested AC
2. **Second:** Remove hard wait and replace with deterministic assertion (High Priority)
3. **Third:** Add data validation assertions to AC1.1 and AC1.2-1.4 tests (High Priority)
4. **Fourth:** Fix weak assertion logic in AC3.3 test (Medium)
5. **Fifth:** Consider adding unit tests for `aggregateSessionsByPeriod` and `calculateWeeklyAdherence` helper functions to validate edge cases without E2E overhead
6. **Sixth:** Add at least 2-3 edge case tests from the list above

---
**ACs:** 7 covered / 11 total | **Findings:** 10 | **Blockers:** 1 | **High:** 3 | **Medium:** 4 | **Nits:** 2
**Edge Cases:** 8 untested scenarios
