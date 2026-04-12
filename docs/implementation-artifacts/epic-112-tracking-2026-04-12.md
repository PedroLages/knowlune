# Epic 112 Tracking — 2026-04-12

**Epic:** E112 — Reading Analytics & Reports  
**Source:** epics-books-library-audit.md  
**Depends on:** E107 (done)  
**Started:** 2026-04-12  

## Stories

| Story | Name | Status | PR URL | Review Rounds | Issues Fixed |
|-------|------|--------|--------|---------------|--------------|
| E112-S01 | Reading Speed, ETA & Time-of-Day Patterns | ready-for-dev | — | — | — |
| E112-S02 | Genre Distribution & Reading Reports | ready-for-dev | — | — | — |

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

## Step Log

| Date | Step | Outcome |
|------|------|---------|
| 2026-04-12 | Phase 0 complete — stories created, sprint-status updated | Ready to execute |
