# Test Coverage Review: E13-S01 — Navigate Between Questions

**Date:** 2026-03-20
**Branch:** feature/e13-s01-navigate-between-questions
**Reviewer:** code-review-testing agent

---

## AC Coverage Summary

**Acceptance Criteria Coverage:** 5/5 ACs tested (**100%**)

**COVERAGE GATE:** PASS (≥80%)

---

## AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1 | Question grid/map for direct navigation | `QuestionGrid.test.tsx:47-56` (click callback), `QuizNavigation.test.tsx:41-46` (grid renders) | `story-e13-s01.spec.ts:163-180` (bubble click jumps to Q3) | Covered |
| 2 | Previous/Next buttons; disabled Previous on Q1; Submit on last Q | `QuizActions.test.tsx:27-60`, `useQuizStore.test.ts:800-828` (navigateToQuestion bounds) | `story-e13-s01.spec.ts:123-144` (Next/Prev), `146-161` (Submit on last) | Covered |
| 3 | Current question visually indicated | `QuestionGrid.test.tsx:24-28` (aria-current), `QuestionGrid.test.tsx:36-38` (bg-brand class) | `story-e13-s01.spec.ts:177-180` (aria-current="true" on active bubble) | Covered |
| 4 | Answered vs unanswered visual distinction | `QuestionGrid.test.tsx:31-45` (bg-brand-soft vs bg-card classes) | `story-e13-s01.spec.ts:183-199` (answered bubble `toHaveClass(/bg-brand-soft/)`) | Partial |
| 5 | Cannot navigate past last or before first question | `QuizActions.test.tsx:27-29` (Previous disabled when isFirst), `useQuizStore.test.ts:806-822` (bounds) | `story-e13-s01.spec.ts:132-134` (prevBtn disabled on Q1), `156-157` (Next not visible on last Q) | Covered |

---

## Test Quality Findings

### [High] `isSubmitting` state not tested in QuizActions
**File:** `src/app/components/quiz/__tests__/QuizActions.test.tsx` | **Confidence:** 82

The `isSubmitting` prop drives two distinct behaviors — Submit button shows "Submitting..." text and becomes disabled — but no unit test exercises either state.

**Suggested test:** `it('Submit Quiz button is disabled and shows Submitting… text when isSubmitting=true')` asserting `expect(screen.getByRole('button', { name: /submitting/i })).toBeDisabled()`

### [High] CSS class assertion couples test to implementation details
**File:** `tests/e2e/story-e13-s01.spec.ts:183-199` | **Confidence:** 78

The AC4 E2E test for answered bubble state asserts `toHaveClass(/bg-brand-soft/)`. Coupling to a design-token class name means the test breaks if the class is renamed during a design-token refactor, with no real regression.

**Suggestion:** Verify via `data-state="answered"` attribute or `aria-label` text instead.

### [High] `goToNextQuestion` / `goToPrevQuestion` actions have no unit tests
**File:** `src/stores/__tests__/useQuizStore.test.ts` | **Confidence:** 75

These actions are wired to the Previous/Next buttons via `Quiz.tsx:85-86`. Boundary behavior is only covered indirectly through `navigateToQuestion` tests.

**Suggested tests:**
- `it('advances currentQuestionIndex by 1')`
- `it('is a no-op when already on last question')`
- `it('goToPrevQuestion is a no-op when currentQuestionIndex is 0')`

### [Medium] QuizNavigation composition logic not tested
**File:** `src/app/components/quiz/__tests__/QuizNavigation.test.tsx:29-47` | **Confidence:** 68

Tests verify subcomponents render but not that `isFirst`/`isLast` are computed correctly from `progress.currentQuestionIndex`.

**Suggested test:** render with `progress.currentQuestionIndex = 2` on a 3-question quiz and assert Submit Quiz button is present.

### [Medium] Missing `afterEach` cleanup in E2E spec
**File:** `tests/e2e/story-e13-s01.spec.ts` | **Confidence:** 65

No `afterEach` block to remove `localStorage.removeItem('levelup-quiz-store')`. On test retry, a persisted in-progress quiz could survive across runs.

### [Medium] Shared `vi.fn()` in module-level `defaultProps`
**File:** `src/app/components/quiz/__tests__/QuestionGrid.test.tsx:6-12` | **Confidence:** 60

Module-level `vi.fn()` accumulates call counts across tests. The click test at line 48 creates a fresh mock locally (safe), but other tests sharing `defaultProps.onQuestionClick` see stale state.

**Fix:** Move `defaultProps` construction into `beforeEach`.

### [Nit] `COURSE_ID` and `LESSON_ID` constants could be more descriptive
**File:** `tests/e2e/story-e13-s01.spec.ts:17-57` | **Confidence:** 55

Minor naming nit — the constants are used correctly, just could benefit from more meaningful names.

---

## Summary

| Severity | Count |
|----------|-------|
| Blockers | 0 |
| High | 3 |
| Medium | 3 |
| Nits | 1 |

**AC Coverage Gate:** PASS (5/5 = 100%)
