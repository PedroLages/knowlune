## Test Coverage Review: E12-S05 — Display Multiple Choice Questions

### AC Coverage Summary

**Acceptance Criteria Coverage:** 4/5 ACs tested (**80%**)

**COVERAGE GATE:** PASS (>=80%) — but only marginally. Three ACs have meaningful gaps that reduce production confidence.

---

### AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1 | Markdown rendering, card styling, 2-6 radio options, label wrapper, no default selection, single selection | `MultipleChoiceQuestion.test.tsx:22-66`, `MultipleChoiceQuestion.test.tsx:100-126`, `MultipleChoiceQuestion.test.tsx:162-177` | `story-e12-s05.spec.ts:75-102` | Partial |
| 2 | Selected visual state (border-2 border-brand bg-brand-soft), unselected state, submitAnswer called, persistence across navigation | `MultipleChoiceQuestion.test.tsx:68-98` | `story-e12-s05.spec.ts:104-120` | Partial |
| 3 | mode prop surface (active / review-correct / review-incorrect / review-disabled) | `MultipleChoiceQuestion.test.tsx:208-235`, `QuestionDisplay.test.tsx:50-57` | None | Partial |
| 4 | Mobile responsive, vertical stack, min-h-12 touch targets | `MultipleChoiceQuestion.test.tsx:192-206` | `story-e12-s05.spec.ts:122-146` | Covered |
| 5 | Graceful degradation <2 or >6 options, console warning | `MultipleChoiceQuestion.test.tsx:128-160`, `MultipleChoiceQuestion.test.tsx:237-252` | None | Partial |

**Coverage**: 4/5 ACs fully covered (AC4) | 0 complete gaps | 4 partial

---

### Test Quality Findings

#### Blockers (untested ACs)

None. All five ACs have at least one test. Coverage gate passes at 80%.

---

#### High Priority

**(confidence: 95) AC2 — Visual CSS state change is asserted nowhere.**
The AC specifically requires the selected option to render with `border-2 border-brand bg-brand-soft` and unselected options with `border border-border bg-card`. The unit test at `MultipleChoiceQuestion.test.tsx:68-81` only checks that the radio input `isChecked`, and the E2E test at `story-e12-s05.spec.ts:104-120` only checks `toBeChecked()` on the radio element. Neither verifies that the wrapping `<label>` gains the correct CSS classes on selection, which is the actual user-visible behavior described in the AC.

Suggested test — add to `MultipleChoiceQuestion.test.tsx` after line 98:
```
it('applies border-brand bg-brand-soft class to selected label', async () => {
  const user = userEvent.setup()
  const { container } = render(<MultipleChoiceQuestion ... value={undefined} ... />)
  await user.click(screen.getByText('Berlin'))
  const labels = container.querySelectorAll('label')
  const berlinLabel = [...labels].find(l => l.textContent?.includes('Berlin'))
  expect(berlinLabel?.className).toContain('border-brand')
  expect(berlinLabel?.className).toContain('bg-brand-soft')
})
```
An E2E complement in `story-e12-s05.spec.ts` could use `page.locator('label').filter({ hasText: 'Option A' })` and assert `toHaveClass(/border-brand/)` after clicking.

**(confidence: 92) AC2 — `submitAnswer` (store integration) has zero test coverage.**
The AC requires that `useQuizStore.submitAnswer(questionId, selectedOption)` is called on selection. The unit test at `MultipleChoiceQuestion.test.tsx:83-98` only checks that the `onChange` prop callback fires with the correct value — it never wires a real or mocked `useQuizStore`, so the store call is untested. The Quiz page (`Quiz.tsx:191`) passes `answer => submitAnswer(currentQuestion.id, answer)` as `onChange`, but this integration is never exercised by any test (no integration test for the Quiz page wiring exists).

Suggested test — add an integration-level unit test for `Quiz.tsx` that mocks `useQuizStore` and asserts `submitAnswer` is called with the correct `questionId` and selected value after a user clicks an option.

