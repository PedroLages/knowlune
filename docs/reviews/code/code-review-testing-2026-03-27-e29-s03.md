# Test Coverage Review: E29-S03 — Fix CareerPaths Mislabelling and Add Sidebar Nav Entry

**Date:** 2026-03-27
**Reviewer:** Claude (automated)
**Verdict:** GAPS FOUND

## Acceptance Criteria Coverage

| AC | Description | Test Coverage | Status |
|----|------------|---------------|--------|
| AC1 | `<h1>` reads "Career Paths", screen readers announce correctly | Unit: MISSING update; E2E: BROKEN (expects old text) | FAIL |
| AC2 | Sidebar "Career Paths" entry exists, highlights active, keyboard navigable | Unit: BROKEN (count mismatch); E2E: no dedicated test | FAIL |
| AC3 | Back-link reads "Back to career paths" | No test coverage | GAP |

## Test Failures (Story-Related)

### Unit Tests (2 failures)
1. `navigation.test.ts` > `Library group has 4 items in correct order` — expects 4 items, now 5
2. `navigation.test.ts` > `getOverflowNav` > `returns remaining items...` — expects 13 items, now 14

### E2E Tests (2 failures)
1. `error-states.spec.ts` > `should show career paths page with learning paths heading` — expects "Learning Paths" heading
2. `error-states.spec.ts` > `should show search empty state when no paths match query` — expects "Learning Paths" heading

## Test Gaps

1. **No E2E test verifying the sidebar "Career Paths" entry** — AC2 requires the entry exists, highlights correctly, and is keyboard navigable. The regression spec (`career-paths.spec.ts` AC6 section) covers this but is gated behind `RUN_REGRESSION` and also has stale text.

2. **No test for back-link text** — AC3 requires "Back to career paths" text. The regression spec line 241+ covers sidebar link but not the back-link aria-label specifically.

3. **No test for remaining aria-labels** — The `aria-label="Learning paths"` on the list element (line 346) and `aria-label="Search learning paths"` (line 315) are not tested and still contain wrong text.

## Recommendations

1. Fix the 2 unit test failures by updating expected counts and adding "Career Paths" to the Library items array
2. Fix the 2 E2E test failures by updating heading expectations to "Career Paths"
3. Fix the 6 remaining "learning path(s)" text instances in CareerPaths.tsx
4. Update the regression spec to use "Career Paths" throughout
