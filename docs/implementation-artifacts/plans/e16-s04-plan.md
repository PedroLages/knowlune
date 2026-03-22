# Implementation Plan: E16-S04 — Calculate Normalized Gain (Hake's Formula)

**Story:** [16-4-calculate-normalized-gain-hakes-formula.md](../16-4-calculate-normalized-gain-hakes-formula.md)
**Branch:** `feature/e16-s04-calculate-normalized-gain-hakes-formula`
**Complexity:** Small (2–3 hours)
**Date:** 2026-03-22

---

## Overview

Add Hake's normalized gain formula to the quiz results page. This is a purely additive change:
- Two pure functions in `src/lib/analytics.ts`
- One new optional prop on `ScoreSummary.tsx`
- One `useMemo` in `QuizResults.tsx`
- Unit tests + E2E spec

No existing functionality is modified. No new dependencies.

---

## File Changes

### 1. `src/lib/analytics.ts` — Add two new exports

Add after the existing `analyzeTopicPerformance` function. Do NOT modify the existing function.

```typescript
// ---------------------------------------------------------------------------
// Normalized Gain (Hake's Formula)
// ---------------------------------------------------------------------------

/**
 * Calculate normalized learning gain using Hake's formula.
 * Returns null when initialScore >= 100 (no room for improvement).
 * Returns negative values for score regression (valid — displayed as "Regression").
 *
 * Formula: (finalScore - initialScore) / (100 - initialScore)
 */
export function calculateNormalizedGain(
  initialScore: number,
  finalScore: number
): number | null {
  if (initialScore >= 100) return null  // Already perfect, no room for improvement
  const actualGain = finalScore - initialScore
  const possibleGain = 100 - initialScore
  return actualGain / possibleGain
}

export type NormalizedGainLevel = 'regression' | 'low' | 'medium' | 'high'

export function interpretNormalizedGain(gain: number): {
  level: NormalizedGainLevel
  message: string
} {
  if (gain < 0) {
    return { level: 'regression', message: "Score decreased — review the material and try again!" }
  } else if (gain < 0.3) {
    return { level: 'low', message: "You're making progress. Keep practicing!" }
  } else if (gain < 0.7) {
    return { level: 'medium', message: "Good learning progress!" }
  } else {
    return { level: 'high', message: "Excellent learning efficiency!" }
  }
}
```

**Edge case notes:**
- `initialScore = 100` → returns `null` → component renders nothing ✓
- `finalScore < initialScore` (regression) → negative gain → "regression" tier ✓
- `initialScore = 0, finalScore = 100` → gain = 1.0 → "high" ✓
- `initialScore = 95, finalScore = 97` → gain = 2/5 = 0.4 → "medium" (correct — small absolute gain is large normalized) ✓

---

### 2. `src/app/components/quiz/ScoreSummary.tsx` — Add normalizedGain prop

**Prop additions to `ScoreSummaryProps`:**
```typescript
import { calculateNormalizedGain, interpretNormalizedGain } from '@/lib/analytics'

interface ScoreSummaryProps {
  // ...existing props...
  normalizedGain?: number | null  // pre-computed by QuizResults; undefined = hide
}
```

**Inside the component body, add `gainColorMap` and render block:**
```typescript
const gainColorMap: Record<string, string> = {
  regression: 'text-muted-foreground',
  low: 'text-muted-foreground',
  medium: 'text-brand',
  high: 'text-success',
}
```

**Render after the `roundedPrevBest` block:**
```tsx
{normalizedGain != null && (() => {
  const interpretation = interpretNormalizedGain(normalizedGain)
  return (
    <div className="mt-2" data-testid="normalized-gain">
      <span className="text-sm text-muted-foreground">Normalized Gain: </span>
      <span className={cn('font-semibold', gainColorMap[interpretation.level])}>
        {Math.round(normalizedGain * 100)}%
      </span>
      <p className="text-sm text-muted-foreground mt-1">{interpretation.message}</p>
    </div>
  )
})()}
```

