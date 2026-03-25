## Test Coverage Review: E18-S03 — Ensure Semantic HTML and Proper ARIA Attributes

### AC Coverage Summary

**Acceptance Criteria Coverage:** 5/5 ACs tested (**100%**)

**COVERAGE GATE:** PASS (>=80%)

### AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1 | Radio groups use `<fieldset>` + `<legend>`, inputs have `<label>`, controls grouped logically | `MultipleChoiceQuestion.test.tsx:241` (fieldset+aria-labelledby), `TrueFalseQuestion.test.tsx:118`, `MultipleSelectQuestion.test.tsx:45`, `FillInBlankQuestion.test.tsx:45` | `story-e18-s03.spec.ts:83` (fieldset visible, legend attached), `story-e18-s03.spec.ts:97` (radio inputs accessible by name) | Covered |
| 2 | h1 for quiz title, h2 for question, `<nav>` wraps question grid, `<main>` + `<section>` for regions | `QuizNavigation.test.tsx:30` (nav landmark) | `story-e18-s03.spec.ts:114` (h1 content), `story-e18-s03.spec.ts:123` (h2 attached + text), `story-e18-s03.spec.ts:133` (nav landmark), `story-e18-s03.spec.ts:142` (main + sections) | Covered |
| 3 | `role="status"` / `role="alert"`, `aria-atomic="true"` for feedback | `AnswerFeedback.test.tsx:147` (role=status + aria-live=polite) | `story-e18-s03.spec.ts:165` (role=status, aria-live=polite, aria-atomic=true after answering) | Covered |
| 4 | Descriptive accessible names on all controls, `aria-label` on icon-only buttons | `QuizActions.test.tsx:20` (Previous/Next by name), `QuizActions.test.tsx:44-59` (click callbacks) | `story-e18-s03.spec.ts:186` (Previous aria-label), `story-e18-s03.spec.ts:194` (Next aria-label), `story-e18-s03.spec.ts:202` (all quiz buttons have non-empty names) | Covered |
| 5 | `role="timer"` + `aria-live="off"`, `role="progressbar"` + `aria-valuenow/min/max` | None | `story-e18-s03.spec.ts:227` (role=timer, aria-live=off, aria-label), `story-e18-s03.spec.ts:237` (sr-only progressbar, 1-based values) | Covered |

**Coverage**: 5/5 ACs fully covered | 0 gaps | 0 partial

---

### Test Quality Findings

#### Blockers (untested ACs)

None. All 5 ACs have test coverage meeting the 80% gate threshold.

---

#### High Priority

- **`tests/e2e/story-e18-s03.spec.ts:165` (confidence: 78)**: The AC3 E2E test clicks a radio button option to trigger feedback, then asserts `role="status"` and `aria-atomic="true"`. However, the `AnswerFeedback` component only renders after `isUnanswered(currentAnswer)` returns false (Quiz.tsx:484). If the radio click does not register as a persisted answer in the store (e.g., `submitAnswer` fails silently or the Dexie write does not complete before the assertion), the feedback element will not exist and `toBeVisible()` will pass vacuously through Playwright's retry-until-visible mechanism rather than catching a real absence. The test has no explicit assertion that the feedback is absent before answering, and does not wait for any state change signal after the click. Suggested fix: add `await expect(page.locator('[data-testid="answer-feedback"]')).not.toBeAttached()` before the click to establish a pre-condition, giving the `await expect(feedback).toBeVisible()` post-condition a clear before/after contrast.

- **`src/app/components/quiz/__tests__/AnswerFeedback.test.tsx:147` (confidence: 75)**: The unit test `'has role="status" and aria-live="polite"'` does NOT assert `aria-atomic="true"`, which is the distinguishing attribute named in AC3. The E2E test at line 177 covers this gap for the full integration path, but there is no unit-level assertion that `aria-atomic` is present. If a refactor removed `aria-atomic` from `AnswerFeedback.tsx:103`, only the E2E test would catch it. Suggested addition in `AnswerFeedback.test.tsx` accessibility block: `expect(status).toHaveAttribute('aria-atomic', 'true')`.

