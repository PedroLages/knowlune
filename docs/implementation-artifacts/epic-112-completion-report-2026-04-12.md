# Epic 112 Completion Report — Reading Analytics & Reports

**Date:** 2026-04-12
**Epic:** E112 — Reading Analytics & Reports
**Branch:** main (all stories merged)
**Status:** Complete — 2/2 stories done

---

## 1. Epic Summary

Epic 112 delivered a full reading analytics feature set to the Knowlune Reports page. The work extended `ReadingStatsService.ts` with five new pure-function analytics methods — computing reading speed from real session data, estimated finish dates for in-progress books, time-of-day reading patterns, genre distribution, and a year-over-year reading summary — then wired them into three new report card components (`ReadingPatternsCard`, `GenreDistributionCard`, `ReadingSummaryCard`) integrated into the Reports page Reading section. Two pre-existing known issues were resolved: KI-044 (replaced the hardcoded 2 min/page heuristic in `usePagesReadToday` with user-derived session speed) and KI-060 (confirmed `SpeedControl.tsx` uses `VALID_SPEEDS` from the audiobook prefs store). The epic introduced zero new npm dependencies and passed all build and lint gates with 50 unit tests green.

---

## 2. Stories Delivered

| Story ID | Story Name | ACs | Review Rounds | Issues Fixed |
|----------|------------|-----|---------------|--------------|
| E112-S01 | Reading Speed, ETA & Time-of-Day Patterns | 5 | 2 | 9 |
| E112-S02 | Genre Distribution & Reading Reports | 5 | 2 | 4 |
| **Total** | | **10** | **4** | **13** |

---

## 3. Key Features Shipped

- **ReadingStatsSection — Avg Speed pill:** Real reading speed in pages/hour computed from session data (finished books, last 90 days). Displays "—" when insufficient data. Replaces the fixed 2 min/page heuristic used for today's pages estimate.
- **ReadingStatsSection — ETA per in-progress book:** Estimated finish date computed from remaining pages, personal reading speed, and average daily reading minutes from the last 30 days. Shows "≈ N days" / "≈ X weeks" format; "—" when no recent sessions.
- **ReadingPatternsCard:** Time-of-day bucket breakdown (Morning, Afternoon, Evening, Night) across all recorded sessions. Highlights the dominant bucket with brand color and progress-bar visualization. Renders null when fewer than 7 sessions exist.
- **GenreDistributionCard:** Donut/pie chart of book counts per genre using Recharts, covering reading/finished/want-to-read books (abandoned excluded). Genres below 5% of total are grouped into "Other"; up to 8 named genres displayed. Renders null when fewer than 2 books have a genre set.
- **ReadingSummaryCard:** Four-metric summary grid — books finished this year vs. yearly goal, average pages per session (finished books), longest reading session (formatted as "Xh Ym"), and most read author. Each metric shows "—" when insufficient data. Renders null when no finished books exist.

---

## 4. Quality Gates

| Gate | Result | Detail |
|------|--------|--------|
| Build | ✓ PASS | 30.07s clean build; no new bundle chunks; PWA precache stable |
| Lint | ✓ PASS | 0 errors; 155 warnings (all pre-existing, none from E112) |
| Unit Tests | ✓ PASS | 4,868 total passing (50 E112-specific: 44 service + 6 hook) |
| E2E (smoke) | ✓ PASS | Smoke spec; no E2E spec dedicated to E112 (documented gap) |
| Testarch Trace | ⚠️ CONCERNS | 60% overall AC coverage (FULL); P1 at 80% — no E2E for new cards, section-ordering not automated |
| NFR Assessment | ⚠️ CONCERNS | 27/29 criteria met; 2 concerns: E2E coverage gap + 13 pre-existing npm vulns (epubjs, not introduced by E112); 0 blockers |

---

## 5. Significant Bugs Fixed During Review

1. **ETA formula — avgPagesPerDay computed as `totalPages / 30` instead of `(totalPages / sessionCount) * 7`**: The initial implementation divided total remaining pages by a fixed 30-day window rather than deriving a weekly cadence from actual session count. This produced estimates off by a factor of 4.3x for users reading twice weekly. Fixed by computing daily reading hours from session data within the 30-day window.

2. **Speed inflation from all-time finished books**: `computeAverageReadingSpeed` initially included all finished books regardless of recency. A book finished years ago with slow, irregular sessions could dominate the computed speed. Fixed by adding a 90-day filter so only recently-finished books contribute to the average.

3. **`computeETA` never called in UI (AC2 scope gap)**: The ETA computation was implemented in the service, covered by unit tests, and marked passing — but never wired into `ReadingStatsSection`. The acceptance criterion ("each in-progress book shows an ETA") was not met at the UI layer. Code review caught it; the component was updated to call `computeETA` and render the result.

4. **`avgPagesPerSession` numerator/denominator scope mismatch**: In `getReadingSummary`, `totalPagesEstimated` was scoped to finished books only but `sessionCount` included sessions from all books (including in-progress). This produced artificially low averages for users with many active reading sessions. Fixed by filtering sessions to finished-book IDs before computing the count.

5. **`avgReadingSpeedPagesPerHour` missing from catch-block fallback in `getReadingStats`**: The catch path returned a stats object without the `avgReadingSpeedPagesPerHour` field, breaking the TypeScript contract for callers that expected a non-optional shape. Fixed by ensuring the catch block returns a fully-typed null-safe stats object.

---

## 6. Post-Epic Validation

### Testarch Trace (Requirements-to-Tests Traceability)

