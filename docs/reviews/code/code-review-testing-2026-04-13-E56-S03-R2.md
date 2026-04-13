# Test Coverage Review R2: E56-S03 Knowledge Map Overview Widget

**Date:** 2026-04-13
**Reviewer:** Claude (Opus)

## AC Coverage

| AC | Description | Test Coverage | Status |
|----|-------------|---------------|--------|
| AC1 | Dashboard section registration | Unit test (25 tests) | ✅ Covered |
| AC2 | Treemap renders with data | E2E `AC2` test | ❌ FAILS — no data seeded |
| AC3 | Empty state | E2E `AC3` test | ✅ Passes |
| AC4 | Focus Areas panel | No E2E test | ⚠️ Gap |
| AC5 | Dark mode design tokens | No test | ⚠️ Gap (visual only) |
| AC6 | "See full map" navigation | E2E `AC7` test | ✅ Passes (graceful skip) |
| AC7 | Empty state message | Covered by AC3 | ✅ |
| AC8 | Mobile accordion | E2E `AC8` test | ❌ FAILS — no data seeded |

## Findings

### HIGH

1. **2 of 4 E2E tests fail** — AC2 and AC8 tests don't seed IndexedDB data but assert elements that only render in the non-empty state. Need to either seed data or adjust assertions.

### MEDIUM

2. **No test for Focus Areas panel** — AC4 (top 3 urgent topics with badges and action buttons) has no E2E coverage. The action button navigation is untested.

### LOW

3. **AC7 test uses localStorage seed flag** — `knowledge-map-widget.spec.ts:38`: Sets `knowlune-knowledge-seed-demo` localStorage flag, but the application code doesn't check this flag. The test gracefully skips via `isVisible().catch()` which means AC7 is effectively skipped, not tested.

## Unit Tests

- `dashboardOrder.test.ts`: 25 tests, all passing. Good coverage of ordering, pinning, relevance scoring.

## Verdict

**ISSUES FOUND** — 1 HIGH (2 failing tests), 1 MEDIUM (AC4 gap), 1 LOW (AC7 effectively skipped)
