## Test Coverage Review: E12-S04 — Create Quiz Route and QuizPage Component

### AC Coverage Summary

**Acceptance Criteria Coverage:** 4/4 ACs tested (**100%**)

**COVERAGE GATE:** PASS (>=80%)

### AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1 | Quiz start screen: title, description, metadata badges (question count, timed/untimed, passing score), "Start Quiz" button visible, no questions visible yet | None | `tests/e2e/story-e12-s04.spec.ts:30` (timed variant), `:65` (untimed variant) | Covered |
| 2 | Click Start Quiz: QuizHeader shows "Question 1 of N" + progress bar; timer starts in MM:SS format for timed quiz | None | `tests/e2e/story-e12-s04.spec.ts:82` (header + progress bar), `:105` (MM:SS timer) | Covered |
| 3 | Incomplete quiz in localStorage: "Resume Quiz (X of Y answered)" button visible; clicking it restores exact question position | None | `tests/e2e/story-e12-s04.spec.ts:130` | Covered |
| 4 | Non-existent quiz: error message "No quiz found for this lesson" + link back to course | None | `tests/e2e/story-e12-s04.spec.ts:171` | Covered |

**Coverage**: 4/4 ACs fully covered | 0 gaps | 0 partial

---

### Previous Blocker — AC3 Resume Click — Verified Fixed

The prior review (2026-03-17) flagged a blocker at confidence 90: the AC3 test never clicked the Resume button to verify that position is restored. This was the primary focus of the re-review.

**Verdict: Fixed.** Commit `ebf19dc` added the click and position assertion at `tests/e2e/story-e12-s04.spec.ts:165-167`:

```
await page.getByRole('button', { name: /resume quiz/i }).click()
await expect(page.getByText(/question 5 of 12/i)).toBeVisible()
```

The seeded progress (`currentQuestionIndex: 4`, 5 answers recorded) now has a corresponding assertion that `QuizHeader` renders "Question 5 of 12" — confirming the `handleResume` → `useQuizStore.setState` wiring is exercised end-to-end. AC3 is fully covered.

---

### Previous High/Medium Findings — Resolved in ebf19dc

All prior High and Medium findings from the 2026-03-17 review were addressed in commit `ebf19dc`:

- **AC2 missing progressbar assertion** — added at line 102 (`getByRole('progressbar')`).
- **Inline question objects instead of factory** — replaced with `makeQuestion()` in all three AC tests (AC1, AC2, AC3).
- **No afterEach cleanup for AC3 localStorage** — `test.afterEach` added at lines 126-128 scoped to the AC3 describe block.
- **Weak `.or()` assertions for badge text** — tightened to exact patterns: `/30 min/i` (line 57) and `/70% to pass/i` (line 58).
- **Stale RED-state comments** — removed from the file header.
- **Missing COURSE_ID routing comment** — added at line 14.
- **Missing AC4 no-seeding comment** — added at line 172.

---

### Test Quality Findings

#### Blockers

None.

#### High Priority

None. All four ACs have complete E2E coverage including the previously-partial AC3 resume-click path.

#### Medium

- **`tests/e2e/story-e12-s04.spec.ts:105-120` (confidence: 72)**: The AC2 timer test (`'timer counts down in MM:SS format for timed quiz'`) asserts only that a string matching `/\d{2}:\d{2}/` is visible after clicking Start Quiz. It does not verify the initial value corresponds to the seeded `timeLimit: 10` (i.e., "10:00"), nor that the element is located inside the QuizHeader rather than matching some other MM:SS-like text on the page. For a 10-minute quiz `startQuiz` sets `timeRemaining: 10` (minutes), and `QuizHeader` converts this to `600` seconds and renders `10:00`. A tighter assertion `await expect(page.getByText('10:00')).toBeVisible()` would confirm the minutes-to-seconds conversion is correct and rule out false positives from other page content. As written, `00:00` would also pass this test.

