## Test Coverage Review: E12-S04 — Create Quiz Route and QuizPage Component

### AC Coverage Summary

**Acceptance Criteria Coverage:** 4/4 ACs tested (**100%**)

**COVERAGE GATE:** PASS (>=80%)

### AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1 | Navigate to quiz URL → start screen: title, description, metadata badges (question count, time limit, passing score), "Untimed" badge when no time limit, "Start Quiz" button visible, no questions yet | None | `tests/e2e/story-e12-s04.spec.ts:34` (timed), `:75` (untimed) | Covered |
| 2 | Click Start Quiz → `useQuizStore.startQuiz(lessonId)` called, QuizHeader shows "Question 1 of N" + progress bar, timer starts if timed (MM:SS) | None | `tests/e2e/story-e12-s04.spec.ts:92` (header/progress), `:120` (timer) | Covered |
| 3 | Incomplete quiz in progress (localStorage) → "Resume Quiz (X of Y answered)" button; clicking restores position/answers/order | None | `tests/e2e/story-e12-s04.spec.ts:139` | Partial |
| 4 | Non-existent quiz → "No quiz found for this lesson" + link back to course | None | `tests/e2e/story-e12-s04.spec.ts:182` | Covered |

**Coverage**: 4/4 ACs covered with tests | 0 hard gaps | 1 partial

---

### Test Quality Findings

#### Blockers (untested ACs)

None. All four ACs have E2E test coverage.

#### High Priority

- **`tests/e2e/story-e12-s04.spec.ts:139` (confidence: 85)**: AC3 tests that the Resume button appears and displays the answered count, but never clicks the Resume button to verify that position and answers are actually restored. The AC explicitly requires "clicking it restores my exact position, answers, and question order." After calling `onResume`, the implementation injects saved progress via `useQuizStore.setState()` — this wiring is untested. A follow-on assertion that clicks the button and then checks `page.getByText(/question 5 of 12/i)` (reflecting `currentQuestionIndex: 4`) would complete the coverage. Suggested addition in the same describe block:
  ```
  test('clicking Resume Quiz restores the saved question index',
  ```
  asserting `page.getByText(/question 5 of 12/i)` is visible after the click.

- **`tests/e2e/story-e12-s04.spec.ts:139` (confidence: 78)**: The AC3 test seeds `localStorage` via `page.addInitScript` which runs on every page load, but the `beforeEach` navigates to `/` before the quiz is seeded. The `addInitScript` call at line 166 happens after `page.goto('/')` completes in `beforeEach`, meaning the script is registered for the next navigation (the `page.goto(QUIZ_URL)` call at line 173). This order is correct, but it means the quiz-progress key is not present during the initial `/` load — which is fine here. However, if `beforeEach` ordering ever changes, the test would silently pass with no resume state. The test should include an explicit assertion that the `localStorage` key is set before navigating to the quiz URL, e.g. via `page.evaluate(() => localStorage.getItem('quiz-progress-quiz-005'))` before `page.goto(QUIZ_URL)`.

- **`tests/e2e/story-e12-s04.spec.ts:92` (confidence: 75)**: AC2 asserts `page.getByText(/question 1 of 5/i)` is visible after clicking Start Quiz, but does not verify that the progress bar (`<Progress>`) is rendered. The AC and implementation both include the progress bar as a required element of QuizHeader. Suggested assertion: `await expect(page.getByRole('progressbar')).toBeVisible()` immediately after the progress text assertion.

#### Medium

- **`tests/e2e/story-e12-s04.spec.ts:54` (confidence: 72)**: The AC1 test seeds 12 questions with hardcoded inline objects rather than using `makeQuestion()` from the factory. The factory at `tests/support/fixtures/factories/quiz-factory.ts:12` exists precisely to reduce this boilerplate. Each question block is 8 lines repeated 12 times, making the test 50+ lines for what is fundamentally a setup step. Replacing the `Array.from` block with `Array.from({ length: 12 }, (_, i) => makeQuestion({ id: \`q-\${i}\`, order: i + 1, text: \`Question \${i + 1}\` }))` would halve the test body.

- **`tests/e2e/story-e12-s04.spec.ts:97` (confidence: 68)**: The AC2 "Start Quiz" test seeds 5 questions with the same inline pattern. Same factory usage issue as above.

- **`tests/e2e/story-e12-s04.spec.ts:144` (confidence: 68)**: The AC3 test seeds 12 questions inline. Same factory usage issue as above.

