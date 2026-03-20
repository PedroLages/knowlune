# Implementation Plan: E13-S01 Navigate Between Questions

**Story:** [13-1-navigate-between-questions.md](../13-1-navigate-between-questions.md)
**Branch:** `feature/e13-s01-navigate-between-questions`
**Complexity:** Medium (3–4 hours)

---

## Context

Epic 12 delivered the basic quiz flow with sequential Previous/Next navigation inline in `Quiz.tsx`. Epic 13-S01 adds:
1. A `navigateToQuestion(index)` store action for direct jumps
2. A `QuestionGrid` component showing all question bubbles (answered/current/unanswered states)
3. Extracted `QuizActions` and `QuizNavigation` components
4. E2E tests covering all navigation paths

**Key constraint:** The question grid must respect `questionOrder` (the shuffled ID order stored in `QuizProgress`), not the original `q.order` property.

---

## Current State

| File | Status | Notes |
|------|--------|-------|
| `src/stores/useQuizStore.ts` | Exists | Has `goToNextQuestion`, `goToPrevQuestion` — missing `navigateToQuestion` |
| `src/app/pages/Quiz.tsx` | Exists | Inline Previous/Next/Submit nav footer — will be replaced |
| `src/app/components/quiz/QuizHeader.tsx` | Exists | Progress bar + question counter — no changes needed |
| `src/app/components/quiz/QuizStartScreen.tsx` | Exists | No changes needed |
| `src/app/components/quiz/QuizActions.tsx` | **Missing** | New file |
| `src/app/components/quiz/QuestionGrid.tsx` | **Missing** | New file |
| `src/app/components/quiz/QuizNavigation.tsx` | **Missing** | New file |
| `tests/e2e/story-e13-s01.spec.ts` | **Missing** | New file |

---

## Implementation Steps

### Step 1 — Add `navigateToQuestion` to `useQuizStore`

**File:** `src/stores/useQuizStore.ts`

Add to `QuizState` interface:
```typescript
navigateToQuestion: (index: number) => void
```

Add implementation in the store body (after `goToPrevQuestion`):
```typescript
navigateToQuestion: (index: number) => {
  const { currentProgress, currentQuiz } = get()
  if (!currentProgress || !currentQuiz) return
  if (index < 0 || index >= currentQuiz.questions.length) return
  set({
    currentProgress: { ...currentProgress, currentQuestionIndex: index },
  })
},
```

**Unit tests** (`src/stores/__tests__/useQuizStore.test.ts`):
- `navigateToQuestion` sets `currentQuestionIndex` to the given index
- `navigateToQuestion` is a no-op when index < 0
- `navigateToQuestion` is a no-op when index >= questions.length
- `navigateToQuestion` is a no-op when no active quiz

---

### Step 2 — Create `QuizActions` component

**File:** `src/app/components/quiz/QuizActions.tsx`

Extracted from the inline nav footer in `Quiz.tsx`:

```typescript
interface QuizActionsProps {
  onPrevious: () => void
  onNext: () => void
  onSubmit: () => void
  isFirst: boolean
  isLast: boolean
  isSubmitting?: boolean
}
```

Layout: `<div className="flex gap-3 items-center">`
- Previous button: `variant="outline"`, disabled when `isFirst`
- Next button: shown when `!isLast`
- Submit Quiz button: shown when `isLast`, `bg-brand text-brand-foreground`

All buttons: `rounded-xl min-h-[44px]`

**Unit tests** (Vitest + RTL):
- Renders Previous + Next when not first/last
- Previous is disabled when `isFirst=true`
- Next is hidden and Submit shown when `isLast=true`
- Both Previous and Submit shown on single-question quiz (`isFirst && isLast`)
- Clicking buttons calls correct callbacks

---

### Step 3 — Create `QuestionGrid` component

**File:** `src/app/components/quiz/QuestionGrid.tsx`

