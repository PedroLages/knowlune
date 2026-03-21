## Test Coverage Review: E14-S03 — Display Fill-in-Blank Questions

### AC Coverage Summary

**Acceptance Criteria Coverage:** 4/4 ACs tested (**100%**)

**COVERAGE GATE:** PASS (>=80%)

### AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1 | Question text displayed with text input, placeholder, appropriate size | `QuestionDisplay.test.tsx` — dispatches fill-in-blank (implicit via switch coverage) | `story-e14-s03.spec.ts:81` — verifies fieldset, textbox role, placeholder attribute, absence of radio/checkbox | Covered |
| 2 | Input saved with 300ms debounce, persists on nav, 500-char limit, character counter | None — no dedicated unit test for FillInBlankQuestion | `story-e14-s03.spec.ts:101` (counter), `:117` (persistence via blur+nav), `:138` (maxLength + 500/500 counter) | Covered (E2E only) |
| 3 | Case-insensitive, whitespace-trimmed, all-or-nothing scoring | `scoring.test.ts:116-131` — exact match, case-insensitive, whitespace trim, wrong answer = 0 | `story-e14-s03.spec.ts:155` (lowercase pass + whitespace pass), `:189` (wrong answer = 0) | Covered |
| 4 | Semantic HTML — fieldset/legend structure | None | `story-e14-s03.spec.ts:216` — verifies fieldset visible, legend present and contains question text, textbox inside fieldset | Covered (E2E only) |

**Coverage**: 4/4 ACs fully covered | 0 gaps | 0 partial

---

### Test Quality Findings

#### Blockers (untested ACs)

None. All four ACs have at least one test.

---

#### High Priority

- **`src/app/components/quiz/__tests__/QuestionDisplay.test.tsx` (confidence: 82)**: The QuestionDisplay unit test file contains 8 tests, none of which explicitly exercises the `fill-in-blank` switch branch. The AC1 dispatch path is covered only implicitly (no crash = pass) because no test renders a `fill-in-blank` question through `QuestionDisplay` and asserts the rendered output. If the `case 'fill-in-blank':` branch were accidentally deleted, every existing unit test would still pass. Suggested fix: add one unit test — `it('dispatches fill-in-blank questions to FillInBlankQuestion')` in `/Volumes/SSD/Dev/Apps/Elearningplatformwireframes/src/app/components/quiz/__tests__/QuestionDisplay.test.tsx`, rendering `makeQuestion({ type: 'fill-in-blank', correctAnswer: 'React' })` and asserting `screen.getByRole('textbox')` is in the document and no `radiogroup` is present.

- **`tests/e2e/story-e14-s03.spec.ts:181` (confidence: 75)**: The confirmation dialog handling in the scoring tests (AC3) uses a `try/catch` pattern with `isVisible({ timeout: 2000 }).catch(() => false)`. This is a conditional assertion — the test silently skips the confirmation click if the dialog never appears. If a future change makes the dialog mandatory, both AC3 scoring tests would silently fail to submit and then fail on the score assertion with an opaque error rather than a clear "dialog was not clicked" message. Fix: replace the conditional guard with an unconditional `await confirmButton.waitFor({ state: 'visible' })` if the submit flow always produces a confirmation dialog, or document clearly (with a comment) the condition under which the dialog is absent.

---

#### Medium

- **`src/app/components/quiz/__tests__/QuestionDisplay.test.tsx` (confidence: 72)**: No unit test covers the `FillInBlankQuestion` component directly — no isolated test for debounce behavior, the `isInitialMount` guard that prevents the initial `onChange` call, or the `onBlur` immediate-save path. These are all tested indirectly via E2E, but fast unit tests would catch regressions without a full browser launch. Suggested location: `/Volumes/SSD/Dev/Apps/Elearningplatformwireframes/src/app/components/quiz/questions/__tests__/FillInBlankQuestion.test.tsx` using `@testing-library/user-event` with `vi.useFakeTimers()` to assert the debounce fires after 300ms and not before, and that `onChange` is not called on initial render.

- **`tests/e2e/story-e14-s03.spec.ts:138` (confidence: 68)**: The 500-character limit test verifies `maxLength="500"` attribute and the `500 / 500` counter, but does not assert that characters beyond 500 are actually prevented (the AC says "input is prevented beyond 500 characters"). This is a browser-enforced constraint via `maxLength`, so the attribute check is likely sufficient — but explicitly attempting to type 501 characters (via `input.fill('a'.repeat(501))`) and asserting `input.inputValue()` returns a string of length 500 would give complete confidence.

