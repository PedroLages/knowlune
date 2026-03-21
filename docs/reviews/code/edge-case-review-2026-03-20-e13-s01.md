## Edge Case Review — E13-S01 (2026-03-20)

### Unhandled Edge Cases

**QuestionGrid.tsx:22-24** — `answers[questionId] is an empty array [] (multiple-select question with zero selections)`
> Consequence: Empty array is truthy and !== '', so bubble shows "answered" (blue) styling for a semantically unanswered question
> Guard: `const isAnswered = questionId ? (answers[questionId] !== undefined && answers[questionId] !== '' && !(Array.isArray(answers[questionId]) && (answers[questionId] as string[]).length === 0)) : false`

**Quiz.tsx:57-60** — `countUnanswered receives answers entry that is an empty array []`
> Consequence: Empty array is not === undefined and not === '', so multi-select question with zero selections counts as "answered", skipping the submit confirmation dialog
> Guard: `return a === undefined || a === '' || (Array.isArray(a) && a.length === 0)`

**QuestionGrid.tsx:21** — `questionOrder[i] is undefined when total > questionOrder.length`
> Consequence: questionId is undefined, isAnswered defaults to false regardless of actual answer state; bubble always shows unanswered styling
> Guard: `if (!questionId) return <button key={i} disabled aria-label={\`Question ${i + 1} (unavailable)\`} ... />`

**QuizNavigation.tsx:35** — `progress.questionOrder is empty array (length 0, falsy)`
> Consequence: Falls through to quiz.questions.length via || operator, masking a corrupt/uninitialized questionOrder that should be surfaced as an error
> Guard: `const total = progress.questionOrder.length > 0 ? progress.questionOrder.length : quiz.questions.length`

**Quiz.tsx:232-237** — `questionOrder[index] contains an ID that matches no question in currentQuiz.questions`
> Consequence: First find() returns undefined, fallback shows questions[currentQuestionIndex] which is a different question than the grid highlights, creating a mismatch between displayed question and grid state
> Guard: `if (!currentQuestion || currentQuestion.id !== questionId) { console.error('[Quiz] Question ID mismatch', { questionId, index }); }`

**navigateToQuestion (useQuizStore.ts:208-215)** — `index is NaN (e.g., from parseInt of non-numeric string)`
> Consequence: NaN < 0 is false, NaN >= length is false, so bounds check passes; currentQuestionIndex is set to NaN, breaking all subsequent index-based lookups
> Guard: `if (!Number.isInteger(index)) return`

**navigateToQuestion (useQuizStore.ts:211)** — `currentQuiz.questions is an empty array (zero-question quiz)`
> Consequence: questions.length is 0, any index >= 0 fails the guard, so navigation silently does nothing; no error surfaced to the user
> Guard: `if (currentQuiz.questions.length === 0) return`

**QuizActions.tsx:26-28** — `isFirst and isLast are both true (single-question quiz)`
> Consequence: Previous is disabled (correct), Next is hidden (correct), Submit is shown (correct), but the user sees a disabled Previous button with no affordance to understand why it exists on a single-question quiz
> Guard: `{!isFirst && <Button ... onClick={onPrevious}>Previous</Button>}` (hide completely instead of disabling)

**QuizNavigation.tsx:31** — `quiz.questions.length is 0 while progress.currentQuestionIndex is 0`
> Consequence: isLast evaluates to 0 === -1 which is false, so Next button is shown instead of Submit on a zero-question quiz
> Guard: `const isLast = quiz.questions.length === 0 || progress.currentQuestionIndex === quiz.questions.length - 1`

---
**Total:** 9 unhandled edge cases found.
