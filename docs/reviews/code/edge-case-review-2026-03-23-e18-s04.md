## Edge Case Review — E18-S04 (2026-03-23)

### Unhandled Edge Cases

**QuestionGrid.tsx:22-23** — `total prop is Infinity or very large number`
> Consequence: Browser freezes rendering infinite DOM nodes
> Guard: `if (!Number.isFinite(total) || total > 200) return null`

---

**QuestionGrid.tsx:8** — `markedForReview prop omitted or undefined at runtime`
> Consequence: markedForReview.includes() throws TypeError, crashes grid
> Guard: `markedForReview = [],`

---

**MultipleChoiceQuestion.tsx:68** — `question.correctAnswer is string[] instead of string`
> Consequence: Correct answers always shown as wrong in review mode
> Guard: `const isCorrectAnswer = Array.isArray(question.correctAnswer) ? question.correctAnswer.includes(option) : option === question.correctAnswer`

---

**TrueFalseQuestion.tsx:63** — `question.correctAnswer is string[] instead of string`
> Consequence: Correct answers always shown as wrong in review mode
> Guard: `const isCorrectAnswer = Array.isArray(question.correctAnswer) ? question.correctAnswer.includes(option) : option === question.correctAnswer`

---

**TrueFalseQuestion.tsx:16** — `question.options is absent in production build`
> Consequence: Blank fieldset renders silently with no true/false choices
> Guard: `if (options.length === 0) return null`

---

**MultipleSelectQuestion.tsx:38-45** — `keyboard focus is outside fieldset element`
> Consequence: Number key shortcuts silently do nothing when focus outside fieldset
> Guard: `document.addEventListener("keydown", handleKeyDown) instead of fieldset onKeyDown`

---

**MarkForReview.tsx:12** — `questionId contains spaces or special characters`
> Consequence: Invalid HTML id breaks aria-labelledby association silently
> Guard: `` const id = `mark-review-${questionId.replace(/[^a-zA-Z0-9-_]/g, "-")}` ``

---

**theme.css:105-109** — `hsl() called with hex value in --heatmap-* tokens`
> Consequence: Heatmap cells render unstyled; invalid CSS silently ignored by browser
> Guard: `--heatmap-level-1: color-mix(in oklch, var(--success) 30%, transparent)`

---
**Total:** 8 unhandled edge cases found.
