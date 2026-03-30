# Test Coverage Review: E91-S01 — Start/Continue CTA + Last Position Resume

**Date:** 2026-03-30
**Reviewer:** Claude Opus 4.6 (automated)

## Acceptance Criteria Coverage

| AC | Description | Test | Status |
|----|-------------|------|--------|
| AC1 | Fresh course → "Start Course" → first lesson | AC1 test | FAIL (wizard blocks) |
| AC2 | Progress → "Continue Learning" + lesson title | AC2 test | FAIL (wizard blocks) |
| AC3 | Completed → "Review Course" | AC3 test | PASS |
| AC4 | CTA navigates to `/courses/:id/lessons/:id` | Covered by AC1/AC2 click assertions | FAIL (blocked) |
| AC5 | Works for YouTube courses | AC5 test | PASS |
| AC6 | Uses `variant="brand"` | AC6 test | PASS (weak assertion) |

## Test Quality

**Good:**
- Uses `seedImportedCourses`, `seedImportedVideos`, `seedIndexedDBStore` helpers (no manual IDB)
- Uses `FIXED_DATE` from test-time utils
- Seeds sidebar state to prevent overlay
- Tests both local and YouTube courses

**Issues:**
- Missing wizard dismissal causes 2/5 tests to fail
- AC6 assertion is not meaningful (checks generic `data-slot` attribute)
- No test for error path (what if Dexie query fails during CTA resolution)
- No test for edge case: course with only PDF lessons (no video → should CTA appear?)

## Gaps

- No unit tests for `getLastWatchedLesson()` or `getFirstLesson()` utility functions
- No test for CTA updating reactively when progress changes (e.g., completing a lesson then returning to detail page)