- **Gate decision:** CONCERNS
- **P0 ACs:** 0 — no P0-class requirements in E112
- **P1 coverage:** 4/5 FULL (80%) — S02-AC5 (Reports section ordering) has zero automated coverage; untestable with current `Reports.test.tsx` mock architecture
- **P2 coverage:** 2/5 FULL (40%) — component tests absent for all three new cards
- **Unit coverage:** Strong — 36 service/hook tests covering all edge cases (formula correctness, null guards, 90-day window, midnight wrap for Night bucket, 5% genre threshold, 8-genre cap, author tie-break)
- **E2E coverage:** 0 specs for E112
- **Action items created:** Add E2E regression spec, section-ordering assertion, and 3 null-path unit tests for `getReadingSummary`

### NFR Assessment

- **Overall status:** CONCERNS — no blockers
- **ADR checklist:** 27/29 criteria met (93%)
- **Performance:** PASS — O(n) algorithms; 90-day and 30-day windows bound data scope; skeleton loading in all new components
- **Security:** CONCERNS — 13 pre-existing npm vulns (epubjs → @xmldom/xmldom); 0 new vulns introduced by E112
- **Reliability:** CONCERNS — E2E coverage gap for three new cards; unit tests 50/50 green
- **Maintainability:** PASS — ESLint 0 errors; `vi.useFakeTimers()` used; JSDoc on all service functions; `// Intentional:` comments on non-obvious sites
- **Release verdict:** Cleared for release; CONCERNS are medium-priority follow-up items

### Retrospective

- **Delivery:** 2/2 stories complete, 4 total review rounds, 0 production incidents, 2 known issues resolved (KI-044, KI-060)
- **Process gap:** Sub-20% E110 action-item follow-through (1 confirmed not done, 8 unverified) — eighth consecutive epic with this pattern
- **Fix pass:** Chore commits before retro close — `04f64cc6` (ReadingQueue touch targets, from E110 AI-1), `b304f4d3` (getBooksBySeries filter scope, from E110 AI-2)

---

## 7. Lessons Learned

### 1. Service implementation without UI wiring is an AC gap, not a completion signal

A service method that computes the correct value and is covered by passing unit tests still fails the acceptance criterion if the result is never rendered in the UI. The path from data source to visible UI element must be traced for each AC before marking it done. (E112-S01 AC2 — `computeETA()` was fully tested but never rendered until code review flagged it.)

### 2. Chained unit-conversion formulas require independent derivation before coding

Unit tests validate that code produces the correct output for given inputs — but if the formula is wrong, the tests are wrong in the same direction. For chained conversions (pages/hour → hours/day → days remaining), derive the expected output independently using a realistic example (e.g., user reads twice weekly, 200 pages remaining, 30 pages/hour → ~1.7 days). Validate the code against the derived value before writing tests. (E112-S01 ETA formula — initial `avgPagesPerDay = totalPages / 30` was off by 4.3x.)

### 3. Aggregate ratios require explicit scope matching for numerator and denominator

`avgPagesPerSession = totalFinishedPages / totalSessionCount` is incorrect when the page total is scoped to finished books but the session count includes all sessions. When writing any aggregate metric, declare the scope for both components and verify they match before implementing. (E112-S02 `avgPagesPerSession`; E112-S01 speed inflation from unfiltered finished books.)

---

## 8. Action Items for E113

| # | Action | Owner | Priority |
|---|--------|-------|----------|
| 1 | Add "For each AC, verify there is a visible UI element tracing back to the service result" to story pre-review checklist in `docs/implementation-artifacts/story-template.md` | Pedro | Before E113-S01 |
| 2 | Add "For aggregate metrics: verify numerator and denominator share the same scope (book set, session set, time window)" to `docs/engineering-patterns.md` under analytics patterns | Pedro | Before E113-S01 |
| 3 | Add formula-derivation step to story implementation notes template: "For numeric computations, derive expected output with a concrete example before coding" | Pedro | Before E113-S01 |
| 4 | Add E2E regression spec for E112: navigate to Reports > Reading tab, assert speed pill, ReadingPatternsCard heading, and ETA for in-progress books | Pedro | E113 milestone |
| 5 | Add component smoke tests for `ReadingPatternsCard`, `GenreDistributionCard`, `ReadingSummaryCard` — renders with data; renders null without data | Pedro | E113 milestone |
| 6 | Update `Reports.test.tsx` with `data-testid` markers and DOM-order assertion matching S02-AC5 spec | Pedro | E113 milestone |
| 7 | Add 3 null-path unit tests for `getReadingSummary` (`avgPagesPerSession=null`, `longestSessionMinutes=null`, `mostReadAuthor=null`) | Pedro | E113 milestone |
| 8 | Track `epubjs` → `@xmldom/xmldom` upgrade in a dedicated dependency maintenance epic | Pedro | Backlog |

---

## Related Artifacts

| Artifact | Path |
|----------|------|
| Story E112-S01 | `docs/implementation-artifacts/stories/E112-S01.md` |
| Story E112-S02 | `docs/implementation-artifacts/stories/E112-S02.md` |
| Traceability matrix | `docs/implementation-artifacts/traceability-e112-2026-04-12.md` |
| NFR assessment | `docs/implementation-artifacts/e112-nfr-assessment-2026-04-12.md` |
| Retrospective | `docs/implementation-artifacts/epic-112-retro-2026-04-12.md` |
| Primary service | `src/services/ReadingStatsService.ts` |
| Service tests | `src/services/__tests__/ReadingStatsService.test.ts` |
| Hook tests | `src/app/hooks/__tests__/usePagesReadToday.test.ts` |

---

*Generated: 2026-04-12*
