## Test Coverage Review: E18-S06 — Display Quiz Performance in Overview Dashboard

### AC Coverage Summary

**Acceptance Criteria Coverage:** 3/4 ACs tested (**75%**)

**COVERAGE GATE:** BLOCKER (<80%) — AC2 (skeleton loading state) has zero test coverage. Must add at least one test before approval.

---

### AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1 | Card shows total quizzes, average score, completion rate when quizzes exist | `src/lib/__tests__/quizMetrics.test.ts:17-79` (all 6 cases) | `tests/e2e/story-e18-s06.spec.ts:35-59` | Covered |
| 2 | Skeleton loading state shown while Dexie queries run | None | None | Gap |
| 3 | Clicking card navigates to `/reports?tab=quizzes`; "View Detailed Analytics" link also navigates there | None | `tests/e2e/story-e18-s06.spec.ts:61-72` (card click), `tests/e2e/story-e18-s06.spec.ts:86-99` (link click) | Covered |
| 4 | Empty state shown when no quizzes — text + "Find Quizzes" CTA | None | `tests/e2e/story-e18-s06.spec.ts:74-84` | Partial |

**Coverage**: 3/4 ACs fully covered | 1 gap (AC2) | 1 partial (AC4) | Total: 75%

---

### Test Quality Findings

#### Blockers (untested ACs)

- **(confidence: 97)** AC2: "Skeleton loading state shown while Dexie queries run" has zero test coverage. No reference to `data-testid="quiz-performance-skeleton"` exists anywhere in the test suite (`grep` across `tests/` returns no matches). The skeleton is rendered when `metrics === null` (before the `useEffect` resolves), but no test intercepts the loading window to assert it. This is the single finding that drives the coverage gate failure.

  Suggested test — add to `tests/e2e/story-e18-s06.spec.ts` as a new case inside the existing `describe` block:

  ```
  test('AC2: skeleton visible during initial data load', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('knowlune-sidebar-v1', 'false')
    })
    // Navigate without waiting for full load
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    // Skeleton should be present before the async calculateQuizMetrics() resolves
    await expect(page.getByTestId('quiz-performance-skeleton')).toBeVisible()
    // Then it should disappear once data loads
    await expect(page.getByTestId('quiz-performance-skeleton')).not.toBeVisible({ timeout: 5000 })
  })
  ```

  The component always starts with `metrics === null` and renders `<QuizPerformanceSkeleton>` on first paint before the `calculateQuizMetrics()` promise resolves. The E2E navigation uses `waitUntil: 'domcontentloaded'` which lands before React's async effect fires, making the skeleton reliably catchable without any artificial delay.

#### High Priority