**(confidence: 90) AC2 — Answer persistence across navigation is untested.**
The AC states "the selection persists via Zustand store if I navigate away and return." The E2E spec has no test covering this flow. No test navigates away from the quiz, returns to it, and verifies the previously selected option is still checked.

Suggested test — add to `story-e12-s05.spec.ts`:
```
test('AC2: Answer persists after navigating away and returning', async ({ page }) => {
  await seedAndNavigateToQuiz(page)
  await startQuiz(page)
  await page.getByRole('radio').first().click()
  // Navigate away
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  // Return to quiz
  await page.goto(`/courses/${COURSE_ID}/lessons/${LESSON_ID}/quiz`)
  await page.waitForLoadState('networkidle')
  // Quiz should resume with the previously selected option still checked
  await expect(page.getByRole('radio').first()).toBeChecked()
})
```

**(confidence: 85) AC3 — Review modes are insufficiently tested at the behavior level.**
`MultipleChoiceQuestion.test.tsx:208-221` asserts that `data-disabled` is present on the radiogroup in `review-correct` mode, and line 223-235 just verifies the component renders without crashing in `review-disabled` mode. However, the AC specifies distinct CSS classes for each review mode (`border-success bg-success-soft` for correct, `border-warning` for incorrect, `opacity-60 pointer-events-none` for disabled). The implementation at `MultipleChoiceQuestion.tsx:57` applies a blanket `opacity-60` for any non-active mode but does NOT differentiate between `review-correct`, `review-incorrect`, and `review-disabled`. Since the AC says "this prop surface exists now to prevent API breakage when review mode ships," the tests should at minimum verify that each mode value is accepted without throwing, and document that the visual differentiation is deferred to Epic 16. The current test for `review-incorrect` mode is entirely absent.

Suggested test — add to `MultipleChoiceQuestion.test.tsx`:
```
it('accepts review-incorrect mode without crashing', () => {
  const { container } = render(
    <MultipleChoiceQuestion ... mode="review-incorrect" />
  )
  expect(container.querySelector('fieldset')).toBeInTheDocument()
})
```

---

#### Medium

**(confidence: 80) AC1 — Card styling (`bg-card rounded-[24px] p-6`) is untested.**
The AC specifies the card wrapper classes but these classes live on the Quiz page wrapper (`Quiz.tsx:185`) rather than on `QuestionDisplay` or `MultipleChoiceQuestion`. Neither unit test nor E2E test verifies the outer card styling. This is understandable because it's a page-level concern, but it means a regression where the card class is accidentally removed would not be caught.

Suggested fix: add an assertion in `story-e12-s05.spec.ts` using `page.locator('.rounded-\\[24px\\]')` or a `data-testid="quiz-card"` on the Quiz page wrapper.

**(confidence: 78) AC1 — Markdown rendering test uses only `bold` and `inline code`; GFM-specific features from `remark-gfm` are untested.**
The AC mentions `remark-gfm` explicitly, which adds tables, strikethrough, and task lists. `MultipleChoiceQuestion.test.tsx:100-126` tests `**bold**` and `` `code` ``, both of which work without `remark-gfm`. If the plugin were accidentally removed, these tests would still pass.

Suggested test — add a test with a GFM-specific construct such as `~~strikethrough~~` and assert the rendered `<del>` tag is present.