**Alternative (cleaner):** Derive interpretation outside JSX using a variable:
```tsx
const gainInterpretation = normalizedGain != null
  ? interpretNormalizedGain(normalizedGain)
  : null

// In JSX:
{gainInterpretation != null && (
  <div className="mt-2" data-testid="normalized-gain">
    <span className="text-sm text-muted-foreground">Normalized Gain: </span>
    <span className={cn('font-semibold', gainColorMap[gainInterpretation.level])}>
      {Math.round(normalizedGain! * 100)}%
    </span>
    <p className="text-sm text-muted-foreground mt-1">{gainInterpretation.message}</p>
  </div>
)}
```

The second pattern is preferred — matches codebase style (variables before return).

---

### 3. `src/app/pages/QuizResults.tsx` — Compute and pass normalizedGain

**Import additions:**
```typescript
import { analyzeTopicPerformance, calculateNormalizedGain } from '@/lib/analytics'
// Note: analyzeTopicPerformance is already imported via PerformanceInsights
// calculateNormalizedGain is new — add to the analytics import
```

Wait — check if analytics is already imported in QuizResults. Looking at the current file, `PerformanceInsights` uses analytics internally. QuizResults does NOT directly import analytics. So add:

```typescript
import { calculateNormalizedGain } from '@/lib/analytics'
```

**Add useMemo after `previousBestPercentage`:**
```typescript
const normalizedGain = useMemo(() => {
  if (attempts.length < 2) return null
  const firstScore = attempts[0].percentage
  const latestScore = lastAttempt?.percentage ?? 0
  return calculateNormalizedGain(firstScore, latestScore)
}, [attempts, lastAttempt?.percentage])
```

**Pass to ScoreSummary:**
```tsx
<ScoreSummary
  percentage={lastAttempt.percentage}
  score={lastAttempt.score}
  maxScore={maxScore}
  passed={lastAttempt.passed}
  passingScore={currentQuiz.passingScore}
  timeSpent={lastAttempt.timeSpent}
  previousBestPercentage={previousBestPercentage}
  normalizedGain={normalizedGain}
/>
```

---

### 4. `src/lib/analytics.test.ts` — New unit test file

Create at `src/lib/analytics.test.ts` (co-located with source, matching project convention).

```typescript
import { describe, it, expect } from 'vitest'
import { calculateNormalizedGain, interpretNormalizedGain } from './analytics'

describe('calculateNormalizedGain', () => {
  it('returns correct gain for standard improvement', () => {
    // (85 - 60) / (100 - 60) = 25 / 40 = 0.625
    expect(calculateNormalizedGain(60, 85)).toBeCloseTo(0.625)
  })

  it('returns null when initialScore is exactly 100', () => {
    expect(calculateNormalizedGain(100, 100)).toBeNull()
  })

  it('returns null when initialScore exceeds 100 (guard)', () => {
    expect(calculateNormalizedGain(101, 101)).toBeNull()
  })

  it('returns negative value for score regression', () => {
    // (50 - 80) / (100 - 80) = -30 / 20 = -1.5
    expect(calculateNormalizedGain(80, 50)).toBeCloseTo(-1.5)
  })

  it('returns 0 when scores are identical', () => {
    expect(calculateNormalizedGain(70, 70)).toBe(0)
  })

  it('returns 1 for perfect improvement from 0 to 100', () => {
    expect(calculateNormalizedGain(0, 100)).toBe(1)
  })

  it('high initial score amplifies small improvements (correct behavior)', () => {
    // (97 - 95) / (100 - 95) = 2 / 5 = 0.4 → medium gain
    expect(calculateNormalizedGain(95, 97)).toBeCloseTo(0.4)
  })
})

describe('interpretNormalizedGain', () => {
  it('returns regression for negative gain', () => {
    expect(interpretNormalizedGain(-0.5).level).toBe('regression')
  })

  it('returns low for gain in [0, 0.3)', () => {
    expect(interpretNormalizedGain(0).level).toBe('low')
    expect(interpretNormalizedGain(0.1).level).toBe('low')
    expect(interpretNormalizedGain(0.299).level).toBe('low')
  })

  it('returns medium for gain in [0.3, 0.7)', () => {
    expect(interpretNormalizedGain(0.3).level).toBe('medium')
    expect(interpretNormalizedGain(0.5).level).toBe('medium')
    expect(interpretNormalizedGain(0.699).level).toBe('medium')
  })

  it('returns high for gain >= 0.7', () => {
    expect(interpretNormalizedGain(0.7).level).toBe('high')
    expect(interpretNormalizedGain(1.0).level).toBe('high')
  })

  it('includes non-empty messages for all levels', () => {
    for (const gain of [-0.1, 0.1, 0.5, 0.9]) {
      expect(interpretNormalizedGain(gain).message.length).toBeGreaterThan(0)
    }
  })
})
```

