## Test Coverage Review: E18-S07 — Surface Quiz Analytics in Reports Section

### AC Coverage Summary

**Acceptance Criteria Coverage:** 1/4 ACs tested (**25%**)

**COVERAGE GATE: BLOCKER (<80%)**

### AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1 | Quiz Analytics tab with all metrics (total quizzes, avg score, completion rate, retake frequency, recent attempts, top/bottom performers) | None — `calculateQuizAnalytics()` not imported or called in `src/lib/__tests__/analytics.test.ts`; `Reports.test.tsx` mocks `QuizAnalyticsDashboard` wholesale | None — `tests/e2e/reports-redesign.spec.ts` never clicks the "Quiz Analytics" tab | Gap |
| 2 | Empty state when no quiz data ("No quiz data yet. Complete a quiz to see your analytics.") | None | None | Gap |
| 3 | Quiz detail navigation to `/reports/quiz/:quizId` | None — route not registered in `src/app/routes.tsx`; task 4 explicitly unimplemented | None | Gap |
| 4 | Responsive layout: metric cards 3-col on desktop, 1-col on mobile | Reports.test.tsx only checks page renders (no viewport test); QuizAnalyticsDashboard is mocked so the grid markup is never exercised | None — `reports-redesign.spec.ts` responsive test covers the Study Analytics bar chart overflow, not the quiz metric card grid | Partial |

**Coverage**: 0/4 ACs fully covered | 3 gaps | 1 partial

---

### Test Quality Findings

#### Blockers (untested ACs)

- **(confidence: 98)** AC1: "Quiz Analytics tab with metrics" has no test. `src/lib/__tests__/analytics.test.ts` imports `analyzeTopicPerformance`, `calculateImprovement`, `calculateNormalizedGain`, `calculateRetakeFrequency`, `interpretRetakeFrequency`, `calculateItemDifficulty`, and `calculateDiscriminationIndices` — but `calculateQuizAnalytics` (the new E18-S07 function at `src/lib/analytics.ts:45`) is never imported or exercised. The function contains non-trivial aggregation: grouping attempts by quizId, computing per-quiz averages with `Math.round`, deriving `completionRate` via `uniqueQuizzes / totalQuizzesAvailable`, sorting top/bottom performers, and slicing the most-recent-5. None of this is verified. Suggested test: `describe('calculateQuizAnalytics')` in `src/lib/__tests__/analytics.test.ts` with at least five cases — empty state returns zeroed struct; single quiz single attempt; multiple quizzes multiple attempts verifying `totalQuizzesCompleted`, `averageScore`, `completionRate`, `averageRetakeFrequency`, `recentAttempts` order, and `topPerforming`/`needsImprovement` ordering; `quizTitle` fallback to "Unknown Quiz" when quizId not in `db.quizzes`; and `completionRate = 0` when `totalQuizzesAvailable = 0`.

- **(confidence: 97)** AC2: "Empty state when no quiz data" has no test. `QuizAnalyticsDashboard.tsx:65` renders `<EmptyState>` when `summary.totalQuizzesCompleted === 0`, with the specific text "No quiz data yet" and description "Complete a quiz to see your analytics." and an `actionHref="/courses"` CTA. Neither a unit test for `QuizAnalyticsDashboard` itself nor an E2E test exercises this path. Suggested test: E2E spec `tests/e2e/regression/story-e18-s07.spec.ts` — seed empty IndexedDB (no quiz attempts), navigate to `/reports?tab=quizzes`, assert `getByText('No quiz data yet')` is visible and `getByRole('link', { name: 'Browse Courses' })` is present.

- **(confidence: 97)** AC1 (E2E dimension): The "Quiz Analytics" tab trigger is never clicked in any E2E test. `tests/e2e/reports-redesign.spec.ts` covers the "Study Analytics" and "AI Analytics" tab switch but never asserts that the "Quiz Analytics" tab exists, is clickable, or that `QuizAnalyticsDashboard` content renders. Suggested test in `tests/e2e/regression/story-e18-s07.spec.ts`: seed at least one quiz attempt via `seedQuizAttempts`, navigate to `/reports`, click `getByRole('tab', { name: 'Quiz Analytics' })`, then assert `data-testid="quiz-metric-cards"` is visible and the `data-testid="quiz-total-count"`, `data-testid="quiz-avg-score"`, `data-testid="quiz-completion-rate"`, and `data-testid="quiz-retake-frequency"` values match seeded data.