```typescript
interface QuestionGridProps {
  total: number                               // total question count
  answers: Record<string, string | string[]>  // current answers map
  questionOrder: string[]                     // ordered array of question IDs
  currentIndex: number                        // 0-based current question index
  onQuestionClick: (index: number) => void
}
```

Renders a row/wrap of numbered buttons (1-indexed display):

```tsx
{Array.from({ length: total }, (_, i) => {
  const questionId = questionOrder[i]
  const isAnswered = questionId ? (answers[questionId] !== undefined && answers[questionId] !== '') : false
  const isCurrent = i === currentIndex

  return (
    <button
      key={i}
      onClick={() => onQuestionClick(i)}
      aria-label={`Question ${i + 1}`}
      aria-current={isCurrent ? 'true' : undefined}
      className={cn(
        'flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium',
        'min-w-[44px] min-h-[44px]', // accessible touch target via padding
        isCurrent
          ? 'bg-brand text-brand-foreground'
          : isAnswered
          ? 'bg-brand-soft text-brand border border-brand'
          : 'bg-card text-muted-foreground border border-border'
      )}
    >
      {i + 1}
    </button>
  )
})}
```

Visual state summary:
| State | Background | Border | Text |
|-------|-----------|--------|------|
| Current | `bg-brand` | none | `text-brand-foreground` |
| Answered | `bg-brand-soft` | `border-brand` | `text-brand` |
| Unanswered | `bg-card` | `border-border` | `text-muted-foreground` |

**Unit tests** (RTL):
- Renders correct number of bubbles
- Current question has `aria-current="true"`, others don't
- Answered questions get answered class, unanswered get default class
- Clicking a bubble calls `onQuestionClick` with the correct 0-based index

---

### Step 4 — Create `QuizNavigation` component

**File:** `src/app/components/quiz/QuizNavigation.tsx`

Composition component combining `QuizActions` and `QuestionGrid`:

```typescript
interface QuizNavigationProps {
  quiz: Quiz
  progress: QuizProgress
  onPrevious: () => void
  onNext: () => void
  onSubmit: () => void
  onQuestionClick: (index: number) => void
  isSubmitting?: boolean
}
```

Layout:
```tsx
<nav aria-label="Quiz navigation" className="mt-6 flex flex-col sm:flex-row items-center gap-4">
  <QuizActions
    onPrevious={onPrevious}
    onNext={onNext}
    onSubmit={onSubmit}
    isFirst={progress.currentQuestionIndex === 0}
    isLast={progress.currentQuestionIndex === quiz.questions.length - 1}
    isSubmitting={isSubmitting}
  />
  <QuestionGrid
    total={progress.questionOrder.length || quiz.questions.length}
    answers={progress.answers}
    questionOrder={progress.questionOrder}
    currentIndex={progress.currentQuestionIndex}
    onQuestionClick={onQuestionClick}
  />
</nav>
```

**Unit tests** (RTL):
- Renders both QuizActions and QuestionGrid
- `aria-label="Quiz navigation"` present

---

### Step 5 — Integrate into `Quiz.tsx`

**File:** `src/app/pages/Quiz.tsx`

1. Import `QuizNavigation` and `useQuizStore.navigateToQuestion`
2. Add `const navigateToQuestion = useQuizStore(s => s.navigateToQuestion)` selector
3. Add `handleQuestionClick` callback:
   ```typescript
   const handleQuestionClick = useCallback((index: number) => {
     navigateToQuestion(index)
   }, [navigateToQuestion])
   ```
4. Replace the inline `<nav>` block (lines 257–289) with:
   ```tsx
   <QuizNavigation
     quiz={currentQuiz}
     progress={currentProgress}
     onPrevious={goToPrevQuestion}
     onNext={goToNextQuestion}
     onSubmit={handleSubmitClick}
     onQuestionClick={handleQuestionClick}
     isSubmitting={isStoreLoading}
   />
   ```
5. Remove now-unused `ChevronLeft`, `ChevronRight` icon imports (if no longer used elsewhere)

