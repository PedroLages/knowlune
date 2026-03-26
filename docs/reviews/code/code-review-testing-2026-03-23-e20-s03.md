## Test Coverage Review: E20-S03 — 365 Day Activity Heatmap

### AC Coverage Summary

**Acceptance Criteria Coverage:** 4/5 ACs tested (**80%**)

**COVERAGE GATE:** PASS (>=80%)

### AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1 | 52x7 heatmap grid, 5 intensity levels, legend | `activityHeatmap.test.ts:141–219` (grid shape, levels, month labels) | `story-e20-s03.spec.ts:75–93` (card visible, cell count >300) | Covered |
| 2 | Tooltip shows date + study duration on hover | None | `story-e20-s03.spec.ts:95–110` (hover Mar 20 cell, tooltip text) | Partial |
| 3 | Color+opacity differentiation, alt text, "View as table" toggle | None | `story-e20-s03.spec.ts:112–129` (toggle click, table visible, toggle back) | Partial |
| 4 | Empty state when no data | None | `story-e20-s03.spec.ts:131–156` (card visible, "0 active days" text) | Covered |
| 5 | heatmap-empty through heatmap-level-4 design tokens, dark mode | None | None | Gap |

**Coverage**: 4/5 ACs with at least one test | 1 gap (AC5) | 2 partial (AC2, AC3)

---

### Test Quality Findings

#### Blockers (untested ACs)

No ACs have zero coverage. The coverage gate passes at 80%.

#### High Priority

- **`tests/e2e/regression/story-e20-s03.spec.ts:104` (confidence: 85)**: AC2 tooltip test is guarded by a conditional `if ((await cellWithActivity.count()) > 0)` block. If no matching cell is found the test passes vacuously — it can never fail on a regression where the tooltip entirely stops working. The assertion inside must always execute.
  Fix: replace the conditional guard with a hard `await expect(cellWithActivity).toHaveCount(1)` assertion before the hover, making the test fail rather than silently skip when the seeded session cell is absent.

- **`tests/e2e/regression/story-e20-s03.spec.ts:107–108` (confidence: 78)**: The tooltip content assertion uses the alternation `/30 min|No activity/`, which means it passes even when the cell with a seeded 30-minute session shows "No activity" — exactly the broken state we want to detect.
  Fix: replace with a strict `toContainText('30 min')` so a data-aggregation regression is caught.

- **`src/app/pages/__tests__/Reports.test.tsx` (confidence: 80)**: The Reports unit test renders the real `ActivityHeatmap` component (it is not mocked). `ActivityHeatmap` calls `db.studySessions.toArray()` on mount (line 50 of `ActivityHeatmap.tsx`), but `@/db` is not mocked in `Reports.test.tsx`. Depending on the Vitest environment this either silently swallows the error (entering the loading state forever) or throws. Either way the unit test cannot verify heatmap integration in the Reports page — it merely confirms the page does not hard-crash.
  Fix: add `vi.mock('@/app/components/reports/ActivityHeatmap', ...)` in `Reports.test.tsx` alongside the other component mocks, or mock `@/db` at the module boundary.

#### Medium

- **`src/lib/__tests__/activityHeatmap.test.ts` — AC5 design token usage (confidence: 72)**: No test verifies that `LEVEL_CLASSES` in `ActivityHeatmap.tsx` maps to `bg-heatmap-*` Tailwind classes rather than hardcoded colors. The ESLint `design-tokens/no-hardcoded-colors` rule guards against this at save-time, but a unit test that renders the component and asserts the presence of heatmap token class names would give stronger regression protection.
  Suggested test: in a new `src/app/components/reports/__tests__/ActivityHeatmap.test.tsx`, render the component with a mocked `@/db` returning one session at level-4 duration, then assert `getByRole('img', { name: /Mar/ })` has `bg-heatmap-level-4` in its `className`.

- **`src/lib/__tests__/activityHeatmap.test.ts` — AC3 alt text content (confidence: 72)**: The alt text format (`"Fri, Mar 20: 30 min studied"`) is assembled in `ActivityHeatmap.tsx` at lines 220–223, but no unit test covers the assembly logic. The `formatStudyTime` sub-function is tested, but the `ariaLabel` concatenation is not.
  Suggested test: render `ActivityHeatmap` (with mocked `@/db`) containing a 30-min session on a known date, then assert `getByRole('img', { name: 'Fri, Mar 20: 30 min studied' })` is present.

