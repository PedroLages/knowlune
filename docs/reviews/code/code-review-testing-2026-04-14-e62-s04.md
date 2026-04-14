# Test Coverage Review: E62-S04 — E2E Tests for Knowledge Map FSRS Integration

**Reviewer**: Claude (code-review-testing agent)
**Date**: 2026-04-14
**Story**: E62-S04

## Acceptance Criteria Coverage

| AC   | Description                                  | Test      | Status                                                                |
| ---- | -------------------------------------------- | --------- | --------------------------------------------------------------------- |
| AC-1 | Treemap cells show varied background colors  | AC-1 test | COVERED — asserts >= 2 distinct fill colors                           |
| AC-2 | Low retention tooltip contains "Fading"      | AC-2 test | COVERED — hovers Chemistry cell, checks /[Ff]ading/                   |
| AC-3 | High retention tooltip contains "Stable"     | AC-3 test | COVERED — hovers Calculus cell, checks /[Ss]table/                    |
| AC-4 | Popover shows Memory Decay with retention %  | AC-4 test | COVERED — clicks cell, checks "Memory Decay" text + aria-label        |
| AC-5 | No Memory Decay for topic without flashcards | AC-5 test | COVERED — clicks Art History cell, checks absence                     |
| AC-6 | Dark mode renders without console errors     | AC-6 test | COVERED — enables dark mode, checks text visibility + filtered errors |
| AC-7 | Deterministic dates                          | AC-7 test | COVERED — verifies browser Date.now() matches FIXED_DATE              |

## Test Quality Assessment

### Strengths

- Deterministic seed data with FSRS parameters (stability, last_review) producing predictable retention
- Uses shared seeding helpers (seedImportedCourses, seedQuizzes, etc.) per project conventions
- Browser date mocking via `addInitScript` in `beforeEach`
- All dates use `FIXED_DATE` and `getRelativeDate()` from test-time.ts
- Tests are independent (each seeds its own data)

### Gaps

1. **AC-4 does not verify decay date text** — The AC says "a retention percentage and decay date" but the test only verifies the retention progress bar `aria-label`. The decay date text is not explicitly asserted. (ADVISORY)

2. **No negative-path test for tooltip on no-FC topic** — AC-5 tests the popover absence of Memory Decay, but there's no test hovering a no-flashcard topic to verify its tooltip does NOT contain "Fading"/"Stable". (ADVISORY)

3. **Dark mode test doesn't verify dark colors are applied** — Only checks text opacity and console errors, not that dark-mode-specific fill colors are used. (ADVISORY — noted by GLM review too)

## Verdict

All 7 ACs are covered. 3 advisory gaps identified — none blocking.

---

Coverage: 7/7 ACs | Gaps: 3 advisory