---

### Step 6 — E2E Tests

**File:** `tests/e2e/story-e13-s01.spec.ts`

**Test data:** 3-question quiz (q1, q2, q3) with `shuffleQuestions: false`

**Setup helper:** Copy `seedQuizData` + `navigateToQuiz` pattern from `story-12-6.spec.ts`

**Test cases:**

```
test.describe('E13-S01: Navigate Between Questions')

  AC1/2: Previous/Next navigation
  ✓ Click Next → advances to Q2 (question counter shows "Question 2 of 3")
  ✓ Click Previous → returns to Q1; Previous button disabled on Q1
  ✓ On last question: Next hidden, Submit Quiz shown

  AC3: Last question
  ✓ Navigate to Q3 → Submit Quiz visible, Previous enabled

  AC4 (jump to question):
  ✓ Click question bubble 3 → jumps from Q1 to Q3
  ✓ Bubble 3 shows aria-current="true"
  ✓ Previously visited/answered bubbles show answered state

  AC (answer persistence):
  ✓ Answer Q1, navigate to Q2, navigate back to Q1 → answer still selected
```

---

## File Change Summary

| File | Action | Description |
|------|--------|-------------|
| `src/stores/useQuizStore.ts` | Modify | Add `navigateToQuestion` action + selector |
| `src/app/components/quiz/QuizActions.tsx` | **Create** | Extracted Previous/Next/Submit button group |
| `src/app/components/quiz/QuestionGrid.tsx` | **Create** | Numbered question bubbles with state |
| `src/app/components/quiz/QuizNavigation.tsx` | **Create** | Composition: QuizActions + QuestionGrid |
| `src/app/pages/Quiz.tsx` | Modify | Replace inline nav with QuizNavigation, add navigateToQuestion |
| `src/stores/__tests__/useQuizStore.test.ts` | Modify | Add navigateToQuestion unit tests |
| `src/app/components/quiz/__tests__/QuizActions.test.tsx` | **Create** | Button rendering/callback tests |
| `src/app/components/quiz/__tests__/QuestionGrid.test.tsx` | **Create** | Visual state + click tests |
| `src/app/components/quiz/__tests__/QuizNavigation.test.tsx` | **Create** | Integration tests |
| `tests/e2e/story-e13-s01.spec.ts` | **Create** | E2E navigation tests |

---

## Risk Assessment

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Touch target size fails WCAG | Low | Use `min-h-[44px]` padding on bubble buttons |
| Bubble overflow on long quizzes | Medium | Use `flex-wrap` on QuestionGrid; consider scroll for >20 questions |
| E2E flake from IndexedDB timing | Low | Use existing retry pattern from story-12-6.spec.ts (10 retries, 200ms) |
| Design token violation | Low | ESLint rule enforces at save-time; no hardcoded colors |

---

## Acceptance Criteria Traceability

| AC | Component/Action | Test Type |
|----|-----------------|-----------|
| Previous/Next navigation | `QuizActions`, `goToNextQuestion`, `goToPrevQuestion` | Unit + E2E |
| Previous disabled on Q1 | `QuizActions` (isFirst prop) | Unit + E2E |
| Submit Quiz on last Q | `QuizActions` (isLast prop) | Unit + E2E |
| Answer auto-saved before navigate | `submitAnswer` (already wired, no change) | E2E (answer persistence test) |
| Previously answered Q shows answer | `QuestionDisplay` (existing, no change) | E2E |
| Question grid with numbered bubbles | `QuestionGrid` | Unit + E2E |
| Answered visual indicator | `QuestionGrid` (answered state) | Unit + E2E |
| Unanswered visual indicator | `QuestionGrid` (default state) | Unit |
| Current question highlighted | `QuestionGrid` (current state + aria-current) | Unit + E2E |
| Click bubble → jump to question | `navigateToQuestion`, `QuestionGrid.onQuestionClick` | Unit + E2E |
