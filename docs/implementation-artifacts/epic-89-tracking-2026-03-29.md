# Epic 89 + 90 Tracking — 2026-03-29

## Stories Progress

| Story | Status | PR URL | Review Rounds | Issues Fixed |
|-------|--------|--------|---------------|--------------|
| E89-S01 | done | #149 | 1 | 0 |
| E89-S02 | done | #150 | 1 | 4 |
| E89-S03 | done | #151 | 1 | 2 |
| E89-S04 | done | #152 | 1 | 7 |
| E89-S05 | done | #153 | 1 | 5 |
| E89-S06 | done | #154 | 1 | 5 |
| E89-S07 | done | #155 | 1 | 6 |
| E89-S08 | done | #156 | 1 | 5 |
| E89-S09 | done | #157 | 1 | 0 |
| E89-S10 | done | #159 | 1 | 1 |
| E89-S12a | done | #158 | — | 13 (URL fixes) |
| E89-S12b | done | #160 | 1 | 0 |
| E89-S12c | done | — (on main) | — | 5 files, +312/-157 lines |
| E89-S11 | deferred | — | — | — |
| E90-S01 | queued | — | — | — |
| E90-S02 | queued | — | — | — |
| E90-S03 | queued | — | — | — |
| E90-S04 | queued | — | — | — |
| E90-S05 | queued | — | — | — |
| E90-S10 | queued | — | — | — |
| E90-S06 | queued | — | — | — |
| E90-S07 | queued | — | — | — |
| E90-S09 | queued | — | — | — |
| E90-S08 | queued | — | — | — |
| E90-S11 | queued | — | — | — |

## Pre-Existing Issues (deferred)

- 21 unit test failures across 7 files (settings, Authors, Courses, ImportedCourseDetail, isPremium, AtRiskBadge) — pre-existing on main since before E89
- Batch course deletion + auto-cleanup from all pages — deferred to future ticket (user request 2026-03-29)

## Post-Epic Status

| Command | E89 | E90 |
|---------|-----|-----|
| sprint-status | pending | pending |
| testarch-trace | pending | pending |
| testarch-nfr | pending | pending |
| review-adversarial | pending | pending |
| retrospective | pending | pending |

## Observed Patterns

- All stories passed review in 1 round (no story needed 2+ rounds)
- Common review findings: missing .catch() on async calls, blob URL leaks, adapter bypass patterns
- E89-S03 had the widest blast radius (26 files) but review found only 3 issues
- E89-S12a discovered 5 additional broken URLs in prototype pages (beyond the 7 identified in audit)
- E89-S12b (feature wiring) passed with 0 issues — cleanest implementation
- E89-S12c: ported old design language (card headers, progress sidebar, Lessons tab) without Gemini — used git history recovery instead
- E89-S11 + E90 + post-E89 workflow deferred per user request
