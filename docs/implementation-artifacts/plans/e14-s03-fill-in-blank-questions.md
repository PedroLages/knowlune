# E14-S03: Display Fill-in-Blank Questions

## Context

Epic 14 adds diverse question types to the quiz system. E14-S01 (True/False) and E14-S02 (Multiple Select) are done. This story adds the Fill-in-Blank question type — a text input component with debounced state saving, character limit, and case-insensitive scoring.

**Complexity:** Small (2-3 hours). Scoring already exists. Only 1 new file + 1 modification.

## Implementation Plan

### Task 1: Create `FillInBlankQuestion.tsx`

**File:** `src/app/components/quiz/questions/FillInBlankQuestion.tsx` (new)

Follow TrueFalseQuestion pattern exactly:
- Props: `{ question: Question, value: string | undefined, onChange: (answer: string) => void, mode: QuestionDisplayMode }`
- `useId()` for legendId
- `isActive = mode === 'active'`
- `<fieldset>` → `<legend>` with `<Markdown>` using shared `REMARK_PLUGINS` + `MARKDOWN_COMPONENTS` from `./markdown-config`
- `<Input>` (shadcn/ui) with `placeholder="Type your answer here"`, `maxLength={500}`, `disabled={!isActive}`
- Character counter: `<span className="text-sm text-muted-foreground">{length} / 500</span>`

**Debounce pattern** (300ms):
```
- Local state: const [inputValue, setInputValue] = useState(value ?? '')
- Sync external value: useEffect to update inputValue when value prop changes (navigation back)
- Debounced save: useEffect with setTimeout(300ms) calling onChange(inputValue)
- Immediate save on blur: onBlur handler calls onChange directly
```

**Review mode:** When `!isActive`, show input as `disabled` with `opacity-60 cursor-default`.

**Reuse:**
- `REMARK_PLUGINS`, `MARKDOWN_COMPONENTS` from `./markdown-config`
- `cn` from `@/app/components/ui/utils`
- `Input` from `@/app/components/ui/input`
- `QuestionDisplayMode` from `../QuestionDisplay`

### Task 2: Integrate into QuestionDisplay

**File:** `src/app/components/quiz/QuestionDisplay.tsx` (modify)

- Add import: `import { FillInBlankQuestion } from './questions/FillInBlankQuestion'`
- Add case before `default` (line 67):
```tsx
case 'fill-in-blank':
  return (
    <FillInBlankQuestion
      question={question}
      value={stringValue}
      onChange={stringOnChange}
      mode={mode}
    />
  )
```

### Task 3: Scoring — No Changes Needed

**File:** `src/lib/scoring.ts` (lines 20-26) — already has `case 'fill-in-blank'` with case-insensitive trimmed comparison. Verified.

### Task 4: Run ATDD tests, fix until green

**File:** `tests/e2e/story-e14-s03.spec.ts` (already created)

7 tests covering all ACs: input rendering, character counter, answer persistence, 500-char limit, case-insensitive scoring, wrong answer = 0 points, fieldset/legend structure.

## Critical Files

| File | Action |
|------|--------|
| `src/app/components/quiz/questions/FillInBlankQuestion.tsx` | Create |
| `src/app/components/quiz/QuestionDisplay.tsx` | Add case |
| `src/app/components/quiz/questions/TrueFalseQuestion.tsx` | Reference pattern |
| `src/app/components/quiz/questions/markdown-config.tsx` | Reuse imports |
| `src/lib/scoring.ts` | No change (already done) |
| `tests/e2e/story-e14-s03.spec.ts` | Already created |

## Verification

1. `npm run build` — no type errors
2. `npm run lint` — no ESLint violations (design tokens, no hardcoded colors)
3. `npx playwright test tests/e2e/story-e14-s03.spec.ts` — all 7 tests pass
4. Manual check: navigate to quiz with fill-in-blank questions, type answer, verify character counter, navigate away and back (answer persists), submit and verify scoring
