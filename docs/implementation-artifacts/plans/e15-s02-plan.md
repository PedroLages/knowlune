# E15-S02: Configure Timer Duration and Accommodations

## Context

Learners need to configure quiz timer durations with accessibility accommodations (standard, 150%, 200%, untimed) before starting a timed quiz. This supports WCAG 2.1 AA+ compliance and accessibility needs (QFR25, QFR26, QFR29). The infrastructure is ~70% built: `TimerAccommodation` type exists, `QuizProgress.timerAccommodation` field is populated (hardcoded to `'standard'`), and the store has a TODO comment at line 91 marking exactly where multiplier logic goes.

## Implementation Plan

### Task 1: Create `TimerAccommodationsModal` component
**File**: `src/app/components/quiz/TimerAccommodationsModal.tsx` (NEW)

- shadcn/ui `<Dialog>` (not AlertDialog) with controlled `open`/`onOpenChange`
- `<RadioGroup>` with 4 card-style options following E14 true/false pattern:
  - Standard time (`1.0`) — e.g. "15 minutes"
  - 150% extended (`1.5`) — e.g. "22 min 30 sec"
  - 200% extended (`2.0`) — e.g. "30 minutes"
  - Untimed (`untimed`) — "No time limit"
- Each label shows calculated time based on `baseTimeMinutes` prop
- Explanation text: "Extended time is available for learners who need additional time due to disabilities or other needs."
- Save button (`variant="brand"`) calls `onSave(accommodation)`
- Props: `open`, `onOpenChange`, `baseTimeMinutes: number`, `value: TimerAccommodation`, `onSave: (v: TimerAccommodation) => void`
- Radio options: `min-h-12` touch targets, `rounded-xl`, `border-brand bg-brand-soft` selected state
- `aria-label="Timer accommodation"` on RadioGroup

**Reuse**: `Dialog`, `DialogContent`, `DialogTitle`, `DialogDescription` from `src/app/components/ui/dialog.tsx`; `RadioGroup`, `RadioGroupItem` from `src/app/components/ui/radio-group.tsx`; `Button` from `src/app/components/ui/button.tsx`; `TimerAccommodation` type from `src/types/quiz.ts`

### Task 2: Add accommodation button + modal to `QuizStartScreen`
**File**: `src/app/components/quiz/QuizStartScreen.tsx` (MODIFY)

- Add new props: `accommodation: TimerAccommodation`, `onAccommodationChange: (v: TimerAccommodation) => void`
- Add local state: `const [modalOpen, setModalOpen] = useState(false)`
- After metadata badges row (line 66), add "Accessibility Accommodations" button:
  - `<Button variant="link" size="sm">` with `Clock` icon from lucide-react
  - Only render when `quiz.timeLimit != null`
- Render `<TimerAccommodationsModal>` with controlled state
- Update time badge to show adjusted time when accommodation is not `'standard'`:
  - `'150%'` → show `22 min 30 sec` with `bg-brand-soft text-brand-soft-foreground`
  - `'200%'` → show `30 min`
  - `'untimed'` → show `Untimed`

### Task 3: Wire accommodation through `Quiz.tsx`
**File**: `src/app/pages/Quiz.tsx` (MODIFY)

- Add local state: `const [accommodation, setAccommodation] = useState<TimerAccommodation>('standard')`
- On mount (in the Dexie fetch effect), load saved preference from localStorage:
  ```
  const saved = localStorage.getItem(`quiz-accommodation-${lessonId}`)
  // Validate with TimerAccommodationEnum.safeParse()
  ```
- Pass `accommodation` and `setAccommodation` to `<QuizStartScreen>`
- When `onAccommodationChange` fires, persist to localStorage: `localStorage.setItem('quiz-accommodation-${lessonId}', value)`
- Modify `handleStart()` to pass accommodation to store (see Task 4)

### Task 4: Apply accommodation multiplier in `useQuizStore.startQuiz()`
**File**: `src/stores/useQuizStore.ts` (MODIFY)

