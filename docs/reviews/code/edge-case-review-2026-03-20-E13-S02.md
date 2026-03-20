## Edge Case Review — E13-S02 (2026-03-20)

### Unhandled Edge Cases

**[ReviewSummary.tsx:22-23]** — `markedForReview contains IDs not present in questionOrder`
> Consequence: The heading displays `markedForReview.length` (e.g., "3 questions marked for review") but `markedIndices` filters out IDs not found in `questionOrder` (line 16: `.filter(i => i !== -1)`). The user sees "3 questions marked for review:" with only 2 clickable links. This can happen if `questionOrder` is stale after rehydration or if a question was removed from the quiz between sessions.
> Guard: `const resolvedCount = markedIndices.length` — use `resolvedCount` in the heading instead of `markedForReview.length`:
> ```tsx
> {markedIndices.length} {markedIndices.length === 1 ? 'question' : 'questions'} marked for review:
> ```

**[Quiz.tsx:168-179 — handleSubmitClick]** — `All questions answered but some are marked for review`
> Consequence: `handleSubmitClick` only shows the confirmation dialog when `countUnanswered > 0`. If the learner answered every question but marked some for review (indicating uncertainty), clicking Submit bypasses the dialog entirely — the quiz submits immediately with no reminder about the marked questions. This defeats the purpose of the "mark for review" feature at the most critical moment.
> Guard: Show the dialog when there are marked questions too:
> ```ts
> if (countUnanswered(q.questions, progress.answers) > 0 || progress.markedForReview.length > 0) {
>   setShowSubmitDialog(true)
> } else {
>   handleSubmitConfirm()
> }
> ```
> The dialog description should also adapt: when `unansweredCount === 0` but marks exist, show a review-focused message instead of the unanswered warning.

**[useQuizStore.ts:239-257 — onRehydrateStorage]** — `markedForReview contains question IDs from a different quiz version`
> Consequence: `onRehydrateStorage` clamps `currentQuestionIndex` but never filters `markedForReview` against valid question IDs. If a quiz was updated between sessions (questions removed/replaced), `markedForReview` retains stale IDs. These stale IDs pass through to `QuestionGrid` (where `markedForReview.includes(questionId)` simply returns false — harmless) but cause the count mismatch in `ReviewSummary` (see first finding).
> Guard: Add to `onRehydrateStorage`:
> ```ts
> const validIds = new Set(state.currentQuiz.questions.map(q => q.id))
> state.currentProgress.markedForReview = state.currentProgress.markedForReview.filter(id => validIds.has(id))
> ```

**[useQuizStore.ts:239-257 — onRehydrateStorage]** — `markedForReview is undefined in old persisted state`
> Consequence: localStorage may contain state persisted before E13-S02 was deployed (no `markedForReview` field). Zustand's `persist` middleware deserializes the raw JSON — if the field is missing, `currentProgress.markedForReview` is `undefined`. Any call to `.includes()` on it (Quiz.tsx:282, QuestionGrid.tsx:30) throws `TypeError: Cannot read properties of undefined`. The Zod schema in `QuizProgressSchema` is only used for explicit validation, not for rehydration.
> Guard: Add to `onRehydrateStorage`:
> ```ts
> if (!Array.isArray(state.currentProgress.markedForReview)) {
>   state.currentProgress.markedForReview = []
> }
> ```

**[useQuizStore.ts:218-228 — toggleReviewMark]** — `questionId is an empty string`
> Consequence: `toggleReviewMark('')` passes the `!state.currentProgress` guard and pushes `''` into `markedForReview`. This phantom entry increments the review count in `ReviewSummary`, but `questionOrder.indexOf('')` returns `-1` so no link renders — creating another count/link mismatch. The caller in Quiz.tsx guards with `currentQuestionId &&` (truthy check), which correctly excludes empty strings. However, `toggleReviewMark` is a public store action callable from anywhere.
> Guard: Add early return:
> ```ts
> toggleReviewMark: (questionId: string) => {
>   if (!questionId) return
> ```

**[useQuizStore.ts:218-228 — toggleReviewMark + submitQuiz snapshot]** — `Mark toggled while submitQuiz is in-flight`
> Consequence: `submitQuiz` snapshots `currentProgress` at the start (line 105: `const snapshot = { currentQuiz, currentProgress }`). If `toggleReviewMark` fires while submission is in-flight (the button is not disabled during submission), it mutates `currentProgress` via `set()`. If `submitQuiz` then fails and rolls back to the snapshot (line 151), the review mark change is silently lost. The user's toggle appears to work (checkbox flips) but reverts on error recovery.
> Guard: Disable the `MarkForReview` checkbox when `isSubmitting` is true:
> ```tsx
> <MarkForReview
>   questionId={currentQuestionId}
>   isMarked={currentProgress.markedForReview.includes(currentQuestionId)}
>   onToggle={() => toggleReviewMark(currentQuestionId)}
>   disabled={isStoreLoading}  // new prop
> />
> ```

---
**Total:** 6 unhandled edge cases found.
