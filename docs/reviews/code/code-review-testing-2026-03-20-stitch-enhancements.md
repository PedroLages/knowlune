## Test Coverage Review: E12-S06 — Calculate and Display Quiz Score

**Review Date**: 2026-03-20
**Branch**: `feature/stitch-quiz-enhancements`
**Reviewer**: Test Coverage Specialist (claude-sonnet-4-6)
**Story File**: `docs/implementation-artifacts/12-6-calculate-and-display-quiz-score.md`

---

### AC Coverage Summary

**Acceptance Criteria Coverage:** 7/8 ACs tested (**87.5%**)

**COVERAGE GATE:** PASS (>=80%)

---

### AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1 | Submit all answered → score page with percentage, "X of Y correct", pass/fail status, time spent | `ScoreSummary.test.tsx:24,34,60` | `story-12-6.spec.ts:149` | Covered |
| 2 | Unanswered → AlertDialog confirmation; "Continue Reviewing" returns to quiz | None | `story-12-6.spec.ts:178` | Covered (E2E only) |
| 3 | "Submit Anyway" → submits with unanswered questions scored as 0 | None | `story-12-6.spec.ts:204` | Covered (E2E only) |
| 4 | Results page: "Retake Quiz" (outline), "Review Answers" (brand), "Back to Lesson" link visible | None | `story-12-6.spec.ts:229` | Covered (E2E only) |
| 4b | "Retake Quiz" navigates to quiz start screen | None | `story-12-6.spec.ts:301` | Covered (E2E only) |
| 5 | Word "Failed" MUST NOT appear anywhere on results screen (QFR23) | `ScoreSummary.test.tsx:52` | `story-12-6.spec.ts:254` | Covered |
| 6 | Time spent shown in human-readable format ("Completed in Xm Ys") | `ScoreSummary.test.tsx:60` | `story-12-6.spec.ts:280` | Covered |
| 7 | submitQuiz Dexie write error: error toast shown, user remains on quiz page with answers intact | None | None | **Gap** |

**Coverage**: 7/8 ACs fully covered | 1 gap | 0 partial

---

### Enhancement Feature Coverage (implementation-defined, not in story ACs)

| Feature | Unit Test | E2E Test | Verdict |
|---------|-----------|----------|---------|
| ScoreSummary tier labels (EXCELLENT / PASSED / NEEDS REVIEW / NEEDS WORK) | `ScoreSummary.test.tsx:30,39,44,47` | `story-12-6.spec.ts:175,273` | Unit covered; E2E assertions stale (see High findings) |
| ScoreSummary tier boundary values (90, 89, 50, 49) | `ScoreSummary.test.tsx:112-130` | None | Unit covered |
| ScoreSummary SVG ring color per tier | `ScoreSummary.test.tsx:91-110` | None | Unit covered |
| ScoreSummary percentage clamp (>100 and <0) | `ScoreSummary.test.tsx:132-140` | None | Unit covered |
| ScoreSummary `timeSpent` floor to 1s at 0ms and 500ms | `ScoreSummary.test.tsx:142-150` | None | Unit covered |
| ScoreSummary aria-live score announcement | `ScoreSummary.test.tsx:85` | None | Unit covered |
| QuestionBreakdown: correct/incorrect icons and points per row | `QuestionBreakdown.test.tsx:19,90` | None | Unit covered, no E2E |
| QuestionBreakdown: collapsed by default, toggle works | `QuestionBreakdown.test.tsx:38,45` | None | Unit covered, no E2E |
| QuestionBreakdown: empty answers renders nothing | `QuestionBreakdown.test.tsx:63` | None | Unit covered |
| AreasForGrowth: renders nothing for empty incorrectItems | `AreasForGrowth.test.tsx:14` | None | Unit covered |
| AreasForGrowth: shows question text and correct answers | `AreasForGrowth.test.tsx:19,34` | None | Unit covered, no E2E |
| AreasForGrowth: "Show all" pagination (>5 items, expand, collapse) | `AreasForGrowth.test.tsx:58,71,83` | None | Unit covered |
| AreasForGrowth: no "Show all" button for <=5 items | `AreasForGrowth.test.tsx:111` | None | Unit covered |
| QuestionHint: renders nothing for undefined / empty / whitespace | `QuestionHint.test.tsx:6,11,16` | None | Unit covered |
| QuestionHint: renders with correct ARIA note role and aria-label | `QuestionHint.test.tsx:28` | None | Unit covered, no E2E |
| Quiz.tsx: auto-focus Next/Submit button after answering | None | None | **Gap** |
| QuizResults: redirect to quiz when no attempt data | None (only `loadAttempts` failure tested) | None | **Gap** |
| formatDuration: full suite including hours, edge values | `formatDuration.test.ts:1-44` | None | Unit covered |

