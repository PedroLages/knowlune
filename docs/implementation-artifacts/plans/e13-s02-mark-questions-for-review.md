# Implementation Plan: E13-S02 — Mark Questions For Review

**Story:** [13-2-mark-questions-for-review.md](../13-2-mark-questions-for-review.md)
**Epic:** 13 — Navigate and Control Quiz Flow
**Complexity:** Small (2–3 hours)
**Date:** 2026-03-20

---

## Context & Pre-existing Work

### Already done (no changes needed)

| Item | File | Status |
|------|------|--------|
| `QuizProgress.markedForReview: string[]` | `src/types/quiz.ts:217` | ✅ exists |
| `toggleReviewMark(questionId)` store action | `src/stores/useQuizStore.ts:207` | ✅ exists |
| Unit tests for `toggleReviewMark` | `src/stores/__tests__/useQuizStore.test.ts:432` | ✅ exists |

### Required from E13-S01 (unmerged branch)

These components exist on `feature/e13-s01-navigate-between-questions` but **not on `main`**:

| Component | E13-S01 file |
|-----------|--------------|
| `QuizNavigation.tsx` | Composes QuizActions + QuestionGrid |
| `QuestionGrid.tsx` | Numbered circle buttons with answered/current state |
| `QuizActions.tsx` | Previous/Next/Submit buttons |

**Branch strategy decision (required before implementation):**

- **Option A (recommended):** Merge E13-S01 PR into `main` first, then rebase `feature/e13-s02-*` on `main`
- **Option B:** Rebase `feature/e13-s02-*` on top of `feature/e13-s01-*` (avoids waiting for merge, but creates a chained branch)

The plan below assumes Option A (E13-S01 merged). If Option B, adjust base branch accordingly.

---

## Implementation Steps

### Step 1: Verify E13-S01 components are available

After merging/rebasing:
- Confirm `src/app/components/quiz/QuestionGrid.tsx` exists
- Confirm `src/app/components/quiz/QuizNavigation.tsx` exists
- Run `npm run build` to confirm no TS errors

### Step 2: Extend QuestionGrid with review indicator

**File:** `src/app/components/quiz/QuestionGrid.tsx`

Add `markedForReview: string[]` to `QuestionGridProps`. For each button, check if `questionId` is in `markedForReview` and overlay a small icon:

```tsx
// Add to interface:
markedForReview: string[]

// Inside the map:
const isMarked = questionId ? markedForReview.includes(questionId) : false

// Inside the button, conditional overlay:
{isMarked && (
  <span className="absolute -top-1 -right-1" aria-hidden="true">
    <Bookmark className="size-3 fill-warning text-warning" />
  </span>
)}
// Button needs `relative` class added
// aria-label update:
aria-label={`Question ${i + 1}${isMarked ? ', marked for review' : ''}`}
```

**Unit tests to add/update** (`src/app/components/quiz/__tests__/QuestionGrid.test.tsx`):
- Renders Bookmark icon when question is in `markedForReview`
- Does not render icon when not marked
- `aria-label` includes "marked for review" text when marked

### Step 3: Thread markedForReview through QuizNavigation

**File:** `src/app/components/quiz/QuizNavigation.tsx`

QuestionGrid already receives `answers` and `questionOrder` from `progress`. Add `markedForReview` from `progress.markedForReview`:

```tsx
// QuizNavigation already has `progress: QuizProgress`
// Just pass it to QuestionGrid:
<QuestionGrid
  ...
  markedForReview={progress.markedForReview}
/>
```

**Unit tests to update** (`src/app/components/quiz/__tests__/QuizNavigation.test.tsx`):
- Passes `markedForReview` prop to QuestionGrid (spy/mock check)

### Step 4: Create MarkForReview component

**New file:** `src/app/components/quiz/MarkForReview.tsx`

