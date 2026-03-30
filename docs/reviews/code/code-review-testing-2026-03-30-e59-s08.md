# Test Coverage Review — E59-S08: E2E Tests and Test Factory Updates

**Date:** 2026-03-30
**Reviewer:** Claude Opus 4.6 (automated)
**Branch:** feature/e59-s08-e2e-tests-and-test-factory-updates

## Acceptance Criteria Coverage

| AC | Description | Test(s) | Status |
|----|-------------|---------|--------|
| AC1 | Review factory uses FSRS fields | story-e59-s08.spec.ts:237 (AC8) | PASS — validates all FSRS fields present, SM-2 fields absent |
| AC2 | `createDueReviewRecord()` has `due` in past | story-e59-s08.spec.ts:55 (AC1) | PASS — seeds due record, review card visible |
| AC2 | `createFutureReviewRecord()` has `due` in future | story-e59-s08.spec.ts:79 (AC2) | FAIL — `review-empty-state` not found |
| AC3 | Flashcard factory exists with correct interface | story-e59-s08.spec.ts:207,219,229 (AC5-7) | PASS — factory unit tests validate FSRS defaults |
| AC3 | Factories use `FIXED_DATE`/`getRelativeDate()` | story-e59-s08.spec.ts:214,224,233 | PASS — deterministic dates verified |
| AC4 | E11-S01/S02/S05 use FSRS fields | regression specs | FAIL — 6 failures after migration |
| AC4 | All existing E2E tests still pass | regression specs | FAIL — contradicts AC |
| AC5 | New E2E spec validates FSRS scheduling | story-e59-s08.spec.ts | PARTIAL — 6 pass, 2 fail |

## Test Quality Assessment

### Strengths
- Good mix of browser E2E tests (4) and fast factory unit tests (4)
- Proper afterEach cleanup with error swallowing (`.catch()`) to avoid cascading failures
- IDB verification test (AC3) reads raw IndexedDB data to verify persistence, not just UI
- Negative test for SM-2 field absence is thorough

### Issues
- **2 browser tests fail**: AC2 (future card filtering) and AC4 (flashcard due count)
- **6 regression tests fail**: The FSRS schema migration broke existing specs
- No test for `createLearningFlashcard()` or `createNewReviewRecord()` — these new factories are exported but untested

### Edge Cases Not Covered
- Flashcard with `state=0` (New) and `due=FIXED_DATE` — is it counted as "due"?
- Review record with `due` exactly equal to current time (boundary)
- Multiple courses with mixed due/future flashcards
- Concurrent seeding of notes + review records (race conditions)

## Recommendations

1. Fix the 8 failing tests (2 story + 6 regression) — this is the primary blocker
2. Add unit tests for `createLearningFlashcard()` and `createNewReviewRecord()`
3. Consider a boundary test for `due === now` (is it "due" or "not due"?)
