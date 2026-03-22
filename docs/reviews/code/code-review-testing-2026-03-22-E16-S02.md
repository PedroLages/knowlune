## Test Coverage Review: E16-S02 — Display Score History Across All Attempts

### AC Coverage Summary

**Acceptance Criteria Coverage:** 5/5 ACs tested (**100%**)

**COVERAGE GATE:** PASS (>=80%)

### AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1 | "View Attempt History" button visible on results screen; clicking it expands the section | `AttemptHistory.test.tsx:70` (collapsed default), `AttemptHistory.test.tsx:83` (expands on click) | `story-e16-s02.spec.ts:157` (button visible), `story-e16-s02.spec.ts:165` (expand shows 3 attempts) | Covered |
| 2 | Each attempt shows attempt number, date/time, score %, time spent, passed/failed; sorted most-recent-first; current attempt highlighted/"Current" | `AttemptHistory.test.tsx:83` (all fields), `AttemptHistory.test.tsx:116` ("Current" badge) | `story-e16-s02.spec.ts:177` (sorted MRF), `story-e16-s02.spec.ts:193` ("Current" badge) | Covered |
| 3 | Single attempt shows "(1 attempt)" singular form | `AttemptHistory.test.tsx:42` | None | Covered |
| 4 | Multiple attempts show "(N attempts)" plural form | `AttemptHistory.test.tsx:56` | `story-e16-s02.spec.ts:165` (3 attempts visible) | Covered |
| 5 | Clicking any attempt row's Review button navigates to review mode for that attempt | `AttemptHistory.test.tsx:133` (Review buttons present per attempt) | `story-e16-s02.spec.ts:202` (>=3 Review buttons visible) | Partial |

**Coverage**: 5/5 ACs fully covered | 0 gaps | 1 partial

### Test Quality Findings

#### Blockers (untested ACs)

None.

#### High Priority

- **`tests/e2e/story-e16-s02.spec.ts:202` (confidence: 78)**: AC 5 states "I navigate to the review mode for that specific attempt" and "I see the questions/answers from that attempt (not current)". The E2E test only asserts that Review buttons are visible and counts them — it never clicks a Review button and verifies the resulting behaviour. Because E16-S01 is explicitly unimplemented and the button fires a toast stub, the navigation side of this AC is untestable right now. However, the test does not even assert that clicking the Review button produces the expected toast ("Review mode coming soon.") — the stub behaviour is left entirely untested in E2E. The unit test at `AttemptHistory.test.tsx:133` only checks button count, not the toast. Suggested test: add a unit-level assertion that clicking a Review button fires `toast.info('Review mode coming soon.')` — the `sonner` mock is already in place at line 8-10 of the unit test file.

- **`src/app/pages/__tests__/QuizResults.test.tsx` (confidence: 75)**: The `QuizResults` test suite does not contain a test that verifies `AttemptHistory` is rendered within the page. The improvement-summary tests confirm `ScoreSummary` integration, and the error-path test confirms `loadAttempts` wiring, but no test asserts that `<AttemptHistory>` is actually mounted (e.g., the trigger button text appears in a rendered `QuizResults`). If `AttemptHistory` were accidentally removed from `QuizResults.tsx`, all existing `QuizResults` unit tests would still pass. Suggested test: in the `QuizResults — improvement summary` describe block, after seeding 2+ attempts, assert `screen.getByRole('button', { name: /view attempt history/i })` is in the document.

#### Medium

- **`src/stores/__tests__/useQuizStore.test.ts:519–611` (confidence: 72)**: The `loadAttempts` sort-order test at line 559 uses hardcoded ISO date strings (`'2025-01-10T08:00:00.000Z'`, `'2025-01-15T09:00:00.000Z'`, `'2025-01-20T12:00:00.000Z'`) rather than `FIXED_DATE` / `getRelativeDate()` from `tests/utils/test-time.ts`. The `quiz-factory.ts` and `AttemptHistory.test.tsx` both import and use these utilities correctly. This inconsistency is a quality deviation from the project's deterministic-time convention, though it does not cause flakiness here since the values are literal constants rather than `new Date()`. The `loadAttempts — queries Dexie` test at line 520 also uses hardcoded dates. Fix: replace the three `completedAt` / `startedAt` string literals in these tests with `getRelativeDate(-10)`, `getRelativeDate(-5)`, and `getRelativeDate(0)` (or equivalent `FIXED_DATE`-relative expressions).

