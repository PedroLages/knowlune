# E14-S01: Display True/False Questions — Implementation Plan

## Context

Epic 14 adds diverse question types to the quiz system built in Epics 12-13. Story 14.1 is the first: True/False questions. All infrastructure is ready — the `'true-false'` type exists in `QuestionType`, scoring logic already handles it, and `QuestionDisplay` is designed for extension. This story creates the UI component and wires it into the dispatcher.

## Files to Create

### 1. `src/app/components/quiz/questions/TrueFalseQuestion.tsx`

Mirror `MultipleChoiceQuestion.tsx` (same file, same patterns):

- **Props**: `{ question: Question, value: string | undefined, onChange: (answer: string) => void, mode: QuestionDisplayMode }`
- **Structure**: `<fieldset>` → `<legend id={legendId}>` (Markdown via `react-markdown` + `remark-gfm`) → `<RadioGroup aria-labelledby={legendId}>`
- **Options**: Two `<label>` wrappers around `<RadioGroupItem>`, one for "True", one for "False"
  - Use `question.options` array (not hardcoded strings) for flexibility
- **Layout**: `grid grid-cols-1 lg:grid-cols-2 gap-3` (stacked mobile, side-by-side desktop)
- **Styling** (reuse exact MC patterns):
  - Selected: `border-2 border-brand bg-brand-soft`
  - Unselected: `border-2 border-border bg-card hover:bg-accent`
  - Focus: `focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2`
  - Touch targets: `min-h-12 p-4 rounded-xl`
  - Disabled (review mode): `cursor-default opacity-60`
- **Mode handling**: `const isActive = mode === 'active'` — disable RadioGroup when not active
- **Warning**: `console.warn` if `options.length !== 2`

### 2. `src/app/components/quiz/__tests__/TrueFalseQuestion.test.tsx`

Unit tests (Vitest + React Testing Library):
- Renders "True" and "False" options with no pre-selection
- Selection triggers onChange callback with correct value
- Selected option shows brand classes, unselected shows default
- Disabled in review mode (not interactive)
- fieldset/legend semantic structure with aria-labelledby
- Console warning when options count ≠ 2

## Files to Modify

### 3. `src/app/components/quiz/QuestionDisplay.tsx`

Add `case 'true-false'` before `default`:

```tsx
case 'true-false': {
  const tfValue = typeof value === 'string' ? value : undefined
  const tfOnChange = (answer: string) => onChange(answer)
  return (
    <TrueFalseQuestion
      question={question}
      value={tfValue}
      onChange={tfOnChange}
      mode={mode}
    />
  )
}
```

Add import: `import { TrueFalseQuestion } from './questions/TrueFalseQuestion'`

## Files Already Done (No Changes Needed)

- `src/types/quiz.ts` — `'true-false'` in QuestionType ✅
- `src/lib/scoring.ts` — true-false scoring at line 15-18 ✅
- `src/lib/__tests__/scoring.test.ts` — scoring tests at lines 74-94 ✅
- `tests/e2e/story-e14-s01.spec.ts` — ATDD tests created in /start-story ✅

## Existing Code to Reuse

| What | Where |
|------|-------|
| `MultipleChoiceQuestion` (template) | `src/app/components/quiz/questions/MultipleChoiceQuestion.tsx` |
| `RadioGroup` / `RadioGroupItem` | `src/app/components/ui/radio-group.tsx` |
| `cn()` utility | `src/app/components/ui/utils.ts` |
| `QuestionDisplayMode` type | `src/app/components/quiz/QuestionDisplay.tsx` |
| `Question` type | `src/types/quiz.ts` |
| Markdown rendering | `react-markdown` + `remark-gfm` (already installed) |
| `REMARK_PLUGINS` / `MARKDOWN_COMPONENTS` | Copy from MultipleChoiceQuestion |

## Build Sequence

1. Create `TrueFalseQuestion.tsx` (copy MC, adapt to 2-option grid layout)
2. Add `case 'true-false'` to `QuestionDisplay.tsx`
3. Create unit tests `TrueFalseQuestion.test.tsx`
4. Run unit tests: `npm run test:unit`
5. Run E2E tests: `npx playwright test tests/e2e/story-e14-s01.spec.ts`
6. Run build + lint: `npm run build && npm run lint`

## Verification

```bash
# Unit tests
npm run test:unit -- --reporter=verbose

# E2E tests (Chromium only)
npx playwright test tests/e2e/story-e14-s01.spec.ts --project=chromium

# Build + lint
npm run build && npm run lint

# Type check
npx tsc --noEmit
```

## Design Decision: Options Source

Use `question.options` array (from data) rather than hardcoding `['True', 'False']`. This:
- Respects the Zod validation that enforces exactly 2 options
- Allows future i18n (localized option labels)
- Matches the polymorphic pattern where data drives rendering
