# Implementation Plan: E16-S02 — Display Score History Across All Attempts

**Story:** [16-2-display-score-history-across-all-attempts.md](../16-2-display-score-history-across-all-attempts.md)
**Branch:** `feature/e16-s02-display-score-history-across-all-attempts`
**Date:** 2026-03-22
**Complexity:** Medium (3-4 hours)

---

## Overview

Replace the disabled "View All Attempts (Coming Soon)" placeholder in `QuizResults.tsx` with a functional, collapsible attempt history component (`AttemptHistory`). The store's `loadAttempts` action already exists but has a sort-order bug (oldest-first instead of most-recent-first). This story fixes that and builds the UI.

---

## Codebase Context

### What Already Exists

| Item | Location | Status |
|------|----------|--------|
| `useQuizStore.loadAttempts` | `src/stores/useQuizStore.ts:195` | EXISTS — returns oldest-first (bug) |
| `selectAttempts` selector | `src/stores/useQuizStore.ts:355` | EXISTS |
| `QuizResults` page | `src/app/pages/QuizResults.tsx` | EXISTS — placeholder at line 161 |
| `Collapsible` component | `src/app/components/ui/collapsible.tsx` | EXISTS (Radix UI) |
| `Table` components | `src/app/components/ui/table.tsx` | EXISTS |
| `formatDuration` | `src/lib/formatDuration.ts` | EXISTS |
| `makeAttempt` factory | `tests/support/fixtures/factories/quiz-factory.ts:45` | EXISTS |
| `FIXED_DATE` | `tests/utils/test-time.ts` | EXISTS |
| `success-soft` token | `src/styles/theme.css:34` | EXISTS |
| `brand-soft` token | `src/styles/theme.css` | EXISTS |

### Key Gap: Sort Order

`loadAttempts` (line 200) calls `.sortBy('completedAt')` which returns ascending (oldest-first). The spec requires most-recent-first. Fix: add `.reverse()` after the Dexie query.

### Key Gap: E16-S01 Dependency

