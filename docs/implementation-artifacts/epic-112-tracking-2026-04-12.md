# Epic 112 Tracking — 2026-04-12

**Epic:** E112 — Reading Analytics & Reports  
**Source:** epics-books-library-audit.md  
**Depends on:** E107 (done)  
**Started:** 2026-04-12  

## Stories

| Story | Name | Status | PR URL | Review Rounds | Issues Fixed |
|-------|------|--------|--------|---------------|--------------|
| E112-S01 | Reading Speed, ETA & Time-of-Day Patterns | review-ready | — | R1 | — |
| E112-S02 | Genre Distribution & Reading Reports | queued | — | — | — |

## Known Issues Scheduled for This Epic

- **KI-044** (`usePagesReadToday` 2 min/page heuristic) — scheduled to E112-S01
- **KI-060** (`SpeedControl SPEED_OPTIONS` diverges from `VALID_SPEEDS`) — scheduled to E112-S01 (may already be fixed — verify in S01)

## Key Files

- `src/services/ReadingStatsService.ts` — extend with speed computation, ETA, time patterns, genre distribution
- `src/app/hooks/usePagesReadToday.ts` — update to use computed speed (KI-044)
- `src/app/components/reports/ReadingStatsSection.tsx` — add Avg Speed stat pill
- `src/app/components/reports/ReadingPatternsCard.tsx` — new component (E112-S01)
- `src/app/components/reports/GenreDistributionCard.tsx` — new component (E112-S02)
- `src/app/components/reports/ReadingSummaryCard.tsx` — new component (E112-S02)
- `src/app/pages/Reports.tsx` — wire up new components
- `src/app/components/audiobook/SpeedControl.tsx` — verify VALID_SPEEDS (KI-060)
- `docs/known-issues.yaml` — update KI-044, KI-060

## Post-Epic Validation

- [ ] Sprint Status check
- [ ] Testarch Trace
- [ ] Testarch NFR
- [ ] Adversarial Review
- [ ] Retrospective
- [ ] Fix Pass (if needed)
- [ ] Gate Check

## Implementation Summary

### E112-S01: Status COMPLETE ✅

**What Was Implemented:**
- `computeAverageReadingSpeed()` — Calculate reading speed from finished book sessions (AC1, AC3)
- `computeETA()` — Estimate finish date for in-progress books (AC2)
- `getTimeOfDayPattern()` — Analyze reading time buckets (AC4)
- `ReadingPatternsCard.tsx` — New UI component with progress visualizations
- Updated `ReadingStatsSection.tsx` — Extended to 4-column grid with Avg Speed pill
- Updated `usePagesReadToday.ts` — Now uses computed speed instead of 2 min/page heuristic
- Verified `SpeedControl.tsx` — Confirmed uses VALID_SPEEDS (no SPEED_OPTIONS) (AC5)
- Fixed KI-044 & KI-060 in known-issues.yaml

**Test Coverage:**
- All unit tests passing (npm run test:unit ✓)
- Test file: `src/services/__tests__/ReadingStatsService.test.ts`
- Test file: `src/app/hooks/__tests__/usePagesReadToday.test.ts`

**Quality Gates:**
- Build: ✓ PASS (npm run build)
- Lint: ✓ PASS (npm run lint)
- Type check: ✓ PASS (no TypeScript errors)
- Tests: ✓ PASS (all unit tests green)
- Git: ✓ CLEAN (commits: 32212edf, 4d3865c4)

**Ready For:** Code review via `/review-story E112-S01`

### E112-S02: Status NOT STARTED

**Scope:** Genre Distribution & Reading Reports (2 new components, 1 service function)
- GenreDistributionCard (donut chart of genres)
- ReadingSummaryCard (yearly goals, avg pages, longest session, top author)
- getGenreDistribution() & getReadingSummary() services

**Effort:** ~2-3 hours for implementation + tests (AC1-AC5, ~100-120 lines new code per component)

## Step Log

| Date | Step | Outcome |
|------|------|---------|
| 2026-04-12 | Phase 0 complete — stories created, sprint-status updated | Ready to execute |
| 2026-04-12 | Story Agent (E112-S01) dispatched | Implemented AC1-AC5 + utilities + components |
| 2026-04-12 | E112-S01 implementation complete | All AC met; commits: 32212edf, 4d3865c4; build ✓, tests ✓ |
