## Test Coverage Review: E13-S02 — Mark Questions for Review

### AC Coverage Summary

**Acceptance Criteria Coverage:** 5/5 ACs tested (**100%**)

**COVERAGE GATE:** PASS (>=80%)

### AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1 | "Mark for Review" checkbox visible, labeled, toggleable on any question | `MarkForReview.test.tsx:13-43` | `story-e13-s02.spec.ts:131-154` | Covered |
| 2 | Toggle marks question in state; grid shows yellow indicator; persists on navigation | `QuestionGrid.test.tsx:64-89`, `QuizNavigation.test.tsx:48-58`, `useQuizStore.test.ts:432-471` | `story-e13-s02.spec.ts:131-154`, `156-178` | Covered |
| 3 | Multiple marked questions all show indicators; jump to them via grid | `QuestionGrid.test.tsx:77-88` | `story-e13-s02.spec.ts:180-201` | Covered |
| 4 | Clearing a review mark removes indicator | `useQuizStore.test.ts:452-470`, `QuestionGrid.test.tsx:70-88` | `story-e13-s02.spec.ts:131-154` (toggle off, line 149-153) | Covered |
| 5 | Submit dialog shows count, list of marked questions, and working jump links | `ReviewSummary.test.tsx:8-93` | `story-e13-s02.spec.ts:203-253` | Covered |

**Coverage**: 5/5 ACs fully covered | 0 gaps | 0 partial

---

### Test Quality Findings

#### Blockers (untested ACs)

None.

#### High Priority

- **`tests/e2e/story-e13-s02.spec.ts:63-99` (confidence: 85)**: The `seedQuizData` helper is a full reimplementation of the `putRecords` logic already encapsulated in `tests/support/fixtures/indexeddb-fixture.ts`. The story's own testing notes explicitly direct to "use the seeding helper from story-12-6.spec.ts pattern," but `story-e13-s02.spec.ts` duplicates the entire 36-line inline seeding function rather than consuming the shared `indexedDB` fixture provided by `tests/support/fixtures/index.ts`. This creates two maintenance surfaces for the same retry loop. Fix: import `test` from `'../support/fixtures'` (already done at line 10), extend the fixture to expose a `seedQuizzes` method, or at minimum extract the inline helper to `tests/support/helpers/seed-helpers.ts` so it is shared.

- **`tests/e2e/story-e13-s02.spec.ts` — no afterEach cleanup (confidence: 80)**: No `afterEach` hook clears the seeded quiz record from IndexedDB or clears the Zustand persist key (`levelup-quiz-store`) from localStorage. Each test that calls `navigateToQuiz` seeds a new copy of the quiz, but if a prior test left state in the Zustand localStorage persist key, the quiz may resume mid-session rather than showing the start screen. This is a test isolation risk. The `indexedDB` fixture auto-cleans seeded `importedCourses` records, but it does not cover the `quizzes` store. Fix: add an `afterEach` that calls `page.evaluate(() => localStorage.removeItem('levelup-quiz-store'))` and clears the seeded quiz from the `quizzes` store. Both calls should be `await`ed.

#### Medium

- **`src/app/components/quiz/__tests__/MarkForReview.test.tsx` — keyboard toggle not tested (confidence: 75)**: The story's testing notes and design guidance specify "Space to toggle" keyboard behavior. The `MarkForReview` component wraps a shadcn/ui `Checkbox` which does support Space, but no unit test fires a `{Space}` keypress via `userEvent.keyboard('{Space}')` while the checkbox is focused to verify the `onToggle` callback fires. This is an AC1 sub-requirement ("I can toggle it on/off by clicking or tapping" also implies keyboard per the accessibility note: "Space to toggle"). Fix: add a test in `MarkForReview.test.tsx` that focuses the checkbox and presses Space, asserting `onToggle` is called.

- **`src/app/components/quiz/__tests__/ReviewSummary.test.tsx` — no accessibility structure test (confidence: 72)**: The design guidance specifies `role=list` with a descriptive `aria-label` on the `ReviewSummary` container. The implementation renders `<ul role="list">` inside a `<div aria-label="Questions marked for review">`. The tests verify count text and button callbacks, but no test asserts the `aria-label` on the container or the `role="list"` on the `<ul>`. Fix: add an assertion `expect(screen.getByRole('list')).toBeInTheDocument()` and verify the landmark `aria-label="Questions marked for review"` is present.

