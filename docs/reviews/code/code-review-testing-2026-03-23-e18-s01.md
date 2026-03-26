## Test Coverage Review: E18-S01 — Implement Complete Keyboard Navigation

### AC Coverage Summary

**Acceptance Criteria Coverage:** 5/6 ACs tested (**83%**)

**COVERAGE GATE:** PASS (>=80%) — but see AC4 blocker below.

> Note: The 83% figure reflects that every AC has _some_ test except AC4. However, AC4 has zero coverage at confidence 95, which is a blocker finding even while the overall gate passes numerically. AC6 is partial (confidence 78).

---

### AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1 | Tab moves sequentially through answer options → MarkForReview → navigation buttons → question grid | None | `story-e18-s01.spec.ts:125` | Partial |
| 2 | Question text container receives programmatic focus on question change; NOT reachable via Tab | None | `story-e18-s01.spec.ts:95`, `:110` | Covered |
| 3 | RadioGroup: Tab to enter, Arrow Up/Down to change selection, Space to select | None | `story-e18-s01.spec.ts:228`, `:253` | Covered |
| 4 | Checkboxes (multiple-select): Tab to each independently, Space to toggle | None | None | Gap |
| 5 | QuestionGrid: Arrow Left/Right moves focus, Enter jumps to that question | None | `story-e18-s01.spec.ts:155`, `:184`, `:204` | Covered |
| 6 | Modal: Escape closes + focus returns to trigger; Tab trapped inside | None | `story-e18-s01.spec.ts:271`, `:296` | Partial |

**Coverage**: 4/6 ACs fully covered | 1 gap (AC4) | 2 partial (AC1, AC6)

---

### Test Quality Findings

#### Blockers (untested ACs)

- **(confidence: 95)** AC4: "Checkboxes (multiple-select): Tab to each independently, Space to toggle" has zero test coverage. The quiz fixture already includes `q3` (a `multiple-select` question with options Red/Green/Blue/Yellow), so the test infrastructure is in place. Suggested test: `'AC4: Multiple-select — Tab navigates to each checkbox independently'` and `'AC4: Multiple-select — Space toggles a checkbox'` in `/Volumes/SSD/Dev/Apps/Knowlune/tests/e2e/regression/story-e18-s01.spec.ts`. The tests should navigate to Q3, use `Tab` from the question-focus-target to land on the first checkbox (`page.getByRole('checkbox').first()`), assert it is focused, press `Tab` to the second checkbox and assert focus moves, then press `Space` and assert `toBeChecked()`.

#### High Priority

- **`story-e18-s01.spec.ts:271` (confidence: 82)**: AC6 requires "focus returns to the trigger element" after Escape closes the dialog. The test at line 271 asserts `submitBtn` is visible after dialog close (line 293) but never calls `await expect(submitBtn).toBeFocused()`. The AC text is explicit: "focus returns to the trigger element." The missing assertion is one line and guards genuine AT/keyboard-only UX. Fix: add `await expect(submitBtn).toBeFocused()` immediately after `await expect(dialog).not.toBeVisible()` at line 290.

- **`story-e18-s01.spec.ts` — missing `test.afterEach` cleanup (confidence: 80)**: The `navigateToQuiz` helper calls `seedQuizzes(page, [quiz])` on every test but there is no `test.afterEach` that clears the `quizzes` IndexedDB store. The `indexedDB` fixture auto-cleans only `importedCourses`. The established pattern for quiz specs is to call `clearIndexedDBStore(page, 'ElearningDB', 'quizzes')` (and `quizAttempts`) in `afterEach` — see `/Volumes/SSD/Dev/Apps/Knowlune/tests/e2e/regression/story-e17-s04.spec.ts:378`. Without cleanup the seeded quiz record accumulates across tests in the same browser context, which can cause false passes or test-order sensitivity. Fix: add a `test.afterEach` block inside the `test.describe` that calls `clearIndexedDBStore` for both `quizzes` and `quizAttempts`.

#### Medium

- **`story-e18-s01.spec.ts:125` (confidence: 72)**: AC1 tab-order test has two gaps. (1) It tests only the MC question tab order. The AC also specifies the tab order for multiple-select questions (where individual checkboxes, not a single radio group, are the answer tab stops). The expected sequence differs and is untested. (2) The test verifies the tab stop sequence starting from a programmatically-focused radio button; it does not verify the very beginning of the tab order (from the quiz header back-link through to answer options). These are lower-risk gaps but worth a follow-up test or extension of the existing test to include a full forward-Tab walk from a known document start point.

