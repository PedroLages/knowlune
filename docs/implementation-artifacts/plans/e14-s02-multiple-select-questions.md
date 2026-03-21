# E14-S02: Display Multiple Select Questions with Partial Credit

## Context

Epic 14 adds diverse question types to the quiz system. E14-S01 (True/False) is done. This story adds Multiple Select ("select all that apply") with Partial Credit Model (PCM) scoring — the most complex question type so far because it requires fractional scoring instead of all-or-nothing.

All dependencies are complete: types support `string[]` answers, useQuizStore accepts `string | string[]`, and QuestionDisplay's props already accept `string | string[]`.

## Implementation Plan

### Task 1: Create MultipleSelectQuestion component
**Create:** `src/app/components/quiz/questions/MultipleSelectQuestion.tsx`

Follow the exact pattern from TrueFalseQuestion.tsx:
- Props: `{ question: Question, value: string[] | undefined, onChange: (answer: string[]) => void, mode: QuestionDisplayMode }`
- Structure: `<fieldset>` → `<legend>` (Markdown question text + "Select all that apply" indicator) → vertical stack of `<label>` wrapping `<Checkbox>` from shadcn/ui
- Selection styling: `border-brand bg-brand-soft` (selected), `border-border bg-card` (default)
- Toggle logic: check → add to array, uncheck → filter from array, call `onChange(newArray)`
- Layout: single column (`space-y-3`), NOT 2-column grid — multiple-select typically has 4+ options
- Touch targets: `min-h-12 p-4` (48px)
- Focus: `focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2`
- Motion: `transition-colors duration-150 motion-reduce:transition-none`

Reuse:
- `REMARK_PLUGINS`, `MARKDOWN_COMPONENTS` from `./markdown-config` (shared Markdown config)
- `Checkbox` from `@/app/components/ui/checkbox`
- `cn` from `@/app/components/ui/utils`

### Task 2: Add multiple-select case to QuestionDisplay
**Modify:** `src/app/components/quiz/QuestionDisplay.tsx`

- Import `MultipleSelectQuestion`
- Add `case 'multiple-select':` in the switch statement
- Create `arrayOnChange` callback: `(answer: string[]) => onChange(answer)`
- Extract `arrayValue`: `Array.isArray(value) ? value : undefined`
- Pass to `<MultipleSelectQuestion question={question} value={arrayValue} onChange={arrayOnChange} mode={mode} />`

### Task 3: Implement PCM scoring in scoring.ts
**Modify:** `src/lib/scoring.ts`

The current architecture uses:
1. `isCorrectAnswer()` → returns `boolean`
2. `calculateQuizScore()` → uses `isCorrect ? pointsPossible : 0`

For PCM, need to support fractional points. **Approach: add `calculatePointsForQuestion()` helper**:

```typescript
function calculatePointsForQuestion(question: Question, userAnswer: string | string[] | undefined): { pointsEarned: number; isCorrect: boolean } {
  if (userAnswer === undefined) return { pointsEarned: 0, isCorrect: false }

  if (question.type === 'multiple-select') {
    const correctSet = new Set(question.correctAnswer as string[])
    const userSet = new Set(userAnswer as string[])
    const correctSelections = [...userSet].filter(a => correctSet.has(a)).length
    const incorrectSelections = [...userSet].filter(a => !correctSet.has(a)).length
    const rawScore = correctSet.size > 0 ? (correctSelections - incorrectSelections) / correctSet.size : 0
    const pointsEarned = Math.max(0, Math.round(rawScore * question.points * 100) / 100)
    const isCorrect = correctSelections === correctSet.size && incorrectSelections === 0
    return { pointsEarned, isCorrect }
  }

  // All other types: all-or-nothing (preserves existing behavior)
  const isCorrect = isCorrectAnswer(question, userAnswer)
  return { pointsEarned: isCorrect ? question.points : 0, isCorrect }
}
```

Update `calculateQuizScore()` loop to use this instead of the inline `isCorrect ? pointsPossible : 0`.

**Keep `isCorrectAnswer()`** for the multiple-select case — it stays as-is (exact match = fully correct). The `isCorrect` field on Answer still means "perfectly answered" for review purposes.

### Task 4: Add feedback display for multiple-select results
**Modify:** `src/app/components/quiz/questions/MultipleSelectQuestion.tsx` (or create separate feedback within the component)

In review mode, show per-option indicators:
- Correct selected → `text-success` + Check icon
- Correct missed → `text-warning` + AlertCircle icon
- Incorrect selected → `text-destructive` + X icon
- Summary: "X of Y correct" in `text-muted-foreground text-sm`

This only renders when `mode !== 'active'` — follows same pattern as existing components (though MC/TF don't have review mode yet, the prop surface is ready).

**Note:** The ScoreSummary already displays fractional points correctly. QuestionBreakdown already shows `pointsEarned/pointsPossible`. No changes needed to those components.

### Task 5: Verify E2E tests pass
**Existing:** `tests/e2e/story-e14-s02.spec.ts` (ATDD tests created earlier)

Run tests to verify all 7 test cases pass:
- AC1: Checkboxes + "Select all that apply"
- AC2: Independent toggling + state persistence
- AC3+5: Zero selections → 0 points
- AC4+5: PCM scoring (100%, 33%, 0%)
- AC6: Feedback display
- AC7: Accessibility (fieldset/legend, keyboard, touch targets)

### Task 6: Commit after each task

Granular commits as save points after each task completes.

## Files Summary

| Action | File | Change |
|--------|------|--------|
| Create | `src/app/components/quiz/questions/MultipleSelectQuestion.tsx` | New component |
| Modify | `src/app/components/quiz/QuestionDisplay.tsx` | Add case + import |
| Modify | `src/lib/scoring.ts` | Add PCM scoring helper |
| Exists | `tests/e2e/story-e14-s02.spec.ts` | Run to verify |

## Key Risks

1. **Scoring refactor** — highest risk. Must preserve exact behavior for MC/TF/FIB while adding fractional scoring for MS. Unit test the formula edge cases.
2. **Checkbox keyboard behavior** — checkboxes use Tab (not Arrow keys like radios). This is native behavior, no special handling needed.
3. **Answer persistence** — useQuizStore already handles `string[]` in `submitAnswer()`. No changes needed.

## Verification

1. `npm run build` — no type errors
2. `npm run lint` — no ESLint violations
3. `npx playwright test tests/e2e/story-e14-s02.spec.ts` — all 7 tests pass
4. Manual: navigate to a quiz with multiple-select questions, verify checkbox selection, submit, check score
