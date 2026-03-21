# E13-S03: Pause and Resume Quiz — Implementation Plan

## Context

Story E13-S03 adds the ability for learners to pause a quiz and resume later without losing progress. **Key finding: ~80% of this functionality is already built** from E12-S03 (Zustand persist middleware), E13-S01 (navigation + resume button), and Quiz.tsx's `loadSavedProgress()`/`handleResume()` flow.

The remaining work is:
1. Accessibility: auto-focus Resume button on page load
2. Per-quiz localStorage backup for crash recovery (already exists — verify + harden)
3. Timer pause plumbing (future E15 uses this; wire up `isPaused` field)
4. Clear per-quiz localStorage on submission (prevent stale resume)
5. E2E tests (ATDD spec already created)

## What Already Works

| Feature | File | Status |
|---------|------|--------|
| Zustand persist middleware (`levelup-quiz-store` key) | `src/stores/useQuizStore.ts:233-266` | Done |
| `loadSavedProgress()` reads per-quiz localStorage | `src/app/pages/Quiz.tsx:37-53` | Done |
| `handleResume()` validates + restores state | `src/app/pages/Quiz.tsx:136-156` | Done |
| Resume button with answer count | `src/app/components/quiz/QuizStartScreen.tsx:51-60` | Done |
| Start Over with AlertDialog confirmation | `src/app/components/quiz/QuizStartScreen.tsx:61-89` | Done |
| Timer sync every 60s + visibility change | `src/app/components/quiz/QuizHeader.tsx:72-109` | Done |
| `submitQuiz` clears `currentProgress: null` | `src/stores/useQuizStore.ts:144-148` | Done |

## Implementation Tasks

### Task 1: Auto-focus Resume button (AC: accessibility)
**File:** `src/app/components/quiz/QuizStartScreen.tsx`

- Add `autoFocus` to the Resume `<Button>` when `hasResume` is true
- This satisfies: "Resume Quiz button has focus on page load if present"
- Screen reader already announces button text including answer count (button label = "Resume Quiz (X of Y answered)")

### Task 2: Save per-quiz localStorage on every answer (AC1: crash recovery)
**File:** `src/stores/useQuizStore.ts`

The Zustand persist middleware saves `currentProgress` to `levelup-quiz-store` key, but Quiz.tsx reads from a **different** per-quiz key (`quiz-progress-{quizId}`). Currently there's no code that writes to the per-quiz key during active quiz taking — it's only used as input for `loadSavedProgress()`.

**Fix:** In `submitAnswer()`, also write `currentProgress` to `quiz-progress-{quizId}` localStorage key. This provides crash recovery independent of Zustand's debounced persist.

```
submitAnswer → update Zustand state (auto-persisted to levelup-quiz-store)
           → also write to quiz-progress-{quizId} (explicit, synchronous)
```

Similarly, update `goToNextQuestion`, `goToPrevQuestion`, `navigateToQuestion`, and `toggleReviewMark` to sync per-quiz key.

**Better approach:** Create a helper `syncProgressToLocalStorage()` called from a Zustand `subscribe` listener that fires whenever `currentProgress` changes. This avoids duplicating the write in every action.

### Task 3: Clear per-quiz localStorage on submission (AC5)
**File:** `src/stores/useQuizStore.ts`

In `submitQuiz()`, after successful DB write and before setting `currentProgress: null`:
```ts
localStorage.removeItem(`quiz-progress-${currentQuiz.id}`)
```

This ensures returning to the quiz URL after completion shows "Start Quiz" not "Resume Quiz".

Also clear in `clearQuiz()` — but we need the quizId. Capture it before clearing state.

### Task 4: Timer pause plumbing (AC4)
**Files:** `src/stores/useQuizStore.ts`, `src/app/components/quiz/QuizHeader.tsx`

AC4 says: "time spent paused does NOT count toward quiz time." Timer UI is from E15 (backlog), but the plumbing should handle it now.

**QuizHeader already handles this implicitly:**
- Timer runs locally via `setInterval` in component state
- When user navigates away, `syncToStore()` fires on unmount (line 107) saving current `remainingSeconds / 60` to `timeRemaining`
- When user returns (resume), `QuizHeader` initializes from `progress.timeRemaining` (line 30-33)
- **Time while away does NOT count** because the interval isn't running

**No changes needed for timer.** The component-local timer already pauses implicitly when the component unmounts (navigation away). On resume, it reads the stored `timeRemaining` and starts fresh from there. The `isPaused` field is a future flag for an explicit pause button (E15 scope).

### Task 5: Add `beforeunload` safety net (AC1: crash recovery)
**File:** `src/app/pages/Quiz.tsx`

Add a `beforeunload` event listener when quiz is active that triggers a final sync of `currentProgress` to the per-quiz localStorage key. This catches tab close/crash scenarios where Zustand's debounced persist might not fire.

```ts
useEffect(() => {
  if (!isQuizActive) return
  const handleBeforeUnload = () => {
    const progress = useQuizStore.getState().currentProgress
    const quiz = useQuizStore.getState().currentQuiz
    if (progress && quiz) {
      localStorage.setItem(`quiz-progress-${quiz.id}`, JSON.stringify(progress))
    }
  }
  window.addEventListener('beforeunload', handleBeforeUnload)
  return () => window.removeEventListener('beforeunload', handleBeforeUnload)
}, [isQuizActive])
```

### Task 6: Unit tests
**File:** `src/stores/__tests__/useQuizStore.test.ts` (or new file)

- Verify `submitAnswer` persists progress to per-quiz localStorage key
- Verify `submitQuiz` clears per-quiz localStorage key
- Verify `loadSavedProgress()` returns null for completed quizzes

### Task 7: E2E tests — fix and verify ATDD spec
**File:** `tests/e2e/story-e13-s03.spec.ts` (already created)

The ATDD tests may need adjustments based on actual UI behavior:
- Verify navigation away → return → Resume button visible
- Verify Resume restores answers and question index
- Verify completed quiz → no Resume button
- Verify auto-focus on Resume button

## Files to Modify

| File | Change |
|------|--------|
| `src/app/components/quiz/QuizStartScreen.tsx` | Add `autoFocus` to Resume button |
| `src/stores/useQuizStore.ts` | Add subscribe listener for per-quiz localStorage sync; clear per-quiz key in `submitQuiz` and `clearQuiz` |
| `src/app/pages/Quiz.tsx` | Add `beforeunload` listener for crash recovery |
| `tests/e2e/story-e13-s03.spec.ts` | Verify/fix ATDD tests |

## Existing Utilities to Reuse

- `loadSavedProgress()` in Quiz.tsx:37 — already validates via `QuizProgressSchema.safeParse()`
- `handleResume()` in Quiz.tsx:136 — validates questionOrder integrity
- `persistWithRetry()` in `src/lib/persistWithRetry.ts` — retry pattern (not needed here, localStorage is sync)
- `makeProgress()` in `tests/support/fixtures/factories/quiz-factory.ts` — test factory
- `seedQuizData()` pattern from `tests/e2e/story-e13-s02.spec.ts` — quiz seeding helper

## Verification

1. `npm run build` — no type errors
2. `npm run lint` — no ESLint violations
3. `npx tsc --noEmit` — type check passes
4. `npx playwright test tests/e2e/story-e13-s03.spec.ts` — all ATDD tests pass
5. Manual test: start quiz → answer 2 questions → close tab → reopen → see Resume button with "2 of N answered" → click Resume → land on correct question with answers restored
6. Manual test: complete quiz → submit → return to quiz URL → see "Start Quiz" (no Resume)
