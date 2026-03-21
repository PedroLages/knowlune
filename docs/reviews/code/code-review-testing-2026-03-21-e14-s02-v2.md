## Test Coverage Review: E14-S02 — Display Multiple Select Questions with Partial Credit (v2)

> Second review after fixes. Changes assessed: PCM clamping unit test added, QuestionDisplay selector
> quality improved, number key shortcuts added to all three question types, Enter-to-advance
> (nextBtnRef) wired through QuizNavigation → QuizActions.

---

### AC Coverage Summary

**Acceptance Criteria Coverage:** 6/7 ACs tested (**86%**)

**COVERAGE GATE:** PASS (>=80%)

---

### AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1 | Question text with "Select all that apply" indicator and checkboxes | None (dispatch untested in `QuestionDisplay.test.tsx`) | `tests/e2e/story-e14-s02.spec.ts:86-116` | Covered |
| 2 | Multiple selections toggle independently, saved to state | None | `tests/e2e/story-e14-s02.spec.ts:118-141` | Covered |
| 3 | Zero selections on submit → 0 points | `src/lib/__tests__/scoring.test.ts:174` (`['B', 'D']` → 0) | `tests/e2e/story-e14-s02.spec.ts:172-190` | Covered |
| 4 | PCM formula: (correct − incorrect) / total correct, clamped to 0 | `src/lib/__tests__/scoring.test.ts:159-176` | `tests/e2e/story-e14-s02.spec.ts:192-220` | Covered |
| 5 | Scoring examples: 2C/1I of 3 = 33%, 3C/0I = 100%, 1C/2I = 0% | `src/lib/__tests__/scoring.test.ts:154-176` (all three sub-cases) | `tests/e2e/story-e14-s02.spec.ts:143-220` (100% and 33%; 0% via unit) | Covered |
| 6 | Feedback shows "X of Y correct" with per-option indicators | None | `tests/e2e/story-e14-s02.spec.ts:222-244` (generic regex; no per-option icons) | Partial |
| 7 | Accessibility — fieldset/legend, Tab/Space keyboard nav | None | `tests/e2e/story-e14-s02.spec.ts:246-290` | Covered |

**Coverage**: 6/7 ACs fully covered | 0 gaps | 1 partial

---

### Changes Since v1 — What Was Fixed

| v1 Finding | Status |
|-----------|--------|
| High: PCM clamping unit test missing (1C/2I scenario) | **Fixed** — `scoring.test.ts:169-172` added the `['A', 'B', 'D']` → 0 case |
| High: `QuestionDisplay.test.tsx` used `getByText` for radio options (brittle) | **Fixed** — replaced with `getByRole('radio', { name: '3' })` at lines 19-21 |
| Edge case: `QuestionDisplay` had no `multiple-select` dispatch test | **Not addressed** — still missing (see High Priority below) |
| Edge case: Disabled-state test for `multiple-select` | **Not addressed** — still missing |

---

### Test Quality Findings

#### Blockers (untested ACs)

None. All 7 ACs have at least one test. Coverage gate passes at 86%.

---

#### High Priority

- **`tests/e2e/story-e14-s02.spec.ts:222-244` (confidence: 92)**: AC6 requires per-option
  feedback indicators — "correct selected" (check icon), "correct missed" (alert icon), and
  "incorrect selected" (X icon). The E2E test at line 243 asserts only the generic
  `/\d+ of \d+ correct/` pattern. Inspection of
  `/Volumes/SSD/Dev/Apps/Elearningplatformwireframes/src/app/components/quiz/questions/MultipleSelectQuestion.tsx`
  confirms the component has no icon imports, no `text-success`/`text-warning`/`text-destructive`
  conditional rendering, and no `mode="review-*"` branching. The per-option half of AC6 has
  zero implementation and zero test coverage. This was noted in v1 and remains unresolved.

  Suggested fix: Add `src/app/components/quiz/__tests__/MultipleSelectQuestion.test.tsx` with
  a test rendering `mode="review-incorrect"` and asserting per-option indicator icons. Update
  the E2E test at line 222 to assert specific icon roles for each option state.

- **`src/app/components/quiz/questions/MultipleSelectQuestion.tsx:40-56` (confidence: 88)**:
  Number key shortcuts (1-9 toggle corresponding option) were added to `MultipleSelectQuestion`
  in commit `2b122729`, and the same shortcut pattern was simultaneously added to
  `MultipleChoiceQuestion` and `TrueFalseQuestion` in commits `2b122729` and `9ac04077`.
  No test exists for any of the three implementations. Searching across all files under
  `/Volumes/SSD/Dev/Apps/Elearningplatformwireframes/tests/` returns zero matches for
  `handleKeyDown`, `keyboard.*shortcut`, `number key`, or `press.*Digit`.

  The shortcut feature is user-visible behaviour that belongs in the story's ACs (or at minimum
  the implementation notes) and requires test coverage for:

  - Pressing `1` toggles option 1 in `MultipleSelectQuestion`
  - Pressing `2` selects option 2 in `MultipleChoiceQuestion` (radio — not toggle)
  - Pressing `1` selects "True" in `TrueFalseQuestion`
  - Shortcut is inactive when `mode !== 'active'` (disabled state)
  - Pressing a digit outside the option range (e.g., `9` when 4 options exist) does nothing

  Suggested test location: `tests/e2e/story-e14-s02.spec.ts` — add a new describe block
  `'AC7-ext: Number key shortcuts'` with E2E scenarios. The unit path is also viable: add
  `userEvent.keyboard('{1}')` assertions in a new
  `src/app/components/quiz/__tests__/MultipleSelectQuestion.test.tsx`.

