## Test Coverage Review: E13-S04 — Unlimited Quiz Retakes

### AC Coverage Summary

**Acceptance Criteria Coverage:** 4/4 ACs tested (**100%**)

**COVERAGE GATE:** PASS (>=80%) — 100% coverage, all four ACs have at least one dedicated test.

---

### AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1 | Results screen shows "Retake Quiz" button, no limit/cooldown messaging, clicking starts new attempt | `QuizResults.test.tsx` (implicit — button rendered in all improvement-summary tests) | `story-13-4.spec.ts:160` (AC1), `story-13-4.spec.ts:178` (AC1b) | Covered |
| 2 | Fresh attempt — answers cleared, shuffle re-applied, timer reset, history preserved | `useQuizStore.test.ts:351` (answers cleared via retakeQuiz) | `story-13-4.spec.ts:194` (answers cleared, partial) | Partial |
| 3 | Improvement summary: current vs. previous best | `QuizResults.test.tsx:148–253` (5 unit tests: no improvement, positive delta, same, negative, multi-attempt best) | `story-13-4.spec.ts:217` (improvement-summary visible) | Covered |
| 4 | Lesson page (QuizStartScreen) shows "Retake Quiz" for completed quizzes | None (QuizStartScreen not unit-tested) | `story-13-4.spec.ts:234` | Covered |

**Coverage**: 4/4 ACs fully covered | 0 gaps | 1 partial (AC2 sub-criteria)

---

### Test Quality Findings

#### Blockers (untested ACs)

None. All four ACs have test coverage.

---

#### High Priority

**`tests/e2e/story-13-4.spec.ts:194` (confidence: 85)**
AC2 lists four sub-criteria: answers cleared, shuffle re-applied, timer reset, and history preserved. The E2E test at line 194 covers only answers cleared and navigates to the first question. Timer reset and shuffle re-application have zero E2E test coverage, and Dexie history preservation is only asserted indirectly (the improvement summary test at line 217 relies on two stored attempts, but never explicitly queries `quizAttempts` to confirm both rows are retained after a retake).

Suggested test — `'AC2b: timer resets to original time limit on retake'` in `story-13-4.spec.ts`: seed a quiz with `timeLimit: 2` (2 minutes), complete attempt 1, click "Retake Quiz", and assert the countdown/timer element shows `2:00` (or reads the `timeRemaining` value from store via `page.evaluate`). This verifies that `startQuiz` correctly sets `timeRemaining: quiz.timeLimit` rather than inheriting the previous attempt's elapsed value.

Suggested test — `'AC2c: previous attempt remains in quizAttempts after retake'` in `story-13-4.spec.ts`: after the retake in the AC2 test, query `db.quizAttempts` via `page.evaluate` (or the existing `seedAttemptData` / IDB helpers) and assert the count is >= 1. This makes the "history preserved" assertion explicit rather than implicit.

**`src/stores/__tests__/useQuizStore.test.ts:351` (confidence: 80)**
The `retakeQuiz` describe block has a single test. It verifies that `answers` are cleared after retake but does not assert that `timeRemaining` is reset to the quiz's `timeLimit`. The `startQuiz` tests (line 662) do cover timer initialization separately, but there is no test that calls `retakeQuiz` on a quiz with a non-null `timeLimit` and then checks `currentProgress.timeRemaining`. Because `retakeQuiz` delegates to `startQuiz`, this is covered indirectly but the delegation is an implementation detail that can silently change.

Suggested test in `useQuizStore.test.ts` `retakeQuiz` describe block:
```
it('resets timeRemaining to quiz.timeLimit on retake', async () => {
  // quiz with timeLimit: 30
  // startQuiz then retakeQuiz
  // assert currentProgress.timeRemaining === 30
})
```

---

#### Medium

**`tests/e2e/story-13-4.spec.ts:160` (confidence: 75)**
The no-limit-messaging assertion uses `page.locator('body').textContent()` with a raw string `.toLowerCase()` check. This is a valid and common negative-assertion pattern, but it only catches text that is literally present in the DOM. It will not catch text hidden via `aria-hidden="true"` or screen-reader-only content that happens to include the blocked phrases. The risk is low given the implementation, but consider scoping to the quiz results card container (`page.locator('[data-testid="quiz-results"]')` or the card `div`) rather than the full `body` to avoid false passes from unrelated text that might be injected by dev toolbars or toast notifications during test runs.

**`src/app/pages/__tests__/QuizResults.test.tsx:65` (confidence: 72)**
The `describe('QuizResults — error paths')` block contains one test labeled `'AC7'` (line 87). The `AC7` label does not correspond to any AC in this story (E13-S04 has ACs 1–4). This is likely a copy-paste artifact from an earlier story's test suite. The test itself is valid and covers an important error path (loadAttempts rejection), but the mislabelled `AC7` makes traceability misleading. Fix: rename to `'shows error toast when loadAttempts fails'` or tag with `'AC1-error-path'`.

