## Edge Case Review — E13-S01 (2026-03-20)

Scope: `QuizActions.tsx`, `QuestionGrid.tsx`, `QuizNavigation.tsx`, `useQuizStore.ts` (navigateToQuestion), `Quiz.tsx` (navigation integration).

---

### Unhandled Edge Cases

#### 1. Zero-question quiz — QuizNavigation computes `isLast` as `index === -1`

**[QuizNavigation.tsx:31]** — `quiz.questions.length === 0`
> Consequence: `isLast` becomes `progress.currentQuestionIndex === -1`, which is `false` when `currentQuestionIndex` is 0. Both "Previous" (disabled) and "Next" buttons render. Clicking "Next" calls `goToNextQuestion` which is a no-op (guard passes because `0 >= -1`), but "Submit Quiz" never appears — the user is trapped with no way to submit.
> Guard: Early return in `QuizNavigation` or `Quiz.tsx` when `quiz.questions.length === 0`. Note: `QuizSchema` enforces `.min(1)` on questions array so this is defense-in-depth only, but corrupted IndexedDB data could bypass Zod.
> ```tsx
> // QuizNavigation.tsx top of render
> if (quiz.questions.length === 0) return null
> ```

#### 2. Single-question quiz — "Previous" disabled, "Submit" shown, but grid button is confusing singleton

**[QuizActions.tsx:26–31]** — `quiz with 1 question`
> Consequence: Works correctly (isFirst=true disables Previous, isLast=true shows Submit). No functional bug. Minor UX: QuestionGrid renders a single button that is always active-styled, providing no navigational value. Low severity.
> Guard: Optionally hide QuestionGrid when `total <= 1`.

#### 3. QuestionGrid `total` vs `questionOrder.length` mismatch

**[QuizNavigation.tsx:35]** — `progress.questionOrder.length || quiz.questions.length`
> Consequence: If `questionOrder` is somehow shorter than `quiz.questions.length` (e.g., corrupted persist state after a quiz was updated with new questions), `total` uses the shorter `questionOrder.length`. Grid renders fewer buttons than actual questions. The user can still navigate beyond the grid via Next button (store uses `quiz.questions.length` for bounds), creating a state where `currentIndex` exceeds visible grid buttons — no button shows the active highlight.
> Guard: Use `Math.max(progress.questionOrder.length, quiz.questions.length)` or always prefer `quiz.questions.length` as the canonical total.
> ```tsx
> total={quiz.questions.length}
> ```

#### 4. QuestionGrid `questionOrder[i]` undefined for out-of-range indices