- **`story-e18-s01.spec.ts:204` (confidence: 65)**: The roving-tabindex test at line 204 inspects `tabindex` attribute values directly on DOM elements. This is an implementation-detail assertion (verifying HTML attributes rather than user-observable focus behavior). It is useful as a guard for the WAI-ARIA toolbar contract, but it does not replace verifying that `Tab` actually lands on exactly one button in the grid rather than traversing all three. Consider complementing with a behavioral test: from the grid's single tabbable button, press `Tab` twice and assert focus moves _out of_ the toolbar entirely (confirming only one grid button consumes a Tab stop).

- **`story-e18-s01.spec.ts` — module-level test data (confidence: 60)**: `q1`, `q2`, `q3`, and `quiz` are defined at module scope (lines 26-65), not inside `beforeEach` or factory calls within each test. This is acceptable given the quiz data is read-only in all tests (no mutations), but it diverges from the factory-per-test pattern established elsewhere in the project. The risk is low here since `shuffleQuestions: false` and `shuffleAnswers: false` keep the data stable, but it is worth noting for consistency.

#### Nits

- **Nit `story-e18-s01.spec.ts:71` (confidence: 50)**: `navigateToQuiz` uses `page.addInitScript` to set `knowlune-sidebar-v1` before navigation. This is correct per the sidebar gotcha pattern. However, it could be expressed more idiomatically using the `localStorage` fixture's `seed` method (already available on the `{ page, localStorage }` destructure from the merged fixture), keeping localStorage seeding consistent across the codebase.

- **Nit `story-e18-s01.spec.ts:296` (confidence: 45)**: The focus-trap test iterates `for (let i = 0; i < 6; i++)` with a hardcoded magic number `6`. A constant like `const TRAP_CYCLES = 6` with a comment explaining the intent (e.g., "two full cycles of three focusable dialog elements") would make this clearer and easier to maintain if dialog content changes.

- **Nit `story-e18-s01.spec.ts:76` (confidence: 40)**: `quiz as unknown as Record<string, unknown>` double-cast is necessary because `seedQuizzes` accepts `Record<string, unknown>[]` but the factory returns a typed `Quiz`. This cast is consistent with the pattern in other specs (e.g., story-e17-s04). No action required unless the `seedQuizzes` signature is updated to accept `Quiz[]` directly.

---

### Edge Cases to Consider

- **QuestionGrid Home/End keys**: `QuestionGrid.tsx` implements `Home` (jump to first button) and `End` (jump to last button) keyboard handlers (lines 42-47), but neither has a corresponding E2E test. These are WAI-ARIA toolbar conventions; their absence from the test suite means regressions on those keys would go undetected.

- **AC3 Arrow-wrap at boundaries**: The RadioGroup arrow navigation tests verify ArrowDown from first to second and second to third, and ArrowUp from third to second, but do not verify wrap-around behavior (ArrowDown on the last option, ArrowUp on the first). Radix UI provides this natively, but a regression test would confirm it remains intact.

- **isArrowNavRef race on rapid input**: The `isArrowNavRef` fix in `Quiz.tsx` (lines 125, 461-477) suppresses auto-advance when Arrow keys are in flight. There is no test covering rapid Arrow-then-Space sequences to confirm the ref is reliably cleared between interactions. This is a lower-risk edge case but could manifest as a flaky UX issue.

- **Tab order on last question (Submit button)**: AC1 specifies the tab order includes "Navigation buttons (Previous, Next, Submit)." On the last question, the Submit button replaces the Next button. The existing AC1 test uses Q1 where no Submit button is present. A test on the final question would confirm the Submit button appears in the expected position in the tab order.

- **Dialog focus trap with Shift+Tab**: The focus-trap test (line 296) only presses forward `Tab`. The AC states "Tab and Shift+Tab cycle within modal boundaries." Shift+Tab cycling backwards within the dialog is untested.

---

ACs: 4 covered / 6 total | Findings: 9 | Blockers: 1 | High: 2 | Medium: 2 | Nits: 3
