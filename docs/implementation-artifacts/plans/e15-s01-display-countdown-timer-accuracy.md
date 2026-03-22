# E15-S01: Display Countdown Timer with Accuracy

## Context

The existing `QuizHeader.tsx` has a basic countdown timer using naive `setInterval` decrement (line 48-62). This drifts when browser tabs are hidden because `setInterval` gets throttled. Story E15-S01 replaces this with a `Date.now()`-anchored pattern, adds color transitions at warning thresholds, and implements auto-submit on expiry.

**Dependencies:** E12-S03 (useQuizStore) and E12-S04 (QuizHeader) — both done.

## Build Sequence

### Task 1: Create `useQuizTimer` hook
**File:** `src/hooks/useQuizTimer.ts` (NEW)

- Hook signature: `useQuizTimer(initialSeconds: number, onExpire: () => void) => number`
- Anchors to `Date.now()` — calculates `endTime = Date.now() + initialSeconds * 1000`
- `setInterval(1000)` recalculates remaining from `endTime - Date.now()` (no drift)
- Listens for `visibilitychange` — recalculates on tab return
- Fires `onExpire` via ref when remaining hits 0
- Move `formatTime()` from QuizHeader.tsx:11-15 into this file as an exported utility
- Returns `timeRemaining` in seconds

### Task 2: Create `QuizTimer` component
**File:** `src/app/components/quiz/QuizTimer.tsx` (NEW)

- Props: `timeRemaining: number`, `totalTime: number`
- Renders `<div role="timer" aria-label="Time remaining">`
- Uses `cn()` for conditional color classes:
  - Default: `text-muted-foreground` (>25% remaining)
  - Warning: `text-warning` (≤25% remaining)
  - Urgent: `text-destructive` (≤10% remaining)
- Add `transition-colors duration-300` for smooth transitions
- Typography: `font-mono text-sm sm:text-base font-semibold tabular-nums`
- Screen reader: keep dual-element pattern — visual timer + sr-only `aria-live="polite"` region announcing per-minute
- Add threshold announcements at 25% and 10% boundaries

### Task 3: Refactor `QuizHeader.tsx`
**File:** `src/app/components/quiz/QuizHeader.tsx` (MODIFY)

- Remove: lines 11-21 (`formatTime`, `formatMinuteAnnouncement`), lines 30-67 (timer state + countdown useEffect), lines 74-109 (store sync useEffect), lines 115-128 (timer JSX)
- Import `QuizTimer` component
- Render `<QuizTimer>` in the header flex row (right-aligned, replacing the old `<span>`)
- Pass `timeRemaining` and `totalTime` from progress/quiz props
- **Do NOT** add `useQuizTimer` hook here — the hook will be called from `Quiz.tsx` page to enable auto-submit wiring

### Task 4: Wire timer + auto-submit in `Quiz.tsx`
**File:** `src/app/pages/Quiz.tsx` (MODIFY)

- Import `useQuizTimer` from `@/hooks/useQuizTimer`
- Call hook when quiz has a time limit: `const timeRemaining = useQuizTimer(initialSeconds, handleTimerExpiry)`
- `handleTimerExpiry` callback:
  1. Call `submitQuiz(courseId)` (same as existing submit flow)
  2. Show `toast.error("Time's up! Your quiz has been submitted.")`
  3. Navigate to results page
- Pass `timeRemaining` down to `QuizHeader` → `QuizTimer`
- Convert `quiz.timeLimit` (minutes) to seconds for hook: `quiz.timeLimit * 60`
- If `progress.timeRemaining` is set (resumed quiz), use that instead: `progress.timeRemaining * 60`

### Task 5: Update `QuizHeader` props
**File:** `src/app/components/quiz/QuizHeader.tsx` (MODIFY — part of Task 3)

- Add `timeRemaining: number | null` and `totalTimeSeconds: number | null` to `QuizHeaderProps`
- Remove internal timer state management entirely
- QuizHeader becomes a pure display component for the timer

### Task 6: Store sync on visibility change
**File:** `src/hooks/useQuizTimer.ts` (part of Task 1)

- Keep the pattern from QuizHeader:74-109 — sync `timeRemaining` back to store via `useQuizStore.setState()` every 60s and on `visibilitychange`
- Convert seconds back to minutes for storage (`remaining / 60`)
- This ensures crash recovery restores correct time

### Task 7: Unit tests
**Files:**
- `src/hooks/__tests__/useQuizTimer.test.ts` (NEW) — test countdown, expiry callback, formatTime
- Use `vi.useFakeTimers()` + `vi.advanceTimersByTime()` for deterministic testing

### Task 8: E2E tests
**File:** `tests/e2e/story-15-1.spec.ts` (ALREADY CREATED — verify/fix as needed)

- Run the ATDD tests after implementation
- Fix any selector mismatches based on actual component output

## Critical Files

| File | Action | Purpose |
|------|--------|---------|
| `src/hooks/useQuizTimer.ts` | CREATE | Date.now()-anchored timer hook |
| `src/app/components/quiz/QuizTimer.tsx` | CREATE | Timer display with color transitions |
| `src/app/components/quiz/QuizHeader.tsx` | MODIFY | Remove old timer, use new QuizTimer |
| `src/app/pages/Quiz.tsx` | MODIFY | Wire hook + auto-submit |
| `src/hooks/__tests__/useQuizTimer.test.ts` | CREATE | Unit tests |
| `tests/e2e/story-15-1.spec.ts` | EXISTS | ATDD E2E tests |

## Reuse Inventory

| Existing Code | Location | How to Reuse |
|---------------|----------|-------------|
| `formatTime()` | QuizHeader.tsx:11-15 | Move to useQuizTimer.ts, export |
| `formatMinuteAnnouncement()` | QuizHeader.tsx:17-21 | Move to QuizTimer.tsx |
| Store sync pattern | QuizHeader.tsx:74-109 | Adapt into useQuizTimer hook |
| `submitQuiz(courseId)` | useQuizStore.ts:117 | Call from Quiz.tsx on expiry |
| `toastError` helpers | src/lib/toastHelpers.ts | Use for expiry toast (or inline toast.error) |
| `QuizProgress.timeRemaining` | types/quiz.ts:215 | Already in minutes, convert to/from seconds |
| `makeQuiz({ timeLimit })` | quiz-factory.ts | Test data already supports timed quizzes |

## Verification

1. `npm run build` — no type errors
2. `npm run lint` — no ESLint violations
3. `npx vitest run src/hooks/__tests__/useQuizTimer.test.ts` — unit tests pass
4. `npx playwright test tests/e2e/story-15-1.spec.ts --project chromium` — E2E tests pass
5. Manual: Start a timed quiz → timer counts down → switch tabs → return → no drift → wait for expiry → auto-submit + toast
