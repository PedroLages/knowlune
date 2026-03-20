## Test Coverage Review: E13-S01 — Navigate Between Questions

### AC Coverage Summary

**Acceptance Criteria Coverage:** 4/4 ACs tested (**100%**)

**COVERAGE GATE:** PASS (>=80%)

### AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1 | Previous disabled on Q1; Submit Quiz on last Q; Previous still enabled on last Q | `QuizActions.test.tsx:27` (disabled), `QuizActions.test.tsx:32` (Submit shown), `QuizActions.test.tsx:38` (single-Q edge), `QuizNavigation.test.tsx:35` (composition) | `story-e13-s01.spec.ts:123` (disabled+Next), `story-e13-s01.spec.ts:146` (Submit+Previous enabled) | Covered |
| 2 | Answer auto-saved before navigation; persistence when returning | `useQuizStore.test.ts:169` (submitAnswer updates store), `useQuizStore.test.ts:650` (guard: no-op when null) | `story-e13-s01.spec.ts:201` (navigate away+back, answer persists) | Covered |
| 3 | Question grid: numbered bubbles; current=blue, answered=blue dot, unanswered=gray; aria-current | `QuestionGrid.test.tsx:16` (bubble count+labels), `QuestionGrid.test.tsx:25` (aria-current), `QuestionGrid.test.tsx:32` (answered class), `QuestionGrid.test.tsx:42` (unanswered class), `QuizNavigation.test.tsx:41` (grid rendered in composition) | `story-e13-s01.spec.ts:183` (answered bubble gets bg-brand-soft after answering) | Covered |
| 4 | Click any question number to jump directly | `QuestionGrid.test.tsx:48` (click index mapping), `useQuizStore.test.ts:800` (in-bounds), `useQuizStore.test.ts:806` (out-of-bounds -1), `useQuizStore.test.ts:815` (out-of-bounds +N), `useQuizStore.test.ts:824` (null guard) | `story-e13-s01.spec.ts:163` (bubble click jumps to Q3; aria-current="true") | Covered |

**Coverage**: 4/4 ACs fully covered | 0 gaps | 0 partial

---

### Test Quality Findings

#### Blockers (untested ACs)

None.

#### High Priority

- **`src/app/components/quiz/__tests__/QuizActions.test.tsx` (confidence: 82)**: The `isSubmitting` prop has no unit test coverage. The implementation renders "Submitting..." and disables the Submit Quiz button when `isSubmitting=true` (`QuizActions.tsx:46-47`), but no test asserts either the label change or the disabled state during submission. This is wired to `isStoreLoading` in `Quiz.tsx:280`, so a user could double-submit or see a stuck button. Suggested test in `QuizActions.test.tsx`: `it('Submit Quiz button is disabled and shows "Submitting..." when isSubmitting=true', ...)` asserting `getByRole('button', { name: /submitting/i })` is disabled and `queryByRole('button', { name: /submit quiz/i })` is absent.

- **`src/app/components/quiz/__tests__/QuizNavigation.test.tsx` (confidence: 75)**: `QuizNavigation` computes `isFirst` and `isLast` from `progress.currentQuestionIndex` vs `quiz.questions.length - 1`, but there is no integration test verifying that the correct buttons are shown/disabled when `currentQuestionIndex` is 0 (first) or equals `questions.length - 1` (last). Tests at lines 35-39 only confirm buttons render at index 0, not that the boundary logic is correctly wired into `QuizActions`. Suggested tests: one rendering with `currentQuestionIndex: 2` for a 3-question quiz to assert Submit is shown, and one at index 0 to assert Previous is disabled.

#### Medium

- **`src/stores/__tests__/useQuizStore.test.ts` — `navigateToQuestion` block (confidence: 72)**: The `navigateToQuestion` tests at lines 741-829 build `baseProgress` and `baseQuiz` with inline object literals rather than using `makeProgress` / `makeQuiz` from the quiz factory. This is inconsistent with the rest of the test file (which uses inline objects throughout) and acceptable given the store's direct state injection pattern, but the pattern breaks the factory-usage convention and makes the test data harder to maintain. Consider refactoring these four tests to use `makeProgress` / `makeQuiz` with selective overrides to match the pattern in `QuizNavigation.test.tsx`.