---

#### Medium

- **`tests/e2e/story-e18-s03.spec.ts:83-95` (confidence: 65)**: AC1's E2E test checks that a `fieldset` is visible and that a `legend` element `toBeAttached()`. It does not verify that `aria-labelledby` on the fieldset actually resolves to an existing element, nor that the referenced element is non-empty. The unit tests (`MultipleChoiceQuestion.test.tsx:241`, `TrueFalseQuestion.test.tsx:118`) do verify the `aria-labelledby` cross-reference at the component level, so this is only a medium-priority gap. The E2E test would benefit from `await expect(fieldset).toHaveAttribute('aria-labelledby')` followed by an evaluation that the referenced element is present in the DOM.

- **`tests/e2e/story-e18-s03.spec.ts:202-218` (confidence: 60)**: The "all quiz buttons have non-empty accessible names" test iterates `quizContainer.getByRole('button')` and checks either `aria-label` or `textContent`. This heuristic conflates whitespace-only `textContent` (e.g., an icon-only button with `aria-hidden` icon and no visible text) with a legitimate accessible name. The loop at line 213 uses `.trim()` which does handle pure whitespace, but `textContent` on a React-rendered button includes text from ALL descendant nodes including hidden `<span>` wrappers. A button that relies solely on `aria-label` but whose `textContent` returns a non-empty string due to a visually hidden child would pass this check even if the `aria-label` were removed. Suggested improvement: scope the accessible-name check to `aria-label` first, then fall back to `textContent` only if `aria-label` is absent, and separately assert that icon-only buttons (those without visible text `span`) always have `aria-label`.

- **`src/app/components/quiz/__tests__/MultipleSelectQuestion.test.tsx` (confidence: 55)**: The MultipleSelectQuestion unit test has only 3 test cases total, all focused on Markdown rendering and the fieldset structure. There are no unit-level assertions for: (a) checkbox inputs are associated with label elements via the `<label>` wrapper (AC1 "all inputs have associated labels"), (b) `aria-describedby` on the fieldset points to the "Select all that apply" hint span (present in source at `MultipleSelectQuestion.tsx:51-52`), or (c) the `role="group"` or `role="listbox"` semantics of the checkbox group. While the FillInBlank and TrueFalse unit tests have comparable gaps in depth, MultipleSelectQuestion has the least coverage of the four question type components.

- **`tests/e2e/story-e18-s03.spec.ts` — missing `afterEach` cleanup (confidence: 55)**: The spec has no `afterEach` hook to clear the `quizzes` IndexedDB store or the quiz progress keys (`quiz-progress-*`) from `localStorage`/`sessionStorage`. All 10 tests within the file use the same fixed `quiz-e18s03` ID and `LESSON_ID`. Playwright's browser context isolation between test files handles cross-file contamination, but within the file, if a test leaves quiz progress in `localStorage` (via the `beforeunload` handler in `Quiz.tsx:329-352`), subsequent tests in the same file could resume an in-progress quiz instead of hitting the start screen, causing navigation to skip `startQuiz`. The current test ordering avoids this because `navigateToQuiz` always re-seeds and re-navigates, but the absence of explicit cleanup increases brittleness. Suggested fix: add `test.afterEach(async ({ page }) => { await page.evaluate(() => { Object.keys(sessionStorage).filter(k => k.startsWith('quiz-progress-')).forEach(k => sessionStorage.removeItem(k)); Object.keys(localStorage).filter(k => k.startsWith('quiz-progress-')).forEach(k => localStorage.removeItem(k)); }) })`.

---

#### Nits

- **Nit `tests/e2e/story-e18-s03.spec.ts:243`**: The `sr-only progressbar` test uses the locator `[role="progressbar"][aria-valuemin="1"]` to distinguish the sr-only element from the visual `<Progress>` (which has `aria-valuemin="0"`). This works, but the selector encodes an implementation detail (the specific value of `aria-valuemin`). If the visual Progress component is ever updated to use 0-based relative values differently, the selector silently changes meaning. A more stable alternative would be `[role="progressbar"].sr-only` or adding `data-testid="question-count-progressbar"` to the sr-only element in the implementation.