- **`tests/e2e/story-e12-s04.spec.ts` (confidence: 65)**: No `afterEach` cleanup of `localStorage` for the quiz-progress key seeded in AC3. The `indexedDB` fixture auto-clears via its `afterEach` (via `use(helper)` teardown), but `quiz-progress-quiz-005` written to `localStorage` in AC3 persists across tests within the same context. While Playwright isolates browser contexts between test files, tests within the same `describe` share a context. If test execution order changes such that AC3 runs before AC1 or AC2, and the `lessonId` lookup resolves to the same quiz ID, a stale progress key could trigger the Resume path in tests that expect the Start path. Mitigate by adding `await page.evaluate(() => localStorage.removeItem('quiz-progress-quiz-005'))` in an `afterEach` scoped to the AC3 describe block.

- **`tests/e2e/story-e12-s04.spec.ts:67` (confidence: 60)**: The time limit badge assertion uses an `or()` — `page.getByText(/30 min/i).or(page.getByText(/30:00/i))`. This passes regardless of which format the badge renders. The implementation renders `${quiz.timeLimit} min` (i.e., "30 min"), so the first branch is the one that matches. The `or()` makes the assertion weaker than it needs to be and would allow a regression to `30:00` to pass undetected. Since the implementation format is known and stable, prefer the single assertion `page.getByText(/30 min/i)`.

#### Nits

- **Nit `tests/e2e/story-e12-s04.spec.ts:14` (confidence: 95)**: The file-level comment block (lines 1-14) still says "Tests are written in RED (failing) state — they drive implementation." The tests pass. This comment is now stale and should be removed or updated to reflect that they are green.

- **Nit `tests/e2e/story-e12-s04.spec.ts:19` (confidence: 90)**: `COURSE_ID` and `LESSON_ID` constants are defined at module scope but only `LESSON_ID` is functionally load-bearing (used to associate the quiz). `COURSE_ID` appears only in `QUIZ_URL` and the error-state AC4 test uses completely different IDs. A brief comment clarifying that `COURSE_ID` is a routing placeholder (not used in quiz lookup) would prevent future confusion.

- **Nit `tests/e2e/story-e12-s04.spec.ts:182` (confidence: 85)**: The AC4 test navigates to `/courses/nonexistent-course/lessons/nonexistent-lesson/quiz` without seeding (correct — tests the empty-IDB path). However, the `beforeEach` already navigated to `/` to initialise Dexie. Since the AC4 test doesn't seed anything, it could skip the shared `beforeEach` Dexie initialisation concern entirely — but it shares `beforeEach` with all other tests, which is fine. Consider a brief inline comment explaining why no seeding is needed for this test.

---

### Edge Cases to Consider

1. **Corrupt localStorage resume data.** `Quiz.tsx:19-29` has a `try/catch` around `JSON.parse` that returns `null` on parse failure. This code path (malformed JSON stored at `quiz-progress-{id}`) is not covered by any test. A test that seeds `localStorage.setItem('quiz-progress-quiz-005', 'not-json')` and then navigates should verify that the Start Quiz button (not Resume) is shown.

2. **Resume state with zero answers.** `Quiz.tsx:25` explicitly returns `null` when `Object.keys(parsed.answers).length === 0`. This means a progress object with an empty `answers` map is treated as "not started." A test seeding a progress object with `answers: {}` should verify the Start Quiz button appears, not Resume.

3. **Progress bar `aria-label` and `aria-valuenow`.** `QuizHeader.tsx:50` renders `<Progress aria-label="Quiz progress" />`. The story's Accessibility section requires `aria-valuenow` and `aria-valuemax`. No test verifies these ARIA attributes are present and correct after Start Quiz is clicked.

4. **Timer stops at zero.** `QuizHeader.tsx:31` stops decrement when `s <= 0` but keeps the interval running. No test verifies the displayed time reads `00:00` and does not go negative after the time expires.

5. **Dexie query failure (error path).** `Quiz.tsx:73-75` catches a Dexie rejection and shows the error state. This path is distinct from "quiz not found" (which is a successful query returning `undefined`). No test exercises a DB-level failure — this would require intercepting or corrupting the IndexedDB transaction.

6. **"Start Over" button in resume state.** `QuizStartScreen.tsx:47-52` renders a "Start Over" ghost button when resume state is active. No test verifies this button is visible alongside the Resume button, nor that clicking it transitions to the active quiz without restoring saved progress.

7. **Missing description field.** `QuizStartScreen.tsx:18-20` conditionally renders the description paragraph only when `quiz.description` is truthy. No test exercises a quiz with `description: ''` or `description: undefined` to verify the description element is absent.

---

ACs: 4 covered / 4 total | Findings: 12 | Blockers: 0 | High: 3 | Medium: 4 | Nits: 3
