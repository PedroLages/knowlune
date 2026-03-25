## Edge Case Review — E18-S03 (2026-03-23)

### Unhandled Edge Cases

**`src/app/pages/Quiz.tsx:435`** — `currentProgress.questionOrder` is `null` or `undefined`
> Consequence: `TypeError` thrown before `||` evaluates; the quiz active view crashes entirely.
> Guard: `const totalQuestions = (currentProgress.questionOrder?.length) || currentQuiz.questions.length`

---

**`src/app/pages/Quiz.tsx:435`** — both `questionOrder` and `questions` arrays are empty (length `0`)
> Consequence: `aria-valuemax={0}` with `aria-valuemin={1}` — invalid ARIA; assistive technology mis-announces or skips the progressbar.
> Guard: `const totalQuestions = currentProgress.questionOrder?.length || currentQuiz.questions.length || 1`

---

**`src/app/pages/Quiz.tsx:445-447`** — `currentQuestionIndex` is `undefined` on a partially-initialised progress object
> Consequence: Screen reader announces "Question NaN of N"; meaningless and confusing for AT users.
> Guard: `Question {(currentProgress.currentQuestionIndex ?? 0) + 1} of {totalQuestions}`

---

**`src/app/components/quiz/QuizHeader.tsx:44-51`** — `currentQuestion` (index + 1) exceeds `totalQuestions` due to an off-by-one in progress state
> Consequence: `aria-valuenow > aria-valuemax` — invalid per ARIA spec; screen readers may mis-announce progress position.
> Guard: `aria-valuenow={Math.min(currentQuestion, totalQuestions)}`

---

**`src/app/components/quiz/QuizHeader.tsx:44-51`** — `totalQuestions` is `0` (empty quiz); `aria-valuemin={1}` exceeds `aria-valuemax={0}`
> Consequence: Invalid ARIA progressbar — `min > max`; screen reader may skip the element or announce nonsensical values.
> Guard: `aria-valuemax={Math.max(totalQuestions, 1)}`

---

**`src/app/components/quiz/QuizActions.tsx:28-46`** — `isLast` question answered; `nextBtnRef.current` is `null` because the Next button is not rendered
> Consequence: Keyboard focus is silently lost after answering the last question; keyboard-only users must hunt for focus.
> Guard: `requestAnimationFrame(() => nextBtnRef.current?.focus() ?? submitBtnRef.current?.focus())`

---

**Total:** 6 unhandled edge cases found.
