## Test Coverage Review: E14-S01 — Display True/False Questions

### AC Coverage Summary

**Acceptance Criteria Coverage:** 5/5 ACs tested (**100%**)

**COVERAGE GATE:** PASS (>=80%)

---

### AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1 | Question text displayed; exactly two radio options (True/False); single-select only; click/tap to select | `TrueFalseQuestion.test.tsx:18` (two options rendered), `:34` (no pre-selection), `:195` (Markdown text) | `story-e14-s01.spec.ts:84` | Covered |
| 2 | Selection visually indicated (brand styling); saved to state immediately; answer changeable | `TrueFalseQuestion.test.tsx:50` (value prop drives checked state), `:65` (onChange callback), `:82` (selected CSS classes) | `story-e14-s01.spec.ts:108` (brand classes, deselect, restyle) | Covered |
| 3 | All-or-nothing scoring: 0% or 100%; correct answer compared exactly; points only on exact match | `src/lib/__tests__/scoring.test.ts:74` (true-false scoring describe block at line 90) | `story-e14-s01.spec.ts:138` (submit quiz, verify score display) | Covered |
| 4 | Desktop (>=1024px): 2-column grid; mobile (<640px): stacked vertically at full width | None (CSS class presence only — no layout assertion in unit tests) | `story-e14-s01.spec.ts:166` (bounding-box Y comparison at two viewports) | Covered |
| 5 | fieldset/legend structure; radiogroup role with aria-labelledby; keyboard arrow navigation; touch targets >=44px | `TrueFalseQuestion.test.tsx:118` (fieldset/legend), `:132` (aria-labelledby), `:149` (min-h-12), `:165` (focus-within ring) | `story-e14-s01.spec.ts:197` (aria-labelledby, legend id, focus, bounding-box height >=44) | Covered |

**Coverage**: 5/5 ACs fully covered | 0 gaps | 0 partial

---

### Test Quality Findings

#### Blockers

None.

#### High Priority

- **`src/app/components/quiz/__tests__/QuestionDisplay.test.tsx` (confidence: 85)**: The `QuestionDisplay` component gained a new `case 'true-false'` dispatch branch in this story (line 46-52 of `QuestionDisplay.tsx`). No unit test in `QuestionDisplay.test.tsx` covers this new branch — the existing tests exercise only `multiple-choice` (line 8) and the unknown-type fallback (line 24). A shallow test that renders `QuestionDisplay` with `type: 'true-false'` and asserts the radiogroup is present would close this gap without duplicating `TrueFalseQuestion.test.tsx`. Suggested test: `"dispatches true-false questions to TrueFalseQuestion"` in `QuestionDisplay.test.tsx`, asserting `getByRole('radiogroup')` is in the document and the True/False labels are visible.

- **`tests/e2e/story-e14-s01.spec.ts:138` (confidence: 75)**: The AC3 scoring test exercises the end-to-end flow but does not assert the zero-point case in isolation. It submits one correct and one incorrect answer and checks a `1 of 2 correct` string. This verifies the 50% path but does not confirm that a fully incorrect attempt yields `0 of 2 correct` or that a fully correct attempt yields `100%` / pass state. The all-or-nothing semantics of individual questions are verified by `scoring.test.ts`, but the UI rendering of both boundary outcomes (all correct, all incorrect) is untested at E2E level. Suggested addition: a second AC3 variant test named `"AC3: 0% score when all answers wrong"` that selects incorrect answers for both questions and asserts `0 of 2 correct` is displayed.

#### Medium

- **`src/app/components/quiz/__tests__/TrueFalseQuestion.test.tsx:82` (confidence: 72)**: The "applies selected CSS classes" test at line 82 queries labels via `container.querySelectorAll('label')` and then `Array.from(labels).find(l => l.textContent?.includes('True'))`. This is a DOM-structure traversal rather than a role- or testid-based selector. While `TrueFalseQuestion` owns this component fully (no router context needed), a `data-testid="option-True"` attribute on each label — matching the convention in `MultipleChoiceQuestion` if it exists — would make this assertion more robust and survive inner-text changes. This is a medium finding because the current selector is functional and unlikely to break from realistic refactors.

- **`tests/e2e/story-e14-s01.spec.ts:113` (confidence: 70)**: The AC2 E2E test selects the True radio via `page.locator('label').filter({ hasText: 'True' })`, then checks that `page.getByRole('radio').first()` is checked. The linkage between the label click and `first()` radio works only because "True" is the first option — if options are reordered (e.g., by a future `shuffleAnswers` flag), this assertion would pass on the wrong radio. A tighter assertion would be `page.getByRole('radio', { name: 'True' })` or `label.locator('input[type=radio]')` to avoid positional coupling.

#### Nits

- **Nit `src/app/components/quiz/__tests__/TrueFalseQuestion.test.tsx:149` (confidence: 55)**: The touch-target test asserts `label.className.includes('min-h-12')` at the class-string level. This verifies the Tailwind class is present but not the resolved pixel height. The E2E test at `story-e14-s01.spec.ts:222` performs the real bounding-box check (`box.height >= 44`), so this unit assertion is complementary but somewhat redundant. Renaming the unit test to clarify it checks "CSS class applied" vs the E2E's "pixel height verified" would improve readability.

- **Nit `src/lib/__tests__/scoring.test.ts:90` (confidence: 50)**: The `true-false` scoring describe block contains only one `it` block that tests correct and incorrect answers in a single assertion chain. This is functional but the test name `"scores correctly for true-false question"` is vague. Splitting into `"awards full points for correct True/False answer"` and `"awards zero points for incorrect True/False answer"` (mirroring the `multiple-choice` describe style at lines 43-67) would make failures immediately diagnostic without expanding coverage.

---

### Edge Cases to Consider

1. **Scoring with an unanswered True/False question**: `scoring.ts` line 56-57 treats `undefined` answers as incorrect. The `multiple-choice` unit tests cover this path explicitly (line 62-67 of `scoring.test.ts`). There is no parallel test for `type: 'true-false'` with no answer provided. The code path is identical and almost certainly correct, but an explicit test would confirm the type-dispatch doesn't accidentally skip the unanswered guard for `true-false`.

2. **`mode="review-incorrect"` and `mode="review-disabled"`**: `TrueFalseQuestion.test.tsx` tests `mode="review-correct"` (line 181) and verifies `data-disabled` is set. The modes `"review-incorrect"` and `"review-disabled"` are part of the `QuestionDisplayMode` union but are not tested. The implementation applies `disabled={!isActive}` which covers all non-active modes uniformly, so the risk is low, but if Epic 16 introduces mode-specific styling this gap may surface.

3. **Keyboard arrow navigation between True and False**: AC5 explicitly calls out "keyboard arrow navigation within the group." The unit test at line 165 checks the `focus-within:ring-2` CSS class exists, and the E2E test at line 215 only focuses the first radio. Neither test fires `ArrowDown`/`ArrowRight` and asserts the second radio becomes focused. Arrow navigation is provided by Radix `RadioGroup` and is unlikely to be broken, but the AC names it explicitly with no test verifying the actual key behavior.

4. **Array `value` prop passed to `true-false` dispatch in `QuestionDisplay`**: `QuestionDisplay` narrows `value` from `string | string[] | undefined` to `string | undefined` before passing to `TrueFalseQuestion` (line 47). A unit test in `QuestionDisplay.test.tsx` verifies this narrowing for `multiple-choice` (line 58), but there is no equivalent test for the `true-false` branch.

---

ACs: 5 covered / 5 total | Findings: 7 | Blockers: 0 | High: 2 | Medium: 2 | Nits: 3
