# Test Coverage Review: E29-S05 — Guard JSON.parse in Layout.tsx Sidebar State Parsing

**Date:** 2026-03-27
**Reviewer:** Claude Opus 4.6 (automated)
**Story:** E29-S05
**Files Changed:** `src/app/components/Layout.tsx`

## Summary

This is a defensive coding fix (try/catch around JSON.parse). No new test files were added. The story file mentions unit tests should be written but none exist.

## Findings

### MEDIUM: No unit tests for the guarded JSON.parse paths

The story's testing notes specify:
- Unit test: Mock `localStorage.getItem` to return corrupted JSON, verify default state is returned
- Unit test: Mock `localStorage.getItem` to return valid JSON, verify parsed state is returned
- Unit test: Verify `localStorage.removeItem` is called when parse fails

None of these were implemented. Given this is a defensive fix for an audit finding (H9, 90% confidence), having at least one test verifying the catch path activates on corrupted data would prevent regression.

**Recommendation:** Add a lightweight unit test that renders Layout with corrupted localStorage and verifies no crash + default state. However, since the state initializer is inside useState, testing requires rendering the component, which may be complex. The E2E navigation tests passing confirms no regression for the happy path.

### LOW: E2E tests don't cover corrupted localStorage scenario

No E2E test sets corrupted localStorage before page load to verify recovery. This is an edge case that's hard to hit in normal usage but was the explicit audit finding.

## Verdict

**ADVISORY** — The fix itself is correct and the happy path is covered by existing E2E navigation tests. The lack of dedicated unit tests for the catch path is noted but not blocking, given the simplicity of the fix and the low likelihood of regression.

## AC-to-Test Mapping

| AC | Test Coverage | Status |
|----|--------------|--------|
| JSON.parse wrapped in try/catch | Code inspection only | PARTIAL |
| Fallback to default state | E2E navigation tests (implicit) | PARTIAL |
| Corrupted value removed | No test | GAP |
| No regression with valid state | E2E navigation tests | COVERED |
