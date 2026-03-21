# E13-S04: Unlimited Quiz Retakes — Implementation Plan

## Context

Learners should be able to retake quizzes unlimited times and see their improvement. The `retakeQuiz` action and "Retake Quiz" button already exist from E12-S03/E12-S06 — this story enhances the flow with improvement tracking (previous best vs. current) and lesson page integration.

**Dependencies (all done):** E12-S03 (useQuizStore), E12-S06 (QuizResults page), E13-S01 (navigation)

## Tasks

### Task 1: Add `previousBestPercentage` to ScoreSummary

**File:** `src/app/components/quiz/ScoreSummary.tsx`

- Add optional prop `previousBestPercentage?: number`
- Below the "Completed in..." line, render improvement comparison when `previousBestPercentage` is defined:
  - `"Previous best: {X}%"` in `text-muted-foreground`
  - If current > previous: `"+{delta}%"` in `text-success font-semibold`
  - If current === previous: `"Same as best"` in `text-muted-foreground`
  - If current < previous: show previous best only (no negative delta — never discouraging)
- Add sr-only text within the existing `aria-live="polite"` region: `"Improved by {delta} percentage points from previous best of {X} percent"`
- Keep component size small — no new sub-components

### Task 2: Wire improvement data in QuizResults

**File:** `src/app/pages/QuizResults.tsx`

- Compute `previousBestPercentage` from `attempts` array (all attempts except the last one):
  ```ts
  const previousBest = useMemo(() => {
    if (attempts.length <= 1) return undefined
    return Math.max(...attempts.slice(0, -1).map(a => a.percentage))
  }, [attempts])
  ```
- Pass `previousBestPercentage={previousBest}` to `<ScoreSummary>`
- Promote "Retake Quiz" button from `variant="outline"` to `variant="brand"` (primary growth CTA)
- Change "Review Answers" to `variant="brand-outline"` (secondary)

### Task 3: Update QuizStartScreen for "Retake Quiz" label (AC4)

**File:** `src/app/components/quiz/QuizStartScreen.tsx`

The QuizStartScreen is the landing page at `/courses/:courseId/lessons/:lessonId/quiz`. Currently shows "Start Quiz" button (line 98). When the user has completed the quiz before, it should say "Retake Quiz" instead.

**Approach:**
- Add optional prop `hasCompletedBefore?: boolean` to `QuizStartScreenProps`
- When `hasCompletedBefore && !hasResume`: show "Retake Quiz" instead of "Start Quiz"
- When `hasResume`: keep existing "Resume Quiz" behavior (takes priority over retake)
- In `Quiz.tsx`: query Dexie for existing attempts on mount (alongside the existing quiz fetch), pass `hasCompletedBefore` to `QuizStartScreen`
  - Use `db.quizAttempts.where('quizId').equals(quiz.id).count()` to check
  - This is lightweight (count query, no data loaded)

### Task 4: Add "View All Attempts" placeholder (AC3)

**File:** `src/app/pages/QuizResults.tsx`

- Add a text link below the action buttons: "View All Attempts" styled like "Back to Lesson" (`text-brand hover:underline text-sm`)
- Since Story 16.1 implements the full history view, this link should either:
  - Show as disabled/muted text: "View All Attempts (Coming Soon)" in `text-muted-foreground`
  - Or be omitted entirely per YAGNI principle
- **Decision:** Show the link as a disabled span — matches AC3 requirement "I can click 'View All Attempts' to see full history (Story 16.1)" while being honest about upcoming availability

### Task 5: Update E2E tests

**File:** `tests/e2e/story-13-4.spec.ts` (already created during ATDD step)

- Tests are already written. After implementation, verify they pass:
  - AC1: Retake button visible, no limit messaging
  - AC1b: Clicking retake starts fresh attempt
  - AC2: Answers cleared on retake
  - AC3: Improvement summary with previous best
  - AC4: Lesson page shows "Retake Quiz" for completed quizzes
- May need to adjust selectors based on actual implementation

### Task 6: Unit tests for improvement calculation

**File:** `src/app/pages/__tests__/QuizResults.test.tsx` (extend existing)

- Test `previousBest` calculation: 0 attempts → undefined, 1 attempt → undefined, 2+ attempts → max of previous
- Test ScoreSummary rendering with/without `previousBestPercentage`

## File Changes Summary

| File | Change |
|------|--------|
| `src/app/components/quiz/ScoreSummary.tsx` | Add `previousBestPercentage` prop + improvement display |
| `src/app/pages/QuizResults.tsx` | Compute previousBest, pass to ScoreSummary, swap button variants |
| `src/app/components/quiz/QuizStartScreen.tsx` | Conditional "Retake Quiz" vs "Start Quiz" label |
| `src/app/pages/Quiz.tsx` | Query attempt count, pass `hasCompletedBefore` to QuizStartScreen |
| `src/app/pages/__tests__/QuizResults.test.tsx` | Unit tests for improvement calculation |
| `tests/e2e/story-13-4.spec.ts` | Already created — verify/adjust after implementation |

## Implementation Order

1. ScoreSummary enhancement (Task 1) — pure presentational, testable in isolation
2. QuizResults wiring (Tasks 2 + 4) — connects data to presentation
3. QuizStartScreen label (Task 3) — independent UI change
4. Unit tests (Task 6) — validate logic
5. E2E verification (Task 5) — end-to-end validation

## Verification

1. `npm run build` — no type/build errors
2. `npm run lint` — no design token violations
3. `npx vitest run --reporter=verbose` — unit tests pass
4. `npx playwright test tests/e2e/story-13-4.spec.ts --project=chromium` — E2E tests pass
5. Manual: Complete a quiz → see results → click Retake → complete again → see improvement summary