- **`src/lib/__tests__/activityHeatmap.test.ts:78–135` — `aggregateSessionsByDay` uses literal `TODAY` string (confidence: 65)**: All tests hardcode `const TODAY = '2026-03-23'`. This is equivalent to a `FIXED_DATE` constant and avoids `Date.now()` — which is correct. However, the constant is local to the describe block without a comment explaining why it is pinned. When the project's actual date advances, a test like "includes today in the range" will still pass because `today` is a parameter, not a live clock call. This pattern is good and just needs a brief inline comment for clarity.
  Fix: add `// pinned: deterministic date, matches project FIXED_DATE convention` above the constant.

- **`tests/e2e/regression/story-e20-s03.spec.ts:66–68` (confidence: 62)**: `afterEach` cleanup clears `studySessions` with the shared `clearIndexedDBStore` helper. This is correct. However, the `localStorage` keys set in `addInitScript` (`study-log`, `knowlune-sidebar-v1`) are never cleared between tests. Because `addInitScript` is scoped to the page context and each test gets a fresh page context from the fixture, this is harmless in practice — but it is worth confirming the fixture creates a fresh context per test (standard Playwright behavior with the default `page` fixture, which it does).

#### Nits

- **Nit** `tests/e2e/regression/story-e20-s03.spec.ts:90` (confidence: 55): The comment says "365 days = at least 365 cells" but the check is `count > 300`. The threshold leaves a 65-cell gap. Tightening to `>= 364` (allowing for the partial first week) would catch a regression where only a few months are rendered.

- **Nit** `tests/e2e/regression/story-e20-s03.spec.ts` (confidence: 50): The `goToReportsWithActivity` helper inlines the `makeSession` call and seeds only a single session at level-2 duration (1800 s = 30 min). No E2E test exercises level-3 or level-4 cells. An additional seeded session at >=5400 s on a second date would confirm the upper end of the intensity scale renders in the DOM.

- **Nit** `src/lib/__tests__/activityHeatmap.test.ts:260–288` (confidence: 45): `formatStudyTime` is tested thoroughly, including exact-boundary values. The only missing case is `formatStudyTime(60)` (exactly 1 minute) — currently covered implicitly by the "returns minutes only when under 1 hour" case at 900 s, but an explicit 60-second case would document the expected output of "1 min".

---

### Edge Cases to Consider

1. **Session spanning midnight**: `aggregateSessionsByDay` assigns the session to the date of `startTime`. A session starting at 23:58 and ending at 00:05 the next day will credit 7 minutes only to the start date. This is the intended behavior but is not explicitly tested. Given the policy is "startTime wins", a test asserting this boundary would prevent future ambiguity.

2. **`study-log-updated` event refresh**: `ActivityHeatmap.tsx` registers a `window.addEventListener('study-log-updated', handler)` refresh path (lines 69–81). No test — unit or E2E — fires this event and verifies the grid re-renders with new data. This is a state-transition gap.
   Suggested E2E test: after initial page load, dispatch `window.dispatchEvent(new Event('study-log-updated'))`, seed an additional session via `seedStudySessions`, then assert the active-day count text increments.

3. **Loading skeleton**: The `activity-heatmap-skeleton` (`data-testid="activity-heatmap-skeleton"`) state is defined in the component (line 99) but is never asserted in any test. While hard to test in unit context (IndexedDB resolves synchronously in the mock), an integration test could verify the skeleton is shown before the DB promise resolves and hidden afterward.

4. **Table empty-row when toggled with no data**: The table path renders a "No study sessions recorded yet" row when `monthlySummary.length === 0` (line 157–163 of `ActivityHeatmap.tsx`). The AC4 E2E test (`story-e20-s03.spec.ts:131`) navigates without sessions and validates the grid's "0 active days" text, but does NOT click "View as table" to verify the empty-row message appears. This is a sub-state of AC4 that is untested at the E2E level.

5. **Partial last week padding**: `buildHeatmapGrid` pads the end of the last week with nulls (line 108 of `activityHeatmap.ts`). The existing unit test at line 201–218 covers partial first-week padding, but no test covers a range whose last day is not Saturday (i.e., end padding). A test with a range ending on a Monday would validate that padding cells are counted only in the null-entry logic, not as real activity.

---

ACs: 4 covered / 5 total | Findings: 9 | Blockers: 0 | High: 3 | Medium: 3 | Nits: 3