- **`tests/e2e/story-e12-s04.spec.ts:105-120` (confidence: 70)**: The timer test uses `makeQuiz` with a single default question (the factory default) rather than seeding multiple questions. This is fine for the timer assertion, but `startQuiz` in the store also builds `questionOrder` from the quiz's questions array. With only one question the timer still starts correctly, so this is low risk — but a brief inline comment noting that question count is irrelevant to the timer assertion would remove any ambiguity about what this test is and is not covering.

#### Nits

- **Nit `tests/e2e/story-e12-s04.spec.ts:161-163` (confidence: 80)**: The AC3 test includes two assertions before the resume click: `getByRole('button', { name: /resume quiz/i })` and `getByText(/5 of 12/i)`. The first is now redundant with the post-click flow (if the click succeeds, the button was obviously visible). Keeping both is not wrong — the pre-click assertion explicitly confirms the button label format — but a brief comment such as `// Verify button label includes count before clicking` would clarify the intent of the two-step pattern.

- **Nit `tests/e2e/story-e12-s04.spec.ts:106-110` (confidence: 75)**: The `quiz-004` used by the timer test is a different ID from `quiz-003` used by the progress-text test. Both are in the same `test.describe('AC2')` block. Both call `await indexedDB.clearStore('quizzes')` before seeding — which is the correct isolation pattern. However, if a future AC2 test is added that does not clear the store, `quiz-003` and `quiz-004` could interfere. The current pattern is fine; noting it here so it is preserved intentionally when AC2 tests expand in Story 12.5.

---

### Edge Cases to Consider

These paths exist in the implementation but have no test coverage. None are blockers given the story scope, but they are candidates for Story 12.5 or a dedicated edge-case story.

1. **Corrupt localStorage resume data.** `Quiz.tsx:27-37` catches `JSON.parse` exceptions and failed Zod parses, returning `null` and falling back to the Start screen. No test seeds a malformed string (e.g., `localStorage.setItem('quiz-progress-quiz-005', 'not-json')`) and verifies that Start Quiz (not Resume) is shown. The `loadSavedProgress` helper is otherwise untested.

2. **Progress object with zero answers.** `Quiz.tsx:32` explicitly returns `null` when `Object.keys(result.data.answers).length === 0`. A progress record with a valid schema but empty `answers` map should show Start Quiz, not Resume. This boundary is distinct from "no key in localStorage" and is unexercised.

3. **"Start Over" confirmation dialog.** `QuizStartScreen.tsx:60-88` renders an `AlertDialog` when resume state is active. No test verifies the "Start Over" button is visible alongside Resume, that clicking it opens the confirm dialog, or that confirming it transitions to the active quiz from question 1 (rather than restoring saved position). The dialog was added in response to the design review blocker but has no corresponding test.

4. **Quiz with no description.** `QuizStartScreen.tsx:32-34` conditionally renders the description paragraph only when `quiz.description` is truthy. The `makeQuiz` factory defaults `description: 'A test quiz'`, so all current tests always render the description. A test with `description: ''` would verify the conditional is wired correctly and the description element is absent from the DOM.

5. **Progress bar ARIA values.** `QuizHeader.tsx:128-135` renders `aria-valuenow`, `aria-valuemin`, and `aria-valuemax`. No test verifies these values are correct after Start Quiz. For a 1-of-5 quiz `aria-valuenow` should be `20`. An assertion `await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '20')` would confirm the percentage calculation in `QuizHeader.tsx:26-27`.

6. **Timer stops at exactly 00:00.** `QuizHeader.tsx:50-54` stops decrement when `s <= 0` and clears the interval. No test verifies the displayed time reads `00:00` and stays there (rather than going negative or wrapping). This would require fast-forwarding the clock via `page.clock.fastForward()`.

7. **Dexie query rejection (not just "not found").** `Quiz.tsx:82-85` catches a rejected Dexie promise and sets `fetchState = 'error'`. This code path is distinct from a resolved query returning `undefined` (which is what the AC4 test exercises). A DB-level failure is not covered.

---

ACs: 4 covered / 4 total | Findings: 4 | Blockers: 0 | High: 0 | Medium: 2 | Nits: 2