- **`src/lib/__tests__/scoring.test.ts` (confidence: 65)**: The scoring tests are pre-existing and not in the diff for this story. However, the inline date strings `'2025-01-15T12:00:00.000Z'` on lines 17-18 violate the `test-patterns/deterministic-time` ESLint rule (should use `FIXED_DATE`/`FIXED_TIMESTAMP` from `tests/utils/test-time`). This file uses a local `makeQuiz` helper rather than the shared factory, and does not import `FIXED_DATE`. This is a pre-existing issue, not introduced by E14-S03, but worth noting for a future cleanup pass.

---

#### Nits

- **Nit** `tests/e2e/story-e14-s03.spec.ts:186` (confidence: 55): The score assertion uses `page.locator('p').filter({ hasText: '5 of 5 correct' })`. A `<p>` tag selector is fragile — if the score summary ever moves the text into a `<span>` or `<div>`, the locator silently fails to match and the assertion throws a timeout error rather than a clear failure. Prefer `page.getByText('5 of 5 correct')` or add a `data-testid="score-summary-points"` attribute and use `page.getByTestId(...)`.

- **Nit** `tests/e2e/story-e14-s03.spec.ts:131` (confidence: 52): The "navigate back" button locator uses a regex alternation `/previous|prev|back/i`. If the button label changes to "Go Back" or "Earlier", the test would fail silently with a locator-not-found error. Prefer a `data-testid="quiz-prev-button"` selector for stability.

- **Nit** `tests/e2e/story-e14-s03.spec.ts:25` (confidence: 50): `buildFillInBlankQuiz()` is a local helper that constructs quiz data inline rather than delegating entirely to the factory. The `COURSE_ID = 'test-course-fib'` constant is referenced in the URL (`/courses/${COURSE_ID}/lessons/${LESSON_ID}/quiz`) but never associated with the seeded quiz data — the quiz is seeded with `lessonId: LESSON_ID` but has no `courseId` field. This works because the route presumably resolves by `lessonId` alone, but it's worth adding a comment explaining why `COURSE_ID` is used in the URL path without being embedded in the quiz record, to avoid future confusion.

---

### Edge Cases to Consider

- **Empty string submission**: The `onBlur` handler calls `onChange(inputValue)` unconditionally. If the user focuses and immediately blurs the input without typing, `onChange('')` is dispatched. No test verifies that an empty-string answer is stored and treated as unanswered (scores 0). The scoring function handles `undefined` answers (returns 0) but the store may receive `''` instead, which behaves differently. Consider an E2E test that submits with an empty fill-in-blank field and asserts 0 score.

- **Review mode rendering**: `FillInBlankQuestion` accepts a `mode` prop (`active` | `review-correct` | `review-incorrect` | `review-disabled`) and applies `opacity-60` to the input wrapper when not active. No test verifies the input is disabled in review modes, nor that the stored answer is displayed correctly when revisiting a submitted quiz. This is marked as Epic 16 scope in the code comment, but the AC does not exclude it — if future stories extend review mode to fill-in-blank, a test gap will exist.

- **`onChange` reference instability**: The debounce `useEffect` in `FillInBlankQuestion.tsx:36-47` lists `onChange` as a dependency. If a parent re-renders and passes a new `onChange` reference on every render (without `useCallback`), the debounce timer resets on every parent render. The E2E tests exercise this indirectly via the quiz player component which uses `useCallback`, but no unit test asserts the debounce is not re-triggered by referential instability. The `QuizNavigation.tsx` in the diff should be reviewed to confirm `onChange` is memoized at the call site.

- **Markdown in legend**: The question text in `FillInBlankQuestion.tsx:61` is rendered as Markdown inside the `<legend>` element. `<legend>` is a block element and Markdown may emit nested `<p>` tags inside it, which is invalid HTML. No test checks for HTML validity warnings or that the legend text is read correctly by screen readers when Markdown is processed.

---

ACs: 4 covered / 4 total | Findings: 9 | Blockers: 0 | High: 2 | Medium: 3 | Nits: 4