---

### Test Quality Findings

#### Blockers (untested ACs)

- **(confidence: 95)** AC7: "Given the submitQuiz store action fails (Dexie write error after retries), the user sees an error toast and remains on the quiz page with answers intact" has zero coverage — no unit test and no E2E test. The `Quiz.tsx` `handleSubmitConfirm` catch block silently swallows the error (relying on the store's toast) and does not navigate, but this path is completely unverified. Suggested test: in `QuizResults.test.tsx` or a new `Quiz.error.test.tsx`, mock `useQuizStore` with `submitQuiz` rejecting, trigger submit, assert no navigation occurs and no blank screen is shown.

#### High Priority

- **`tests/e2e/story-12-6.spec.ts:175` (confidence: 97)**: The assertion `page.getByText(/mastered this material/)` matches the EXCELLENT tier (>=90%) message. The test submits a quiz where the learner answers all 3 questions correctly → 100% → EXCELLENT tier. This assertion is correct for the current code. However, the test name "AC1: submit quiz with all answered shows score page" maps to the story AC which specifies "Congratulations! You passed!" as the pass message. The implementation was redesigned to a tier system and the original AC message text no longer exists. The test assertion works, but the test title and the story AC text are now misaligned — anyone reading the story and the test will see a contradiction. The AC 1 pass message should be updated in the story file, or a comment should document the tier redesign.

- **`tests/e2e/story-12-6.spec.ts:273` (confidence: 97)**: The assertion `page.getByText(/Keep practicing/)` matches the NEEDS WORK tier (<50%) message. The test answers all 3 questions incorrectly → 0% → NEEDS WORK. This is correct against the current code. The same staleness issue as above applies: the story AC says "Keep Going! You got X of Y correct" but the implementation renders "Keep practicing! Focus on the topics below." The test passes incidentally. Story AC text should be reconciled.

- **`src/app/pages/__tests__/QuizResults.test.tsx` — redirect on no-attempt data untested (confidence: 85)**: The component has two `<Navigate>` redirect paths: one when `!currentQuiz && !isLoading` (line 80) and one when `attemptsLoaded && !lastAttempt && !isLoading` (line 85). Only the `loadAttempts` error path is unit-tested (1 test case in the file). Neither redirect path has a unit test. Story task 5.4 explicitly calls out "QuizResults redirects when no attempt data." Suggested test: render `<QuizResults>` inside `<MemoryRouter>` with store state `{ currentQuiz: null, attempts: [], isLoading: false }` and assert the component renders a `<Navigate>` (or `useNavigate` is called with the quiz URL).

- **Auto-focus Next/Submit after answering — untested at all levels (confidence: 82)**: The `requestAnimationFrame(() => nextBtnRef.current?.focus())` behavior in `Quiz.tsx:255-256` has no test. This is a deliberate keyboard-navigation enhancement (mentioned in the commit history as a dedicated commit). Suggested E2E test in `story-12-6.spec.ts`: after seeding a quiz and starting it, click a radio option, then assert `page.evaluate(() => document.activeElement?.textContent?.trim())` returns "Next" (or "Submit Quiz" on the last question).

#### Medium

- **No E2E coverage for QuestionBreakdown, AreasForGrowth, QuestionHint integration (confidence: 78)**: All three new components rendering on the results page are verified only by unit tests. The E2E suite does not assert that "Areas to Review" appears after answering incorrectly, that clicking "Question Breakdown" expands the list, or that a hint card appears during quiz-taking. These are user-visible features on the happy path covered by AC1/AC5 E2E tests, but the tests scope only to the score value and pass/fail message. Suggested additions to `tests/e2e/story-12-6.spec.ts`: (1) in AC5 (all wrong answers), assert `page.getByText('Areas to Review')` is visible; (2) click the "Question Breakdown" trigger and assert the first question row is visible.

- **`src/app/components/quiz/__tests__/QuestionBreakdown.test.tsx:6-16` — module-level shared test data (confidence: 72)**: The `questions` and `answers` constants are declared at module scope and shared across all tests. Since they are `const` and contain only primitives, mutation between tests is not possible here. This is safe in practice, but it bypasses the `beforeEach` factory pattern recommended in `test-cleanup.md`. A future test that inadvertently uses `let` instead of `const` would introduce ordering bugs. Suggest wrapping data in a `makeBreakdownFixture()` helper or inlining per test.

- **`src/app/components/quiz/__tests__/ScoreSummary.test.tsx:52-58` — two renders in one `it` block (confidence: 68)**: The "never renders 'Failed'" test renders two separate `ScoreSummary` instances in a single `it` block. Testing Library auto-cleans the DOM between `it` blocks but not within them, so both renders accumulate in the document. The test uses scoped `container.textContent` so it passes correctly today, but if any assertion were changed to `screen.getBy*` it would find elements from both renders. Splitting into two `it` blocks removes the ambiguity.

#### Nits

- **Nit `tests/e2e/story-12-6.spec.ts:65-101` (confidence: 75)**: The `seedQuizData` function re-implements raw `indexedDB.open` with retry logic inline. The project's shared seeding helpers (referenced in `.claude/rules/testing/test-patterns.md`) are the canonical approach. The factory (`makeQuestion`) also has no `hint` field yet, meaning any E2E test for `QuestionHint` would have to construct raw question objects. Recommend extending `makeQuestion` in `tests/support/fixtures/factories/quiz-factory.ts` to accept a `hint` override.

- **Nit `tests/support/fixtures/factories/quiz-factory.ts` — `hint` field absent from `makeQuestion` (confidence: 75)**: `hint?: string` was added to the question type on this branch but `makeQuestion` in the factory does not expose it. Tests that want to verify hint rendering must construct question objects by hand. One-line fix: add `hint: overrides.hint` (or include it in the spread) so override support is available.

- **Nit `src/app/components/quiz/__tests__/AreasForGrowth.test.tsx:6` — local helper naming (confidence: 55)**: The local `makeItems` helper creates objects shaped as `AreasForGrowthProps['incorrectItems'][number]`. Renaming it to `makeIncorrectItems` would align with the prop name and clarify intent, making the test file easier to scan.

- **Nit `src/app/components/quiz/__tests__/QuestionHint.test.tsx:35-41` — SVG attribute accessed via `querySelector` (confidence: 50)**: The test queries `note.querySelector('svg')` and checks `aria-hidden`. This is correct today because Lucide renders a single root `<svg>`. If the component structure ever wraps the icon, the selector would silently pass (finding `null` if the assertion were `not.toBeInTheDocument()` rather than checking an attribute). Prefer `screen.getByRole('img', { hidden: true })` or a `data-testid` on the icon wrapper for resilience.

---

### Edge Cases to Consider

1. **QuestionBreakdown: answer references a questionId not in the questions array** — the `answerMap.get(question.id)` lookup silently produces `null` rows that are filtered out. The inverse (an answer whose `questionId` has no corresponding question) is also silently dropped. No test covers this mismatched-ID scenario.

2. **AreasForGrowth: exactly 6 incorrect items** — tests cover 5 (no button) and 7 (button visible). The boundary at 6 (first case where the button appears) is not explicitly tested. If `DEFAULT_VISIBLE_COUNT` is ever changed, only the 5-item and 7-item tests would fail — the exact boundary would not be caught.

3. **ScoreSummary: `percentage` exactly 0** — no test covers zero score. The SVG arc `strokeDashoffset` would equal `circumference`, producing an invisible arc. Functionally valid but unverified.

4. **AreasForGrowth: `correctAnswer` is an empty string** — `QuizResults.tsx` uses nullish coalescing (`?? 'N/A'`) so an empty string `""` passes through and renders as "Correct answer: " with no value. Empty string is not the same as `null`/`undefined` under `??`.

5. **Quiz.tsx: `countUnanswered` with an array answer** — the function checks `a === ''` for emptiness but multi-select answers are `string[]`. An empty array `[]` would be falsy when coerced but `=== ''` is `false`, meaning an empty multi-select would be counted as answered. This edge case is not tested.

6. **QuizResults: `handleRetake` error path** — the `try/catch` in `handleRetake` logs the error but does not show a toast or render feedback. The user would click "Retake Quiz", nothing would happen, and no error would be surfaced. This silent failure path is untested.

---

ACs: 7 covered / 8 total | Findings: 12 | Blockers: 1 | High: 4 | Medium: 3 | Nits: 4