- **`tests/e2e/story-e16-s02.spec.ts` (confidence: 70)**: The E2E test suite has no `afterEach` cleanup. The `setupResultsPage` helper seeds IndexedDB and Zustand localStorage on every test run, but never clears them afterward. The test fixture in `tests/support/fixtures` may handle browser context isolation between tests, which would make this a non-issue; however, if the fixture reuses the same browser context across tests in the same `describe` block, stale IDB data from test N could affect test N+1. The pattern established in `story-12-6.spec.ts` (referenced in the story testing notes) should be consulted to confirm whether afterEach cleanup is required. Fix: add an `afterEach` that calls `page.evaluate(() => indexedDB.deleteDatabase('ElearningDB'))` and `page.evaluate(() => localStorage.clear())`, or confirm via the fixture implementation that browser contexts are isolated per test.

- **`src/app/components/quiz/__tests__/AttemptHistory.test.tsx` (confidence: 65)**: Module-level `attempt1`, `attempt2`, `attempt3` objects are defined outside `describe`/`beforeEach`. These are read-only objects with no mutation, so test isolation is not violated here, but it means every test in the file shares the same factory output. If a future test needs a variant (e.g., an attempt where `currentAttemptId` is not `attempt3.id`), it must define new inline data or re-read from the module scope. This is a minor structural pattern that is acceptable but slightly fragile.

#### Nits

- **Nit `src/app/components/quiz/__tests__/AttemptHistory.test.tsx:97-99` (confidence: 55)**: The assertion `expect(screen.getAllByText('#3').length).toBeGreaterThanOrEqual(1)` is intentionally loose to accommodate both desktop and mobile renders. The comment on line 96 explains this. A tighter alternative would be to assert `.toBeGreaterThanOrEqual(1)` and `.toBeLessThanOrEqual(2)` to catch accidental tripling, but this is a minor style point.

- **Nit `tests/e2e/story-e16-s02.spec.ts:42-70` (confidence: 50)**: The three attempt objects are declared as plain object literals rather than using `makeAttempt()` from the factory. `makeAttempt` is already imported at line 9 (for `quiz`). Using the factory for attempts would keep the data consistent with the factory's type contract and catch schema changes automatically. The quiz uses the factory correctly (`makeQuiz` at line 19-25); the attempts don't.

- **Nit `src/app/components/quiz/__tests__/AttemptHistory.test.tsx:80` (confidence: 50)**: The collapsed-state test asserts `screen.queryByText('#3')` is not in the document. This is valid, but `#3` is a somewhat coincidental sentinel. A more semantically correct approach would check for the absence of the table or the collapsible content container via ARIA or testid, rather than a specific data value that is only incidentally absent when collapsed.

### Edge Cases to Consider

- **Zero attempts passed to `AttemptHistory`**: The component iterates `attempts.map(...)` and computes `n = attempts.length` — it will render `"(0 attempts)"` and an empty table body. The trigger text renders incorrectly as "(0 attempts)" rather than gracefully hiding the component. `QuizResults.tsx` always passes `attempts` from the Zustand store, which redirects away when `attemptsLoaded && !lastAttempt`, so this state is unreachable in production today. But it is a fragile contract: any future caller that passes `[]` will show a broken trigger. No test covers this empty-array path for `AttemptHistory`.

- **`currentAttemptId` not matching any attempt**: If `lastAttempt.id` does not correspond to any `attempts[i].id` (possible if `loadAttempts` races with navigation), no row gets the `bg-brand-soft` highlight and no "Current" badge appears. There is no test for this defensive scenario.

- **`loadAttempts` error path in `QuizResults`**: Tested at `QuizResults.test.tsx:87` — the toast fires. However, the test does not assert that `attemptsLoaded` is still set to `true` in the catch branch (line 40 of `QuizResults.tsx`), meaning there is no coverage verifying that the loading skeleton clears and the redirect guard at line 101 still evaluates correctly after an error.

- **Date display locale variance**: `AttemptHistory.tsx` uses `toLocaleString()` (line 79), which produces locale-specific output. The unit tests do not assert any date string content (they test percentage, time, and status fields, but not the rendered date). The E2E tests also skip date content assertions. This is intentional but means the date column is untested by content — a rendering bug (e.g., `undefined` date) would not be caught.

---
ACs: 5 covered / 5 total | Findings: 10 | Blockers: 0 | High: 2 | Medium: 2 | Nits: 4 (including edge cases as advisory)
