# E15-S04: Provide Immediate Explanatory Feedback per Question

## Context

After answering a quiz question, learners currently get no feedback until the quiz is fully submitted. This story adds inline feedback that appears immediately after answering — showing whether the answer was correct, an explanation, and for multiple-select questions, a per-option breakdown. This supports the pedagogical principle of immediate reinforcement.

**Dependencies:** All satisfied — Story 12.5 (question answering flow), 15.1-15.3 (timer infrastructure) are `done`.

## Implementation Plan

### Task 1: Export scoring helpers from `src/lib/scoring.ts`

Export `isCorrectAnswer()` and `calculatePointsForQuestion()` — currently private functions. The AnswerFeedback component needs these to calculate feedback on-the-fly without duplicating logic.

**Changes:**
- `function isCorrectAnswer(` → `export function isCorrectAnswer(`
- `function calculatePointsForQuestion(` → `export function calculatePointsForQuestion(`

**Commit:** `refactor: export scoring helpers for reuse in answer feedback`

### Task 2: Create `src/app/components/quiz/AnswerFeedback.tsx`

New component displaying inline feedback below the question after answer selection.

**Props interface:**
```typescript
interface AnswerFeedbackProps {
  question: Question
  userAnswer: string | string[] | undefined
  isTimerExpired?: boolean
}
```

**Internal logic:**
- Call `calculatePointsForQuestion(question, userAnswer)` to get `{ pointsEarned, isCorrect }`
- Derive `feedbackState`: `'correct' | 'incorrect' | 'partial' | 'time-expired'`
  - `isTimerExpired && !userAnswer` → `'time-expired'`
  - `isCorrect` → `'correct'`
  - `pointsEarned > 0 && !isCorrect` → `'partial'`
  - else → `'incorrect'`

**Visual states (from design guidance):**

| State | Border | Background | Icon |
|-------|--------|------------|------|
| Correct | `border-l-success` | `bg-success-soft` | CheckCircle `text-success` |
| Incorrect | `border-l-warning` | `bg-warning/10` | AlertCircle `text-warning` |
| Partial | `border-l-warning` | `bg-warning/10` | AlertCircle `text-warning` |
| Time expired | `border-l-muted` | `bg-muted/50` | Clock `text-muted-foreground` |

**Content sections:**
1. **Header:** "Correct!" / "Not quite" / "{n} of {total} correct" / "Not answered in time"
2. **Explanation:** Render `question.explanation` via existing `MarkdownRenderer` component
3. **Correct answer indicator** (incorrect only): "Correct answer: {correctAnswer}"
4. **Partial credit breakdown** (multiple-select only): `<ul aria-label="Answer breakdown">` showing which options were correct/incorrect/missed
5. **Points earned** (when < possible): "You earned {n} of {m} points"

**Accessibility:**
- Outer element: `role="status" aria-live="polite"`
- Icons: `aria-hidden="true"` (text carries meaning)
- Animation: `animate-in slide-in-from-bottom-2 fade-in duration-300`

**Imports:** `Card` from ui, `CheckCircle`/`AlertCircle`/`Clock` from lucide-react, `MarkdownRenderer`, `calculatePointsForQuestion` from scoring.ts, `cn` from utils

**Commit:** `feat(E15-S04): create AnswerFeedback component`

### Task 3: Integrate feedback into `src/app/pages/Quiz.tsx`

**Changes (lines ~434-475):**

1. **No new state needed.** Feedback is derived from existing data: if `currentAnswer` exists for the current question, show feedback. This is simpler and more robust than managing separate feedback state.

2. **Render AnswerFeedback** after `QuestionHint` and before `MarkForReview` (around line 450):
   ```tsx
   {currentAnswer !== undefined && currentAnswer !== '' && (
     <AnswerFeedback
       question={currentQuestion}
       userAnswer={currentAnswer}
     />
   )}
   ```

3. **For multiple-select:** The `onChange` handler already calls `submitAnswer()` immediately. However, MS questions need explicit submission (user toggles multiple checkboxes). The feedback should only show after the user has made their selections.

   **Decision:** For MC/TF/FIB, feedback shows immediately on selection (since these auto-submit). For MS, we need a way to indicate "I'm done selecting" — feedback should show after the user clicks Next or a Submit button. This can be handled by checking `currentAnswer` is defined AND the question type:
   - MC/TF/FIB: Show feedback when `currentAnswer` is truthy
   - MS: Show feedback when `currentAnswer` is a non-empty array (selections exist). Since the user actively checks/unchecks, we show feedback live as they select — this matches how partial credit works.

