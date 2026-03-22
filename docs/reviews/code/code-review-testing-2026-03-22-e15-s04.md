## Test Coverage Review: E15-S04 — Provide Immediate Explanatory Feedback per Question

### AC Coverage Summary

**Acceptance Criteria Coverage:** 5/5 ACs tested (**100%**)

**COVERAGE GATE:** PASS (>=80%)

### AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1 | Correct answer → green checkmark, "Correct!" message, explanation | `AnswerFeedback.test.tsx:30-48` | `story-e15-s04.spec.ts:115-135` | Covered |
| 2 | Incorrect answer → orange "Not quite", explanation, correct answer shown | `AnswerFeedback.test.tsx:50-65` | `story-e15-s04.spec.ts:141-161` | Covered |
| 3 | Partial credit (multiple-select) → "N of M correct", per-option breakdown | `AnswerFeedback.test.tsx:67-85` | `story-e15-s04.spec.ts:167-193` | Partial |
| 4 | Feedback appears immediately, does NOT block navigation | — | `story-e15-s04.spec.ts:199-218` | Covered |
| 5 | Timer-expired → unanswered questions show correct answer + "not answered in time" | `AnswerFeedback.test.tsx:87-101` | `story-e15-s04.spec.ts:224-255` | Covered |

**Coverage**: 5/5 ACs fully covered | 0 gaps | 1 partial

---

### Test Quality Findings

#### Blockers (untested ACs)

None. All five acceptance criteria have at least one test.

---

#### High Priority

- **`tests/e2e/story-e15-s04.spec.ts:167-193` (confidence: 82)**: AC3 E2E test does not assert the per-option breakdown for incorrectly selected options. The AC requires "I see which selections were correct and which were incorrect," but the test only selects `Red` and `Blue` (both correct) — it never selects a wrong option such as `Green`. The unit test at `AnswerFeedback.test.tsx:67-85` asserts `within(breakdown).getByText(/Yellow.*missed/)` for a missed option, but the E2E layer never exercises the `selectedIncorrectly` branch (the `AlertCircle` list items rendered for wrong selections). Fix: add a second E2E sub-case that selects `Red` and `Green` (one correct, one wrong) and asserts the orange indicator and `Green` appear in the breakdown list.

- **`src/app/components/quiz/__tests__/QuestionBreakdown.test.tsx:6-16` (confidence: 78)**: The `QuestionBreakdown` test data omits both `explanation` and `correctAnswer` fields on questions. The component's `hasDetails` flag and expanded-state rendering (lines 92, 160-166 of `QuestionBreakdown.tsx`) depend on those fields to decide whether a row is clickable and whether "Correct answer:" and the explanation are shown. No test exercises the expanded-state path that was added in this story (progressive disclosure of explanation + correct answer in the results breakdown). This is the primary integration surface for AC5 in the results view. Fix: add tests in `QuestionBreakdown.test.tsx` that include `explanation` and `correctAnswer` on at least one question, then expand that row and assert the "Correct answer:" text and explanation are visible.

- **`tests/e2e/story-e15-s04.spec.ts` — AC4 immediacy (confidence: 75)**: AC4 states feedback must appear "immediately after I answer (no loading delay)." The E2E test at line 199 verifies the button is enabled and navigation advances, but it does not assert that the feedback element is already visible *before* any `await` resolves — i.e., it does not verify synchronous render. Because `AnswerFeedback` is pure derived-state (no `useEffect`), this is safe by construction, but the test's `await expect(feedback).toBeVisible()` assertion cannot distinguish synchronous from async appearance. The gap is low-impact given the derived-state implementation pattern, but it is worth noting. The AC says "no loading delay" and the implementation note explicitly cites this as the motivation for the derived-state design. Fix: assert `feedback` is visible in the same microtask as the click by calling `expect(feedback).toBeVisible()` immediately after `page.getByText('Paris').click()` without an intervening `await nextBtn` (already satisfied in the test structure — this is a documentation gap more than a code gap).

---

#### Medium

- **`tests/e2e/story-e15-s04.spec.ts` — no `afterEach` cleanup (confidence: 72)**: The spec has no `afterEach` hook and does not clear the `quizzes` IndexedDB store between tests. Each test seeds its own quiz via `seedQuizData`, but because tests share the same Playwright browser context (unless explicitly isolated), stale records from a prior test could be present in IndexedDB and cause test pollution if the story spec runs after another spec in the same context. The `navigateToQuiz` helper does re-navigate and re-seed on every test, which mitigates the risk for this spec in isolation. However, because the project pattern (per `.claude/rules/testing/test-cleanup.md`) requires cleanup in `afterEach`, this is a conformance gap. Fix: add `afterEach(async ({ page }) => { await clearIndexedDBStore(page, 'ElearningDB', 'quizzes') })` (helper already available at `tests/support/helpers/indexeddb-seed.ts:164`).