The "Review" button per attempt should navigate to `/courses/:courseId/lessons/:lessonId/quiz/review/:attemptId` (E16-S01's route). Since E16-S01 is not yet implemented, this button shows a `toast.info('Review mode coming soon.')` until E16-S01 is merged.

---

## Implementation Steps

### Step 1: Fix `loadAttempts` Sort Order

**File:** `src/stores/useQuizStore.ts`

**Change:** Add `.reverse()` after `.sortBy('completedAt')`:

```typescript
loadAttempts: async (quizId: string) => {
  try {
    const attempts = await db.quizAttempts
      .where('quizId')
      .equals(quizId)
      .sortBy('completedAt')
    attempts.reverse()  // Most recent first
    set({ attempts })
  } catch (err) {
    console.error('[useQuizStore] loadAttempts failed:', err)
    set({ error: 'Failed to load quiz history' })
  }
},
```

**Unit test:** `src/app/components/quiz/__tests__/AttemptHistory.test.tsx` (or a store test) — mock `db.quizAttempts` and verify output is reversed.

---

### Step 2: Create `AttemptHistory` Component

**File to create:** `src/app/components/quiz/AttemptHistory.tsx`

**Props interface:**
```typescript
interface AttemptHistoryProps {
  attempts: QuizAttempt[]        // Already sorted most-recent-first
  currentAttemptId: string       // ID of the current (just-completed) attempt
  courseId: string               // For navigation
  lessonId: string               // For navigation
}
```

**Layout decisions:**

1. **Collapsible trigger:** `Button variant="link"` with text:
   `View Attempt History ({n} attempt{n !== 1 ? 's' : ''})`

2. **Desktop (≥640px):** `<Table>` with columns:
   - `Attempt` → `#{attempts.length - index}` (most recent = highest number)
   - `Date` → `new Date(attempt.completedAt).toLocaleString()` (readable date+time)
   - `Score` → `{attempt.percentage}%`
   - `Time` → `formatDuration(attempt.timeSpent)`
   - `Status` → Passed / Not Passed badge
   - Review → `Button variant="ghost" size="sm"`

3. **Mobile (<640px):** `<div className="sm:hidden space-y-3">` with card-per-attempt layout. Each card shows all fields stacked vertically.

4. **Attempt numbering:** `#N` where N = `attempts.length - index` — since the array is most-recent-first, `index=0` gets the highest number.

5. **Current attempt highlight:** Table row gets `className={attempt.id === currentAttemptId ? 'bg-brand-soft' : ''}` + a "Current" badge next to the attempt number.

6. **Passed badge:** `<span className="bg-success-soft text-success rounded-full px-2 py-0.5 text-xs font-medium">Passed</span>`

7. **Not Passed badge:** `<span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs font-medium">Not Passed</span>`

8. **Review button handler:**
   ```typescript
   const handleReview = useCallback((attemptId: string) => {
     // E16-S01 will implement the review route
     toast.info('Review mode coming soon.')
   }, [])
   ```

9. **Accessibility:**
   - `<th scope="col">` on each header
   - Collapsible uses Radix `CollapsibleTrigger` (handles `aria-expanded` automatically)
   - Table has an `aria-label="Quiz attempt history"` or caption

---

### Step 3: Integrate into `QuizResults`

**File:** `src/app/pages/QuizResults.tsx`

**Changes:**
1. Import `AttemptHistory`
2. Compute `currentAttemptId = lastAttempt?.id ?? ''`
3. Replace the disabled button block (lines 160-175 in current file):
   ```tsx
   // BEFORE (disabled placeholder):
   <button disabled ...>
     <History className="size-4" />
     View All Attempts (Coming Soon)
   </button>

   // AFTER:
   <AttemptHistory
     attempts={attempts}
     currentAttemptId={currentAttemptId}
     courseId={courseId}
     lessonId={lessonId}
   />
   ```
4. Remove unused `History` import from lucide-react (if no other usage)

---

### Step 4: Unit Tests

**File:** `src/app/components/quiz/__tests__/AttemptHistory.test.tsx`

Test cases:
1. **Singular label:** `makeAttempt()` × 1 → button text contains "(1 attempt)"
2. **Plural label:** `makeAttempt()` × 3 → button text contains "(3 attempts)"
3. **All fields rendered:** After expanding, all attempt data visible (score, date, time, status)
4. **Current attempt highlighted:** Row with `currentAttemptId` has `bg-brand-soft` class or "Current" text
5. **Collapsed by default:** Content not visible until trigger clicked

Use `@testing-library/react` with `userEvent` for click. Mock `toast.info` for the Review button test.

---

### Step 5: E2E Tests

**File:** `tests/e2e/story-e16-s02.spec.ts`

**Setup pattern** (from `story-12-6.spec.ts`):
1. `addInitScript` → `localStorage.setItem('eduvi-sidebar-v1', 'false')` (prevent sidebar overlay)
2. `goto('/')` → let Dexie initialize DB
3. Seed `quizzes` store with `makeQuiz()` data
4. Seed `quizAttempts` store with 3 attempts (different `completedAt` timestamps)
5. Seed Zustand persisted state in localStorage (`levelup-quiz-store`) with `currentQuiz` + last attempt in `attempts`
6. Navigate to `/courses/:courseId/lessons/:lessonId/quiz/results`

**Test cases:**
1. **AC: Trigger visible** — `getByRole('button', { name: /view attempt history/i })` is visible
2. **AC: Expand shows 3 attempts** — click trigger, expect 3 attempt rows/cards
3. **AC: Sorted most-recent-first** — first row shows highest attempt number (e.g., "#3")
4. **AC: Current attempt marked** — row containing last attempt's ID shows "Current" badge or `bg-brand-soft`
5. **AC: Review button present** — each row has a Review button (stub behavior acceptable)

**Zustand localStorage seeding approach:**
```javascript
// In addInitScript or after goto('/'):
await page.evaluate((quizStoreKey, serialized) => {
  localStorage.setItem(quizStoreKey, serialized)
}, 'levelup-quiz-store', JSON.stringify({ state: { currentQuiz: quiz, currentProgress: null }, version: 0 }))
```
Then separately seed `quizAttempts` IDB. `loadAttempts` fetches from IDB on mount, so the `attempts` array in state is populated from IDB (not from the store's persisted state).

---

## File Summary

| Action | File |
|--------|------|
| MODIFY | `src/stores/useQuizStore.ts` — add `.reverse()` to `loadAttempts` |
| CREATE | `src/app/components/quiz/AttemptHistory.tsx` |
| MODIFY | `src/app/pages/QuizResults.tsx` — replace placeholder, import AttemptHistory |
| CREATE | `src/app/components/quiz/__tests__/AttemptHistory.test.tsx` |
| CREATE | `tests/e2e/story-e16-s02.spec.ts` |

---

## Design Token Verification

| Usage | Token | File | Verified |
|-------|-------|------|----------|
| Current row background | `bg-brand-soft` | theme.css | ✅ |
| Current badge text | `text-brand-soft-foreground` | theme.css | check |
| Passed badge bg | `bg-success-soft` | theme.css:34 | ✅ |
| Passed badge text | `text-success` | theme.css | ✅ |
| Not Passed bg | `bg-muted` | theme.css | ✅ |
| Not Passed text | `text-muted-foreground` | theme.css | ✅ |

---

## Risk Register

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| E16-S01 route not ready | Certain (it's backlog) | Review button shows toast stub |
| `bg-success-soft` missing | Low (confirmed in theme.css:34) | Fallback: `bg-success/10` |
| IDB seeding race in E2E | Medium | Use retry pattern from `story-12-6.spec.ts` |
| Mobile layout overflow at 320px | Low | Test at 375px and 320px viewports |
| `brand-soft-foreground` token not in theme | Low | Verify before use; fallback to `text-brand` |

---

## Acceptance Criteria Coverage

| AC | Implementation |
|----|---------------|
| "View Attempt History" trigger visible | Step 3 — replace placeholder |
| Expands to show all attempts | Step 2 — Collapsible + CollapsibleContent |
| Each row: attempt#, date/time, score%, time, passed/failed | Step 2 — Table columns |
| Sorted most-recent-first | Step 1 — `.reverse()` fix |
| Current attempt highlighted/"Current" | Step 2 — `bg-brand-soft` + badge |
| Singular "(1 attempt)" | Step 2 — conditional plural |
| Plural "(N attempts)" | Step 2 — conditional plural |
| Click Review → navigate to review mode | Step 2 — stub toast (E16-S01 dependency) |
