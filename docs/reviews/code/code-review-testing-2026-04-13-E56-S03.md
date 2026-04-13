# Test Coverage Review: E56-S03 Knowledge Map Overview Widget

**Date:** 2026-04-13
**Reviewer:** Claude (inline)

## Coverage

- **dashboardOrder.ts**: 25 unit tests, all passing — covers constants, CRUD, stats, ordering, pinning, reset
- **No E2E spec**: No story-specific Playwright test exists

## AC Mapping

| AC | Test Coverage | Status |
|----|--------------|--------|
| AC1: knowledge-map in DashboardSectionId | `dashboardOrder.test.ts` — DEFAULT_ORDER length, SECTION_LABELS | COVERED |
| AC2: Treemap with 5 cells | No test — visual component, would need E2E | GAP |
| AC3: Focus Areas panel | No test | GAP |
| AC4: Mobile accordion fallback | No test | GAP |
| AC5: Design tokens / dark mode | Verified via design review (Playwright) | COVERED |
| AC6: See full map link | Verified via design review (link href check) | COVERED |
| AC7: Empty state | No test | GAP |
| AC8: Action button navigation | No test | GAP |

## Findings

### MEDIUM

1. **No E2E test for the widget** — AC2-4, AC7-8 have no automated test coverage. The widget rendering, mobile fallback, empty state, and action navigation are only verified manually. Consider adding a basic E2E spec.

### LOW

2. **Test uses real Date** — `dashboardOrder.test.ts:198-203`: `new Date().toISOString()` and `Date.now()` used without `vi.useFakeTimers()` in `computeRelevanceScore` tests. Tests pass due to relative comparisons but are technically non-deterministic.

## Verdict

Unit test quality is good (25 tests, clean mocking). Missing E2E coverage for visual/interactive ACs is a gap but acceptable for a widget story.
