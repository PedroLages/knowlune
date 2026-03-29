# Test Coverage Review - E59-S07 "Unit Test Rewrite for FSRS Algorithm"

**Date:** 2026-03-30
**Reviewer:** Claude (automated)
**Test File:** `src/lib/__tests__/spacedRepetition.test.ts`
**Implementation File:** `src/lib/spacedRepetition.ts`

---

## Summary

38 tests covering all 3 exported functions (`calculateNextReview`, `predictRetention`, `isDue`) plus the exported `fsrsTest` instance. Acceptance criteria coverage is strong.

**Verdict:** 0 gaps in AC coverage, 1 MEDIUM quality suggestion

---

## Acceptance Criteria Coverage Matrix

| AC | Description | Test(s) | Status |
|----|-------------|---------|--------|
| AC1 | Tests rewritten to verify FSRS behavior | All 38 tests use FSRS | COVERED |
| AC2 | New card + each rating -> correct state transitions | Lines 44-69 (4 tests) | COVERED |
| AC3 | Review card + each rating -> stability/difficulty changes | Lines 117-193 (9 tests) | COVERED |
| AC4 | `predictRetention()` power-law decay (not exponential) | Lines 337-348 (explicit power-law test) | COVERED |
| AC5 | `isDue()` with `due` field | Lines 372-395 (4 tests) | COVERED |
| AC6 | Edge case: card with `last_review: undefined` | Lines 198-216 | COVERED |
| AC7 | Tests use `fsrsTest` (enable_fuzz: false) | All `calculateNextReview` calls pass `fsrsTest` | COVERED |
| AC8 | Tests use `FIXED_DATE` constant | Line 22, used throughout | COVERED |
| AC9-11 | Migration logic (easeFactor->difficulty, interval->stability, state) | Delegated to `migration-v31-fsrs.test.ts` (per story Task 7) | DEFERRED (OK) |

---

## Test Quality Assessment

### Strengths

1. **Behavioral assertions** — tests verify FSRS invariants (stability ordering, difficulty bounds 0-10, state transitions) rather than exact snapshot values, making them resilient to ts-fsrs version upgrades
2. **Integration flow** — "new card -> Good -> Good -> Good" and "Again -> Good recovery" tests validate multi-step scheduling which is the real-world usage pattern
3. **Edge cases well covered** — undefined last_review, stability=0, invalid date string, 10 consecutive Again/Easy for boundary testing
4. **Power-law verification** — the `R(t=S) ~= 90%` test (lines 337-348) directly validates the FSRS forgetting curve property, distinguishing it from exponential decay

### MEDIUM Suggestion

**M1. No test for `calculateNextReview` default parameter behavior**

The implementation accepts optional `now` and `fsrsInstance` parameters with defaults (`new Date()` and production `fsrs`). While tests always pass explicit values (correct for determinism), there's no test verifying that the function works when called with just `(null, 'good')` — the minimal API that consumers would use.

A single test calling `calculateNextReview(null, 'good')` (no explicit date/instance) would verify the default parameter wiring works. This is low-risk since TypeScript enforces defaults, but it documents the intended API surface.

**Classification:** STORY-RELATED (advisory)

---

## Missing Edge Cases (Advisory)

These are not required by the ACs but could improve robustness:

1. **Negative elapsed_days** — what happens if `due` is in the future but the card is reviewed early? The implementation passes it through to ts-fsrs, which handles it, but a test would document the behavior.
2. **Very large stability values** — stability > 365 (maximum_interval). FSRS clamps internally but verifying the behavior documents it.

These are suggestions for future hardening, not blockers for this story.
