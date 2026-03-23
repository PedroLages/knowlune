# Test Coverage Review — E17-S02: Track Average Retake Frequency

**Date**: 2026-03-22
**Branch**: feature/e17-s02-track-average-retake-frequency
**Reviewer**: code-review-testing agent (Claude Sonnet 4.6)
**Files reviewed**: `src/lib/__tests__/analytics.test.ts`, `tests/e2e/regression/story-e17-s02.spec.ts`, `src/lib/analytics.ts`, `src/app/pages/Reports.tsx`

---

## AC Coverage Summary

**7/8 ACs covered (87.5%)** — PASS (threshold: ≥80%)

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| AC1 | Display "Average Retake Frequency" card in Study Analytics tab | N/A (pure UI) | `story-e17-s02.spec.ts:51` | Covered |
| AC2 | Compute total attempts / distinct quizzes (e.g. 2.5) | `analytics.test.ts:467` | `story-e17-s02.spec.ts:67` | Covered |
| AC3 | freq = 1.0 → "No retakes yet" label | `analytics.test.ts:498` | `story-e17-s02.spec.ts:55` | Covered |
| AC4 | freq 1.0–2.0 → "Light review" label | `analytics.test.ts:502` | None | **Partial** |
| AC5 | freq 2.0–3.0 → "Active practice" label | `analytics.test.ts:506` | `story-e17-s02.spec.ts:67` | Covered |
| AC6 | freq ≥ 3.0 → "Deep practice" label | `analytics.test.ts:512` | `story-e17-s02.spec.ts:38` | Covered |
| AC7 | Show numeric value alongside interpretation label | `analytics.test.ts:498-515` | `story-e17-s02.spec.ts:44,60,75` | Covered |
| AC8 | Zero attempts → empty state / hide retake card | `analytics.test.ts:439` | `story-e17-s02.spec.ts:83` | Covered |

---

## Findings

### [High] H1 — Boundary value `interpretRetakeFrequency(2.0)` is untested

**Confidence**: 85

The implementation uses `avg <= 2.0` meaning `2.0` maps to "Light review". The boundary value has no test in either unit or E2E suites. A regression at this exact threshold (e.g. changing `<=` to `<`) would go undetected.

**Fix**: Add `interpretRetakeFrequency(2.0)` asserting `'Light review — you occasionally revisit quizzes.'` to `analytics.test.ts`.

---

### [High] H2 — AC8 empty-state E2E assertion passes for the wrong structural reason

**File**: `tests/e2e/regression/story-e17-s02.spec.ts:83`
**Confidence**: 80

The test asserts `quiz-retake-card` is not visible because the entire analytics tab is hidden when `hasActivity` is false — not because the card has its own conditional render. If a future refactor moves empty state inside the tab, the test will start failing even though AC8 is still satisfied.

**Fix**: Make the assertion specific — assert the card is absent from the DOM tree, or assert "No quizzes attempted yet" text is visible in the empty state section.

---

### [High] H3 — Sidebar key `'eduvi-sidebar-v1'` is a stale legacy value

**File**: `tests/e2e/regression/story-e17-s02.spec.ts:25`
**Confidence**: 72

The `beforeEach` seeds `localStorage.setItem('eduvi-sidebar-v1', 'false')` but the canonical key is `'knowlune-sidebar-v1'`. On tablet viewports the sidebar may remain open, obscuring the retake card and causing flaky locator matches.

**Fix**: Change to `localStorage.setItem('knowlune-sidebar-v1', 'false')`.

---

### [Medium] M1 — AC4 ("Light review") has no E2E coverage

**Confidence**: 65

All other interpretation bands (AC3, AC5, AC6) have both unit and E2E tests; AC4 has only a unit test. A wiring bug in Reports.tsx for this specific band would not be caught by E2E regression.

**Fix**: Add an E2E test seeding one quiz with 2 attempts (avg = 1.5) and asserting `'Light review'` text.

---

### [Medium] M2 — Unit tests use raw stub objects instead of the project factory

**File**: `src/lib/__tests__/analytics.test.ts:449`
**Confidence**: 60

`calculateRetakeFrequency` tests use `{ id: 'a1', quizId: 'q1' }` objects. The project convention (and E2E tests) use `makeAttempt()` from the quiz factory. This inconsistency means type evolution in `QuizAttempt` could silently break unit tests.

**Fix**: Use `makeAttempt({ quizId: 'q1' })` in unit tests for consistency.

---

## Edge Cases Not Currently Tested

1. **Single quiz, single attempt** — produces `averageRetakes = 1.0`, distinguishable from the two-quiz-each-once case. No dedicated test exists.
2. **`interpretRetakeFrequency(0)`** — returns "No retakes yet" due to `0 <= 1.0`. No test documents this contract; a direct caller could misuse it.
3. **DB error in useEffect** — rejected promise falls back to `console.error` only. No test validates the component remains in a safe state.

---

## Summary

| Severity | Count |
|----------|-------|
| Blocker  | 0     |
| High     | 3     |
| Medium   | 2     |
| Nit      | 2     |

**COVERAGE GATE**: PASS (7/8 ACs, 87.5%)
