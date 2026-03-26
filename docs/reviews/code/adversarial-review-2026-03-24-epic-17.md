# Adversarial Review: Epic 17 — Analyze Quiz Data and Patterns

**Date:** 2026-03-24
**Reviewer:** Claude Opus 4.6 (adversarial mode)
**Epic:** E17 — Quiz Analytics (5 stories: S01-S05)
**Verdict:** Functional but architecturally fragile. 14 findings (3 critical, 5 high, 4 medium, 2 low).

---

## Executive Summary

Epic 17 delivers five quiz analytics features: completion rate, retake frequency, item difficulty (P-values), discrimination indices (point-biserial correlation), and learning trajectory pattern detection. The implementation is mathematically sound and well-tested at the unit level. However, it suffers from **performance anti-patterns that will degrade with scale**, **duplicated full-table scans**, **missing memoization in hot render paths**, and **UX inconsistencies between the Reports page and QuizResults page**. The statistical implementations are correct but lack the guardrails needed for a production analytics system.

---

## Findings

### CRITICAL-01: Duplicate full-table scans on Reports page load

**Severity:** CRITICAL
**Files:** `src/lib/analytics.ts:212-239`, `src/lib/analytics.ts:262-271`

`calculateCompletionRate()` and `calculateRetakeFrequency()` both call `db.quizAttempts.toArray()` independently, fetching the entire quizAttempts table twice on every Reports page mount. With 100+ attempts across multiple quizzes, this doubles IndexedDB I/O for no reason.

```typescript
// calculateCompletionRate — line 213
const allAttempts = await db.quizAttempts.toArray()

// calculateRetakeFrequency — line 263
const allAttempts = await db.quizAttempts.toArray()
```

**Impact:** Each call deserializes the full table. As users accumulate quiz history, this becomes the dominant bottleneck on the Reports page.

**Fix:** Extract a shared `loadAllAttempts()` function or create a `calculateQuizMetrics()` that computes both metrics in a single pass.

---

### CRITICAL-02: ItemDifficultyAnalysis lacks useMemo — recalculates on every render

**Severity:** CRITICAL
**File:** `src/app/components/quiz/ItemDifficultyAnalysis.tsx:51`

`calculateItemDifficulty(quiz, attempts)` is called directly in the render body without `useMemo`. Every parent re-render (score summary animation, collapsible toggle, etc.) re-runs the O(questions * attempts) calculation and the `.sort()`.

Compare with `DiscriminationAnalysis.tsx:13` which correctly wraps in `useMemo`. This inconsistency suggests copy-paste drift between S03 and S04 implementations.

**Fix:** Wrap in `useMemo(() => calculateItemDifficulty(quiz, attempts), [quiz, attempts])`.

---

### CRITICAL-03: No caching or staleness strategy for Reports page quiz metrics

**Severity:** CRITICAL
**File:** `src/app/pages/Reports.tsx:85-118`

The three async fetches (`getTotalStudyNotes`, `calculateCompletionRate`, `calculateRetakeFrequency`) fire on every mount with no caching. If the user navigates away and back to Reports, all three queries re-execute. There is no `stale-while-revalidate` pattern, no Zustand persistence, and no React Query — just raw `useEffect` with `useState`.

**Impact:** Perceptible flicker on revisits as values reset to 0 then populate.

---

### HIGH-01: Discrimination index uses `attempt.score` (raw points) instead of `attempt.percentage`

**Severity:** HIGH
**File:** `src/lib/analytics.ts:445`

The point-biserial correlation correlates question correctness with `attempt.score` (raw points). If quizzes have different numbers of questions (e.g., Quiz A has 5 questions, Quiz B has 20), the raw scores are on different scales. While this only matters for cross-quiz analysis (currently single-quiz), this is a latent bug waiting for the first multi-quiz analytics feature.

```typescript
return { x: answer.isCorrect ? 1 : 0, y: attempt.score }
```