4. **No clearing needed on navigation** — feedback is derived from `currentAnswer`, which resets per-question automatically when `currentQuestionIndex` changes.

**Commit:** `feat(E15-S04): integrate AnswerFeedback into Quiz page`

### Task 4: Handle timer-expired feedback

When the timer expires, `handleTimerExpiry()` (line 241) calls `submitQuiz()` and navigates to results. The story requires unanswered questions to show feedback with correct answers.

**Approach:** Timer-expired feedback should appear on the **results page** (QuizResults.tsx), not during active quiz — since auto-submit immediately navigates away. The existing `QuestionBreakdown` component on results already shows per-question correct/incorrect. We need to:

1. Check if `QuestionBreakdown` already shows explanations — if not, add explanation display there for timer-expired (unanswered) questions
2. Add a "Not answered in time" indicator for questions where `userAnswer` is empty/undefined

**File:** `src/app/pages/QuizResults.tsx` and/or `src/app/components/quiz/QuestionBreakdown.tsx`

**Commit:** `feat(E15-S04): show timer-expired feedback on results page`

### Task 5: Accessibility verification

- Verify `role="status"` + `aria-live="polite"` works with screen readers
- Verify keyboard flow: after feedback appears, Tab reaches "Next Question"
- Verify color is not sole indicator (icon + text in all states)

No separate commit — verified as part of testing.

### Task 6: Unit tests

Create `src/app/components/quiz/__tests__/AnswerFeedback.test.tsx`:
- Renders correct state (CheckCircle, "Correct!", explanation)
- Renders incorrect state (AlertCircle, "Not quite", correct answer shown)
- Renders partial credit (points breakdown, per-option list)
- Renders time-expired state (Clock, "Not answered in time")
- Markdown explanation renders safely
- ARIA attributes present (role="status", aria-live="polite")

**Commit:** `test(E15-S04): add AnswerFeedback unit tests`

### Task 7: E2E test validation

Run existing ATDD tests (`tests/e2e/story-e15-s04.spec.ts`) and fix any selector/flow mismatches discovered during implementation.

**Commit:** `test(E15-S04): fix ATDD tests for actual implementation`

## Critical Files

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/scoring.ts` | Export 2 functions | Reuse scoring logic |
| `src/app/components/quiz/AnswerFeedback.tsx` | **Create** | New feedback component |
| `src/app/pages/Quiz.tsx` | Modify (~10 lines) | Render feedback inline |
| `src/app/components/quiz/QuestionBreakdown.tsx` | Modify | Timer-expired feedback |
| `src/app/components/quiz/MarkdownRenderer.tsx` | Read-only | Reuse for explanations |
| `src/types/quiz.ts` | Read-only | Question type has `explanation` + `correctAnswer` |

## Existing Code to Reuse

- `calculatePointsForQuestion()` — `src/lib/scoring.ts:42` (scoring + partial credit)
- `isCorrectAnswer()` — `src/lib/scoring.ts:11` (correctness check)
- `MarkdownRenderer` — `src/app/components/quiz/MarkdownRenderer.tsx` (explanation rendering)
- `Card` — `src/app/components/ui/card.tsx` (wrapper)
- `cn()` — `src/app/components/ui/utils.ts` (class merging)
- Design tokens: `--success`, `--success-soft`, `--warning`, `--muted` from `theme.css`

## Verification

1. **Unit tests:** `npm run test:unit -- --grep AnswerFeedback`
2. **E2E tests:** `npx playwright test tests/e2e/story-e15-s04.spec.ts --project=chromium`
3. **Manual verification:**
   - Start a quiz → answer correctly → see green "Correct!" with explanation
   - Answer incorrectly → see orange "Not quite" with correct answer
   - Multiple-select partial credit → see "2 of 3 correct" breakdown
   - Navigate Next → feedback clears, new question shows
   - Timed quiz → let timer expire → results show "Not answered in time"
4. **Build:** `npm run build` (no type errors)
5. **Lint:** `npm run lint` (no design token violations)
