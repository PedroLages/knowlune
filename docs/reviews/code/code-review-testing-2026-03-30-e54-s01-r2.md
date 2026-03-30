# Test Coverage Review: E54-S01 — Wire Lesson Flow (Round 2)

**Date:** 2026-03-30
**Story:** E54-S01
**Round:** 2

## Unit Test Coverage (PASS)

**File:** `src/app/pages/__tests__/UnifiedLessonPlayer.test.tsx`
**Result:** 6/6 passing

| Test | AC | Verdict |
|------|-----|---------|
| Renders lesson player content | Setup | PASS |
| Shows celebration modal when video ends | AC1, AC2 | PASS |
| Does NOT show celebration on persistence failure | AC1 (error path) | PASS |
| Shows lesson-level celebration when not all complete | AC1, AC2 | PASS |
| Shows course-level celebration when all complete | AC6 | PASS |
| Does not call getLessons() in showCelebration | Performance (dedup fix) | PASS |

**Assessment:** Unit tests are well-structured with proper mocking. They test the critical callback logic including the error path (persistence failure). The dedup verification test confirms the Round 1 fix.

## E2E Test Coverage (FAILING)

**File:** `tests/e2e/story-e54-s01.spec.ts`
**Result:** 3/9 passing, 6/9 failing

### Passing Tests

| Test | AC | Verdict |
|------|-----|---------|
| Next button navigates to next lesson | AC4 | PASS |
| Previous button navigates to previous lesson | AC4 | PASS |
| Manual completion toggle shows celebration | AC5 | PASS |

### Failing Tests

| Test | AC | Failure Reason |
|------|-----|----------------|
| Marks lesson as completed when video ends | AC1 | `video` element not found (no fileHandle) |
| Shows lesson celebration modal | AC2 | `video` element not found |
| Celebration modal has Close/Continue buttons | AC2 | `video` element not found |
| Auto-advance countdown visible | AC3 | `video` element not found |
| Cancel button stops auto-advance | AC3 | `video` element not found |
| Course completion celebration on last video | AC6 | `video` element not found |

**Root cause:** All 6 failures share the same root cause — `simulateVideoEnd()` requires a `<video>` DOM element, but seeded ImportedVideo records have no `fileHandle`, so `LocalVideoContent` never renders a video player.

## AC Coverage Matrix

| AC | Unit Tests | E2E Tests | Overall |
|----|-----------|-----------|---------|
| AC1: Video end triggers completion | Covered | FAILING | Partial |
| AC2: Celebration modal appears | Covered | FAILING | Partial |
| AC3: Auto-advance countdown | Not covered | FAILING | Not covered |
| AC4: Prev/next navigation | Not covered | PASSING | Covered |
| AC5: Manual completion toggle | Not covered | PASSING | Covered |
| AC6: Course-level celebration | Covered | FAILING | Partial |
| AC7: Manual toggle details | Not covered | PASSING (AC5) | Covered |
| AC8: Keyboard accessibility | Not covered | Not covered | Gap |

## Recommendations

1. **Fix E2E video simulation** — Either mock the video element at page level or restructure tests to not depend on native `<video>` element
2. **Add AC8 test** — Keyboard accessibility on cancel button (Tab + Enter) is untested
3. **Consider adding AC3 unit test** — Auto-advance countdown logic is only covered by failing E2E tests