---

### 5. `tests/e2e/story-e16-s04.spec.ts` — E2E tests

Pattern: seed quiz + two pre-built attempts into IDB, navigate to results page, assert normalized gain displayed.

**Key seeding insight:** `QuizResults.tsx` requires both `currentQuiz` (Zustand state) and `lastAttempt` (loaded from DB via `loadAttempts`). The `currentQuiz` is in Zustand persisted state, while attempts come from Dexie. The easiest approach is to:
1. Seed quiz + 2 attempts into IDB
2. Navigate through the quiz flow by playing two real quiz attempts in the browser

OR use a simpler approach:
1. Seed quiz into `quizzes` IDB store
2. Seed the quiz into Zustand persist state (localStorage) as `currentQuiz`
3. Seed attempts into `quizAttempts` IDB store
4. Navigate directly to `/courses/:id/lessons/:id/quiz/results`

Look at how `story-12-6.spec.ts` seeds data — it only seeds the quiz, then plays through. For E16-S04 we need 2+ attempts already in IDB. We should seed them directly.

Reference pattern from `story-12-6.spec.ts`:
- `localStorage.setItem('eduvi-sidebar-v1', 'false')` to close sidebar
- `page.goto('/')` first to initialize Dexie
- Seed IDB, then navigate to quiz page

For E16-S04, we need Zustand `currentQuiz` set AND attempts in IDB. The cleanest approach: play through quiz twice. But that's slow. Alternatively, seed `zustand-quiz-store` in localStorage AND seed attempts in IDB.

**Recommended approach:** Play through quiz twice naturally for the primary test (most reliable), and use IDB seeding for the regression/edge case tests.

---

## Dependency Boundary

**Do NOT implement E16-S02 or E16-S03 features** in this story:
- No `AttemptHistory.tsx` component (that's E16-S02)
- No `calculateImprovement()` function (that's E16-S03's `calculateImprovement` in `analytics.ts`)
- The "View All Attempts" button in `QuizResults.tsx` remains disabled (placeholder from Epic 12)

The normalized gain section is a **separate visual block** from the improvement/score history section. They display different metrics and are added independently.

---

## Testing Strategy

**Unit tests** cover all calculation edge cases (deterministic, fast, no browser needed).
**E2E tests** verify the visual integration on the results page (requires browser + IDB).

Vitest is used for unit tests (`npm run test:unit`). E2E uses Playwright (`npx playwright test tests/e2e/story-e16-s04.spec.ts`).

---

## Risk Assessment

**Low risk.** All changes are additive:
- New functions in `analytics.ts` — no modification to existing `analyzeTopicPerformance`
- New optional prop in `ScoreSummary` — existing callers unchanged (prop is optional, defaults to hiding the section)
- `QuizResults.tsx` change is a single new `useMemo` + one new prop pass

No schema changes, no store changes, no route changes.

---

## Success Criteria

1. `calculateNormalizedGain(60, 85)` returns `0.625` ✓
2. `calculateNormalizedGain(100, 100)` returns `null` (no display) ✓
3. After two quiz attempts, `[data-testid="normalized-gain"]` is visible on results page ✓
4. After one attempt only, normalized gain section is NOT displayed ✓
5. Regression case shows "text-muted-foreground" styled message (not red/destructive) ✓
6. ESLint passes (no hardcoded colors) ✓
7. TypeScript compiles clean ✓