**(confidence: 75) E2E spec lacks `afterEach` cleanup for the `quizzes` IndexedDB store.**
The spec seeds quizzes via `seedQuizzes(page, ...)` in `seedAndNavigateToQuiz` at `story-e12-s05.spec.ts:57`, but no `afterEach` or fixture cleanup removes the seeded quiz records from the `quizzes` store after each test. The `indexedDBFixture` auto-cleanup only tracks records seeded via `indexedDB.seedImportedCourses()` (the fixture's internal `seededIds` array). Direct calls to `seedQuizzes()` bypass that tracking. If tests share the same Playwright browser context between runs, stale quiz data from a prior test could bleed into the next.

Suggested fix: add an `afterEach` block or use the `indexedDB.clearStore('quizzes')` fixture helper:
```typescript
test.afterEach(async ({ page, indexedDB }) => {
  await indexedDB.clearStore('quizzes')
})
```
Note: Playwright gives each `test()` a fresh browser context by default, which mitigates this risk in practice — but it's still fragile if the project ever enables context reuse.

**(confidence: 72) Unit tests use inline `makeTestQuestion` helper instead of the shared factory.**
Both `QuestionDisplay.test.tsx:6-18` and `MultipleChoiceQuestion.test.tsx:7-19` define a local `makeTestQuestion` function that duplicates the `makeQuestion` factory from `tests/support/fixtures/factories/quiz-factory.ts`. The shared factory produces deterministic timestamps via `FIXED_DATE` and uses `crypto.randomUUID()` for IDs. The inline helpers use hardcoded string IDs (`'q-1'`) and no timestamps. While not a correctness issue, it violates the project's factory pattern convention and could drift if the `Question` type evolves.

Suggested fix: import and use `makeQuestion` from the quiz factory in both test files.

---

#### Nits

- **Nit** `story-e12-s05.spec.ts:148-171` (confidence: 60): The "Accessibility" test is not labeled with an AC prefix in its test name, making it harder to trace to a requirement. Rename it to `'AC1/AC4: Accessibility — radiogroup structure and focusable options'`.

- **Nit** `story-e12-s05.spec.ts:26-44` (confidence: 55): `buildQuizWithQuestions` generates questions whose text contains template literals with `${i + 1} + ${i + 1}` arithmetic but the options are always `['Option A', 'Option B', 'Option C', 'Option D']` — the question body implies a numeric answer that doesn't match any option. This is a low-severity data quality issue but could cause confusion when debugging test failures.

- **Nit** `QuestionDisplay.test.tsx:50-56` (confidence: 55): The assertion `expect(radioGroup).not.toHaveAttribute('disabled')` tests a Radix UI implementation detail (native `disabled` HTML attribute) rather than the user-visible behavior. Radix RadioGroup sets `data-disabled` rather than `disabled`. This test could give false confidence. Use `expect(radioGroup).not.toHaveAttribute('data-disabled')` to be consistent with the approach taken at `MultipleChoiceQuestion.test.tsx:219`.

---

### Edge Cases to Consider

1. **Zustand store rehydration race**: The Quiz page reads `currentProgress` from the Zustand store after navigation back. If the `persist` middleware hasn't finished rehydrating when the component mounts, `currentQuestion` resolves to `undefined` and the "No question found" fallback renders. No test covers this loading-then-rehydration transition.

2. **`shuffleAnswers: true` on the quiz**: When `quiz.shuffleAnswers` is `true`, the option order presented to the user may differ from `question.options`. The `MultipleChoiceQuestion` component currently renders `question.options` in their original array order without any shuffle. No test verifies that the shuffle flag is either honored or explicitly ignored at the component level.

3. **Exact boundary values for option count warning**: The warning fires at `options.length < 2 || options.length > 6`. Tests cover 1 (below minimum) and 7 (above maximum). The exact boundary values of 2 and 6 options are not tested to confirm no spurious warning is emitted. Given the `<` and `>` (strict) operators this is low risk, but worth a boundary test.

4. **Empty `question.text` string**: `MultipleChoiceQuestion` renders `react-markdown` with `question.text`. No test verifies behavior when `text` is an empty string or `undefined` — the legend would be empty and the screen reader would announce nothing for the group label.

5. **Rapid repeated clicks on the same option**: No test exercises clicking the already-selected option a second time to verify it remains selected (radio inputs cannot be deselected by clicking again — but `onChange` might fire again with the same value, causing a redundant `submitAnswer` call).

---

ACs: 4/5 covered (80%) | Findings: 10 | Blockers: 0 | High: 4 | Medium: 3 | Nits: 3
