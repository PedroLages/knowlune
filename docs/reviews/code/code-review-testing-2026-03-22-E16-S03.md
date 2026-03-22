# Test Coverage Review: E16-S03 — Calculate and Display Score Improvement
**Date:** 2026-03-22
**Branch:** feature/e16-s03-calculate-and-display-score-improvement
**Reviewer:** code-review-testing agent

---

## AC Coverage: 4/4 (100%) — PASS

| AC# | Description | Unit | Component | Integration | E2E | Verdict |
|-----|-------------|------|-----------|-------------|-----|---------|
| 1 | First attempt: "First attempt complete!" message | ✓ | ✓ | ✓ | ✓ | Covered |
| 2 | Multiple attempts: first/current/improvement rows | ✓ | ✓ | ✓ | ✓ | Covered |
| 3 | New personal best: trophy + green + "New personal best!" | ✓ | ✓ | ✓ | ✓ | Covered |
| 4 | Regression: neutral messaging, no red, best score + attempt# | ✓ | ✓ | ✓ | ✓ | Partial (see High findings) |

---

## High Priority

**[High] `src/app/components/quiz/__tests__/ScoreSummary.test.tsx:46-53` (confidence: 88)**
The `regressionData` fixture has `improvement: 15` (positive value) despite `currentScore: 75 < bestScore: 90`. A genuine regression always has a negative `improvement`. Because the fixture uses a positive value, the critical behavior — whether a negative delta like "-20%" is suppressed or shown neutrally in the `Improvement:` row — is **never tested**. The component unconditionally renders `{sign}{roundedImprovement}%` (ScoreSummary.tsx:155-157), meaning a real regression scenario shows "-20%", which may violate AC4's "NO negative messaging" requirement. No test catches this.

Suggested fix — add to `ScoreSummary.test.tsx`:
```ts
it('regression with negative delta: Improvement row does not show a negative number', () => {
  const negativeRegressionData: ImprovementData = {
    firstScore: 80, bestScore: 80, bestAttemptNumber: 1,
    currentScore: 60, improvement: -20, isNewBest: false,
  }
  render(<ScoreSummary {...passProps} improvementData={negativeRegressionData} />)
  const panel = screen.getByTestId('improvement-summary')
  expect(panel).not.toHaveTextContent('-20%')
})
```
Note: this test would **currently FAIL** if run, revealing a real AC4 violation.

**[High] `src/app/pages/__tests__/QuizResults.test.tsx:123-132` (confidence: 82)**
`makeAttemptWith` spreads `testAttempt` without overriding `completedAt`. Every multi-attempt integration test produces attempts sharing the identical timestamp `'2026-03-20T10:05:00Z'`. When `calculateImprovement` sorts by `completedAt`, the relative order depends entirely on JS sort stability rather than any explicit chronological signal. Tests pass today because V8 uses stable sort, but the test data encodes an implicit assumption about insertion order rather than testing the documented sort-by-date contract.

Fix: Override `completedAt` in `makeAttemptWith` to use distinct ascending ISO strings (e.g., increment by one day per attempt), mirroring the explicit timestamps used in the unit tests at `analytics.test.ts:300-306`.

---

## Medium Priority

**[Medium] `tests/e2e/e16-s03-score-improvement.spec.ts:189` (confidence: 75)**
The AC4 E2E test verifies neutral messaging and absence of `text-destructive` CSS class, but does not assert that a negative delta string (e.g. "-15%") is absent from the visible panel. Given the rendering issue identified above, an assertion like `await expect(panel).not.toContainText(/-\d+%/)` would provide a true end-to-end guard for "no negative messaging."

**[Medium] `src/lib/__tests__/analytics.test.ts` (confidence: 72)**
No test for same-timestamp sort stability. When two attempts share identical `completedAt`, the sort is a no-op and falls back on array insertion order. This is an undocumented assumption. A unit test with same-timestamp attempts would pin the behavior (or expose that it is undefined).

---

## Nits

**[Nit] `src/app/components/quiz/__tests__/ScoreSummary.test.tsx:228` (confidence: 55)**
`container.querySelector('svg')` for the Trophy icon assertion matches any SVG in the tree (ScoreRing also has an SVG). Scope to the improvement panel.

**[Nit] `src/app/pages/__tests__/QuizResults.test.tsx:18-63` (confidence: 45)**
`testQuiz` and `testAttempt` fixtures constructed inline instead of using `makeQuiz`/`makeAttempt` from the factory. Bypasses the factory's `FIXED_DATE` convention.

---

## Edge Cases to Consider

- **Decimal percentages**: All tests use integer percentages. Fractional values (e.g. `67.5 - 60.0 = 7.5`) are realistic on 8-question quizzes and untested.
- **`bestAttemptNumber` tie-breaking**: When multiple attempts share the same max percentage, the implementation keeps the first index. No test asserts this.
- **Zero-delta E2E gap**: Same score (current = previous best, `+0%`) is covered in integration tests but absent from E2E.
- **Large `bestAttemptNumber`** (e.g. attempt #20): No test exercises high attempt counts.
