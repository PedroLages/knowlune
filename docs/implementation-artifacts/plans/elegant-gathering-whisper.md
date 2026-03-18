# E12-S05: Display Multiple Choice Questions — Implementation Plan

## Context

Epic 12 builds the quiz system for LevelUp. Stories 12.1-12.4 established the type definitions, Dexie schema, Zustand store, and Quiz page shell. E12-S05 adds the first interactive question rendering — specifically multiple choice questions with radio button selection, Markdown rendering, and design-token-based styling. The Quiz page currently shows a placeholder stub at line 173 that this story replaces.

## Dependencies (all confirmed `done`)

- **E12-S01**: `Question` type with `options: string[]`, `type: QuestionType` — `src/types/quiz.ts`
- **E12-S03**: `useQuizStore.submitAnswer(questionId: string, answer: string | string[])` — `src/stores/useQuizStore.ts`
- **E12-S04**: Quiz page with QuizHeader + placeholder stub — `src/app/pages/Quiz.tsx:173`

## Implementation Steps

### Step 1: Verify dependencies are installed
- Check `package.json` for `react-markdown` (v10.1.0) and `remark-gfm` (v4.0.1) — already confirmed present
- No install needed

### Step 2: Create QuestionDisplay polymorphic renderer
**File**: `src/app/components/quiz/QuestionDisplay.tsx`

- Define `QuestionDisplayMode` type: `'active' | 'review-correct' | 'review-incorrect' | 'review-disabled'`
- Props: `{ question: Question; value: string | string[] | undefined; onChange: (answer: string | string[]) => void; mode?: QuestionDisplayMode }`
- Default `mode` to `'active'`
- Switch on `question.type`:
  - `'multiple-choice'` → render `<MultipleChoiceQuestion>`
  - default → render unsupported type fallback div
- Export the mode type for reuse in sub-components

### Step 3: Create MultipleChoiceQuestion component
**File**: `src/app/components/quiz/questions/MultipleChoiceQuestion.tsx`

- Props: `{ question: Question; value: string | undefined; onChange: (answer: string) => void; mode: QuestionDisplayMode }`
- Semantic HTML: `<fieldset>` wrapper, `<legend>` with `<ReactMarkdown remarkPlugins={[remarkGfm]}>` for question text
- shadcn/ui `RadioGroup` with `value` and `onValueChange`
- Each option: `<label>` wrapping `<RadioGroupItem>` + option text span
- Styling per AC:
  - Unselected: `border border-border bg-card hover:bg-accent rounded-xl p-4`
  - Selected: `border-2 border-brand bg-brand-soft rounded-xl p-4`
  - Use `data-[state=checked]` or conditional `cn()` for state styling
- `min-h-12` on each label for 48px touch targets
- `transition-colors duration-150` for smooth state changes
- Console warning if `question.options` has `< 2` or `> 6` items
- In `'active'` mode: full interactivity. Review modes: stub with comment (E16)

### Step 4: Integrate into Quiz page
**File**: `src/app/pages/Quiz.tsx`

- Import `QuestionDisplay` from `@/app/components/quiz/QuestionDisplay`
- Replace stub at line 173-176 with:
  ```tsx
  const currentQuestion = currentQuiz.questions[
    currentProgress.questionOrder.length > 0
      ? currentProgress.questionOrder.indexOf(currentQuiz.questions[currentProgress.currentQuestionIndex]?.id) !== -1
        ? currentProgress.currentQuestionIndex
        : currentProgress.currentQuestionIndex
      : currentProgress.currentQuestionIndex
  ]
  ```
  Simpler approach: use `questionOrder` to get current question ID, then find it:
  ```tsx
  const questionId = currentProgress.questionOrder[currentProgress.currentQuestionIndex]
    ?? currentQuiz.questions[currentProgress.currentQuestionIndex]?.id
  const currentQuestion = currentQuiz.questions.find(q => q.id === questionId)
    ?? currentQuiz.questions[currentProgress.currentQuestionIndex]
  const currentAnswer = currentProgress.answers[currentQuestion.id] as string | undefined
  ```
- Render: `<QuestionDisplay question={currentQuestion} value={currentAnswer} onChange={(a) => submitAnswer(currentQuestion.id, a)} mode="active" />`
- Get `submitAnswer` from store: `const submitAnswer = useQuizStore(s => s.submitAnswer)`

### Step 5: Write unit tests
**File**: `src/app/components/quiz/__tests__/MultipleChoiceQuestion.test.tsx`

Tests (Vitest + React Testing Library):
- Renders all options from question.options
- No option pre-selected when value is undefined
- Clicking option calls onChange with option text
- Only one option selected at a time (radio behavior)
- Markdown rendering in question text (bold, code)
- Console warning for < 2 or > 6 options
- Review mode prop exists (forward-compat surface test)
- Touch target: label elements have proper classes (min-h-12)
- Fieldset/legend semantic structure

### Step 6: Verify E2E ATDD tests pass
- Run `tests/e2e/story-e12-s05.spec.ts` (created during /start-story)
- Tests should turn GREEN once implementation is complete
- Fix any test adjustments needed for actual rendering

### Step 7: Commit after each task
- Granular commits: one per task (Step 2, 3, 4, 5, 6)

## Critical Files

| File | Action |
|------|--------|
| `src/app/components/quiz/QuestionDisplay.tsx` | Create |
| `src/app/components/quiz/questions/MultipleChoiceQuestion.tsx` | Create |
| `src/app/pages/Quiz.tsx` | Modify (replace stub at line 173) |
| `src/app/components/quiz/__tests__/MultipleChoiceQuestion.test.tsx` | Create |
| `tests/e2e/story-e12-s05.spec.ts` | Already created (verify passes) |

## Reusable Existing Code

- `RadioGroup`, `RadioGroupItem` — `src/app/components/ui/radio-group.tsx`
- `cn()` utility — `src/app/components/ui/utils.ts`
- `useQuizStore`, `selectCurrentQuiz`, `selectCurrentProgress` — `src/stores/useQuizStore.ts`
- `Question` type — `src/types/quiz.ts`
- `makeQuestion()`, `makeQuiz()` — `tests/support/fixtures/factories/quiz-factory.ts`
- `seedQuizzes()` — `tests/support/helpers/indexeddb-seed.ts`

## Verification

1. **Build**: `npm run build` — no TypeScript errors
2. **Lint**: `npm run lint` — no design token violations (all classes use tokens)
3. **Unit tests**: `npm run test:unit` — MultipleChoiceQuestion tests pass
4. **E2E tests**: `npx playwright test tests/e2e/story-e12-s05.spec.ts --project=chromium` — ATDD tests pass
5. **Manual**: Navigate to quiz page, start quiz, verify:
   - Question text renders with Markdown formatting
   - 4 radio options visible, none pre-selected
   - Clicking option shows brand styling
   - Clicking different option deselects previous
   - Mobile viewport: 48px touch targets
