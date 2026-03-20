## Test Coverage Review: feature/stitch-quiz-enhancements — Stitch Quiz Enhancements

**Review Date**: 2026-03-20
**Branch**: `feature/stitch-quiz-enhancements`
**Reviewer**: Test Coverage Specialist (claude-sonnet-4-6)
**Story File**: `docs/implementation-artifacts/12-6-calculate-and-display-quiz-score.md`

---

### AC Coverage Summary

**Acceptance Criteria Coverage:** 7/8 ACs tested (**87.5%**)

**COVERAGE GATE:** PASS (>=80%) — 87.5% meets the 80% minimum threshold.

The coverage figure reflects the original E12-S06 story ACs, which are the only formally documented acceptance criteria for this branch. The stitch enhancements (QuestionBreakdown, AreasForGrowth, QuestionHint, auto-focus Next, score ring tier redesign) are enhancement commits layered on top of the story and evaluated here as implementation-defined features, not formally documented ACs.

---

### AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1 | Submit quiz → score page with percentage, "X of Y correct", pass/fail status, time spent | `ScoreSummary.test.tsx:24,34,60` | `story-12-6.spec.ts:149` | Covered |
| 2 | Unanswered questions → AlertDialog confirmation; "Continue Reviewing" returns to quiz | None | `story-12-6.spec.ts:178` | Covered (E2E only) |
| 3 | Unanswered → "Submit Anyway" submits with unanswered scored as 0 | None | `story-12-6.spec.ts:204` | Covered (E2E only) |
| 4 | Results page: "Retake Quiz" (outline), "Review Answers" (brand), "Back to Lesson" link | None | `story-12-6.spec.ts:229` | Covered (E2E only) |
| 4b | "Retake Quiz" navigates back to quiz start screen | None | `story-12-6.spec.ts:301` | Covered (E2E only) |
| 5 | Word "Failed" MUST NOT appear anywhere on results screen (QFR23) | `ScoreSummary.test.tsx:52` | `story-12-6.spec.ts:254` | Covered |
| 6 | Time spent displayed in human-readable format ("Completed in Xm Ys") | `ScoreSummary.test.tsx:60` | `story-12-6.spec.ts:280` | Covered |
| 7 | submitQuiz Dexie write error: error toast shown, user remains on quiz page with answers intact | None | None | Gap |

**Coverage**: 7/8 ACs fully covered | 1 gap | 0 partial

---

### Enhancement Feature Coverage Table

The following implementation-defined enhancements (added across commits on this branch but not formally itemized as separate ACs in the story file) are assessed below for completeness.

| Feature | Unit Test | E2E Test | Verdict |
|---------|-----------|----------|---------|
| ScoreSummary: tier labels (EXCELLENT / PASSED / NEEDS REVIEW / NEEDS WORK) | `ScoreSummary.test.tsx:47,30,42,39` | None | Unit covered, no E2E |
| ScoreSummary: tier boundary values (90, 89, 50, 49) | `ScoreSummary.test.tsx:112-130` | None | Unit covered |
| ScoreSummary: SVG ring color per tier (success/brand/warning/destructive) | `ScoreSummary.test.tsx:91-110` | None | Unit covered |
| ScoreSummary: "X of Y correct · N% to pass" combined subtitle | `ScoreSummary.test.tsx:31` | None | Unit covered |
| ScoreSummary: `Math.max(timeSpent, 1000)` floor (sub-second display) | None | None | Gap |
| QuestionBreakdown: per-question correct/incorrect icons and points | `QuestionBreakdown.test.tsx:19,90` | None | Unit covered, no E2E |
| QuestionBreakdown: collapsed by default, toggle open/close | `QuestionBreakdown.test.tsx:38,45` | None | Unit covered, no E2E |
| QuestionBreakdown: empty answers renders nothing | `QuestionBreakdown.test.tsx:63` | None | Unit covered |
| AreasForGrowth: renders nothing for empty incorrectItems | `AreasForGrowth.test.tsx:14` | None | Unit covered |
| AreasForGrowth: shows question text and correct answer | `AreasForGrowth.test.tsx:19,34` | None | Unit covered, no E2E |
| AreasForGrowth: "Show all" pagination (>5 items) | `AreasForGrowth.test.tsx:58,71` | None | Unit covered |
| AreasForGrowth: "Show all" not shown for <=5 items | `AreasForGrowth.test.tsx:96` | None | Unit covered |
| QuestionHint: renders nothing for undefined/empty/whitespace | `QuestionHint.test.tsx:6,11,16` | None | Unit covered |
| QuestionHint: renders hint text with ARIA note role | `QuestionHint.test.tsx:21,28` | None | Unit covered, no E2E |
| Quiz.tsx: auto-focus Next/Submit button after answering | None | None | Gap |
| QuizResults: `loadAttempts` failure swallowed (`.catch(() => setAttemptsLoaded(true))`) | None | None | Gap |
| QuizResults: `navigate()` used for Retake (not `window.location.href`) | None | `story-12-6.spec.ts:301` | E2E only |
| ScoreSummary: `aria-live` region announces score to screen readers | `ScoreSummary.test.tsx:85` | None | Unit covered |
| E2E: AC1 asserts "Congratulations! You passed!" (stale — message changed to "Great job!") | — | `story-12-6.spec.ts:175` | Stale assertion |
| E2E: AC5 asserts "Keep Going!" (stale — message changed to "Keep practicing!") | — | `story-12-6.spec.ts:273` | Stale assertion |

