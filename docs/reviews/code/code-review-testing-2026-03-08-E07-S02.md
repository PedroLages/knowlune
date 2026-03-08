# Test Coverage Review: E07-S02 — Recommended Next Dashboard Section (Round 2)

**Date:** 2026-03-08
**Branch:** feature/e07-s02-recommended-next-dashboard-section
**Reviewer:** Test Coverage Agent

## AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1 | 3+ active courses → exactly 3 cards | `recommendations.test.ts:176` (count), `:202` (ranking) | `story-e07-s02.spec.ts:43` (count=3, seeds 4) | Covered |
| 2 | Fewer than 3 active → show all | `recommendations.test.ts:163` | `story-e07-s02.spec.ts:93` (count=2) | Covered |
| 3 | Course card click → navigate | None | `story-e07-s02.spec.ts:130` (click + URL assertion) | Covered |
| 4 | No active courses → empty state | None | `story-e07-s02.spec.ts:30` (empty state + CTA visible) | Covered |
| 5 | Rankings refresh after progress | None | `story-e07-s02.spec.ts:154` (reload, count stable) | **Partial** |

**Coverage:** 4/5 ACs fully covered | 1 partial | 0 gaps

## Findings

### Blockers

None. Previous blocker (AC5 zero coverage) is resolved.

### High Priority

**H1 — AC5 test verifies survival-after-reload, not ranking change (confidence: 88)**
`tests/e2e/story-e07-s02.spec.ts:154-208`: Never mutates progress between observations. Cannot detect stale-cache or ranking inversion. Would pass even with a constant.

**Fix:** Between reloads, update `course-progress` to promote COURSE_3 above COURSE_1, then assert first card href contains `/courses/authority`.

**H2 — AC3 selector too broad (confidence: 78)**
`tests/e2e/story-e07-s02.spec.ts:147`: `section.locator('a').first()` may grab instructor link instead of course link. Assertion `toHaveURL(/\/courses\//)` would pass even for `/courses` list page.

**Fix:** Scope to `section.locator('a[href*="/courses/6mx"]').first()`, assert `toHaveURL(/\/courses\/6mx/)`.

### Medium

**M1 — Overview.test.tsx mock adds no coverage (confidence: 75)**
`src/app/pages/__tests__/Overview.test.tsx:99-101`: RecommendedNext mocked as stub div, never asserted present.

**M2 — No test for `totalLessons === 0` guard (confidence: 72)**
`src/lib/recommendations.ts:28,65`: Early return for empty modules untested.

**M3 — AC4 empty state CTA not click-tested (confidence: 70)**
`tests/e2e/story-e07-s02.spec.ts:37-40`: Asserts link visible but doesn't click or verify navigation.

### Nits

- `makeProgress` factory always sets identical `startedAt`/`lastAccessedAt`
- COURSE_2 (`ba-101`) assumption fragile — use obviously fictitious ID
- No test for loading skeleton → done transition

## Edge Cases Not Covered

- Score tie-breaking (JS `Array.sort` stability)
- Sessions outside 30-day window filter
- Loading skeleton persistence/disappearance

## Verdict

4/5 ACs covered. AC5 partial. 0 blockers, 2 high, 3 medium, 3 nits.