```tsx
import { Bookmark } from 'lucide-react'
import { Checkbox } from '@/app/components/ui/checkbox'
import { Label } from '@/app/components/ui/label'

interface MarkForReviewProps {
  questionId: string
  isMarked: boolean
  onToggle: () => void
}

export function MarkForReview({ questionId, isMarked, onToggle }: MarkForReviewProps) {
  const id = `mark-review-${questionId}`
  return (
    <div className="flex items-center gap-2 mt-4">
      <Checkbox
        id={id}
        checked={isMarked}
        onCheckedChange={onToggle}
        aria-describedby={`${id}-label`}
      />
      <Label
        id={`${id}-label`}
        htmlFor={id}
        className="text-sm text-muted-foreground cursor-pointer flex items-center gap-1.5 select-none"
      >
        <Bookmark className="size-3.5" aria-hidden="true" />
        Mark for Review
      </Label>
    </div>
  )
}
```

**Unit tests** (`src/app/components/quiz/__tests__/MarkForReview.test.tsx`):
- Renders unchecked by default when `isMarked=false`
- Renders checked when `isMarked=true`
- Calls `onToggle` when checkbox clicked
- Keyboard: Space key toggles (shadcn Checkbox handles this natively)

### Step 5: Integrate MarkForReview into Quiz.tsx

**File:** `src/app/pages/Quiz.tsx`

In the active quiz render section:
1. Import `MarkForReview`
2. Import `selectCurrentProgress` (already imported)
3. After `QuestionDisplay`, before the navigation footer:

```tsx
import { MarkForReview } from '@/app/components/quiz/MarkForReview'

// In active quiz section, after QuestionDisplay:
{currentQuestionId && (
  <MarkForReview
    questionId={currentQuestionId}
    isMarked={currentProgress.markedForReview.includes(currentQuestionId)}
    onToggle={() => toggleReviewMark(currentQuestionId)}
  />
)}
```

4. Wire `toggleReviewMark` from store:
```tsx
const toggleReviewMark = useQuizStore(s => s.toggleReviewMark)
```

5. Pass `markedForReview` to QuizNavigation (which then passes to QuestionGrid):
The `progress` object already passes through — QuizNavigation reads `progress.markedForReview` directly (Step 3).

### Step 6: Create ReviewSummary component

**New file:** `src/app/components/quiz/ReviewSummary.tsx`

Show when there are marked questions — used inside the submit dialog:

```tsx
interface ReviewSummaryProps {
  markedForReview: string[]
  questionOrder: string[]
  onJumpToQuestion: (index: number) => void
}

export function ReviewSummary({ markedForReview, questionOrder, onJumpToQuestion }: ReviewSummaryProps) {
  if (markedForReview.length === 0) return null

  const markedIndices = markedForReview
    .map(id => questionOrder.indexOf(id))
    .filter(i => i !== -1)
    .sort((a, b) => a - b)

  return (
    <div className="mt-3" aria-label="Questions marked for review">
      <p className="text-sm font-medium mb-1.5">
        {markedForReview.length} {markedForReview.length === 1 ? 'question' : 'questions'} marked for review:
      </p>
      <ul className="flex flex-wrap gap-2" role="list">
        {markedIndices.map(i => (
          <li key={i}>
            <button
              onClick={() => onJumpToQuestion(i)}
              className="text-sm text-brand hover:underline underline-offset-2 min-h-[44px] px-2"
            >
              Q{i + 1}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

**Unit tests** (`src/app/components/quiz/__tests__/ReviewSummary.test.tsx`):
- Returns null when `markedForReview` is empty
- Shows correct count ("3 questions marked for review")
- Renders correct question numbers (1-indexed)
- Calls `onJumpToQuestion` with correct index on button click

### Step 7: Integrate ReviewSummary into submit dialog

**File:** `src/app/pages/Quiz.tsx`

In the `AlertDialogDescription` or below it, add `ReviewSummary`:

```tsx
import { ReviewSummary } from '@/app/components/quiz/ReviewSummary'

// Import navigateToQuestion from store:
const navigateToQuestion = useQuizStore(s => s.navigateToQuestion)  // from E13-S01

// In AlertDialogContent, after unanswered count message:
<ReviewSummary
  markedForReview={currentProgress.markedForReview}
  questionOrder={currentProgress.questionOrder}
  onJumpToQuestion={(idx) => {
    navigateToQuestion(idx)
    setShowSubmitDialog(false)
  }}