- Change `startQuiz` signature: `startQuiz: (lessonId: string, accommodation?: TimerAccommodation) => Promise<void>`
- Replace lines 91-96 (the TODO section) with:
  ```typescript
  const acc = accommodation ?? 'standard'
  const multiplier = acc === '150%' ? 1.5 : acc === '200%' ? 2 : 1
  const timeRemaining = acc === 'untimed' ? null : (quiz.timeLimit != null ? quiz.timeLimit * multiplier : null)
  ```
- Set `progress.timeRemaining = timeRemaining` and `progress.timerAccommodation = acc`
- Update `retakeQuiz` to also accept accommodation param and forward to `startQuiz`
- Update `QuizState` interface for the new signature

### Task 5: Add annotation to `QuizTimer` and `QuizHeader`
**File**: `src/app/components/quiz/QuizTimer.tsx` (MODIFY)
- Add optional `annotation?: string` prop
- Render after time digits: `{annotation && <span className="text-muted-foreground text-xs ml-1">({annotation})</span>}`
- Include annotation in screen reader live region
- Add `data-testid="quiz-timer"` to the timer div (needed by E2E tests)

**File**: `src/app/components/quiz/QuizHeader.tsx` (MODIFY)
- Pass `annotation` prop to `<QuizTimer>` based on `progress.timerAccommodation`:
  - `'standard'` → no annotation (undefined)
  - `'150%'` or `'200%'` → `"Extended Time"`
- For untimed: timer already hidden (line 24 checks `timeRemaining !== null`)

### Task 6: Handle untimed mode in `Quiz.tsx`
**File**: `src/app/pages/Quiz.tsx` (MODIFY)

- `timerInitialSecondsRef` already handles `timeRemaining === null` (results in 0 → timer disabled)
- `totalTimeSeconds` already handles `timeLimit === null` (results in 0)
- The `useQuizTimer(0, ...)` returns 0 and never fires — timer UI correctly hidden
- No code changes needed for untimed: timer is already conditionally rendered (QuizHeader line 24)
- **One change**: When untimed accommodation is selected but quiz HAS a timeLimit, ensure `timerInitialSecondsRef.current` stays 0. Currently line 224 checks `currentQuiz?.timeLimit != null` — this is about the quiz definition, not the accommodation. Need to also check `currentProgress.timerAccommodation !== 'untimed'`

### Task 7: E2E tests (already created)
**File**: `tests/e2e/story-e15-s02.spec.ts` (EXISTS — may need minor adjustments after implementation)

- 5 tests covering AC1-AC5
- Run after implementation to verify all pass

## Files Modified (Summary)

| File | Action | Lines Changed (est.) |
|------|--------|---------------------|
| `src/app/components/quiz/TimerAccommodationsModal.tsx` | CREATE | ~120 |
| `src/app/components/quiz/QuizStartScreen.tsx` | MODIFY | ~30 |
| `src/app/pages/Quiz.tsx` | MODIFY | ~25 |
| `src/stores/useQuizStore.ts` | MODIFY | ~15 |
| `src/app/components/quiz/QuizTimer.tsx` | MODIFY | ~8 |
| `src/app/components/quiz/QuizHeader.tsx` | MODIFY | ~5 |
| `tests/e2e/story-e15-s02.spec.ts` | EXISTS | minor adjustments |

## Implementation Order

1. Task 4 (store multiplier) — core business logic, no UI dependencies
2. Task 1 (modal component) — self-contained new component
3. Task 5 (timer annotation) — small changes, enables visual feedback
4. Task 2 (QuizStartScreen integration) — connects modal to start screen
5. Task 3 (Quiz.tsx wiring + persistence) — ties everything together
6. Task 6 (untimed guard) — edge case fix
7. Task 7 (run E2E tests) — validate all ACs

Commit after each task as a save point.

## Verification

1. `npm run build` — no type errors
2. `npm run lint` — no ESLint violations (design tokens, no hardcoded colors)
3. `npx playwright test tests/e2e/story-e15-s02.spec.ts --project=chromium` — all 5 AC tests pass
4. Manual testing:
   - Open a timed quiz → see "Accessibility Accommodations" link
   - Select 150% → start → timer shows 22:30 (Extended Time)
   - Select Untimed → start → no timer visible
   - Complete quiz → retake → preference pre-selected
   - Untimed quiz (timeLimit: null) → no accommodations button shown
