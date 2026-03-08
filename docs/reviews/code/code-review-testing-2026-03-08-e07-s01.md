# Test Coverage Review: E07-S01 — Momentum Score Calculation & Display

**Date**: 2026-03-08
**Reviewer**: Test Coverage Agent

## AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1 | Score = weighted recency (40%) + completion (30%) + frequency (30%), range 0-100 | `momentum.test.ts:55-168` | None | Partial |
| 2 | Visual indicator: hot/warm/cold with colors, icons, ARIA | None | `story-e07-s01.spec.ts:21-50` | Partial |
| 3 | No sessions → score 0, tier cold | `momentum.test.ts:56-69` | None | Partial |
| 4 | "Sort by Momentum" orders highest to lowest, indicators visible | None | `story-e07-s01.spec.ts:53-77` | Partial |
| 5 | Score recalculates within page session after study session | None | None | **Gap** |

**Coverage**: 0/5 fully covered | 1 gap (AC5) | 4 partial

## Findings

### Blockers

1. **AC5 has zero test coverage** (confidence: 95)
   - No test fires `study-session-ended` event and verifies score update
   - Suggested: E2E test using `page.evaluate(() => window.dispatchEvent(new CustomEvent('study-session-ended')))`

### High Priority

2. **Sort test doesn't verify ordering** — `story-e07-s01.spec.ts:53-77` (confidence: 85)
   - Only checks badge count and select value, not actual course order
   - All courses have score 0 (no seeded sessions) — sort is a no-op
   - Fix: Seed differentiated study sessions, assert first card has higher score than last

3. **Badge visibility assertion fragile** — `story-e07-s01.spec.ts:11-19` (confidence: 80)
   - Uses `count > 0` without waiting for async `loadMomentumScores` to resolve
   - Fix: Use `await expect(page.getByTestId('momentum-badge').first()).toBeVisible()`

4. **Select option selectors fragile** — `story-e07-s01.spec.ts:42-51` (confidence: 80)
   - CSS `option[value="..."]` selectors break if refactored to shadcn Select
   - Fix: Assert `toHaveValue('momentum')` instead of querying option elements

5. **Inline `makeSession` factory duplicates shared factory** — `momentum.test.ts:96-111` (confidence: 75)
   - Inconsistent with `tests/support/fixtures/factories/session-factory.ts`
   - Fix: Import and use `createStudySession` from shared factories

### Medium

6. **No sidebar localStorage seeding** — `story-e07-s01.spec.ts` (confidence: 78)
   - Tests don't seed `eduvi-sidebar-v1` — fragile at tablet viewports per project patterns

7. **No boundary test for 14-day recency cliff** — `momentum.test.ts` (confidence: 72)
   - No explicit test for session exactly 14 days old → recency = 0

8. **Weight verification test missing** — `momentum.test.ts` (confidence: 70)
   - No test controls all three components to known values and asserts exact score
   - Weights could be swapped without test failure

### Nits

9. `fake-indexeddb/auto` import unnecessary in pure function test
10. Inline factory `endTime: startTime` vs shared factory `endTime: undefined` inconsistency
11. `badgesBefore` variable name misleading — never used for ordering comparison