/>
```

**Note on `navigateToQuestion`:** This action was added in E13-S01. Verify it's available after merge/rebase.

### Step 8: Write E2E tests

**New file:** `tests/e2e/story-e13-s02.spec.ts`

```
Test: mark for review toggle
  - Navigate to quiz, answer Q1
  - Click "Mark for Review" → checkbox checked, Q1 circle shows Bookmark icon
  - Click again → unchecked, icon gone

Test: review indicator persists on navigation
  - Mark Q1, navigate to Q2
  - Navigate back to Q1 → still marked
  - Q1 grid button still shows indicator

Test: mark multiple questions
  - Mark Q1, Q3 → both show indicators in grid
  - Q2 shows no indicator

Test: submit dialog shows review summary
  - Mark Q2, click Submit Quiz (on last Q)
  - Dialog shows "1 question marked for review: Q2"
  - Click Q2 link → dialog closes, navigated to Q2
```

**E2E seeding pattern** (from story-12-6.spec.ts):
- Use `makeQuiz` and `makeQuestion` factories
- Seed IndexedDB via `page.evaluate` with retry loop
- Seed localStorage sidebar: `localStorage.setItem('knowlune-sidebar-v1', 'false')`

---

## Files to Create

| File | Type | Purpose |
|------|------|---------|
| `src/app/components/quiz/MarkForReview.tsx` | New | "Mark for Review" checkbox toggle |
| `src/app/components/quiz/ReviewSummary.tsx` | New | Pre-submit list of marked questions |
| `src/app/components/quiz/__tests__/MarkForReview.test.tsx` | New | Unit tests for MarkForReview |
| `src/app/components/quiz/__tests__/ReviewSummary.test.tsx` | New | Unit tests for ReviewSummary |
| `tests/e2e/story-e13-s02.spec.ts` | New | E2E tests |

## Files to Modify

| File | Change | Depends on |
|------|--------|------------|
| `src/app/components/quiz/QuestionGrid.tsx` | Add `markedForReview` prop + Bookmark overlay | E13-S01 merge |
| `src/app/components/quiz/QuizNavigation.tsx` | Thread `markedForReview` to QuestionGrid | E13-S01 merge |
| `src/app/components/quiz/__tests__/QuestionGrid.test.tsx` | Tests for review indicator | E13-S01 merge |
| `src/app/components/quiz/__tests__/QuizNavigation.test.tsx` | Tests for prop threading | E13-S01 merge |
| `src/app/pages/Quiz.tsx` | Add MarkForReview, ReviewSummary, toggleReviewMark | E13-S01 merge |

---

## Risk & Edge Cases

| Risk | Mitigation |
|------|-----------|
| E13-S01 not merged | Cannot modify QuestionGrid — must merge first or use Option B (chained branch) |
| `navigateToQuestion` from E13-S01 | Only available after E13-S01 merge; ReviewSummary jump links depend on it |
| Marked review persists across sessions (localStorage) | Already handled — `markedForReview` is in persisted QuizProgress slice |
| Quiz with only 1 question | ReviewSummary handles empty list (`if length === 0 return null`) |
| Question ID not found in questionOrder | `indexOf` returns -1, filtered out before rendering |

---

## Acceptance Criteria Traceability

| AC | Tasks |
|----|-------|
| "Mark for Review" toggle visible on each question | Task 4 (MarkForReview.tsx) + Task 5 (Quiz.tsx integration) |
| Toggle on/off by clicking/tapping | Task 4 (Checkbox component, onCheckedChange) |
| Visual indicator in navigation grid for marked questions | Task 2 (QuestionGrid extension) + Task 3 (QuizNavigation threading) |
| Mark persists when navigating away and returning | Inherent — QuizProgress.markedForReview already in Zustand persist |
| All marked questions show indicators | Task 2 (maps over markedForReview array) |
| Jump to any marked question from grid | Task 2 (grid buttons still clickable) |
| Clear mark by toggling off | Task 4 (toggle logic calls toggleReviewMark which removes ID) |
| Pre-submit list of marked questions with jump links | Task 6 (ReviewSummary.tsx) + Task 7 (dialog integration) |
| Count display (e.g., "3 questions marked") | Task 6 (ReviewSummary renders count) |