- **`src/app/components/quiz/__tests__/QuestionDisplay.test.tsx` (confidence: 85)**:
  `QuestionDisplay.test.tsx` tests dispatch for `multiple-choice` (line 8) and `true-false`
  (line 24) but has no test for `multiple-select`. This gap was flagged in v1's Edge Cases
  section and is still absent. Without this test, a regression removing the `multiple-select`
  case from `QuestionDisplay.tsx:59-67` would not be caught by unit tests.

  Suggested addition to `src/app/components/quiz/__tests__/QuestionDisplay.test.tsx`:
  ```
  it('dispatches multiple-select questions to MultipleSelectQuestion', () => {
    render(
      <QuestionDisplay
        question={makeQuestion({ type: 'multiple-select',
          options: ['A', 'B', 'C'], correctAnswer: ['A', 'C'] })}
        value={undefined}
        onChange={vi.fn()}
        mode="active"
      />
    )
    expect(screen.getAllByRole('checkbox')).toHaveLength(3)
    expect(screen.getByText('Select all that apply')).toBeInTheDocument()
  })
  ```

---

#### Medium

- **`src/app/components/quiz/QuizNavigation.tsx` + `QuizActions.tsx` (confidence: 78)**:
  Commit `2b122729` wired `nextBtnRef` through `QuizNavigation` → `QuizActions` to support
  Enter-to-advance behaviour. No unit or E2E test covers this interaction. The `forwardRef`
  pattern in `/Volumes/SSD/Dev/Apps/Elearningplatformwireframes/src/app/components/quiz/QuizNavigation.tsx:16`
  is a meaningful behaviour change — if the ref is not correctly forwarded, Enter key navigation
  silently fails. A single E2E test pressing `Enter` after answering a question and asserting
  navigation to the next question would close this gap.

- **`tests/e2e/story-e14-s02.spec.ts:163-165, 182-184, 211-213, 237-239` (confidence: 75)**:
  The conditional confirmation-dialog pattern
  `if (await confirmButton.isVisible({ timeout: 2000 }).catch(() => false))` is repeated
  across all four submit tests. The `catch(() => false)` suppresses Playwright errors silently.
  If the dialog is reliably present, assert it directly with `await expect(confirmButton).toBeVisible()`
  then click it. If it is optional by design, document why with a comment. As written, the pattern
  would allow a missing dialog to go undetected.

- **`src/lib/__tests__/scoring.test.ts` (confidence: 70)**: The `multiple-select` test block
  at lines 138-177 uses the file-local `makeQuiz()` helper (line 5) rather than the shared
  factory at `tests/support/fixtures/factories/quiz-factory.ts`. This is a consistency gap
  against the project's factory pattern documented in `.claude/rules/testing/test-cleanup.md`.
  The inline factory also hard-codes ISO date strings instead of using `FIXED_DATE` from test
  time utilities — a pattern the `test-patterns/deterministic-time` ESLint rule would flag in
  test files that assert on dates.

---

#### Nits

- **Nit `tests/e2e/story-e14-s02.spec.ts:169, 189, 219` (confidence: 65)**: Score assertions
  use `page.locator('p').filter({ hasText: '5 of 5 correct' })`. If the `ScoreSummary`
  element is ever changed from `<p>` to `<span>` or `<div>`, the locator silently stops
  matching. Prefer `page.getByText('5 of 5 correct', { exact: false })` or a stable
  `data-testid` on the score element.

- **Nit `tests/e2e/story-e14-s02.spec.ts:284-289` (confidence: 55)**: Touch-target bounding
  box assertions use `xpath=ancestor::label` to traverse the DOM. The XPath locator strategy
  is flagged as brittle by the project's selector quality standard
  (`.claude/rules/testing/test-patterns.md`). Using `fieldset.locator('label').nth(i)` would
  be more idiomatic and survive DOM restructuring.

- **Nit `tests/e2e/story-e14-s02.spec.ts:93` (confidence: 55)**: AC1 checks Markdown
  rendering with `page.getByText('primary colors', { exact: false })` rather than asserting
  the rendered `<strong>` element. The question text uses `**primary colors**` (Markdown bold).
  `page.locator('fieldset legend strong').filter({ hasText: 'primary colors' })` would confirm
  that Markdown rendering is active, not merely that the text node is present.

---

### Edge Cases Still to Consider

- **Number key out-of-range**: Pressing `9` when a question has 4 options should do nothing.
  `MultipleSelectQuestion.tsx:44` guards with `num <= options.length`, but this path has no test.

- **Number key in inactive mode**: `MultipleSelectQuestion.tsx:42` returns early when
  `!isActive`, preventing shortcuts when in review mode. No test verifies this guard.

- **PCM with empty `correctAnswer` array**: `scoring.ts:58` guards with
  `correctSet.size > 0` to avoid division by zero, but no unit test directly invokes
  `calculatePointsForQuestion` with `correctAnswer: []` (bypassing schema validation).

- **Duplicate selected values in PCM**: If `userAnswer` contains `['A', 'A', 'C']`, the
  `new Set(userAnswer)` at `scoring.ts:54` deduplicates silently. No test documents this
  boundary.

- **Checkbox disabled state**: `MultipleSelectQuestion.tsx:100` passes `disabled={!isActive}`
  to each `Checkbox`, but no test renders `mode="review-disabled"` and asserts checkboxes
  are non-interactive. The equivalent path for `MultipleChoiceQuestion` is tested in the
  existing `QuestionDisplay.test.tsx` via the `data-disabled` assertion (line 94).

---

ACs: 6 covered / 7 total | Findings: 10 | Blockers: 0 | High: 3 | Medium: 3 | Nits: 3
