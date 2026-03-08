# Test Coverage Review: E07-S01 — Momentum Score Calculation & Display

**Date**: 2026-03-08
**Reviewer**: Test Coverage Agent

## AC Coverage Table

| AC# | Description | Unit Test | E2E Test | Verdict |
|-----|-------------|-----------|----------|---------|
| 1 | Score = weighted function (recency 40%, completion 30%, frequency 30%), 0–100 | `momentum.test.ts:55–168` | None | Partial |
| 2 | Visual indicator hot/warm/cold on course cards | None | `story-e07-s01.spec.ts:21–50` | Partial |
| 3 | No sessions → score 0, cold | `momentum.test.ts:56–69` | None | Partial |
| 4 | Sort by Momentum, badges visible | None | `story-e07-s01.spec.ts:53–163` | Partial |
| 5 | Recalculates within page session | None | None | **Gap** |

**Coverage**: 0/5 fully covered | 1 gap | 4 partial

## Findings

### Blocker

- **(confidence: 97)** AC5 has zero test coverage. No test exercises real-time recalculation after study session.

### High Priority

- **(confidence: 92)** Sort assertion structurally weak — only checks first vs last, not monotonic ordering.
- **(confidence: 88)** Badge visibility test has race condition — doesn't wait for async `loadMomentumScores()`.
- **(confidence: 82)** No deterministic weight-isolation test — weights could be swapped undetected.
- **(confidence: 78)** Badge only tested via aria-label text, not icon/color (AC2 requires distinct iconography).
- **(confidence: 76)** Sort option test uses brittle CSS selectors.

### Medium

- **(confidence: 85)** Missing sidebar localStorage seed — tests fail at 768px CI viewport.
- **(confidence: 80)** No test for 14-day recency cliff boundary.
- **(confidence: 77)** `fake-indexeddb/auto` import unnecessary in pure function tests.
- **(confidence: 73)** No E2E test for cold badge on unstarted courses.
- **(confidence: 72)** Local `makeSession` factory diverges from shared factory shape.

### Nits

- Pinned assertion pattern should be applied consistently
- Missing auto-cleanup for seeded sessions
- Inline IndexedDB seeding duplicates fixture logic

## Summary

ACs: 0/5 fully covered | Findings: 15 | Blockers: 1 | High: 5 | Medium: 5 | Nits: 3