- **`tests/e2e/regression/story-e13-s01.spec.ts` — IDB cleanup (confidence: 68)**: The `seedQuizData` helper at line 63 seeds the `quizzes` IndexedDB store using a raw `indexedDB.open` loop, bypassing the shared `indexedDBFixture` auto-cleanup that the `test` import from `tests/support/fixtures` provides. The fixture wires auto-cleanup via `indexeddb-fixture.ts:158`. However, since this spec uses `import { test, expect } from '../../support/fixtures'` (line 10), the IDB fixture is active. The raw seeding helper does not register its seeded record IDs with the fixture, so the `quiz-e13s01` record may persist in IDB and could affect other tests running in the same browser context if parallelism is high. Risk is low in practice (quiz IDs are unique per spec), but the pattern is fragile. Consider migrating to the `indexedDBFixture.seed('quizzes', [quiz])` API to benefit from tracked auto-cleanup.

- **`src/app/components/quiz/__tests__/QuestionGrid.test.tsx` — shared mutable mock (confidence: 65)**: `defaultProps.onQuestionClick` is a `vi.fn()` created at module level (line 11) and reused across all tests. The click test at line 48 instantiates its own local mock, so the call-count does not bleed across tests. However, tests at lines 16 and 25 render with `defaultProps` without resetting the shared mock. If a future test uses `defaultProps` and later asserts `expect(defaultProps.onQuestionClick).toHaveBeenCalledOnce()`, it will fail due to accumulated calls. Low risk now; adding `beforeEach(() => vi.clearAllMocks())` or converting `defaultProps.onQuestionClick` to a `let` reset in `beforeEach` would eliminate the risk entirely.

#### Nits

- **Nit `src/app/components/quiz/__tests__/QuizNavigation.test.tsx:10-17` (confidence: 60)**: `q1`, `q2`, `q3`, `quiz`, and `progress` are declared at module scope with `const`, meaning they are shared across all tests in this file. If a future test mutates `progress` (e.g., spreading it with different `currentQuestionIndex`), the module-level objects remain untouched, which is fine. However the pattern is subtly different from the local `progressWithMarked` created in line 49. Consistent approach: either move all to `beforeEach` or keep factory calls at module scope only for truly immutable baseline data.

- **Nit `tests/e2e/regression/story-e13-s01.spec.ts:156` (confidence: 55)**: The assertion `await expect(page.getByRole('button', { name: /next/i })).not.toBeVisible()` uses `.not.toBeVisible()`. Because the Next button is conditionally rendered (not just hidden), `.not.toBeInTheDocument()` would be a stronger and more accurate assertion matching the unit test at `QuizActions.test.tsx:34`. Inconsistency is minor but `.not.toBeVisible()` could pass even if the element exists in the DOM but is off-screen.

- **Nit `src/app/components/quiz/__tests__/QuestionGrid.test.tsx:33-39` (confidence: 55)**: Visual-state tests at lines 32-39 assert CSS class names directly via `element.className.toContain('bg-brand-soft')`. This couples tests to implementation token names. While design tokens are stable in this project, a rename would silently break these assertions without a TypeScript error. This is an acceptable tradeoff given the project's token-first styling convention, but noting for awareness.

---

### Edge Cases to Consider

- **`isSubmitting` during double-click**: No test verifies that clicking Submit Quiz twice is prevented when `isSubmitting=true`. The implementation disables the button, but there is no test asserting that a second rapid click before `isSubmitting` is set does not dispatch `onSubmit` twice.

- **Single-question quiz E2E**: The unit test at `QuizActions.test.tsx:38` covers the `isFirst && isLast` combination, but there is no E2E test exercising a one-question quiz where Submit appears immediately without any Next navigation.

- **Question grid with `questionOrder` shorter than `total`**: `QuizNavigation.tsx:35` falls back to `quiz.questions.length` when `questionOrder` is empty, but there is no unit test for a progress object where `questionOrder.length` differs from `quiz.questions.length` (possible during store rehydration if data is partially written).

- **`navigateToQuestion` called with exactly `questions.length - 1` (last index)**: The store tests cover `index >= questions.length` (out-of-bounds) but not the exact boundary `index === questions.length - 1` (valid last question). This is implicitly exercised by the E2E jump-to-Q3 test, but there is no dedicated unit assertion for the maximum valid in-bounds index.

- **`goToNextQuestion` / `goToPrevQuestion` bounds guards**: These existing store actions have no dedicated unit tests in the current test suite (neither in the original tests nor in the E13-S01 additions). They are exercised indirectly via E2E, but an out-of-bounds call to `goToNextQuestion` when already on the last question has no unit-level coverage.

---

ACs: 4 covered / 4 total | Findings: 7 | Blockers: 0 | High: 2 | Medium: 3 | Nits: 3