**`tests/e2e/story-13-4.spec.ts:217` (confidence: 70)**
AC3's E2E test asserts only that `data-testid="improvement-summary"` is visible after the second attempt. It does not assert the actual text content (previous percentage, delta). The five unit tests in `QuizResults.test.tsx` thoroughly cover content assertions, so this is not a blocker, but the E2E test should add at minimum one `toHaveText` or `toContainText` assertion on the improvement summary to confirm the real rendered output rather than just visibility — e.g., `await expect(page.getByTestId('improvement-summary')).toContainText('Previous best:')`.

**`tests/e2e/story-13-4.spec.ts:234` (confidence: 70)**
AC4 checks that the QuizStartScreen shows "Retake Quiz" when a previous attempt exists, and that clicking it starts a new attempt "immediately (no confirmation dialog needed)". The test at line 234 verifies the button label swap and that "Start Quiz" is not visible, but does not assert the "no confirmation dialog" behavior — i.e., it never clicks the "Retake Quiz" button and verifies a dialog does NOT appear. The AC explicitly calls out the absence of a confirmation dialog as a requirement.

Suggested additional assertion: click `getByRole('button', { name: /retake quiz/i })` and assert `page.locator('[role="alertdialog"]')` is not visible, and URL has changed to the quiz active view.

---

#### Nits

**Nit** `tests/e2e/story-13-4.spec.ts:56–57` (confidence: 40): The E2E quiz fixture has `shuffleQuestions: false` and `shuffleAnswers: false` for determinism, which is correct. However, the AC2 shuffle sub-criterion ("questions are re-randomized if shuffleQuestions is enabled") has no coverage path with shuffle enabled. A dedicated shuffle-on-retake E2E test is lower priority since `startQuiz` shuffle logic is unit-tested in the store, but the story's own Testing Notes at line 129 ("Questions re-randomize on retake if shuffle enabled") listed this as a planned E2E case.

**Nit** `src/app/pages/__tests__/QuizResults.test.tsx:123` (confidence: 35): `makeAttemptWith` is a local helper function defined inside the test file at line 123. The factory pattern for this project uses `tests/support/fixtures/factories/quiz-factory.ts`. This helper duplicates what `makeAttempt` already provides. Consider replacing `makeAttemptWith` with `makeAttempt({ percentage: N, id: 'aX', score: ... })` from the shared factory to keep test data creation consistent and avoid drift.

**Nit** `tests/e2e/story-13-4.spec.ts:209` (confidence: 30): The AC2 test assertion `page.getByText(q1.text).or(page.getByText(q2.text)).or(page.getByText(q3.text))` is a wide OR assertion — it passes as long as any one of the three question texts is visible. For shuffle-off quizzes, `q1.text` will always appear first and the assertion could be tightened to `page.getByText(q1.text)` directly, making it clearer what is actually being verified.

---

### Edge Cases to Consider

1. **Retake with in-progress saved state**: If a user starts a quiz, answers one question, abandons, then later navigates to the start screen (which shows "Resume Quiz"), completes the quiz, and hits "Retake Quiz" — `retakeQuiz` calls `startQuiz` which does not clear the localStorage `quiz-progress-{id}` key. On the resulting start screen the `loadSavedProgress` call in `Quiz.tsx:117` may resurrect the previously abandoned in-progress state and show "Resume Quiz" instead of directly entering the new attempt. No test covers this transition edge case.

2. **Retake error path — quiz deleted between completion and retake**: `retakeQuiz` → `startQuiz` → `db.quizzes.where('lessonId').first()`. If the quiz has been deleted from Dexie between the original completion and the retake click, `startQuiz` sets `error: 'Quiz not found'`. `handleRetake` in `QuizResults.tsx:71` catches this with a `console.error` but does not show a user-facing error toast or prevent navigation. No test (unit or E2E) covers this scenario.

3. **Improvement summary ordering assumption**: `QuizResults.tsx:49–52` computes `previousBestPercentage` as `Math.max(...attempts.slice(0, -1).map(a => a.percentage))` — it assumes `attempts` is ordered chronologically (oldest first), which depends on `loadAttempts` sorting by `completedAt` ascending. If `sortBy('completedAt')` returns ties in undefined order, the "current attempt" (last element) could be wrong. The unit tests in `QuizResults.test.tsx` pass attempt arrays in explicit order, so they pass regardless of this assumption. No test seeds Dexie directly and calls `loadAttempts` to verify the sort order drives the correct previousBest calculation end-to-end.

4. **Zero-question quiz retake**: `countUnanswered` and the score ring both handle zero questions via the `Math.max(0, percentage)` clamp, but `retakeQuiz` on a quiz with an empty `questions` array would produce a `currentProgress` with an empty `questionOrder` and potentially render an infinite loop or blank state. Not tested.

---

ACs: 4 covered / 4 total | Findings: 9 | Blockers: 0 | High: 2 | Medium: 4 | Nits: 3
