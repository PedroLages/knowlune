## Edge Case Review — E12-S05 (2026-03-18)

### Unhandled Edge Cases

**MultipleChoiceQuestion.tsx:48** — `Two or more options have identical text strings`
> Consequence: React duplicate key warning; selecting either option is indistinguishable in store
> Guard: `key={\`\${option}-\${index}\`}` — use index-suffixed keys and store answer by index or option ID instead of raw text

**MultipleChoiceQuestion.tsx:48** — `An option string is empty ("")`
> Consequence: RadioGroup `value=""` matches empty option on mount (false pre-selection); empty label has no clickable text
> Guard: `options.filter(o => o.length > 0)` or render placeholder text for empty options

**MultipleChoiceQuestion.tsx:43-46** — `Selected option uses border-2, unselected uses border (1px vs 2px)`
> Consequence: 1px layout shift when selecting/deselecting an option; adjacent elements jitter
> Guard: Use uniform `border-2` on all options with `border-transparent` for unselected: `border-2 border-transparent` / `border-2 border-brand`

**MultipleChoiceQuestion.tsx:32-36** — `RadioGroup lacks aria-labelledby pointing to the legend`
> Consequence: Screen readers may not associate the radiogroup role with the question text in the legend
> Guard: `<legend id={\`q-\${question.id}-legend\`}>` and `<RadioGroup aria-labelledby={\`q-\${question.id}-legend\`}>`

**Quiz.tsx:171-175** — `questionOrder array is empty (length 0)`
> Consequence: `questionOrder[currentQuestionIndex]` returns undefined; falls through to positional lookup which works, but silently ignores that ordering data is missing
> Guard: `if (currentProgress.questionOrder.length === 0) console.warn('[Quiz] questionOrder is empty, falling back to positional index')`

---
**Total:** 5 unhandled edge cases found.
