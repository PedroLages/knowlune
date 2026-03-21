## Test Coverage Review: E14-S02 — Display Multiple Select Questions with Partial Credit

### AC Coverage Summary

**Acceptance Criteria Coverage:** 6/7 ACs tested (**86%**)

**COVERAGE GATE:** PASS (>=80%)

### AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1 | Question text with "Select all that apply" indicator and checkboxes | `src/lib/__tests__/scoring.test.ts` (type validation) | `tests/e2e/story-e14-s02.spec.ts:86-116` | Covered |
| 2 | Multiple selections toggle independently, saved to state | None | `tests/e2e/story-e14-s02.spec.ts:118-141` | Covered |
| 3 | Zero selections on submit → 0 points | `src/lib/__tests__/scoring.test.ts:169-172` (wrong/empty → 0) | `tests/e2e/story-e14-s02.spec.ts:172-190` | Covered |
| 4 | PCM formula: (correct − incorrect) / total correct, clamped to 0 | `src/lib/__tests__/scoring.test.ts:159-172` | `tests/e2e/story-e14-s02.spec.ts:192-220` | Covered |
| 5 | Scoring examples: 2C/1I of 3 = 33%, 3C/0I = 100%, 1C/2I = 0% | `src/lib/__tests__/scoring.test.ts:154-172` | `tests/e2e/story-e14-s02.spec.ts:143-220` | Partial |
| 6 | Feedback shows "X of Y correct" with per-option indicators | None | `tests/e2e/story-e14-s02.spec.ts:222-244` (generic regex only) | Partial |
| 7 | Accessibility — fieldset/legend, Tab/Space keyboard nav | None | `tests/e2e/story-e14-s02.spec.ts:246-290` | Covered |

**Coverage**: 5/7 ACs fully covered | 0 gaps | 2 partial

---

### Test Quality Findings

#### Blockers (untested ACs)

None. All 7 ACs have at least one test. Coverage gate passes at 86%.

---

#### High Priority

- **`tests/e2e/story-e14-s02.spec.ts:222-244` (confidence: 92)**: AC6 requires per-option feedback indicators (correct-selected with check icon, correct-missed with alert icon, incorrect-selected with X icon). The E2E test at line 243 only asserts the generic `ScoreSummary` pattern `/\d+ of \d+ correct/` — it does not verify that `MultipleSelectQuestion` renders per-option visual indicators. Inspection of `src/app/components/quiz/questions/MultipleSelectQuestion.tsx` confirms the component contains no `review-correct`/`review-incorrect` mode rendering: there are no icon imports, no `text-success`/`text-warning`/`text-destructive` CSS classes, and no conditional rendering based on whether an option was a "correct missed" or "incorrect selected" choice. The AC states: _"Multiple Select questions show 'X of Y correct' with per-option indicators (correct selected, correct missed, incorrect selected)"_ — the per-option half of this AC has zero implementation and zero test coverage.

  Fix: Add a dedicated unit test for `MultipleSelectQuestion` in `src/app/components/quiz/__tests__/MultipleSelectQuestion.test.tsx` asserting that when `mode="review-incorrect"` is passed with a known `value` and `correctAnswer`, each option renders the appropriate icon. Also update the E2E test at line 222 to assert per-option icons using `getByRole('img', { name: 'Correct' })`, `getByRole('img', { name: 'Correct (missed)' })`, and `getByRole('img', { name: 'Incorrect' })` — the same pattern used by `QuestionBreakdown.test.tsx:26-30`.

- **`tests/e2e/story-e14-s02.spec.ts:192-220` (confidence: 80)**: AC5 requires three specific scoring examples: 2C/1I of 3 = 33%, 3C/0I = 100%, and 1C/2I = 0%. The 100% and 33% cases are E2E-tested (lines 143-170, 192-220). The 1C/2I = 0% (negative-clamped) case is covered by unit test `scoring.test.ts:169-172` (`['B', 'D']` → 0), but the exact AC5 scenario — _1 correct and 2 incorrect_ — is only implicitly covered. The unit test fixture has 2 correct answers (`['A', 'C']`), so selecting `['A', 'B', 'D']` (1C/2I) would yield (1-2)/2 = -0.5 → clamped 0. No unit test explicitly names and asserts this sub-case, and there is no E2E test for the all-incorrect-penalty scenario.

  Fix: Add to `scoring.test.ts` inside the `multiple-select` describe block:
  ```
  it('clamps to 0 when incorrect selections outnumber correct (1C/2I scenario from AC5)', () => {
    expect(calculateQuizScore(quiz, { q1: ['A', 'B', 'D'] }).score).toBe(0)
  })
  ```

---

#### Medium

- **`tests/e2e/story-e14-s02.spec.ts:163-165, 182-184, 211-213, 237-239` (confidence: 75)**: The confirmation dialog handling pattern `if (await confirmButton.isVisible({ timeout: 2000 }).catch(() => false))` is repeated four times across four tests. If the dialog is always present (which it is — the quiz chrome shows a submit confirmation), this pattern silently succeeds without ever asserting the dialog was shown and dismissed. If the dialog is ever absent due to a bug, the test still passes. The `catch(() => false)` swallows Playwright errors.

  Fix: Replace with a deterministic `waitFor` assertion. If the confirmation dialog is unconditional, assert it directly: `await expect(confirmButton).toBeVisible()` then `await confirmButton.click()`. This removes the defensive branch and makes the test fail properly if the dialog disappears.