- **Nit `src/app/components/quiz/__tests__/AnswerFeedback.test.tsx:147`**: The test description says `'has role="status" and aria-live="polite"'` but is nested under `describe('accessibility')` alongside a test that does not explicitly name the AC it covers. Adding a comment `// AC3 requirement` on the relevant assertions would make AC-to-test traceability clearer in future reviews.

- **Nit `tests/e2e/story-e18-s03.spec.ts:57-70`**: The `navigateToQuiz` helper navigates to `/` first (to establish a valid browsing context), then seeds, then navigates to the quiz URL. This two-navigation pattern is correct for IDB seeding (the DB must be opened before seeding), but the intermediate `/` navigation adds round-trip latency. Since `page.goto('/', ...)` happens before `seedQuizzes`, and `seedQuizzes` opens IndexedDB directly via `page.evaluate`, the first navigation could be replaced by a bare `page.goto('about:blank')` to reduce test time without affecting correctness.

---

### Edge Cases to Consider

1. **Untimed quiz (no timer): AC5 timer assertions will fail.** The quiz fixture at `tests/e2e/story-e18-s03.spec.ts:50` sets `timeLimit: 300` to satisfy AC5. There is no complementary test that verifies the timer element is absent (not rendered) when `timeLimit: null`. The `QuizTimer` component is conditionally rendered in `Quiz.tsx:446` only when `timerInitialSecondsRef.current > 0`. An untimed quiz should have no `role="timer"` element — but this negative case is untested. Suggested test: `'timer element is absent for untimed quizzes'` in the AC5 describe block, using `makeQuiz({ timeLimit: null })` and asserting `await expect(page.locator('[role="timer"]')).not.toBeAttached()`.

2. **Progress bar values on question navigation.** The sr-only progressbar test at line 237 only asserts `aria-valuenow="1"` (first question). No test verifies that `aria-valuenow` increments correctly when the user navigates to question 2 (via the Next button). The `QuizHeader.tsx:48` computes `currentQuestion` from `progress.currentQuestionIndex + 1`, so navigation must actually update the store. Suggested assertion: after `nextBtn.click()`, assert `srProgressbar` has `aria-valuenow="2"`.

3. **`role="alert"` for error state in Quiz.tsx.** The AC3 text includes `role="alert"` as a valid ARIA role for dynamic content. `Quiz.tsx:390-405` renders a `role="alert"` wrapper for the error/not-found state, but no test covers this state. Suggested test: navigate to a non-existent quiz URL (with no seeded data) and assert `await expect(page.getByRole('alert')).toBeVisible()` with appropriate message content.

4. **FillInBlankQuestion `<label>` association via `aria-labelledby`.** `FillInBlankQuestion.tsx:93` uses `aria-labelledby={labelId}` on the `<Input>` element (not a `<label>` element). AC1 requires "all inputs have associated `<label>` elements." The `<Input>` is inside a `<fieldset>` but the input itself does not have a wrapping `<label>` — it relies on `aria-labelledby`. WCAG 1.3.1 allows `aria-labelledby` as a substitute for `<label>`, so this is technically conformant, but it is a subtle divergence from the literal AC text ("associated `<label>` elements"). No unit test distinguishes between label association via `<label>` wrap versus `aria-labelledby` for FillInBlank. This distinction should be explicitly documented in the test or the AC clarified.

5. **`QuizActions` Submit button descriptive `aria-label` not tested.** `QuizActions.tsx:55-57` renders the Submit button with a long descriptive `aria-label` (`"Submit Quiz — ends the quiz and shows your results"` or `"Submitting quiz…"`). The `QuizActions.test.tsx` tests find the button by `{ name: /submit quiz/i }` (partial match) and by `{ name: /submitting/i }`, neither of which verifies the full descriptive label text mandated by AC4 ("descriptive accessible names"). Consider adding an assertion for the exact or substantially complete label string.

---

ACs: 5 covered / 5 total | Findings: 10 | Blockers: 0 | High: 2 | Medium: 4 | Nits: 3