**Fix:** Use `attempt.percentage` for scale-invariant correlation.

---

### HIGH-02: `toLocaleString()` in AttemptHistory creates non-deterministic rendering

**Severity:** HIGH
**File:** `src/app/components/quiz/AttemptHistory.tsx:90,142`

`new Date(attempt.completedAt).toLocaleString()` produces locale-dependent output that varies across browsers and OS settings. This makes E2E test assertions fragile (none of the E2E tests actually assert on date formatting in the history table, which masks the issue).

**Fix:** Use `date-fns/format` with an explicit format string, consistent with `Reports.tsx:132` which already does this.

---

### HIGH-03: Exponential R-squared calculation is mathematically questionable for scores containing zero

**Severity:** HIGH
**File:** `src/lib/analytics.ts:581-585`

`calculateExpR2` filters out `y <= 0` points before log-transforming. If a learner scores 0% on their first attempt, that data point is silently dropped. This biases the exponential model toward higher R-squared values by removing the very data that would make the fit worse, potentially misclassifying a linear pattern as exponential.

```typescript
const transformed = points.filter(p => p.y > 0).map(p => ({ x: p.x, y: Math.log(p.y) }))
```

**Fix:** Either penalize the exponential model when points are dropped (e.g., reduce R-squared proportionally) or document this as a known limitation.

---

### HIGH-04: No loading/skeleton states for ItemDifficultyAnalysis and DiscriminationAnalysis

**Severity:** HIGH
**Files:** `src/app/components/quiz/ItemDifficultyAnalysis.tsx`, `src/app/components/quiz/DiscriminationAnalysis.tsx`

Both components render synchronously from props but show no loading indicator while the parent `QuizResults` is loading attempts. The parent shows skeletons, but once `lastAttempt` is truthy, these components render immediately with potentially stale `attempts` array (the `loadAttempts` promise may still be in-flight for the full history).

**Impact:** On slow connections, users may see the difficulty analysis with only the most recent attempt, then see it jump when full history loads.

---

### HIGH-05: `calculateCompletionRate` couples to localStorage key name

**Severity:** HIGH
**File:** `src/lib/analytics.ts:220`

The completion rate function hardcodes `localStorage.getItem('levelup-quiz-store')` and parses its JSON structure. This creates a hidden coupling between the analytics module and the Zustand store's persistence format. If the store key or shape changes, the analytics function silently returns wrong results with no compile-time error.

**Fix:** Import the store key as a constant, or better yet, have the Zustand store expose an `isQuizInProgress()` selector.

---

### MEDIUM-01: E17-S05 E2E test lives outside the `regression/` directory

**Severity:** MEDIUM
**File:** `tests/e2e/regression/story-e17-s05.spec.ts` is actually at `tests/e2e/story-e17-s05.spec.ts` (outside regression/)

The S05 E2E test file is at a different path than S01-S04 (which are all in `tests/e2e/regression/`). This organizational inconsistency means CI glob patterns targeting `tests/e2e/regression/story-e17-*.spec.ts` would miss S05.

---

### MEDIUM-02: Plateau detection threshold (5 percentage points) is arbitrary and untested at boundary

**Severity:** MEDIUM
**File:** `src/lib/analytics.ts:619`

The plateau heuristic `maxScore - minScore <= 5` is a magic number with no configurability. A score range of [70, 75, 70] is classified as plateau, but [70, 76, 70] jumps to the curve-fitting logic. The unit tests cover the plateau case but do not test the boundary at exactly 5 or 6 points of range.

---

### MEDIUM-03: No cross-story integration test

**Severity:** MEDIUM

Each story has isolated E2E tests, but there is no integration test that verifies all five analytics components render correctly together on a single QuizResults page. The QuizResults page stacks all components vertically, and layout collisions, z-index issues, or DOM nesting errors would only be caught by a holistic test.

---

### MEDIUM-04: Discrimination analysis does a `quiz.questions.find()` in the render loop

