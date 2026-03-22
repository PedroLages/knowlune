# Implementation Plan: E16-S03 — Calculate and Display Score Improvement

**Story:** [16-3-calculate-and-display-score-improvement.md](../16-3-calculate-and-display-score-improvement.md)
**Branch:** `feature/e16-s03-calculate-and-display-score-improvement`
**Complexity:** Medium (3-4 hours)

---

## Context

E16-S03 adds a rich score improvement panel to the quiz results screen. The panel shows:
- First attempt vs. current attempt comparison
- "+X%" improvement in green when score beats the first attempt
- "New personal best!" trophy when current > all previous bests
- Neutral best-score display when current < previous best (never red/negative)
- "First attempt complete! Retake to track improvement." for single-attempt state

### Current State (before this story)

`ScoreSummary` has a `previousBestPercentage?: number` prop that drives a simplified single-line delta display (e.g., "Previous best: 80% (+5%)"). This is insufficient for E16-S03's 4-state model.

`QuizResults.tsx` computes `previousBestPercentage` as `Math.max(...previousAttempts.map(a => a.percentage))`.

### After This Story

`src/lib/analytics.ts` provides a pure `calculateImprovement(attempts: QuizAttempt[])` function.
`ScoreSummary` accepts `improvementData` (typed return of `calculateImprovement`) instead of `previousBestPercentage`.
`QuizResults.tsx` computes `improvementData` and passes it down.

---

## Files to Create

### 1. `src/lib/analytics.ts`

Pure calculation module — no DB access, no React, easily unit-testable.

```typescript
import type { QuizAttempt } from '@/types/quiz'

export interface ImprovementData {
  firstScore: number | null
  bestScore: number | null
  bestAttemptNumber: number | null
  currentScore: number
  improvement: number | null   // currentScore - firstScore
  isNewBest: boolean           // current > all previous (not including current)
}

export function calculateImprovement(attempts: QuizAttempt[]): ImprovementData {
  if (attempts.length === 0) {
    return { firstScore: null, bestScore: null, bestAttemptNumber: null, currentScore: 0, improvement: null, isNewBest: false }
  }

  const sortedByDate = [...attempts].sort((a, b) =>
    new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime()
  )

  const firstAttempt = sortedByDate[0]
  const currentAttempt = sortedByDate[sortedByDate.length - 1]

  // Best among all PREVIOUS attempts (exclude current) — for isNewBest
  const previousAttempts = sortedByDate.slice(0, -1)
  const bestPrevious = previousAttempts.length > 0
    ? previousAttempts.reduce((best, cur) =>
        cur.percentage > best.percentage ? cur : best
      )
    : null

  // Best across ALL attempts (including current) — for bestAttemptNumber display
  const bestAttempt = attempts.reduce(
    (best, cur, idx) =>
      cur.percentage > best.item.percentage ? { item: cur, index: idx } : best,
    { item: attempts[0], index: 0 }
  )

  const improvement = sortedByDate.length > 1
    ? currentAttempt.percentage - firstAttempt.percentage
    : null

  const isNewBest = bestPrevious === null || currentAttempt.percentage > bestPrevious.percentage

  return {
    firstScore: sortedByDate.length > 1 ? firstAttempt.percentage : null,
    bestScore: bestAttempt.item.percentage,
    bestAttemptNumber: bestAttempt.index + 1,
    currentScore: currentAttempt.percentage,
    improvement,
    isNewBest,
  }
}
```

**Design decision:** `improvement` is null when there's only 1 attempt. `isNewBest` is true on first attempt (no previous to beat). The component uses `attempts.length > 1` to gate the comparison panel — not `improvement !== null` — to avoid edge cases.

### 2. `src/lib/__tests__/analytics.test.ts`

Unit tests for `calculateImprovement`:

| Test | Scenario |
|------|----------|
| empty array → all nulls | zero attempts guard |
| single attempt → improvement null, isNewBest true | first-time user |
| two attempts, score up → isNewBest true, correct improvement | happy path |
| two attempts, score same → isNewBest false (not strictly greater) | tie handling |
| three attempts, current is new best → isNewBest true | multi-attempt best |
| three attempts, current is NOT best → isNewBest false, bestAttemptNumber correct | regression |
| bestAttemptNumber = 3 when 3rd attempt overall is best | index counting |
| out-of-order completedAt → sort produces correct first/current | sort correctness |

---

## Files to Modify

### 3. `src/app/components/quiz/ScoreSummary.tsx`

**Prop change:**
- Remove `previousBestPercentage?: number`
- Add `improvementData?: ImprovementData` (import from `@/lib/analytics`)

**Render logic** (add below `<p className="text-sm text-muted-foreground">Completed in...</p>`):

```
if improvementData is provided:
  if attempts.length === 1 (first attempt):
    → render first-attempt message
  else if attempts.length > 1:
    → render comparison panel
      → always show: First attempt, Current attempt, Improvement delta
      → if isNewBest: trophy + "New personal best!" in text-success
      → else: "Your best: X% (attempt #N)" + "Keep practicing to beat your best!" in text-muted-foreground
```

