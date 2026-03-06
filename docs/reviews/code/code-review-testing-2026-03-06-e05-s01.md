# Test Coverage Review: E05-S01 — Daily Study Streak Counter (Round 2)

**Date**: 2026-03-06
**Reviewer**: Test Coverage Agent (Opus)

## AC Coverage Table

| AC | Description | Unit Tests | E2E Tests | Coverage |
|----|-------------|-----------|-----------|----------|
| AC1 | Streak counter visible on Overview | `studyLog.test.ts` (53 tests) | `story-e05-s01.spec.ts:35,46` | Covered |
| AC2 | Live increment without reload | `studyLog.test.ts:117` (event dispatch) | `story-e05-s01.spec.ts:61,92` | Covered (event dispatch now unit-tested) |
| AC3 | Calendar heatmap + keyboard a11y | `studyLog.test.ts:403-427` (activity) | `story-e05-s01.spec.ts:124,143` | Partial (keyboard nav not simulated) |

## Key Findings

### High Priority

1. **CSS class-based active cell selector** (`story-e05-s01.spec.ts:138`) — confidence: 82
   - Uses `button[class*="bg-green"]` — fragile against Tailwind class changes. Should use `data-testid`.

2. **Longest streak value not asserted** (`story-e05-s01.spec.ts:42`) — confidence: 78
   - E2E only asserts "Longest Streak" label is visible, never the numeric value. No `data-testid="longest-streak-value"`.

3. **Keyboard test doesn't simulate navigation** (`story-e05-s01.spec.ts:143-161`) — confidence: 75
   - Asserts buttons exist with `aria-label` but never presses Tab or verifies focus traversal.

### Medium

4. **No test for Pause Streak dialog** — confidence: 70
   - Complete interactive workflow (open dialog, enter value, activate pause, verify alert) has zero test coverage.

5. **Local `makeAction` vs shared factory** (`studyLog.test.ts:19-26`) — confidence: 72
   - Unit test defines local helper instead of using shared `createStudyAction` factory.

6. **localStorage cleanup gap** (`story-e05-s01.spec.ts:28-33`) — confidence: 70
   - `beforeEach` seeds sidebar but doesn't clear streak-related localStorage keys.

### Nits

7. **Midnight flakiness risk** (`story-e05-s01.spec.ts:12-25`) — confidence: 55
   - `makeStreakEntry` uses real clock `new Date()`, could fail near midnight.

8. **Loose aria-label assertion** (`story-e05-s01.spec.ts:159-160`) — confidence: 48
   - Only checks label contains `:` — any string with a colon passes.

## Summary

- **3/3 ACs have test coverage** (2 full, 1 partial)
- **53 unit tests** for streak logic (up from 52 — new event dispatch test)
- **6 E2E tests** in `story-e05-s01.spec.ts`
- **Previous blocker resolved**: Event dispatch now unit-tested
- **DST edge cases** well-tested in unit tests