**Severity:** MEDIUM
**File:** `src/app/components/quiz/DiscriminationAnalysis.tsx:31`

Inside the `.map()` over `results`, the component calls `quiz.questions.find(q => q.id === item.questionId)` for each result. This is O(questions * results) in the render path. The analytics function already has access to the question text but does not include it in the return type.

**Fix:** Add `questionText` to `DiscriminationResult` (like `ItemDifficulty` already has) to avoid the lookup.

---

### LOW-01: `buildSuggestions` in ItemDifficultyAnalysis uses string key for React list

**Severity:** LOW
**File:** `src/app/components/quiz/ItemDifficultyAnalysis.tsx:81`

```tsx
<li key={suggestion} className="text-sm text-muted-foreground">
```

Using the full suggestion text as a React key is fragile. If two topics produce identical suggestion text (unlikely but possible with "General" topic), React would silently deduplicate.

---

### LOW-02: `interpretRetakeFrequency` bands don't cover the 2.0 boundary precisely

**Severity:** LOW
**File:** `src/lib/analytics.ts:282-287`

The function uses `avg <= 2.0` for "Light review" and `avg <= 3.0` for "Active practice". At exactly 2.0, the user sees "Light review" which says "you occasionally revisit quizzes" — but 2.0 means every quiz was taken exactly twice, which is more than "occasional". The E2E test for S02 does not test the exact 2.0 boundary.

---

## Summary Table

| # | Severity | Finding | File(s) |
|---|----------|---------|---------|
| C-01 | CRITICAL | Duplicate full-table scans on Reports | analytics.ts:212,263 |
| C-02 | CRITICAL | Missing useMemo in ItemDifficultyAnalysis | ItemDifficultyAnalysis.tsx:51 |
| C-03 | CRITICAL | No caching for Reports page quiz metrics | Reports.tsx:85-118 |
| H-01 | HIGH | Discrimination uses raw score instead of percentage | analytics.ts:445 |
| H-02 | HIGH | Non-deterministic date formatting in AttemptHistory | AttemptHistory.tsx:90,142 |
| H-03 | HIGH | Exponential R-squared drops zero-score data points | analytics.ts:581-585 |
| H-04 | HIGH | No loading states for difficulty/discrimination | ItemDifficultyAnalysis.tsx, DiscriminationAnalysis.tsx |
| H-05 | HIGH | Hardcoded localStorage key coupling | analytics.ts:220 |
| M-01 | MEDIUM | S05 E2E test outside regression/ directory | story-e17-s05.spec.ts |
| M-02 | MEDIUM | Arbitrary plateau threshold without boundary tests | analytics.ts:619 |
| M-03 | MEDIUM | No cross-story integration test | (missing) |
| M-04 | MEDIUM | O(n*m) find() in discrimination render loop | DiscriminationAnalysis.tsx:31 |
| L-01 | LOW | String key for suggestion list items | ItemDifficultyAnalysis.tsx:81 |
| L-02 | LOW | Retake frequency 2.0 boundary interpretation | analytics.ts:282-287 |

## What Was Done Well

- **Mathematical correctness**: Point-biserial correlation, Hake's normalized gain, and R-squared implementations are textbook-accurate with proper edge case handling (division by zero, SD=0, ceiling effects).
- **Comprehensive unit tests**: `analytics.test.ts` has thorough coverage of all five analytics functions including boundary conditions.
- **Accessibility**: All chart components have `aria-label` attributes, `aria-hidden` on decorative SVGs, and semantic headings.
- **Progressive disclosure**: Components gracefully hide when insufficient data (< 2 for trajectory, < 3 for patterns, < 5 for discrimination).
- **Design token compliance**: No hardcoded colors detected across all new components.

---

**Findings count:** 14
**Critical:** C-01, C-02, C-03
**Recommendation:** Address the three critical findings before starting Epic 18. The duplicate DB scans and missing memoization are performance regressions that compound with usage.