- **`src/app/components/quiz/__tests__/AnswerFeedback.test.tsx:6-15` — inline test data not using factory (confidence: 65)**: The unit tests construct `mcQuestion` and `msQuestion` as hand-coded literals rather than calling `makeQuestion()` from `tests/support/fixtures/factories/quiz-factory.ts`. While not a correctness issue, it diverges from the project factory pattern and means any future schema change to `Question` requires two updates. Fix: replace inline literals with `makeQuestion({ ... })` overrides.

- **`src/app/components/quiz/__tests__/AnswerFeedback.test.tsx:133-138` — empty explanation edge case incomplete (confidence: 60)**: The test `renders without explanation when explanation is empty` only verifies the header still renders for a correct answer. It does not check that no explanation element is rendered (no `queryByText` negative assertion), nor does it test the empty-explanation path for the `incorrect` or `time-expired` states (where the component would still render "Correct answer:" but nothing in the explanation `<div>`). The implementation at `AnswerFeedback.tsx:126` correctly gates on `question.explanation`, but the test does not confirm the conditional branch for non-correct states. Fix: add a negative assertion `expect(screen.queryByText(/MarkdownRenderer/)).not.toBeInTheDocument()` (or equivalent prose text assertion), plus one test for `incorrect` state with empty explanation.

---

#### Nits

- **Nit `tests/e2e/story-e15-s04.spec.ts:133`**: The icon assertion `await expect(feedback.locator('svg')).toBeVisible()` for AC1 is functional but fragile — it targets any SVG inside the feedback, including SVGs that might be added by `MarkdownRenderer`. Prefer `feedback.locator('svg[aria-hidden="true"]').first()` to tie directly to the decorative-icon contract tested in the unit layer, or extract a `data-testid="feedback-icon"` attribute.

- **Nit `tests/e2e/story-e15-s04.spec.ts:174`**: `page.getByText('4', { exact: true }).first()` is fragile when navigating to q2. If the quiz renders question numbers or timer digits containing "4", the `.first()` resolves to the wrong element. Prefer selecting the answer option by its ARIA role: `page.getByRole('radio', { name: '4' })` to anchor the selector to the answer list context.

- **Nit `src/app/components/quiz/__tests__/QuestionBreakdown.test.tsx:12-15`**: The `answers` array uses single-character `userAnswer` values (`'A'`, `'C'`, `'B'`). These do not match realistic quiz option text and make it harder to trace which answer maps to which question when a test fails. Use option text consistent with the question wording.

---

### Edge Cases to Consider

1. **`isTimerExpired=true` with a non-empty answer**: `AnswerFeedback.tsx:20` checks `isTimerExpired && (userAnswer === undefined || userAnswer === '')`. If the timer expires after a partial multi-select answer is submitted (`userAnswer = ['Red']`), the component falls through to PCM scoring rather than showing "Not answered in time." This is plausibly intentional (partial answer recorded = was attempted), but there is no test that explicitly covers this boundary. A dedicated unit test would document the intent.

2. **Full-credit multiple-select**: A user who selects all three correct answers for `msQuestion` reaches `state === 'correct'` (not `partial`). The unit test suite does not include this path for multiple-select. The partial-credit breakdown list should not render in this case. Add: `render(<AnswerFeedback question={msQuestion} userAnswer={['Red', 'Blue', 'Yellow']} />)` and assert `screen.queryByRole('list', { name: 'Answer breakdown' })` is `null` and "Correct!" is shown.

3. **Zero-point partial credit (PCM clamp)**: The PCM formula in `scoring.ts:57-59` clamps to 0 when `correctSelections - incorrectSelections < 0`. This means selecting only wrong options for a multiple-select question earns 0 points and `state === 'incorrect'` (not `partial`). No unit test covers the case where a user selects only incorrect options for a multiple-select question. Add: `userAnswer={['Green']}` (wrong only) and assert "Not quite" (not "0 of 3 correct").

4. **QuestionBreakdown with unanswered questions but timer not expired**: The `isUnanswered` helper in `QuestionBreakdown.tsx:28-31` triggers the Clock icon for empty-string or empty-array `userAnswer`. The test data at line 12-15 does not include an unanswered question entry, so the Clock icon path is never exercised in unit tests. The E2E test covers it, but a unit test would be faster and more precise.

5. **Concurrent rapid clicks (multiple-select toggle)**: Rapidly toggling a multiple-select option could race with `submitAnswer` being called on each change. The `AnswerFeedback` re-renders on each change (no debounce). No test verifies that the feedback state stays coherent during rapid toggle sequences. Low risk given the derived-state architecture, but worth a brief note.

---

ACs: 5 covered / 5 total | Findings: 9 | Blockers: 0 | High: 3 | Medium: 3 | Nits: 3