**[QuestionGrid.tsx:24]** — `questionOrder shorter than total`
> Consequence: When `total` is derived from `quiz.questions.length` but `questionOrder` has fewer entries (same root cause as #3, opposite direction), `questionOrder[i]` returns `undefined`. The null-guards on lines 25-29 handle this gracefully (`isAnswered=false`, `isMarked=false`), so no crash. However, clicking that grid button calls `navigateToQuestion(i)` which succeeds (index is in-range per quiz.questions.length), but then `Quiz.tsx:236` reads `questionOrder[index]` which is `undefined`, falling through to the `??` fallback on line 237. Functional but the question lookup chain is fragile.
> Guard: Already partially handled by Quiz.tsx fallback chain. For robustness, log a warning when `questionOrder.length !== quiz.questions.length`.

#### 5. `navigateToQuestion` with non-integer or NaN index

**[useQuizStore.ts:208–215]** — `navigateToQuestion(1.5)` or `navigateToQuestion(NaN)`
> Consequence: `NaN < 0` is `false` and `NaN >= length` is also `false`, so both guards pass. `currentQuestionIndex` is set to `NaN`. Subsequent renders: `questionOrder[NaN]` is `undefined`, question lookup fails, and the "No question found" fallback renders. `goToNextQuestion` and `goToPrevQuestion` both produce `NaN + 1 = NaN` and `NaN - 1 = NaN`, permanently breaking navigation. For `1.5`: non-integer index sets `currentQuestionIndex` to 1.5, `questionOrder[1.5]` is `undefined`, same cascading failure.
> Guard: Add integer validation.
> ```ts
> navigateToQuestion: (index: number) => {
>   const { currentProgress, currentQuiz } = get()
>   if (!currentProgress || !currentQuiz) return
>   if (!Number.isInteger(index) || index < 0 || index >= currentQuiz.questions.length) return
>   set({ currentProgress: { ...currentProgress, currentQuestionIndex: index } })
> },
> ```

#### 6. Rapid clicking on grid buttons — no debounce or transition guard

**[QuestionGrid.tsx:34]** — rapid successive `onQuestionClick` calls
> Consequence: Each click synchronously calls `navigateToQuestion` which does a Zustand `set()`. Zustand batches React re-renders, so rapid clicks cause multiple state updates but only one render. No crash, no race condition — Zustand's synchronous `set()` is inherently safe. React may re-render with an intermediate index the user didn't intend, but this is cosmetic. **Low risk.**
> Guard: None needed — synchronous store updates are safe. If animation/transition is added later, a debounce or `isTransitioning` flag would be warranted.

#### 7. `isLast` and `isFirst` both true simultaneously (single-question quiz)

**[QuizActions.tsx:26+33+40]** — `quiz.questions.length === 1`
> Consequence: `isFirst=true` and `isLast=true`. Previous is disabled (correct). The `!isLast` check on line 33 hides Next (correct). The `isLast` check on line 40 shows Submit (correct). Works as intended.
> Guard: None needed.

#### 8. Grid layout overflow with 100+ questions

**[QuestionGrid.tsx:22]** — `flex flex-wrap gap-2` with 100+ 44x44px buttons
> Consequence: 100 buttons at 44px + 8px gap = ~5200px of content if unwrapped. With `flex-wrap`, they wrap into rows. At 320px mobile width, each row fits ~6 buttons, producing ~17 rows (~850px height). The grid is not in a scroll container — it pushes the page height significantly. At 50+ questions this becomes unwieldy; at 100+ it dominates the viewport.
> Guard: Wrap in a constrained scroll area for large question counts.
> ```tsx
> <div className={cn(
>   "flex flex-wrap gap-2",
>   total > 20 && "max-h-48 overflow-y-auto rounded-lg p-1"
> )}>
> ```

#### 9. Keyboard navigation — grid buttons lack arrow-key support

**[QuestionGrid.tsx:31–53]** — plain `<button>` elements without `role="radiogroup"` or arrow-key handlers
> Consequence: Grid buttons are individually focusable via Tab, which is correct for accessibility. However, with 20+ buttons, Tab-navigating through every button is tedious. The grid visually resembles a toolbar or radio group where arrow keys would be expected. Screen reader users must Tab through every button sequentially.
> Guard: Add `role="toolbar"` to the container and implement roving tabindex with arrow key navigation.
> ```tsx
> <div role="toolbar" aria-label="Question navigator" className="flex flex-wrap gap-2"
>   onKeyDown={handleArrowKeys}>
> ```

#### 10. `handleQuestionClick` in submit dialog — navigates but dialog may not close on all paths

**[Quiz.tsx:296–299]** — `ReviewSummary.onJumpToQuestion` calls `navigateToQuestion` then `setShowSubmitDialog(false)`
> Consequence: Works correctly for the intended flow. However, if `navigateToQuestion` throws (it currently cannot, but if error handling is added later), the dialog would remain open while the navigation state is indeterminate. Minor future-proofing concern.
> Guard: Close dialog first, then navigate (order swap).

#### 11. `answers[questionId]` check misses array answers (multiple-select)

**[QuestionGrid.tsx:26]** — `answers[questionId] !== undefined && answers[questionId] !== ''`
> Consequence: For multiple-select questions, the answer is `string[]`. An empty array `[]` passes the `!== undefined && !== ''` check (an array is not equal to empty string), so an empty-array answer shows as "answered" in the grid. However, this is a minor display issue — the scoring system handles empty arrays separately.
> Guard: Add array-length check.
> ```ts
> const isAnswered = questionId
>   ? (() => {
>       const a = answers[questionId]
>       if (a === undefined || a === '') return false
>       if (Array.isArray(a) && a.length === 0) return false
>       return true
>     })()
>   : false
> ```

#### 12. Stale Zustand persist state — `currentQuestionIndex` beyond new quiz version

**[useQuizStore.ts:232–238]** — persist middleware rehydrates `currentProgress` with old `currentQuestionIndex`
> Consequence: If a quiz is updated (questions removed) while a user has persisted progress, `currentQuestionIndex` may exceed the new `questions.length`. `navigateToQuestion` guards against this, but `goToNextQuestion` and `goToPrevQuestion` do not re-validate the current index — they just increment/decrement from the stale value. The Quiz.tsx fallback (line 236-240) catches the missing question gracefully with `??` chains, but the user sees "No question found" until they click a valid grid button.
> Guard: Add a rehydration validator in the persist middleware's `onRehydrateStorage` callback to clamp `currentQuestionIndex` to valid range.
> ```ts
> onRehydrateStorage: () => (state) => {
>   if (state?.currentProgress && state?.currentQuiz) {
>     const max = state.currentQuiz.questions.length - 1
>     if (state.currentProgress.currentQuestionIndex > max) {
>       state.currentProgress.currentQuestionIndex = Math.max(0, max)
>     }
>   }
> }
> ```

---

**Total:** 12 edge cases found (5 actionable bugs, 4 robustness improvements, 3 low-risk/cosmetic).

### Priority Summary

| Severity | Count | IDs |
|----------|-------|-----|
| **High** (functional bug) | 2 | #5 (NaN/float index), #1 (0-question trap) |
| **Medium** (data integrity) | 3 | #3 (total mismatch), #11 (array answer display), #12 (stale persist) |
| **Low** (UX/robustness) | 4 | #4 (fragile lookup), #8 (grid overflow), #9 (keyboard nav), #10 (dialog order) |
| **Info** (working as intended) | 3 | #2 (single question), #6 (rapid click), #7 (first+last) |
