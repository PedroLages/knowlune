# Test Coverage Review: E59-S05 — Retention Metrics and Consumer Updates

**Date:** 2026-03-30
**Reviewer:** Claude Opus 4.6 (automated)
**Branch:** `feature/e59-s05-retention-metrics-consumer-updates`

## Acceptance Criteria Coverage

| AC | Description | Test Coverage | Verdict |
|----|-------------|---------------|---------|
| AC1 | retentionMetrics `makeReview` factory uses FSRS fields, assertions reflect FSRS retention logic | 22 tests pass with FSRS fields; retention calibrated (stability=1, 14d elapsed -> ~48%) | COVERED |
| AC2 | interleave `makeRecord` factory uses FSRS fields | 9 tests pass with FSRS fields | COVERED |
| AC3 | exportService uses `last_review` instead of `reviewedAt` | Mock data updated, 33 tests pass | COVERED |
| AC4 | NotificationService uses `due` instead of `nextReviewAt` | Mock data updated, `isDue` semantics correct, 21 tests pass | COVERED |
| AC5 | Zero TS errors in updated files, all unit tests pass | 0 TS errors in changed files, 85/85 tests pass | COVERED |

## Test Quality Assessment

### Strengths

1. **Factory pattern consistency**: All 4 test files use factory functions (`makeReview`, `makeRecord`) with `Partial<ReviewRecord>` overrides — clean, DRY pattern
2. **FSRS-aware test data**: Retention thresholds calibrated against actual FSRS forgetting curve (stability=1 + 14d = ~48%, stability=3 + 14d = ~69%)
3. **Semantic correctness**: NotificationService test updated from "missing `nextReviewAt` = due" (SM-2) to "due field set at creation" (FSRS) — reflects real FSRS behavior
4. **Deterministic time**: All tests use `FIXED_NOW` / `FIXED_DATE` constants — no `Date.now()` calls

### Edge Cases

| Edge Case | Covered? | Notes |
|-----------|----------|-------|
| Missing `last_review` (new card, never reviewed) | Partial | `last_review` is optional in type, but test factories always provide it. The `predictRetention` function handles undefined `last_review` in production code |
| Zero stability | Not tested | Edge case: stability=0 would cause division issues in forgetting curve. Not in scope for this story (pure factory migration) |
| Negative elapsed days | Not tested | Would occur if `last_review` is in the future. Low risk — not in scope |

### Anti-Patterns Check

| Pattern | Status |
|---------|--------|
| `Date.now()` in tests | CLEAN |
| `waitForTimeout()` hard waits | CLEAN |
| Manual IndexedDB seeding | CLEAN (tests use Vitest mocks) |
| Non-deterministic data | CLEAN |

## Issues Found

### STORY-RELATED

None — test coverage is complete for all acceptance criteria.

### PRE-EXISTING

| # | Severity | Description |
|---|----------|-------------|
| 1 | ADVISORY | `spacedRepetition.test.ts` still uses SM-2 fields — scheduled for E59-S07 |
| 2 | ADVISORY | Global coverage at 69.39% (below 70% threshold) — not caused by this story |

## Verdict

**PASS** — All 5 acceptance criteria fully covered. 85/85 tests pass. Test data calibrated to FSRS forgetting curve semantics. No test anti-patterns detected.
