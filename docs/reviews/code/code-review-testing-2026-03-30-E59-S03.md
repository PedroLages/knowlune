# Test Coverage Review: E59-S03 — Dexie v31 Schema Migration (SM-2 to FSRS) — Round 2

**Date:** 2026-03-30
**Reviewer:** Claude Opus 4.6 (automated)
**Branch:** `feature/e59-s03-dexie-v29-schema-migration`

## Test Files

| File | Tests | Purpose |
|------|-------|---------|
| `src/db/__tests__/migration-v31-fsrs.test.ts` | 10 | Migration upgrade callback correctness |
| `src/db/__tests__/schema-checkpoint.test.ts` | 4 | Checkpoint/migration schema parity |
| `src/db/__tests__/schema.test.ts` | 56 | Full schema CRUD + index verification |

**Total: 70 tests, all passing**

## Acceptance Criteria Coverage

| AC | Description | Test(s) | Covered? |
|----|-------------|---------|----------|
| AC1 | Flashcard SM-2 to FSRS field transformation | `should transform SM-2 flashcard fields to FSRS fields` | Yes |
| AC1 | Legacy SM-2 fields removed from flashcards | Same test (6 `toBeUndefined()` assertions) | Yes |
| AC1 | Flashcard index nextReviewAt to due | `should use due index after migration` | Yes |
| AC2 | ReviewRecord SM-2 to FSRS field transformation | `should transform SM-2 review record fields to FSRS fields` | Yes |
| AC2 | Legacy SM-2 fields removed from reviewRecords | Same test (5 `toBeUndefined()` assertions) | Yes |
| AC2 | ReviewRecord indexes updated | `should use due and last_review indexes after migration` | Yes |
| AC3 | Fresh install uses checkpoint v31 | `checkpoint-created DB should have identical schema to migration-created DB` | Yes |
| AC4 | easeFactor to difficulty mapping | Covered in transform test (3.33 value) + extreme clamp test | Yes |
| AC4 | State derivation (New/Learning/Review) | 3 separate tests (state=0, state=1, state=2) | Yes |
| AC5 | Migration vs checkpoint schema parity | `checkpoint-created DB should have identical schema` | Yes |

## Edge Case Coverage

| Edge Case | Test | Status |
|-----------|------|--------|
| New/never-reviewed flashcard (state=0) | `should handle new/never-reviewed flashcards` | Covered |
| Learning-phase flashcard (interval < 1) | `should handle learning-phase flashcards` | Covered |
| Missing optional fields (no easeFactor, interval, reviewCount) | `should handle review records with missing optional fields` | Covered |
| Extreme easeFactor (below SM-2 minimum) | `should clamp extreme easeFactor values` | Covered |
| Empty tables | `should handle empty tables without error` | Covered |
| Other tables preserved during migration | `should preserve other tables during migration` | Covered |
| Index queries post-migration (due, last_review) | 2 dedicated index query tests | Covered |

## Test Quality Assessment

**Strengths:**
- Tests use real Dexie upgrade path (seed v30, open with v31 declarations) -- not mocked
- Comprehensive assertion coverage: FSRS fields exist, SM-2 fields removed, non-migrated fields survive
- Index queries tested with range queries (belowOrEqual, above) -- verifies indexes are functional
- Schema-checkpoint parity test prevents drift between fresh install and migration paths
- `beforeEach` cleanup with `Dexie.delete()` ensures test isolation

**No issues found.**

## Gaps / Advisory

**ADVISORY-1: No test for `elapsed_days` determinism within a batch**
The fix for Round 1 MEDIUM-1 ensures `migrationNow` is captured once, but no test explicitly verifies two records in the same migration get the same `elapsed_days` base timestamp. Low risk since the fix is straightforward (single `const`).

**ADVISORY-2: No test for invalid ISO date in `reviewedAt`**
`calcElapsedDays` has an `isNaN(lastDate.getTime())` guard, but no test exercises this path with a malformed date string. Low risk since the guard exists.

**ADVISORY-3: No test for easeFactor above SM-2 maximum (e.g., 3.0) or negative interval**
The clamping logic (`Math.max(1.3, Math.min(2.5, ef))` and `Math.max(0, interval)`) handles these but they are untested. Low risk.

## Verdict: PASS

All 5 acceptance criteria are covered. Edge cases are thorough. Test isolation is proper. Three minor advisory gaps noted but none affects confidence in the migration correctness.
