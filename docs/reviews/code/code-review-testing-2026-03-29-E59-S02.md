# Test Coverage Review: E59-S02 — FSRS Algorithm Wrapper

**Date:** 2026-03-29
**Reviewer:** Claude (automated)
**Story:** E59-S02 — FSRS Algorithm Wrapper

## Acceptance Criteria Coverage

| AC | Description | Test Coverage | Status |
|----|-------------|---------------|--------|
| 1 | `spacedRepetition.ts` rewritten as ts-fsrs wrapper | Build passes, imports verified | COVERED (by build) |
| 2 | `calculateNextReview` returns FSRS fields | Existing tests reference old fields; rewrite deferred to E59-S07 | DEFERRED |
| 3 | `predictRetention` uses FSRS forgetting curve | Existing tests reference old interface; rewrite deferred | DEFERRED |
| 4 | `isDue` uses `due` field | Existing tests reference `nextReviewAt`; rewrite deferred | DEFERRED |
| 5 | FSRS config: retention=0.9, maxInterval=365, fuzz=true, shortTerm=true | Verified by code inspection (lines 23-28) | COVERED (by inspection) |
| 6 | Single gateway pattern | Grep confirms only 1 file imports ts-fsrs | COVERED (by grep) |
| 7 | Rating conversion inside wrapper only | `RATING_MAP` is module-private (lines 41-46) | COVERED (by inspection) |
| 8 | ISO dates converted at boundary | Date objects only used when calling ts-fsrs API | COVERED (by inspection) |
| 9 | New card (null) handled without Invalid Date | `createEmptyCard(now)` used for null cards (line 110) | COVERED (by inspection) |
| 10 | Test FSRS instance with enable_fuzz=false | `fsrsTest` exported (lines 31-36) | COVERED (by inspection) |

## Test Quality Assessment

### Current State

- **20/23 unit tests FAIL** — Expected. Tests assert SM-2 behavior (intervals, easeFactor, nextReviewAt) which no longer exists. This is documented in the story file and test rewrite is deferred to E59-S07.
- **3/23 tests PASS** — Tests that happen to work with the new interface shape.
- **No E2E tests** — Appropriate for a pure-logic library module with no UI surface.

### Gaps

1. **No FSRS-specific unit tests yet** — The rewritten module has no tests validating FSRS-specific behavior (stability, difficulty, state transitions, forgetting curve coefficients). This is explicitly deferred to E59-S07.
2. **Coverage threshold breach** — Global line coverage at 69.08% vs 70% threshold. This is pre-existing (not caused by this story).

### Risk Assessment

**LOW RISK** — This is a pure-function library with no side effects. The implementation delegates all scheduling logic to the well-tested `ts-fsrs` library (v4.7.1). The wrapper is thin enough that the risk of bugs is minimal. Consumer integration (stores, components) will be validated in subsequent stories (E59-S04, S05).

## Verdict

**ACCEPTABLE** — Test coverage is deferred by design. The story scope is intentionally limited to the wrapper rewrite, with test updates planned for E59-S07. No test gaps that should block this story.
