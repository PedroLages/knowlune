## Test Coverage Review: E112-S02 — Genre Distribution & Reading Reports

### AC Coverage Summary

**Acceptance Criteria Coverage:** 4/5 ACs tested (**80%**)

**COVERAGE GATE:** PASS (>=80%)

### AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1 | getGenreDistribution — groups genres, <5% → Other, null when <2 books | `ReadingStatsService.test.ts:615-708` | None | Covered |
| 2 | Includes reading/finished/want-to-read, excludes abandoned, caps at 8 genres | `ReadingStatsService.test.ts:692-708` (excluded) / no cap test | None | Partial |
| 3 | getReadingSummary — 5 metrics | `ReadingStatsService.test.ts:729-820` (3 of 5 metrics asserted) | None | Partial |
| 4 | ReadingSummaryCard renders null when no finished books | `ReadingStatsService.test.ts:716-727` (service only, no component render) | None | Partial |
| 5 | Reports page Reading section order | None | None | Gap |

**Coverage**: 1/5 ACs fully covered | 1 gap | 3 partial

### Test Quality Findings

#### Blockers (untested ACs)

- **(confidence: 95)** AC5: "Reports page Reading section ordering" has no test of any kind. The rendering order is verifiable by reading Reports.tsx (lines 319-339 match spec), but there is no automated test guarding it. Any future reordering would go undetected. Suggested test: `Reports.spec.ts` E2E or a shallow render unit test in `src/app/pages/__tests__/Reports.test.tsx` asserting the DOM order of the five section components.

#### High Priority

- **`ReadingStatsService.test.ts` — AC2, 8-genre cap (confidence: 92)**: The cap at 8 named genres is implemented in `ReadingStatsService.ts:334` (`named.length < 8`) but has zero test coverage. A dataset with 10+ distinct genres where all are above the 5% threshold would verify the cap. Suggested test in `getGenreDistribution` describe block: seed 10 genres each with 10 books (1 genre per 10%), call `getGenreDistribution`, assert `result!.length <= 9` (8 named + "Other") and that the 9th+ genres are collapsed into "Other".

- **`ReadingStatsService.test.ts` — AC2, want-to-read inclusion (confidence: 90)**: The `excludes abandoned` test (line 692) verifies the `anyOf` call includes `'want-to-read'`, but no test verifies that books with status `'want-to-read'` actually contribute genre counts to the distribution. Suggested test: seed one `'want-to-read'` book alongside one `'finished'` book with the same genre and assert the count is 2, not 1.

- **`ReadingStatsService.test.ts` — AC3, avgPagesPerSession not asserted (confidence: 88)**: The metric is computed in `ReadingStatsService.ts:396` and returned, but no test asserts its value. The `longestSessionMinutes` test at line 797 seeds sessions but never checks `avgPagesPerSession`. Suggested assertion: in the longestSessionMinutes test, also verify `result!.avgPagesPerSession` equals expected pages/sessions.

- **`ReadingStatsService.test.ts` — AC3, yearlyGoal not tested (confidence: 85)**: `yearlyGoal` is read from `localStorage` (line 369-374 in the service). No test seeds localStorage with a `ReadingGoal` value and verifies it surfaces in the summary result. This is a localStorage boundary that unit tests should explicitly cover. Suggested test: call `localStorage.setItem('reading-goal', JSON.stringify({ yearlyBookTarget: 24 }))` before calling `getReadingSummary()` and assert `result!.yearlyGoal === 24`.

- **AC4, component render not tested (confidence: 85)**: The service-level null return is tested at line 716, but task 4.4 in the story requires `ReadingSummaryCard renders null when no finished books`. The component at `src/app/components/reports/ReadingSummaryCard.tsx` has no render test. If the component were changed to show a fallback UI instead of returning null, no test would catch the regression. Suggested test: `src/app/components/reports/__tests__/ReadingSummaryCard.test.tsx` using React Testing Library — mock `getReadingSummary` to return null and assert `container.firstChild` is null. Same gap applies to `GenreDistributionCard` (AC1).

#### Medium

- **`ReadingStatsService.test.ts:658-661` — weak content assertions (confidence: 75)**: The "groups genres and sorts by count" test asserts `result![0]` equals `{ genre: 'Fiction', count: 2 }` which is good, but the remaining entries are only checked with `.toContain(genre name)` (lines 660-661) without verifying their counts. If the count calculation were wrong for non-first entries, the test would still pass. Prefer `expect(result).toEqual([{ genre: 'Fiction', count: 2 }, { genre: 'Non-Fiction', count: 1 }, { genre: 'Technology', count: 1 }])` for full structural assertion.

- **`ReadingStatsService.test.ts` — no test for all-null metrics (confidence: 70)**: AC3 states each metric shows "—" if insufficient data. The service returns `null` for individual metrics (e.g., `avgPagesPerSession: null` when `sessionCount === 0`). No test verifies this: a finished book exists but no sessions → `avgPagesPerSession` and `longestSessionMinutes` should be null. The "counts books finished this year" test (line 729) mocks sessions as empty but never asserts those two fields.

#### Nits

- **Nit `ReadingStatsService.test.ts:664-689`**: The comment at line 665 says "1 Sci-Fi (5%), 1 Horror (5%)" then corrects itself in the next line. The comment is accurate but confusing. Simplify to just describe the final dataset (21 books, Sci-Fi and Horror each at 4.76%).

- **Nit `ReadingStatsService.test.ts:716`**: Test description says "(AC4)" parenthetical inline — consistent with story references but the other getReadingSummary tests don't reference ACs. Pick a consistent style.

### Edge Cases to Consider

- Genre is an empty string (`genre: ''`) — the service skips falsy genres (`if (!book.genre) continue`) which would correctly exclude empty strings, but no test covers this.
- All books have the same genre — result should be a single-element array; the null guard uses `total < 2` (book count with genres), not genre variety, so this correctly returns a non-null single-item array. Worth a test to document the behavior.
- `getReadingSummary` when a book has no `author` field — the author count loop could produce `undefined` as a map key. No test covers a book with `author: undefined`.
- `longestSessionMinutes` when all sessions have `duration: 0` — should return `null`, not `0`.

---
ACs: 1 fully covered / 5 total | Findings: 10 | Blockers: 1 | High: 4 | Medium: 2 | Nits: 2