- **(confidence: 95)** AC3: "Quiz detail navigation to `/reports/quiz/:quizId`" has no test AND the route is unregistered. `src/app/routes.tsx` only has a bare `path: 'reports'` with no children. The `Link` elements in `QuizAnalyticsDashboard.tsx:185,215,248` produce `/reports/quiz/:quizId` hrefs but clicking them results in a 404. This AC cannot be tested until task 4 (QuizDetailAnalytics page + route) is implemented. The story file documents this as intentionally unimplemented — but the AC remains unverified and must be blocked.

- **(confidence: 92)** AC4: "Responsive layout 3-col to 1-col on mobile" has no test. `QuizAnalyticsDashboard.tsx:83` uses `grid-cols-1 sm:grid-cols-3` for the metric card row. `Reports.test.tsx` mocks `QuizAnalyticsDashboard` completely (line 120-124), so the grid markup is never rendered in unit tests. `reports-redesign.spec.ts` only verifies `overflow-x-auto` and `min-w-[480px]` on the Study Analytics bar chart, not the quiz metric card layout. Suggested test: E2E spec — `page.setViewportSize({ width: 375, height: 812 })`, navigate to `/reports?tab=quizzes` with seeded data, assert `data-testid="quiz-metric-cards"` has computed column count of 1 (or use bounding-box checks to verify cards stack vertically).

#### High Priority

- **`src/lib/__tests__/analytics.test.ts` (confidence: 90)**: `calculateQuizAnalytics` sorts `needsImprovement` via `[...sortedByScore].reverse().slice(0, 5)` (`analytics.ts:107`). When exactly 5 quizzes exist, `needsImprovement` and `topPerforming` will contain the same 5 quizzes in reverse order — not a bug, but the behavior is untested. When more than 5 exist, the bottom-5 boundary is also untested. Fix: add unit test cases for exactly 5 quizzes and for 6+ quizzes verifying that `topPerforming` contains the highest 5 and `needsImprovement` contains the lowest 5 with no overlap.

- **`src/lib/__tests__/analytics.test.ts` (confidence: 88)**: `calculateQuizAnalytics` computes `completionRate = Math.round((uniqueQuizzes / totalQuizzesAvailable) * 100)` (`analytics.ts:95`). When `totalQuizzesAvailable = 0` (db.quizzes returns empty array but db.quizAttempts returns attempts with orphaned quizIds), the guard on line 95 returns `0` — but this path is unreachable in practice only if the `allAttempts.length === 0` early-return fires first. If quizAttempts exist for quizIds not in db.quizzes, `totalQuizzesAvailable` could be 0 while attempts exist. Fix: add a unit test that mocks `db.quizzes.toArray` returning `[]` while `db.quizAttempts.toArray` returns one attempt, asserting `completionRate === 0`.

- **`src/app/components/reports/QuizAnalyticsDashboard.tsx` error path (confidence: 85)**: The `useEffect` at line 39-42 logs `console.error('Failed to load quiz analytics:', err)` and sets `loading = false` but does not set any error state or render user-visible feedback. The component silently displays nothing (loading resolves, `summary` remains `null`, triggers the empty-state branch — which is misleading). This is both a silent-failure code issue and a missing test: no test verifies that a Dexie rejection renders a meaningful error state rather than the "No quiz data" empty state. Fix: add `error` state and render an error message distinct from the empty state; add a unit test for `QuizAnalyticsDashboard` mocking `calculateQuizAnalytics` to reject, asserting an error message appears.

#### Medium

- **`src/app/pages/__tests__/Reports.test.tsx:120-124` (confidence: 80)**: `QuizAnalyticsDashboard` is mocked to a static stub `<div data-testid="quiz-analytics-dashboard">`. This is correct for isolating the Reports page unit tests, but it means the unit test suite has zero assertion coverage that the "Quiz Analytics" tab panel (`<TabsContent value="quizzes">`) actually mounts the real component. The existing test at line 231-251 only checks Study Analytics content. Fix: add a test within `Reports.test.tsx` that renders with `<MemoryRouter initialEntries={['/reports?tab=quizzes']}>` and asserts `screen.getByTestId('quiz-analytics-dashboard')` is in the document — this at minimum verifies the tab wiring is correct.

