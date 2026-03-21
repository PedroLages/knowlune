## Edge Case Review — E14-S02 (2026-03-21)

### Unhandled Edge Cases

**scoring.ts:50** — `correctAnswer is string instead of string[] for multiple-select question`
> Consequence: Set iterates characters of string, producing nonsensical scoring
> Guard: `if (!Array.isArray(question.correctAnswer)) return { pointsEarned: 0, isCorrect: false }`

**scoring.ts:51** — `userAnswer is string instead of string[] for multiple-select question`
> Consequence: Set iterates characters of string, producing nonsensical scoring
> Guard: `if (!Array.isArray(userAnswer)) return { pointsEarned: 0, isCorrect: false }`

**MultipleSelectQuestion.tsx:26-31** — `useMemo used for console.warn side effect`
> Consequence: React may skip or double-execute memoized side effects
> Guard: `useEffect(() => { if (options.length < 2) console.warn(...) }, [question.id, options.length])`

**scoring.ts:55-57** — `correctAnswer is empty array (correctSet.size === 0)`
> Consequence: isCorrect returns true for any user selection when no correct answers exist
> Guard: `if (correctSet.size === 0) return { pointsEarned: 0, isCorrect: false }`

**MultipleSelectQuestion.tsx:59-62** — `options array is empty (length 0)`
> Consequence: Renders empty fieldset with no visible options or error message
> Guard: `if (options.length === 0) return <p>No options available</p>`

**QuestionDisplay.tsx:34-35** — `Stored value is string when question type changes to multiple-select`
> Consequence: Previous string selection silently discarded, user loses answer
> Guard: `Log warning when value type mismatches question type expectation`

**MultipleSelectQuestion.tsx:58-62** — `Duplicate strings in question.options array`
> Consequence: Multiple checkboxes toggle same value, visual state inconsistency
> Guard: `const options = [...new Set(question.options ?? [])]`

---
**Total:** 7 unhandled edge cases found.