- **`src/app/components/quiz/__tests__/QuestionGrid.test.tsx:37-44` — CSS class assertion against design tokens (confidence: 70)**: The test at lines 39 and 41-43 asserts against class strings containing `bg-brand-soft`, `bg-card`, and `bg-brand`. These are Tailwind design-token class names, not `data-testid` attributes or ARIA roles. If the token names are ever renamed, these tests break even though visual behavior is unchanged. The test framework guidance rates selector quality as "High" concern. Fix: convert these assertions to visible-state checks (e.g., test that the answered bubble has `aria-current` absent and the unanswered one does not have an indicator) or use `data-testid` attributes on state variants. At minimum, scope the class assertions to the design token layer with a comment.

#### Nits

- **Nit `src/app/components/quiz/__tests__/MarkForReview.test.tsx:6-10` (confidence: 60)**: `defaultProps.onToggle` is declared as a module-level `vi.fn()` that is not reset between tests. While none of the tests in this file share state in a way that breaks them currently (each test passes its own `onToggle` where it matters), the pattern risks subtle cross-test leakage if tests are added later. Prefer declaring `onToggle: vi.fn()` inside each test or inside a `beforeEach`. The `QuestionGrid.test.tsx` file correctly uses `beforeEach(() => vi.clearAllMocks())` — the same pattern should be applied here.

- **Nit `tests/e2e/story-e13-s02.spec.ts:217-218` (confidence: 55)**: The AC5 test opens the submit dialog by clicking "Submit Quiz" on the last question with unanswered questions, relying on the dialog's appearance being triggered by `countUnanswered > 0`. The test does not verify the case where all questions are answered and the dialog should still show the review summary — which the implementation handles by skipping the dialog and submitting directly. This is intentional behavior (ReviewSummary only appears in the confirmation dialog, which only appears when questions are unanswered), but a comment in the test clarifying why AC5 can only be exercised with unanswered questions would reduce confusion for future maintainers.

- **Nit `src/stores/__tests__/useQuizStore.test.ts` — inline quiz data, no factory (confidence: 50)**: The `startQuiz`, `submitAnswer`, `submitQuiz`, `retakeQuiz`, and `startQuiz — timeLimit` describe blocks each build quiz objects inline (14-18 lines each). The `makeQuiz` / `makeQuestion` factory functions in `tests/support/fixtures/factories/quiz-factory.ts` exist precisely to avoid this duplication. The factories produce realistic defaults with `FIXED_DATE` timestamps and random UUIDs. Migrating the store tests to use these factories would reduce boilerplate and keep data generation in one place.

---

### Edge Cases to Consider

1. **Submit dialog with all questions marked but all answered**: Currently no test exercises the path where every question is both answered AND marked for review. In this case `countUnanswered` returns 0, `handleSubmitClick` bypasses the dialog and calls `handleSubmitConfirm` directly, so the `ReviewSummary` is never shown. This is correct behavior per the implementation, but the AC5 wording ("Given I am on the quiz final review screen before submit, When I view the Questions Marked for Review section") arguably implies the summary should be visible regardless. No test documents or asserts this edge case outcome. Consider adding either a unit test on `Quiz.tsx`'s `handleSubmitClick` logic or an E2E test that marks a question but answers all of them, verifying the quiz submits directly without showing the dialog.

2. **`ReviewSummary` with `markedForReview` IDs not in `questionOrder`**: Covered by `ReviewSummary.test.tsx:81-92` (filters unknown IDs). No E2E equivalent — acceptable at unit level.

3. **Navigation via grid bubble to a marked question (AC3 jump behavior)**: The unit test in `QuestionGrid.test.tsx:52-61` verifies `onQuestionClick` fires with the correct index. The E2E test in `story-e13-s02.spec.ts:180-201` verifies indicators appear but does not click a marked bubble and confirm navigation lands on the correct question. A targeted assertion like `await expect(page.getByText(/color is the sky/i)).toBeVisible()` after clicking the Q3 grid bubble in the AC4 test would close this gap.

4. **MarkForReview toggle when `currentQuestionId` is undefined**: The `Quiz.tsx` page guards the `<MarkForReview>` render behind `{currentQuestionId && ...}` (line 279). The guard path (no question found) is not exercised in any unit or E2E test for this story specifically. The store-level guard is tested in `useQuizStore.test.ts:730-735`.

5. **ReviewSummary jump link closes dialog before navigation**: The `Quiz.tsx` `onJumpToQuestion` handler (lines 310-313) calls `navigateToQuestion(idx)` then `setShowSubmitDialog(false)`. The E2E test at line 231-234 does verify the dialog is no longer visible and the correct question text appears after clicking the jump link. This path is adequately covered.

---

ACs: 5 covered / 5 total | Findings: 8 | Blockers: 0 | High: 2 | Medium: 2 | Nits: 4
