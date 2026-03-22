## Edge Case Review — E15-S04 (2026-03-22)

### Unhandled Edge Cases

**AnswerFeedback.tsx:15-17** — `isTimerExpired && userAnswer is empty array []`
> Consequence: Timer-expired multiple-select question with `userAnswer = []` falls through to `calculatePointsForQuestion` instead of returning `'time-expired'` state, showing "Not quite" instead of "Not answered in time"
> Guard: `if (isTimerExpired && (userAnswer === undefined || userAnswer === '' || (Array.isArray(userAnswer) && userAnswer.length === 0)))`

**AnswerFeedback.tsx:57-59** — `pointsEarned is a non-integer float from PCM formula`
> Consequence: Display reads "You earned 0.33 of 1 points" — unrounded float confuses learners
> Guard: `You earned {Math.round(pointsEarned * 100) / 100} of {question.points}`

**AnswerFeedback.tsx:30** — `formatCorrectAnswer receives empty array []`
> Consequence: Renders "Correct answer: " with no value — blank text after the colon
> Guard: `if (Array.isArray(correctAnswer) && correctAnswer.length === 0) return '(none specified)'`

**AnswerFeedback.tsx:69-76** — `state === 'partial' but question.type !== 'multiple-select'`
> Consequence: `partialTitle` stays as empty string `''` from `config.title`, rendering an empty `<h4>` heading — screen readers announce empty heading
> Guard: `partialTitle = partialTitle || \`${pointsEarned} of ${question.points} points\``

**AnswerFeedback.tsx:21** — `question.explanation is whitespace-only string "   "`
> Consequence: MarkdownRenderer renders invisible whitespace block — empty visual space with no content value
> Guard: `{question.explanation?.trim() && (<div ...><MarkdownRenderer content={question.explanation} /></div>)}`

**QuestionBreakdown.tsx:22** — `isUnanswered called with undefined at runtime`
> Consequence: `undefined === ''` is false, so unanswered question shows incorrect icon (XCircle) instead of Clock icon
> Guard: `function isUnanswered(userAnswer: string | string[] | undefined): boolean { if (userAnswer == null) return true; ... }`

**QuestionBreakdown.tsx:86-93** — `row.question.correctAnswer is undefined when question has no correctAnswer field`
> Consequence: Expanded detail renders "Correct answer: undefined" as literal text
> Guard: `{(unanswered || !row.answer.isCorrect) && row.question.correctAnswer != null && (<p ...>...</p>)}`

**QuestionBreakdown.tsx:83-85** — `role="status" aria-live="polite" on user-triggered expansion`
> Consequence: Screen readers may announce expansion content as a status update rather than revealed content — semantically incorrect for click-triggered disclosure
> Guard: `role="region" aria-label="Question details"` (remove `aria-live="polite"`)

**Quiz.tsx:449-452** — `currentAnswer is null (not undefined) from answers record`
> Consequence: `null !== undefined` is true and `null !== ''` is true, so AnswerFeedback renders with `userAnswer={null}` — `calculatePointsForQuestion` receives unexpected `null`
> Guard: `{currentAnswer != null && currentAnswer !== '' && !(Array.isArray(currentAnswer) && currentAnswer.length === 0) && (<AnswerFeedback ... />)}`

**AnswerFeedback.tsx:62-76** — `userAnswer contains duplicate entries for multiple-select`
> Consequence: `new Set(userAnswer)` deduplicates, so `selectedCorrectly.length` may differ from what user sees — "2 of 3 correct" when user checked same option twice
> Guard: Deduplicate `userAnswer` before Set conversion or document that callers must not pass duplicates

---
**Total:** 10 unhandled edge cases found.
