# E15-S03: Display Timer Warnings at Key Thresholds

## Context

Story 15.3 adds toast notifications and enhanced ARIA announcements at timer thresholds (25%, 10%, 1 minute) for timed quizzes. The `QuizTimer` component already handles visual color transitions at these thresholds (E15-S01) and accommodations (E15-S02). This story adds the notification layer on top.

**Dependencies:** E15-S01 (done), E15-S02 (done) — both production-stable.

## Implementation Plan

### Task 1: Add `onWarning` callback to `useQuizTimer` hook

**File:** `src/hooks/useQuizTimer.ts`

**Changes:**
1. Add optional `onWarning` parameter: `(level: '25%' | '10%' | '1min', remainingSeconds: number) => void`
2. Add `warningsFiredRef = useRef({ twentyFivePercent: false, tenPercent: false, oneMinute: false })`
3. Reset `warningsFiredRef` when `initialSeconds` changes (alongside existing `hasFiredRef` reset)
4. Inside `recalculate()`, after computing `remaining`:
   - Guard: if `initialSeconds <= 0`, skip all warning logic (untimed mode)
   - Check `remaining / initialSeconds <= 0.25` → fire `onWarning('25%', remaining)` once
   - Check `remaining / initialSeconds <= 0.10` → fire `onWarning('10%', remaining)` once
   - Check `remaining <= 60` → fire `onWarning('1min', remaining)` once
5. Store `onWarning` in a ref (like `onExpireRef`) to avoid effect restarts

**Existing patterns to follow:**
- `onExpireRef` pattern at line 29-30 for stable callback reference
- `hasFiredRef` pattern at line 33 for single-fire guard
- Threshold math matches `QuizTimer.tsx` lines 25-26

### Task 2: Create `TimerWarnings.tsx` component

**File:** `src/app/components/quiz/TimerWarnings.tsx` (new)

**Component:** Renderless — only `sr-only` ARIA live regions in DOM.

```
Props:
- warningLevel: '25%' | '10%' | '1min' | null
- remainingSeconds: number
```

**Behavior:**
1. When `warningLevel` changes from null → a level, fire Sonner toast:
   - `'25%'`: `toast.info('{MM:SS} remaining', { duration: 3000 })`
   - `'10%'`: `toast.warning('Only {MM:SS} remaining!', { duration: 5000 })`
   - `'1min'`: `toast.warning('{MM:SS} remaining', { duration: Infinity })`
2. Use `formatTime()` from `useQuizTimer.ts` for MM:SS formatting
3. Render two `sr-only` ARIA regions:
   - `<div role="status" aria-live="polite" aria-atomic="true" className="sr-only">` — updated for 25% warning
   - `<div aria-live="assertive" aria-atomic="true" className="sr-only">` — updated for 10% and 1min warnings

**State management:** Use `useState` for `politeAnnouncement` and `assertiveAnnouncement` strings, updated via `useEffect` on warningLevel changes.

### Task 3: Integrate warnings in Quiz page

**File:** `src/app/pages/Quiz.tsx`

**Changes:**
1. Import `TimerWarnings` component
2. Add state: `const [warningState, setWarningState] = useState<{ level: '25%' | '10%' | '1min'; remaining: number } | null>(null)`
3. Create `handleTimerWarning` callback:
   ```
   const handleTimerWarning = useCallback((level, remaining) => {
     setWarningState({ level, remaining })
   }, [])
   ```
4. Pass `handleTimerWarning` as third arg to `useQuizTimer`:
   ```
   const timerRemaining = useQuizTimer(timerInitialSecondsRef.current, handleTimerExpiry, handleTimerWarning)
   ```
5. Render `<TimerWarnings warningLevel={warningState?.level ?? null} remainingSeconds={warningState?.remaining ?? 0} />` after `<QuizHeader />`

### Task 4: Update ATDD tests

**File:** `tests/e2e/story-15-3.spec.ts` (already created)

**Updates needed after implementation:**
- Update toast selectors to use `[data-sonner-toast]` pattern from existing toast tests (established in `toast-notifications.spec.ts`)
- Verify auto-dismiss timing assertions work with Sonner's actual behavior
- May need to adjust ARIA assertions based on actual rendered DOM structure

### Commit Sequence

1. Task 1: `feat(E15-S03): add onWarning callback to useQuizTimer hook`
2. Task 2: `feat(E15-S03): create TimerWarnings component with toasts and ARIA`
3. Task 3: `feat(E15-S03): integrate timer warnings in Quiz page`
4. Task 4: `test(E15-S03): update E2E tests for timer warnings`

## Key Files

| File | Action |
|------|--------|
| `src/hooks/useQuizTimer.ts` | Modify — add `onWarning` callback |
| `src/app/components/quiz/TimerWarnings.tsx` | Create — renderless toast + ARIA component |
| `src/app/pages/Quiz.tsx` | Modify — wire warnings |
| `tests/e2e/story-15-3.spec.ts` | Update — refine selectors |
| `src/app/components/quiz/QuizTimer.tsx` | No changes needed (color transitions already work) |

## Reusable Utilities

- `formatTime()` from `src/hooks/useQuizTimer.ts` (line 8-13) — MM:SS formatting
- `toast` from `sonner` — already imported in Quiz.tsx
- Sonner configured at `src/app/components/ui/sonner.tsx` — `bottom-right`, `richColors`, `closeButton`, design token styling
- `[data-sonner-toast]` selector pattern from `tests/e2e/toast-notifications.spec.ts`

## Verification

1. `npm run build` — no type errors
2. `npm run lint` — no ESLint violations
3. `npx playwright test tests/e2e/story-15-3.spec.ts --project chromium` — all ATDD tests pass
4. Manual: Start a timed quiz, fast-forward (or wait) → verify toasts appear at thresholds
5. Manual: Start untimed quiz → verify NO warnings appear
6. Screen reader test: VoiceOver on → verify announcements at thresholds