**Note:** `ScoreSummary` receives `improvementData` but not the raw `attempts` array. The calling component (`QuizResults`) passes the computed result. The component itself doesn't need `attempts.length` — the `improvementData.improvement === null` flag is sufficient to distinguish single vs. multi-attempt (since `improvement` is null when there's only 1 attempt, or null for zero).

To distinguish "first attempt" from "no data", add a helper: `improvementData.firstScore === null && improvementData.currentScore > 0` → first attempt state.

**Aria-live region update:** Extend `improvementSrText` to include the richer context (first score, new best status).

**data-testid:** Keep `data-testid="improvement-summary"` on the panel wrapper for test continuity.

### 4. `src/app/components/quiz/__tests__/ScoreSummary.test.tsx`

**Updates needed:**
- Remove tests that use `previousBestPercentage` prop — replace with `improvementData` shape
- Add test: first attempt → "First attempt complete! Retake to track improvement."
- Add test: new personal best → "New personal best!" present, Trophy visible, text-success
- Add test: regression → "Keep practicing to beat your best!" present, no "Failed"/"worse"
- Add test: improvement panel shows first/current/improvement values correctly
- Add test: no red colors in regression state (text-destructive not in className)

### 5. `src/app/pages/QuizResults.tsx`

**Replace:**
```typescript
// BEFORE
const previousBestPercentage = useMemo(() => { ... }, [attempts])
// Pass to ScoreSummary: previousBestPercentage={previousBestPercentage}
```

**With:**
```typescript
// AFTER
import { calculateImprovement } from '@/lib/analytics'
const improvementData = useMemo(
  () => calculateImprovement(attempts),
  [attempts]
)
// Pass to ScoreSummary: improvementData={improvementData}
```

---

## Files to Create (Tests)

### 6. `tests/e2e/e16-s03-score-improvement.spec.ts`

E2E test scenarios:

| Scenario | Steps | Assertion |
|----------|-------|-----------|
| First attempt | Complete quiz once → view results | No improvement comparison panel; "First attempt complete!" message |
| Second attempt, improvement | Retake with higher score → view results | "+X%" shown in green; "Improvement:" row visible |
| New personal best | Third attempt beats all previous → view results | "New personal best!" + trophy visible |
| Regression | Attempt lower than previous best → view results | "Your best: X%" shown; "Keep practicing" visible; no red text |

**Seed approach:** For efficiency, use `useQuizStore.setState` in `page.evaluate()` to inject pre-seeded attempts directly — faster than completing full quiz flows multiple times.

---

## Implementation Order

1. **`src/lib/analytics.ts`** — pure function, no dependencies, test-first friendly
2. **`src/lib/__tests__/analytics.test.ts`** — unit tests, verifies logic before UI integration
3. **`src/app/components/quiz/ScoreSummary.tsx`** — update props + render improvement panel
4. **`src/app/components/quiz/__tests__/ScoreSummary.test.tsx`** — update unit tests for new prop shape
5. **`src/app/pages/QuizResults.tsx`** — wire up calculateImprovement, pass improvementData
6. **`tests/e2e/e16-s03-score-improvement.spec.ts`** — E2E happy path + edge cases

---

## Edge Cases & Risks

| Risk | Mitigation |
|------|-----------|
| `bestAttemptNumber` off-by-one | Index is 0-based from `attempts` array (unsorted); add 1 for display. Test explicitly. |
| Sort order instability if two completedAt are equal | Use stable sort (JS sort is stable in V8); document assumption. |
| Negative improvement displayed as "-15%" | Ensure sign formatting: use `Math.abs()` or just show the signed value — AC says "+25%" for positive, so show signed diff for both. Check whether to suppress when negative (show bestScore instead). |
| `previousBestPercentage` prop removal breaks snapshot tests | Update all ScoreSummary test fixtures — remove old prop, add improvementData. |
| First attempt: `isNewBest: true` but no comparison — must not show "New personal best!" | Gate "New personal best!" on `improvementData.improvement !== null` (multi-attempt). |

---

## Design Token Checklist

All improvement colors must use tokens:
- ✅ `text-success` — positive delta, trophy, "New personal best!"
- ✅ `text-muted-foreground` — neutral messages, regression encouragement
- ✅ `bg-surface-sunken` — panel background
- ❌ Never `text-red-*`, `text-destructive`, `text-green-*` (hardcoded)

---

## Acceptance Criteria Coverage

| AC | Covered By |
|----|-----------|
| Multi-attempt: first/current/improvement shown | ScoreSummary panel + QuizResults wire-up |
| Positive delta: green + "New personal best!" + trophy | ScoreSummary isNewBest branch |
| Regression: best score with attempt#, neutral messaging | ScoreSummary !isNewBest branch |
| First attempt: message shown, no comparison | ScoreSummary first-attempt state |
| No negative messaging in regression | Unit test + design token enforcement |