- **`tests/e2e/reports-redesign.spec.ts:81-97` (confidence: 75)**: The empty-state test uses `localStorage.clearAll()` then navigates, but the `addInitScript` for sidebar occurs after `page.goto('/reports')` — the script fires before the *reload*, not before the initial navigation. The `addInitScript` registers a function to run before page load but it is only called on the subsequent `page.reload()`, not the first `page.goto('/reports')` on line 84. This means the Reports page could render with the sidebar open on tablet viewports, potentially obscuring the empty-state assertion. Fix: call `page.addInitScript` before `page.goto`, consistent with the mobile responsive test at line 129-134 which correctly seeds before `goto`.

- **`src/lib/__tests__/analytics.test.ts` (confidence: 73)**: `calculateQuizAnalytics` uses `db.quizzes.toArray` in addition to `db.quizAttempts.toArray`, but the existing `vi.mock('@/db')` at line 21-27 only stubs `quizAttempts.toArray`. Any unit test for `calculateQuizAnalytics` will need to extend the mock to include `quizzes: { toArray: vi.fn() }`. This is an infrastructure gap that will cause test failures unless addressed before writing the tests.

#### Nits

- **Nit `src/app/components/reports/QuizAnalyticsDashboard.tsx:174`** (confidence: 60): `new Date(attempt.completedAt).toLocaleDateString()` without a locale argument produces locale-dependent output, which can cause E2E date assertion failures across environments. The engineering patterns doc (`engineering-patterns.md`) recommends `toLocaleDateString('sv-SE')` for deterministic formatting. Suggest either fixing the display format or asserting only that a date-shaped string is present in E2E tests (not an exact value).

- **Nit `src/app/pages/__tests__/Reports.test.tsx` (confidence: 50)**: The four existing tests (lines 213-253) all re-render `<MemoryRouter><Reports /></MemoryRouter>` without a `initialEntries` prop, defaulting to `?tab=` unset. The `activeTab` logic in `Reports.tsx:71` falls back to `'study'`, so these tests only ever exercise the Study Analytics tab. Consider adding `initialEntries={['/reports?tab=quizzes']}` in one test to ensure the tab state URL parameter is correctly parsed.

---

### Edge Cases to Consider

- **`calculateQuizAnalytics` — single-attempt scenario for `recentAttempts`**: When exactly 1 attempt exists, `recentAttempts.slice(0, 5)` returns a 1-element array. `topPerforming` and `needsImprovement` both equal a single-element array pointing to the same quiz. No test covers this case.

- **`calculateQuizAnalytics` — quiz with attempts but title not in `db.quizzes`**: The `quizTitleMap.get(quizId) ?? 'Unknown Quiz'` fallback on lines 83 and 102 is a meaningful user-visible data quality outcome. No test verifies the "Unknown Quiz" label appears in `recentAttempts` or performance lists.

- **`QuizAnalyticsDashboard` — loading skeleton**: The `aria-busy="true"` loading state at `QuizAnalyticsDashboard.tsx:50` has no test. No test verifies the skeleton renders while the async call is pending, or that it is replaced once data resolves.

- **`calculateQuizAnalytics` — all attempts for the same quiz (retakeFrequency = totalAttempts)**: If a learner has attempted only one quiz N times, `averageRetakeFrequency = N` and `totalQuizzesCompleted = 1`. This boundary interacts with the "top performing" and "needs improvement" display, which would show the same quiz in both lists. No test covers this.

- **Tab URL persistence**: `Reports.tsx:70-71` reads `searchParams.get('tab')` for the active tab. No test (unit or E2E) verifies that navigating directly to `/reports?tab=quizzes` opens the Quiz Analytics tab rather than defaulting to Study Analytics.

---

ACs: 0 covered (1 partial) / 4 total | Findings: 12 | Blockers: 5 | High: 3 | Medium: 3 | Nits: 2
