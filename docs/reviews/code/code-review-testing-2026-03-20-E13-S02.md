# Test Coverage Review — E13-S02: Mark Questions For Review
**Date:** 2026-03-20
**Branch:** feature/e13-s02-mark-questions-for-review
**Reviewer:** code-review-testing agent

---

## AC Coverage Summary

**5/5 ACs covered (100%) — PASS**

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1 | Toggle visible per question, can toggle on/off | `MarkForReview.test.tsx:13-43` | `story-e13-s02.spec.ts:131-154` | ✅ Covered |
| 2 | Toggling marks state; grid shows bookmark indicator | `QuestionGrid.test.tsx:59-85`, `QuizNavigation.test.tsx:48-58`, `useQuizStore.test.ts:432-471` | `story-e13-s02.spec.ts:131-154` | ✅ Covered |
| 3 | Mark persists when navigating away and back | `useQuizStore.test.ts:432-471`, `QuizNavigation.test.tsx:48-58` | `story-e13-s02.spec.ts:156-178` | ✅ Covered |
| 4 | Multiple questions marked; unmarking removes indicator | `QuestionGrid.test.tsx:72-84`, `useQuizStore.test.ts:452-470` | `story-e13-s02.spec.ts:180-201` | ✅ Covered |
| 5 | Submit dialog shows count + jump links; nothing shown when no marks | `ReviewSummary.test.tsx:9-93` | `story-e13-s02.spec.ts:203-255` | ✅ Covered |

---

## Findings

### [High] AC5 integration gap: ReviewSummary invisible when all questions answered
**Confidence:** 75%
File: `tests/e2e/story-e13-s02.spec.ts:203-235`

The submit dialog only opens when `countUnanswered > 0` (see `Quiz.tsx:177`). When all questions are answered AND some are marked for review, the dialog is skipped and `ReviewSummary` never renders. No test covers this scenario and there is no code comment documenting the intentional omission.

**Suggested fix:** Add an integration or E2E test for "all answered + some marked → verify ReviewSummary visibility" or document the product decision to skip the dialog.

### [High] Keyboard toggle (Space) not tested for MarkForReview
**Confidence:** 72%
File: `src/app/components/quiz/__tests__/MarkForReview.test.tsx`

Design Guidance and Implementation Notes both require Space key to toggle. Only click interactions are tested. The `userEvent` library supports `userEvent.keyboard('{Space}')`.

**Suggested test:**
```typescript
it('toggles when Space key is pressed on focused checkbox', async () => {
  await userEvent.tab()
  await userEvent.keyboard('{Space}')
  expect(onToggle).toHaveBeenCalledOnce()
})
```

---

### [Medium] seedQuizData is manual IndexedDB seeding — should use shared helper
**Confidence:** 65%
File: `tests/e2e/story-e13-s02.spec.ts:63-99`

The `seedQuizData` helper inlines a manual `indexedDB.open('ElearningDB')` retry loop — the exact pattern the `test-patterns/use-seeding-helpers` ESLint rule flags. The story's Testing Notes say "No manual IndexedDB seeding." Extract to a shared fixture.

### [Medium] isSubmitting behavior untested in QuizActions
**Confidence:** 60%
File: `src/app/components/quiz/__tests__/QuizActions.test.tsx`

The `isSubmitting` prop disables the Submit button and changes its label to "Submitting…" but these states have no tests. Both behaviors are implemented in the modified file.

---

### [Nit] `className` assertion couples test to Tailwind tokens
**Confidence:** 55%
File: `src/app/components/quiz/__tests__/QuestionGrid.test.tsx:33-39`

`expect(button.className).toContain('bg-brand-soft')` couples the test to internal CSS class names. Prefer `data-testid` or ARIA state assertions.

### [Nit] `.not.toBeVisible()` should be `.not.toBeInTheDocument()`
**Confidence:** 50%
File: `tests/e2e/story-e13-s02.spec.ts:150-153`

When a question is unmarked, the button with `aria-label="Question 1, marked for review"` is absent from DOM, not hidden. `.not.toBeInTheDocument()` is more precise.

---

## Edge Cases to Consider

- **All questions marked**: `ReviewSummary.test.tsx` doesn't test all items in `questionOrder` being marked.
- **Single-question quiz with mark**: No integration test covers marking the only question → submit dialog path.
- **markedForReview reset on retake**: `startQuiz` resets to `[]` but no test explicitly asserts this.
- **Jump link closes dialog**: Integration wiring in `Quiz.tsx:296-299` tested only via E2E (acceptable).