- **`tests/e2e/story-e18-s06.spec.ts` — missing `afterEach` cleanup for seeded `quizAttempts` records (confidence: 85)**

  The spec uses `seedQuizAttempts()` directly from `tests/support/helpers/indexeddb-seed.ts`, bypassing the `indexedDB` fixture that tracks seeded IDs and auto-cleans them in teardown. No `afterEach` block calls `clearIndexedDBStore` or `indexedDB.clearStore('quizAttempts')`. Three tests (AC1, AC3, AC3b) each seed records that persist into the next test's browser context.

  The AC4 test is the most directly at risk: it intentionally seeds nothing and waits for the empty state. If the test runner reuses the browser context from a prior test that seeded attempts (Playwright's default within a `describe` block), the AC4 test will see stale data and the empty state will never appear.

  Fix: add an `afterEach` block that calls `clearIndexedDBStore(page, 'ElearningDB', 'quizAttempts')` from `tests/support/helpers/indexeddb-seed.ts`, or switch to using the `indexedDB` fixture so cleanup is automatic:

  ```typescript
  test.afterEach(async ({ page }) => {
    await clearIndexedDBStore(page, 'ElearningDB', 'quizAttempts')
  })
  ```

  Note: `clearIndexedDBStore` is already exported from `tests/support/helpers/indexeddb-seed.ts:167`.

- **`tests/e2e/story-e18-s06.spec.ts:26-28` — module-level factory calls with `crypto.randomUUID()` create shared mutable test data (confidence: 78)**

  `attempt1`, `attempt2`, and `attempt3` are constructed once at module load time. `makeAttempt()` calls `crypto.randomUUID()` for `quizId` (no override provided), so each attempt gets a stable ID for the `id` field (overridden explicitly), but the `quizId` field is random-at-load and shared across all tests. This is not a correctness issue for this story since `calculateQuizMetrics` ignores `quizId`, but it violates the test isolation principle: test data should be constructed inside each test or inside `beforeEach`. If the `QuizAttempt` type gains a `quizId`-indexed query in a future story, these shared objects will cause silent cross-contamination.

  Fix: move factory calls inside a `beforeEach` or inline them within each test.

#### Medium

- **`tests/e2e/story-e18-s06.spec.ts:82` — `getByText(/No quizzes completed yet/)` is a partial-text regex matcher against prose copy (confidence: 72)**

  The actual string in `src/app/components/dashboard/QuizPerformanceCard.tsx:65` is `"No quizzes completed yet. Start a quiz to track your progress!"`. The regex `/No quizzes completed yet/` matches correctly today, but text-based selectors are fragile: any copy edit to the first five words would silently break the assertion without a `data-testid` providing a stable hook.

  The empty-state container already has `data-testid="quiz-performance-empty"` (line 58 of `QuizPerformanceCard.tsx`), and the test already asserts that at line 79. The prose assertion on line 82 adds little confidence beyond the `data-testid` check and is the weaker of the two selectors.

  Fix: either remove the prose assertion in favour of relying on `data-testid="quiz-performance-empty"` alone, or strengthen it by asserting the full known string with `{ exact: true }`.

- **`src/lib/__tests__/quizMetrics.test.ts` — no `beforeEach` mock reset; Vitest global `clearMocks` is not configured (confidence: 74)**

  `vite.config.ts` does not set `test.clearMocks`, `test.resetMocks`, or `test.restoreMocks` globally. The module-level `const mockToArray = db.quizAttempts.toArray as ReturnType<typeof vi.fn>` is reused across all six `it` blocks. Each test calls `mockToArray.mockResolvedValue(...)` which does override the prior value, but the call history accumulates. If a future test uses `toHaveBeenCalledTimes` or `toHaveBeenCalledWith` it will see calls from earlier tests.

  Fix: add `beforeEach(() => { mockToArray.mockClear() })` inside the `describe` block, or enable `test.clearMocks: true` globally in `vite.config.ts`.

- **`tests/e2e/story-e18-s06.spec.ts:50` — `card.getByText('3')` is an ambiguous text match (confidence: 68)**

  `getByText('3')` with no scoping beyond the card element will match any element inside the card containing the single character `'3'`. If the card renders any other numeric value that happens to be `3` (e.g., a count badge, an icon label, or an ARIA attribute rendered as visible text), the assertion passes for the wrong element. The metric value is rendered inside a `<span class="text-sm font-semibold tabular-nums">` with no `data-testid`.

  Fix: add a `data-testid` to each `MetricRow` value cell (e.g., `data-testid="metric-total-quizzes"`) and assert `card.getByTestId('metric-total-quizzes').toHaveText('3')`.

#### Nits

- **Nit** `tests/e2e/story-e18-s06.spec.ts:14-20` (confidence: 55): `navigateToOverview` uses `page.addInitScript()` to set the sidebar key. This is correct for new navigation but it silently has no effect if the test calls `page.reload()` later without re-applying the script — `addInitScript` scripts persist for the page lifetime so a `page.reload()` will re-execute them, which is fine here. However the helper is not exported; if other specs need the same guard it would need to be duplicated. Consider moving it to `tests/support/helpers/navigation.ts` alongside the existing `goToOverview` helper.

- **Nit** `tests/e2e/story-e18-s06.spec.ts:80` (confidence: 52): `{ timeout: 5000 }` is a magic number. The project's established timeout constant pattern (see `test-patterns.md`) recommends defining named constants. The project's default `expect` timeout from Playwright config should handle this case without an explicit override; if the Dexie async is the concern, the `waitUntil: 'domcontentloaded'` + React render cycle should settle well within the default. Consider removing the explicit timeout and relying on Playwright's auto-retry.

- **Nit** `src/lib/__tests__/quizMetrics.test.ts:14` (confidence: 50): The cast `as ReturnType<typeof vi.fn>` is weaker than `vi.mocked(db.quizAttempts.toArray)`. Using `vi.mocked()` preserves the original function's type signature on the mock, making `.mockResolvedValue()` type-safe against the actual return type `Promise<QuizAttempt[]>`. The current cast allows `mockResolvedValue` to accept any shape without a type error.

---

### Edge Cases to Consider

1. **`averageScore` rounding at the display layer is untested.** `calculateQuizMetrics()` returns a raw float (e.g., `66.666...` for attempts of 60/70/70). `QuizPerformanceCard.tsx:117` applies `Math.round()` before rendering. No unit or E2E test verifies this rounding — an attempt set of `[33, 34]` would display `34%` not `33%`. Add a unit case with non-integer averages and an E2E assertion that verifies the displayed string matches `Math.round(expected)`.

2. **Concurrent mount/unmount race is exercised only by the `ignore` flag in source code, not in any test.** The implementation uses the ignore-flag pattern (`QuizPerformanceCard.tsx:86-92`) to guard against setting state after unmount. No test verifies that rapidly navigating away before the Dexie query resolves does not produce a React state-update-on-unmounted-component error. This is acceptable for initial coverage but worth noting as a future robustness test.

3. **AC4 "Find Quizzes" CTA navigates to `/courses`, not to a quiz-specific route.** `QuizPerformanceCard.tsx:68` renders `<Link to="/courses">Find Quizzes</Link>`. The AC4 E2E test at line 83 only asserts the link is visible (`getByRole('link', { name: /Find Quizzes/i })`); it does not click it and verify the destination URL. If the route is intentional, a comment in the test acknowledging this would improve clarity. If the route should eventually point to a quiz catalog, a TODO should be left in both the source and test.

4. **Single-attempt average score equality check.** The unit test `handles single attempt correctly` at `quizMetrics.test.ts:58` uses `toBe(75)` (strict equality) on a floating-point result derived from `75 / 1`. This is safe because integer division by 1 is exact, but the pattern is inconsistent with other tests that use `toBeCloseTo`. Consistency prevents surprises if the calculation ever changes to a weighted formula.

---

ACs: 3 covered / 4 total | Findings: 9 | Blockers: 1 | High: 2 | Medium: 3 | Nits: 3