- **`src/lib/__tests__/scoring.test.ts:138-172` (confidence: 72)**: The `multiple-select` unit test block uses an inline `makeQuiz()` call (lines 139-151) rather than the shared factory from `tests/support/fixtures/factories/quiz-factory.ts`. The scoring test file defines its own local `makeQuiz` helper at line 5 and constructs quiz data inline. While functional, this diverges from the project's factory pattern (see `tests/support/fixtures/factories/quiz-factory.ts`). The inline factory also sets `createdAt`/`updatedAt` to a hardcoded ISO string instead of `FIXED_DATE` from `tests/utils/test-time`, which the ESLint `test-patterns/deterministic-time` rule would flag if dates were used in assertions.

  Fix: Import and use `makeQuestion`/`makeQuiz` from `tests/support/fixtures/factories/quiz-factory.ts` in `scoring.test.ts`. This is a medium-priority consistency fix rather than a correctness issue.

- **`src/app/components/quiz/questions/MultipleSelectQuestion.tsx:26-32` (confidence: 70)**: The component's edge-case warning for `options.length < 2` (line 27-32) is tested for `MultipleChoiceQuestion` via `QuestionDisplay.edge-cases.test.tsx`, but there is no equivalent test for the `multiple-select` path. The `MultipleSelectQuestion` component wraps the warning in `useMemo` with a `console.warn`, but no unit test verifies this fires when a `multiple-select` question has fewer than 2 options.

  Fix: Add a test to a new `src/app/components/quiz/__tests__/MultipleSelectQuestion.test.tsx` that renders `MultipleSelectQuestion` with `options: []`, spies on `console.warn`, and asserts the warning fires with the expected message.

---

#### Nits

- **Nit `tests/e2e/story-e14-s02.spec.ts:169, 189, 219` (confidence: 65)**: The score assertions use `page.locator('p').filter({ hasText: '5 of 5 correct' })`. The `ScoreSummary` component renders `{score} of {maxScore} correct` inside a `<p>` (line 150 of `ScoreSummary.tsx`), so this selector is functionally correct today. However, if the element is changed to a `<span>` or `<div>`, the test will silently fail to find the element rather than loudly fail. Prefer `page.getByText('5 of 5 correct', { exact: false })` or add a `data-testid="score-summary-points"` attribute to the `<p>` in `ScoreSummary.tsx`.

- **Nit `tests/e2e/story-e14-s02.spec.ts:86` (confidence: 60)**: AC1 checks for Markdown rendering with `page.getByText('primary colors', { exact: false })` (line 93) rather than asserting the bold-rendered `<strong>` element. The question text is `'Which of the following are **primary colors**?'`. A more precise assertion would be `page.locator('fieldset legend strong').filter({ hasText: 'primary colors' })`, which confirms Markdown bold rendering is active, not just that the text node is present.

- **Nit `tests/e2e/story-e14-s02.spec.ts:284-289` (confidence: 55)**: The touch target size assertion (lines 284-289) uses `xpath=ancestor::label` to walk up the DOM to the label wrapper. The `xpath` locator strategy is flagged as brittle by the Selector Quality standard (see `.claude/rules/testing/test-patterns.md`). The label wrapper could instead carry a `data-testid="option-label-{index}"` attribute for stable traversal, or the bounding box check could target the `label` directly via `.locator('label').nth(i)` within the fieldset.

---

### Edge Cases to Consider

- **PCM with `correctAnswer` as empty array at runtime**: `scoring.ts:50` casts `question.correctAnswer as string[]` without a runtime guard. If `correctAnswer` is somehow an empty array at scoring time (schema validation should prevent it, but the guard at line 55 uses `correctSet.size > 0`), the function returns 0 silently. Schema tests in `src/types/__tests__/quiz.test.ts:508-510` cover the Zod rejection of empty `correctAnswer`, but there is no unit test for `calculatePointsForQuestion` receiving a question whose `correctAnswer` is `[]` directly (bypassing schema validation). Worth adding to document the `correctSet.size > 0` guard's behavior.

- **Duplicate selected values**: If `userAnswer` contains duplicates (e.g., `['A', 'A', 'C']`), the `new Set(userAnswer)` deduplication at line 51 silently normalises it. No test covers this boundary. Unlikely in practice but worth a single unit test assertion.

- **QuestionDisplay dispatch for multiple-select**: `QuestionDisplay.test.tsx` has no test case dispatching a `multiple-select` question to `MultipleSelectQuestion`. The dispatch for `multiple-choice` and `true-false` are each tested (lines 8-22 and 24-41 respectively), creating an asymmetry. Add to `QuestionDisplay.test.tsx`:
  ```
  it('dispatches multiple-select questions to MultipleSelectQuestion', () => {
    render(<QuestionDisplay question={makeQuestion({ type: 'multiple-select',
      options: ['A', 'B', 'C'], correctAnswer: ['A', 'C'] })}
      value={undefined} onChange={vi.fn()} mode="active" />)
    expect(screen.getAllByRole('checkbox')).toHaveLength(3)
    expect(screen.getByText('Select all that apply')).toBeInTheDocument()
  })
  ```

- **Disabled state (mode != 'active')**: No test verifies that checkboxes are `disabled` when `mode="review-disabled"`. `MultipleSelectQuestion.tsx:70` passes `disabled={!isActive}` to each `Checkbox`, but this path is untested. `MultipleChoiceQuestion.test.tsx:309-333` covers the equivalent for radio buttons.

---

ACs: 6 covered / 7 total | Findings: 9 | Blockers: 0 | High: 2 | Medium: 3 | Nits: 4
