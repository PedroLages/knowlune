# Test Coverage Review: E07-S02 — Recommended Next Dashboard Section (Round 3)

**Review Date**: 2026-03-08
**Reviewed By**: Claude Code (code-review-testing agent)

## AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1 | 3+ active courses → exactly 3 cards | `recommendations.test.ts:176` (cap), `:202` (ranking) | `story-e07-s02.spec.ts:43` (seeds 4, asserts 3) | Covered |
| 2 | Fewer than 3 → show all | `recommendations.test.ts:163` (2 of 2) | `story-e07-s02.spec.ts:93` (seeds 2, asserts 2) | Covered |
| 3 | Card click → navigate | None | `story-e07-s02.spec.ts:130` (click + toHaveURL) | Covered |
| 4 | No active courses → empty state | None | `story-e07-s02.spec.ts:30` (testid, text, CTA) | Covered |
| 5 | Rankings refresh after session | None | `story-e07-s02.spec.ts:154` (reload after write) | Partial |

**Coverage**: 4/5 ACs fully covered | 0 gaps | 1 partial

## Findings

### Blockers

None.

### High Priority

**H1: AC5 test doesn't verify ranking change (confidence: 92)**
- Only verifies count change on reload, not ranking order recalculation.
- Fix: After initial observation, promote one course above another by modifying `lastAccessedAt`, reload, assert new ordering.

**H2: AC3 URL assertion uses regex that could partial-match (confidence: 85)**
- `/\/courses\/6mx/` would match `/courses/6mx-extended`.
- Fix: Use exact string `expect(page).toHaveURL('/courses/6mx')`.

### Medium

**M1: Overview unit test mocks RecommendedNext but never asserts it (confidence: 78)**
- No test verifies `<RecommendedNext />` is present in Overview layout.
- Fix: Add `expect(await screen.findByTestId('recommended-next')).toBeInTheDocument()`.

**M2: No test for `totalLessons === 0` guard (confidence: 75)**
- `computeCompositeScore` returns 0 early, `getRecommendedCourses` skips — neither tested.

**M3: AC1 test relies on assumption about absent course ID (confidence: 72)**
- Uses `ba-101` which happens to not be in `allCourses`. Replace with `__nonexistent-course__`.

**M4: AC4 CTA visible but not click-tested (confidence: 70)**
- "Explore courses" link asserted visible but navigation not verified.

### Nits

**N1**: `makeProgress` factory sets `startedAt = lastAccessedAt` (confidence: 60).
**N2**: Card count selector could match non-card course links (confidence: 55).
**N3**: No test for loading/skeleton state (confidence: 50).

## Edge Cases to Consider

- Score tie-breaking stability (no test pins this)
- 30-day session window filtering (only tested indirectly in E2E)
- `PROGRESS_UPDATED_EVENT` same-tab path (custom event listener untested)
- `getAllProgress()` JSON parse failure (silently returns `{}`)

## Summary

ACs: 4/5 covered | 1 partial | Findings: 9 | Blockers: 0 | High: 2 | Medium: 4 | Nits: 3
