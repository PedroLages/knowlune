# Test Coverage Review — E16-S04: Calculate Normalized Gain (Hake's Formula)
**Date:** 2026-03-22
**Branch:** feature/e16-s04-calculate-normalized-gain-hakes-formula
**Reviewer:** code-review-testing agent
**Files reviewed:** src/lib/analytics.test.ts, tests/e2e/story-e16-s04.spec.ts, src/lib/analytics.ts, src/app/components/quiz/ScoreSummary.tsx, src/app/pages/QuizResults.tsx

---

## AC Coverage Summary

**Overall:** 4/4 ACs covered (100%) | PASS

| AC# | Description | Unit | E2E | Verdict |
|-----|-------------|------|-----|---------|
| AC1 | (final - initial) / (100 - initial); first attempt = initial | analytics.test.ts:5-8 | story-e16-s04.spec.ts:125-155 | Covered |
| AC2 | Display as % with 4-tier interpretation | analytics.test.ts:38-63 | story-e16-s04.spec.ts:125-155 (medium), :206-243 (regression) | Partial — see TESTING-HIGH-1 |
| AC3 | High initial score → amplified gain | analytics.test.ts:31-34 | story-e16-s04.spec.ts:174-204 | Covered (shallow assertion) |
| AC4 | Single attempt → not displayed | Not unit tested (QuizResults logic) | story-e16-s04.spec.ts:157-172 | Covered |

---

## Findings

### High Priority

#### [TESTING-HIGH-1] Message content not pinned at unit level
**File:** `src/lib/analytics.test.ts:59-63` | **Confidence:** 82

`interpretNormalizedGain` message test only asserts `message.length > 0`. Any breaking change to message text (including violation of the AC2 neutral/encouraging tone requirement) would pass unit tests undetected. E2E tests partially cover two of the four messages.

**Fix:** Add unit assertions for all four message strings:
```ts
expect(interpretNormalizedGain(-0.5).message).toBe("Score decreased — review the material and try again!")
expect(interpretNormalizedGain(0.1).message).toBe("You're making progress. Keep practicing!")
// etc.
```

---

#### [TESTING-HIGH-2] AC3 E2E test: shallow assertion (no message check)
**File:** `tests/e2e/story-e16-s04.spec.ts:174-204` | **Confidence:** 78

The high-initial-score test asserts `toContainText('40%')` but does not assert the interpretation message for medium gain (0.4 → "Good learning progress!"). The formula-to-rendered-message round-trip is incomplete.

**Fix:** Add `await expect(gainSection).toContainText('Good learning progress!')` to lines 203-204.

---

#### [TESTING-HIGH-3] Brittle CSS class selector for regression color check
**File:** `tests/e2e/story-e16-s04.spec.ts:241-243` | **Confidence:** 75

`locator('span.font-semibold')` is a CSS class selector that would silently stop targeting the correct element if `font-semibold` is renamed or the element tag changes. A false-pass would result.

**Fix:** Add `data-testid="normalized-gain-value"` to the percentage `<span>` in `ScoreSummary.tsx` and update selector to `gainSection.locator('[data-testid="normalized-gain-value"]')`.

---

### Medium Priority

#### [TESTING-MEDIUM-1] AC2 tier label display gap
**File:** Story AC2 vs implementation | **Confidence:** 72

AC2 specifies tier labels: "Regression", "Low gain", "Medium gain", "High gain". The component renders only the `message` field — no tier label appears in the DOM. No test explicitly confirms whether this is intentional or an omission. If the product intent is visible tier labels alongside percentages, neither unit nor E2E tests would catch the absence.

**Fix:** Either render tier labels in the UI (e.g., `<span data-testid="normalized-gain-label">{interpretation.level}</span>`) and test them, OR add a story closure comment confirming messages fulfill the tier label requirement.

---

#### [TESTING-MEDIUM-2] Missing boundary test `calculateNormalizedGain(99, 100)`
**File:** `src/lib/analytics.test.ts` | **Confidence:** 68

The `>= 100` guard is tested from the null side (100 → null, 101 → null), but `initialScore=99` (just below the boundary) with `finalScore=100` is not tested. `(100-99)/(100-99) = 1.0` — maximum valid non-null gain. This is the boundary that confirms the guard is exclusive.

**Fix:** `expect(calculateNormalizedGain(99, 100)).toBeCloseTo(1.0)`

---

### Nits

- **NIT-1** `tests/e2e/story-e16-s04.spec.ts:47-88`: Inline `seedIDBStore` helper — extract to shared file. (confidence: 60)
- **NIT-2** `tests/e2e/story-e16-s04.spec.ts:172`: `not.toBeVisible()` vs `not.toBeAttached()` — style preference for conditionally-rendered elements. (confidence: 55)
- **NIT-3** `src/lib/analytics.test.ts`: Missing explicit `calculateNormalizedGain(0, 0) → 0` test for lower boundary of initial score. (confidence: 50)

---

## Edge Cases Without Tests

1. **NaN percentage in attempts** — `calculateNormalizedGain(NaN, 80)` returns `NaN`, falls through to "high" tier in `interpretNormalizedGain` (NaN comparisons are always false). Would display "Excellent learning efficiency!" for corrupt data.
2. **3+ attempts** — formula uses `attempts[0]` and `lastAttempt`. No test verifies middle attempts are ignored.
3. **`undefined` normalizedGain prop** — ScoreSummary guards with `!= null` (catches both `undefined` and `null`) but no explicit unit test exercises the `undefined` path.