---

### Test Quality Findings

#### Blockers (untested ACs)

- **(confidence: 95)** AC7: "Given the submitQuiz store action fails (Dexie write error after retries), the user sees an error toast and remains on the quiz page with answers intact" has zero test coverage — neither unit nor E2E. The story file identifies this AC explicitly. The `QuizResults.tsx` diff adds a `.catch(() => setAttemptsLoaded(true))` for `loadAttempts`, but there is no test that triggers it or verifies the user is not stranded. Suggested test: `QuizResults.error.test.tsx` — mock `useQuizStore` with `loadAttempts` rejecting, assert the loading state resolves (no infinite spinner) and the component renders the redirect or a fallback, not a blank screen.

#### High Priority

- **`tests/e2e/story-12-6.spec.ts:175` (confidence: 95)**: The E2E assertion `page.getByText(/Congratulations! You passed!/)` will fail against the current implementation. `ScoreSummary.tsx` was redesigned on this branch — the PASSED tier now renders "Great job! You're on the right track." not "Congratulations! You passed!". The old message string no longer exists anywhere in the source tree. This is a broken E2E test masquerading as a pass only if the test is not currently being run against the new code. Fix: update the assertion to match the actual rendered message for the PASSED tier, e.g. `/Great job/` or `/on the right track/`.

- **`tests/e2e/story-12-6.spec.ts:273` (confidence: 95)**: Same staleness problem for the not-pass (NEEDS WORK) tier. The assertion `page.getByText(/Keep Going!/)` refers to the old not-pass message. The current implementation renders "Keep practicing! Focus on the topics below." Fix: update to match `/Keep practicing/`.

- **Auto-focus Next/Submit button after answering (confidence: 85)**: The `requestAnimationFrame(() => nextBtnRef.current?.focus())` behavior added in `Quiz.tsx` has no test at any level. This is a user-visible keyboard navigation enhancement. An E2E test is the appropriate vehicle: seed a quiz with a hint, click a radio option, then assert that the Next button (or Submit button on last question) has `document.activeElement`. This behavior is testable via `page.evaluate(() => document.activeElement?.textContent)` after a radio click. Suggested test name: "answering a question auto-focuses the Next button for keyboard advancement" in `story-12-6.spec.ts` or a dedicated stitch spec.

- **`src/app/components/quiz/__tests__/ScoreSummary.test.tsx` — `timeSpent` floor not tested (confidence: 80)**: The `Math.max(timeSpent, 1000)` guard was added to ScoreSummary to prevent `formatDuration(0)` rendering "0s" for near-instant submissions. No test exercises `timeSpent = 0` or `timeSpent = 500`. The existing test at line 60 uses `timeSpent: 512000` which never hits the floor. Suggested test: render `ScoreSummary` with `timeSpent={0}` and assert the display is "Completed in 1s" (the 1000ms floor rendered through `formatDuration`).

#### Medium

- **`tests/e2e/story-12-6.spec.ts` — no E2E coverage for QuestionBreakdown, AreasForGrowth, or QuestionHint (confidence: 80)**: All three new components are tested only at the unit level. On the results page integration path (QuizResults rendering QuestionBreakdown + AreasForGrowth together), there is no E2E assertion that these sections are visible, let alone functional. The collapsible toggle, the "Show all" expansion, and the hint card during quiz-taking are user-facing interactions with no browser-level coverage. Suggested additions to `story-12-6.spec.ts`: (1) after submitting with incorrect answers, assert `page.getByText('Areas to Review')` is visible; (2) click the "Question Breakdown" button and assert individual question rows appear; (3) seed a question with a hint and assert the hint card renders during quiz-taking.

- **`src/app/components/quiz/__tests__/QuestionBreakdown.test.tsx:6-16` — inline test data instead of factory (confidence: 70)**: The `questions` and `answers` arrays at the top of the file are declared as module-level constants — they are immutable so mutation is not a risk, but they bypass the factory pattern established in `tests/support/fixtures/factories/quiz-factory.ts`. The factory's `makeQuestion()` and `makeAttempt()` would produce the same data with less coupling to the internal shape of `Question`. This is a style concern, not a correctness issue.

