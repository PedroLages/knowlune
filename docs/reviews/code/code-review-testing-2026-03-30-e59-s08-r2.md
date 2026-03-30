# Test Coverage Review — E59-S08 (Round 2)

**Date:** 2026-03-30
**Story:** E59-S08 — E2E Tests and Test Factory Updates
**Round:** 2

## Acceptance Criteria Coverage

| AC | Description | Test Coverage | Status |
|----|-------------|---------------|--------|
| AC1 | Review factory uses FSRS fields | `story-e59-s08.spec.ts` AC8 validates all FSRS fields present, SM-2 fields absent | COVERED |
| AC2 | Flashcard factory with FSRS defaults | `story-e59-s08.spec.ts` AC5/AC6/AC7 validate state, stability, due dates | COVERED |
| AC3 | Existing E2E tests updated and passing | Regression tests for E11-S01, E11-S02, E11-S05 all pass (20/20) | COVERED |
| AC4 | New E2E spec validates FSRS scheduling | `story-e59-s08.spec.ts` AC1-AC4 cover due filtering, rating persistence, dashboard display | COVERED |

## Test Quality Assessment

### Strengths
- **Deterministic time**: `story-e59-s08.spec.ts` properly freezes clock with `page.clock.install`
- **Factory isolation**: Unit-style tests (AC5-AC8) validate factory output without browser interaction
- **IDB verification**: AC3 reads back from IndexedDB to confirm FSRS field persistence
- **Negative testing**: AC2 verifies future-due cards do NOT appear in review queue
- **Clean data**: `afterEach` cleans all seeded stores with graceful error handling

### Issue
- `story-e11-s05.spec.ts:232` — `Date.now()` needs eslint-disable comment (see code review)

## Factory Coverage

| Factory Function | Tested By |
|-----------------|-----------|
| `createFlashcard()` | AC5 (state=0, stability=0, reps=0) |
| `createDueFlashcard()` | AC6 (state=2, due in past) |
| `createFutureFlashcard()` | AC7 (due in future) |
| `createDueReviewRecord()` | AC8 (all FSRS fields, no SM-2 fields) |
| `createFutureReviewRecord()` | AC2 (used in E2E filtering test) |
| `createLearningFlashcard()` | Not directly tested (available for future use) |
| `createNewReviewRecord()` | Not directly tested (available for future use) |

## Verdict

All acceptance criteria are covered with appropriate test depth. The `createLearningFlashcard` and `createNewReviewRecord` factories are not directly tested but are convenience functions for future stories — acceptable scope for this story.
