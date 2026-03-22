# Test Coverage Review: E17-S01 — Track and Display Quiz Completion Rate

**Date:** 2026-03-22
**Branch:** feature/e17-s01-track-and-display-quiz-completion-rate
**Reviewer:** Claude code-review-testing agent
**Coverage gate:** PASS (83% AC coverage ≥ 80%)

---

## AC Coverage Summary

| AC# | Description | Unit | E2E | Verdict |
|-----|-------------|------|-----|---------|
| 1 | Quiz Completion Rate card appears on Reports page | — | ✓ (75% test, line 52-54) | Covered |
| 2 | Card shows % of started quizzes completed | ✓ (100%, 75% cases) | ✓ (lines 54, 71) | Covered |
| 3 | Card shows count label ("3 of 4 started") | — | ✓ (lines 55, 72) | Covered |
| 4 | In-progress quizzes counted as started, not completed | ✓ (currentProgress + inProgressQuizIds) | Partial (currentProgress only) | Partial |
| 5 | "No quizzes started yet" empty state | — | **Gap** (guarded by `if (!isPageEmpty)`) | **Gap** |
| 6 | Rate calculated correctly (floored) | Partial (exact values only; floor vs round untested) | ✓ (75%, 100%) | Partial |

**Result: 4/6 ACs fully covered, 1 gap (AC5), 2 partial (AC4, AC6)**

---

## Findings

### [Blocker] AC5 empty-state test is conditionally guarded and never asserts
**File:** `tests/e2e/story-e17-s01.spec.ts:19-26` | **Confidence:** 92

All assertions for the "No quizzes started yet" state are inside `if (!isPageEmpty)`. In a clean browser context with no activity data, the Reports page shows its own overall empty state, making `isPageEmpty` true. The test exits without asserting anything — the "No quizzes started yet" text could be absent and this test would still pass.

**Fix:** Seed minimal non-quiz activity (e.g., `seedStudySessions`) so the page renders normally, then unconditionally assert `quiz-completion-card` contains "No quizzes started yet".

---

### [High] `addInitScript` is registered after initial navigation
**File:** `tests/e2e/story-e17-s01.spec.ts:38-48` | **Confidence:** 85

`page.addInitScript()` registers a script for future navigations only. It is called after `page.goto('/')` has already loaded, so localStorage is not set for that initial load. The test works currently only because `goToReports` triggers a new navigation — but is fragile if client-side routing is ever used.

**Fix:** Move `addInitScript` before `page.goto('/')`.

---

### [High] AC6 says "floored" but implementation uses raw float; UI uses `Math.round`
**File:** `src/lib/__tests__/analytics.test.ts:348` | **Confidence:** 80

The implementation returns `(completedCount / startedCount) * 100` (a float). The UI calls `Math.round()`. The unit test for the 1/3 case uses `Math.round(result.completionRate)`, which masks whether floor or round is used. At boundaries like 2/3 * 100 = 66.67, `Math.round` gives 67 while `Math.floor` gives 66 — the AC behavior is not enforced by any test.

**Fix:** Add a unit test for `completedCount=2, startedCount=3` asserting the expected value per the AC (66 if floored, 67 if rounded), and align implementation + UI to match.

---

### [High] No test for double-counting when quiz is both completed and in-progress
**File:** `src/lib/__tests__/analytics.test.ts` | **Confidence:** 75

A realistic scenario: user completes a quiz, then starts it again. The quiz ID appears in both `quizAttempts` (completed) and `currentProgress` (in-progress). The implementation adds `inProgressCount` unconditionally, inflating `startedCount` and dropping the rate below 100% for a fully-completed quiz.

**Fix:** Add unit test: one `q1` attempt in DB + `currentProgress.quizId = 'q1'` in localStorage → `startedCount` should be 1, `completionRate` should be 100%.

---

### [Medium] E2E tests use inline objects instead of `makeAttempt` factory
**File:** `tests/e2e/story-e17-s01.spec.ts:33-36` | **Confidence:** 65

Inline objects bypass type safety and omit schema fields that `makeAttempt` would provide (e.g., `totalQuestions`, `lessonId`). Will silently break if the Dexie schema evolves.

**Fix:** Import `makeAttempt` from the factory and pass its output to `seedQuizAttempts`.

---

### [Medium] `inProgressQuizIds` array path has no E2E coverage
**File:** `tests/e2e/story-e17-s01.spec.ts` | **Confidence:** 60

Unit coverage exists for this alternate localStorage shape, but the UI rendering for this path is not exercised end-to-end. Lower priority given unit coverage.

---

### [Nit] `beforeEach` is between `describe` blocks rather than inside one
**File:** `src/lib/__tests__/analytics.test.ts:279-282` | **Confidence:** 55

Scope is non-obvious. Move inside `describe('calculateCompletionRate')` block.

---

### [Nit] Two page navigations per E2E test are expected but underdocumented
**File:** `tests/e2e/story-e17-s01.spec.ts:29` | **Confidence:** 50

The pattern (navigate to `/`, seed, navigate to `/reports`) is correct but costs two full page loads per test. The comment explains why — this is acceptable but worth noting as a known performance cost.

---

## Edge Cases Not Tested

- In-progress quiz already completed (double-count) — untested at both unit and E2E
- `inProgressQuizIds` containing a quiz ID also in `completedQuizIds`
- Reports page overall empty state hiding the quiz card entirely
- `calculateCompletionRate` async failure (IndexedDB unavailable) → silent 0% display
- Fractional rates where floor ≠ round (e.g., 2/3 = 66.67%)