- **`src/app/components/quiz/__tests__/AreasForGrowth.test.tsx:6-11` — `makeItems` factory not reusing `quiz-factory.ts` (confidence: 65)**: The local `makeItems` helper creates ad-hoc objects shaped like `{questionId, questionText, correctAnswer}`. These are props-level objects (not full `Question` entities), so using `quiz-factory.ts` directly would require reshaping. This is acceptable, but the function name `makeItems` could be more descriptive (`makeIncorrectItems`) to match the prop name `incorrectItems`.

- **`src/app/components/quiz/__tests__/ScoreSummary.test.tsx:53-58` — two renders in one test (confidence: 60)**: The `'never renders "Failed" in any state'` test renders two separate `ScoreSummary` instances inside the same `it` block. Each render is uncleaned, which means DOM nodes from the first render remain when the second is rendered. Testing Library auto-cleans between `it` blocks but not within them. The assertions use `container.textContent` scoped to each render's container, so the test is functionally correct, but the pattern is fragile if future RTL versions change cleanup behavior. Suggested fix: split into two `it` blocks.

#### Nits

- **Nit `tests/e2e/story-12-6.spec.ts:65-101` (confidence: 75)**: The `seedQuizData` helper uses manual `indexedDB.open` with retry logic instead of the shared seeding helper referenced in `.claude/rules/testing/test-patterns.md`. This predates the shared helper and was there before this branch's changes, but it is surfaced here because the stitch enhancements branch added quiz data with `hint` fields — the factory (`makeQuestion`) does not yet have a `hint` default, so E2E tests for QuestionHint would need the factory extended before they can be written cleanly.

- **Nit `tests/support/fixtures/factories/quiz-factory.ts:12-23` (confidence: 75)**: `makeQuestion` does not include a `hint` field in its defaults. Since `hint?: string` was added to `BaseQuestionSchema` on this branch, the factory should be updated to optionally accept a `hint` override, enabling E2E tests that exercise the hint display path without constructing raw question objects inline.

- **Nit `src/app/components/quiz/__tests__/QuestionBreakdown.test.tsx:42` (confidence: 60)**: The assertion `expect(screen.queryByRole('list')).not.toBeInTheDocument()` correctly verifies the collapsed state, but it also passes if the `Collapsible` component renders the `ul` with `hidden` attribute or `display: none`. The Radix Collapsible implementation unmounts content when closed, so this passes correctly today — but it is an implementation assumption worth a comment.

---

### Edge Cases to Consider

1. **QuestionBreakdown: answer exists but question does not** — the `rows` computation in `QuestionBreakdown.tsx` uses `answers.find(a => a.questionId === question.id)` and silently drops unmatched answers. No test covers the inverse: an answer for a `questionId` that has no matching entry in `questions`. The component would silently omit that row. A unit test with a mismatched `questionId` would confirm the graceful degradation.

2. **AreasForGrowth: exactly 5 incorrect items** — the boundary between "no Show all button" and "Show all button" is at `length > 5`. The test at line 96 covers exactly 5 items (button absent) and line 58 covers 7 (button present). The boundary at 6 is not tested — if the constant `DEFAULT_VISIBLE_COUNT` is ever changed, both adjacent boundary tests should be updated together.

3. **ScoreSummary: `percentage` exactly 0** — no test covers the zero-score edge case. The SVG `strokeDashoffset` calculation would produce `offset === circumference`, resulting in an invisible arc. The component should render correctly (empty ring is valid), but this is unverified.

4. **ScoreSummary: `percentage > 100`** — the `Math.round(percentage)` display would render values like "102" without clamping. The SVG `strokeDashoffset` would go negative, potentially drawing a full ring plus overflow. No validation or clamping exists in the component or its callers.

5. **AreasForGrowth: correctAnswer is an empty string** — `QuizResults.tsx` maps `correctAnswer ?? 'N/A'` but an empty string (`""`) is falsy in JS only for `||`, not `??`. An empty string passes the nullish check and renders as "Correct answer: " with no value. Not tested.

6. **Auto-focus race condition on slow renders** — `requestAnimationFrame(() => nextBtnRef.current?.focus())` is called inside the `onChange` handler. If the component re-renders and unmounts `nextBtnRef` before the animation frame fires (e.g., rapid double-click on a radio), the ref would be null. The optional chaining `?.focus()` prevents a throw, but the focus intent is silently lost. No test covers this scenario.

7. **QuizResults `loadAttempts` error path** — the `.catch(() => setAttemptsLoaded(true))` added in this branch silently swallows the `loadAttempts` rejection, setting `attemptsLoaded` to `true` without a `lastAttempt`. The component then hits the `<Navigate>` redirect (no attempt found). This is the correct silent-failure behavior, but it is untested and could mask a broken Dexie schema.

---

ACs: 7 covered / 8 total | Enhancement features: 15 covered, 3 gaps | Findings: 12 | Blockers: 1 | High: 4 | Medium: 4 | Nits: 4
