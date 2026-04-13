# Epic 56 Completion Report: Knowledge Map Phase 1

**Date:** 2026-04-13
**Epic:** E56 — Knowledge Map Phase 1
**Status:** Complete

---

## 1. Executive Summary

Epic 56 delivered the first phase of the Knowledge Map feature: a local-first, read-only view of
learner mastery across all quiz topics. The epic covered the full stack from raw data resolution
to user-facing visualisation — topic normalisation library, composite scoring engine, Zustand
orchestration store, dashboard widget (D3 Treemap + Accordion fallback), and a dedicated
`/knowledge-map` route with click-through `TopicDetailPopover`.

All four stories shipped on 2026-04-13. Zero production incidents. Zero design-token violations.
The resulting modules (`topicResolver.ts`, `knowledgeScore.ts`, `knowledgeTierUtils.ts`,
`useKnowledgeMapStore`) form the shared infrastructure that E57 (AI Tutoring) and E62/E71 depend
on directly.

**Date range:** 2026-04-13 (single-day execution)
**Stories delivered:** 4 / 4 (100%)
**Total review rounds:** 8 (avg 2.0 / story)

---

## 2. Stories Delivered

| Story | Name | PR | Review Rounds | Issues Fixed |
|-------|------|----|---------------|--------------|
| E56-S01 | Topic Resolution Service | #308 | 1 | 0 |
| E56-S02 | Knowledge Score Calculation + Zustand Store | #309 | 2 | 7 |
| E56-S03 | Knowledge Map Overview Widget | #310 | 3 | 15 |
| E56-S04 | Dedicated Knowledge Map Page | #311 | 2 | 6 |

**Key notes per story:**

- **S01** — A pre-implementation blocker was resolved before a single line of code was written.
  `useCourseStore` was deprecated in E89-S01 (Dexie v30). The story pivot to Option B (use
  `ImportedCourse.tags[]`, `ImportedCourse.category`, `Question.topic`) eliminated schema
  migration entirely and produced a cleaner design. R1 passed with zero findings.

- **S02** — R1 surfaced a BLOCKER: `db.courses.toArray()` referenced a table dropped in v30.
  Five HIGH-severity edge cases (division-by-zero, stale-data, NaN from null `reviewedAt`) were
  also identified and addressed. Fixed in R2.

- **S03** — Required three rounds. R1: touch targets below 44×44 px (WCAG), manual IndexedDB
  seeding instead of factory helpers. R2: deduplication of tier logic — extracted to
  `knowledgeTierUtils.ts`. R3: E2E seeding structure. Two LOW/NIT items (arbitrary `text-[10px]`,
  `formatDaysAgo` i18n) deferred per the max-3-rounds policy.

- **S04** — R1 caught missing E2E tests, a broken treemap root-node rendering, and popover
  anchor misalignment. SVG cell clicks required `evaluate()` instead of standard `click()`
  because Recharts Treemap cells do not propagate synthetic pointer events. Fixed in R2.

---

## 3. Review Metrics

### Issue Counts by Severity (all stories, all rounds)

| Severity | Found | Fixed | Deferred |
|----------|-------|-------|----------|
| BLOCKER | 1 | 1 | 0 |
| HIGH | 12 | 12 | 0 |
| MEDIUM | 10 | 10 | 0 |
| LOW / NIT | 5 | 3 | 2 |
| **Total** | **28** | **26** | **2** |

**Deferred items** (max-3-rounds policy, tracked in known-issues.yaml):
- `text-[10px]` arbitrary Tailwind value in KnowledgeMapWidget — LOW
- `formatDaysAgo` missing i18n support — NIT

### Review Efficiency

| Metric | Value |
|--------|-------|
| First-pass rate | 0% (0 / 4 stories) |
| Stories needing 3+ rounds | 1 (S03) |
| Preventable rounds (self-testing failures) | 2 (S02 BLOCKER, S04 visual defect) |
| Rounds eliminated by pre-implementation analysis | ~1 (S01 Option B pivot) |

---

## 4. Deferred Issues

### 4a. Known Issues Register — Matched

None. No pre-existing known-issues.yaml entries matched Epic 56 scope.

### 4b. New Pre-Existing Issues Discovered

None. All issues found during review were introduced by E56 itself and fixed before merge, or
deferred (2 LOW/NIT items) as minor tech-debt candidates for a future chore pass.

---

## 5. Post-Epic Validation

### 5a. Gate Results

| Validation | Command / Agent | Status | Result |
|------------|-----------------|--------|--------|
| Sprint Status | `/sprint-status` | PASS | All 4 stories marked done |
| Mark Epic Done | `chore: mark Epic 56` | PASS | Committed 2026-04-13 |
| Traceability (Trace) | `/testarch-trace` | PASS | 87% overall; P0 100%, P1 93% |
| NFR Assessment | `/testarch-nfr` | PASS | All 4 domains LOW risk |
| Adversarial Review | — | SKIPPED | Not requested |
| Retrospective | `/retrospective` | PASS | epic-56-retro-2026-04-13.md |
| Build Verification | `npm run build` | PASS | 25.97 s, zero errors |

**Traceability detail (30 total ACs):**

| Priority | Total | Covered | % |
|----------|-------|---------|---|
| P0 | 4 | 4 | 100% |
| P1 | 15 | 14 | 93% |
| P2 | 8 | 6 | 75% |
| P3 | 3 | 2 | 67% |
| **Overall** | **30** | **26** | **87%** |

All three gate thresholds met (P0 ≥ 100%, P1 ≥ 90%, overall ≥ 80%).

**NFR domains assessed:** Performance, Security, Reliability, Maintainability — all LOW risk.
Notable: Recharts + D3 isolated in a dedicated `chart` chunk (452 kB / 129 kB gzip), loaded
lazily on first KnowledgeMap route visit. Pre-existing architectural trade-off, not an E56
regression.

### 5b. Fix Pass Results (Post-Trace)

The trace report identified two uncovered ACs in S04: AC3 (treemap cell click opens popover)
and AC4 (popover displays correct topic data). A targeted fix pass added two E2E tests to
`tests/e2e/regression/knowledge-map-page.spec.ts` covering both ACs via `page.evaluate()`
SVG cell-click pattern.

- **Tests added:** 2
- **Gate re-check:** PASS (overall coverage moved from 83% pre-fix to 87% post-fix)
- **Commit:** `test(Epic 56): add E2E coverage for TopicDetailPopover cell-click (S04-AC3, AC4)`

---

## 6. Lessons Learned

From the Epic 56 retrospective (`docs/implementation-artifacts/epic-56-retro-2026-04-13.md`).

### What Worked

**1. Option B pivot was fast and left no schema debt.**
The S01 pre-implementation analysis identified the deprecated `useCourseStore` before coding.
The pivot to `ImportedCourse.tags[]` + `Question.topic` was cleaner than the original design
and required no migration script. Speed was enabled by sufficient E89-S01 context in the story
spec.

**2. knowledgeTierUtils.ts extracted before copy-paste proliferation.**
Tier thresholds and badge styles were centralised in `src/lib/knowledgeTierUtils.ts` during S03
review, before S04 duplicated them. E62 and E71 can import the same util without drift.

**3. Pre-review edge case analysis in S02 surfaced 5 HIGH-severity math edge cases.**
Division-by-zero, completion-only 100% confidence, stale scores, NaN from null timestamps, and
topic canonicalisation mismatch were all written into the spec before implementation. This
prevented late-discovery rework on the scoring engine.

**4. date-fns formatDistanceToNow established as the standard relative-time pattern.**
Consistent relative timestamps (`"about 3 days ago"`) across widget and page. Sets the pattern
for E57, E62.

**5. Zero design-token violations across all four stories.**
ESLint save-time enforcement continues to hold. No hardcoded colors reached review.

### What Did Not Work

**1. db.courses BLOCKER (S02) — data-layer assumption not verified before implementation.**
`db.courses.toArray()` referenced a Dexie table dropped in v30. Same failure class as E54-S03
(dead component). 60-second schema verification would have prevented the BLOCKER.
*Action: Add Dexie schema check to story template pre-implementation checklist.*

**2. Touch targets below 44×44 px repeated in S03 (recurring pattern).**
This finding appears in multiple prior epics. Not a complexity failure — a self-review failure.
*Action: Add touch target check to story template pre-review checklist.*

**3. Treemap root-node visual defect not caught before review (S04).**
A broken primary UI was visible within 3 seconds of loading the page with seed data. Caught in
review, not self-testing. Cost: one full review round.
*Action: Add visual sanity check (load feature with seed data) to pre-review checklist.*

**4. Zero first-pass stories; two rounds were preventable.**
The review pipeline is functioning correctly. It should not be the primary place runtime visual
defects and touch target failures surface.

**5. E54 lessons not durably applied.**
Two of three E54 retro action items were not applied in E56 — they were documented in narrative
text but never embedded in the story template. Lessons require template changes to stick.

---

## 7. Suggestions for Next Epic (E57: AI Tutoring Phase 1-2)

E57 (5 stories) builds directly on E56's `useKnowledgeStore`. Key preparation items:

### Critical Path (Must Do Before E57-S1)

**Harden `useKnowledgeStore` cache invalidation.**
`computeScores()` currently runs only on mount. Stale scores will produce wrong tutoring
context. Implement `useLiveQuery` subscription or invalidation callback with the existing 30-second
cache guard before E57-S1 reads `ScoredTopic[]` for context injection.

### Process Improvements (Apply From Day 1 of E57)

1. **Story template pre-implementation checklist** must include:
   - "Verify all referenced `db.*` tables exist in `src/db/schema.ts`" (Dexie schema check)
   - "Verify all referenced routes exist in `src/app/routes.tsx`" (from E54)

2. **Story template pre-review self-checklist** must include:
   - "All interactive elements ≥ 44×44 px (verify in DevTools)"
   - "Load feature with seed data — visually confirm primary UI renders without obvious defects"

3. **E2E test template** should include a commented pointer to `tests/helpers/factories/`
   to reduce seeding friction (repeated E2E anti-pattern).

### Patterns Available from E56 to Reuse in E57

- `knowledgeTierUtils.ts` — tier thresholds and badge styles (importable directly)
- `useKnowledgeMapStore` — `ScoredTopic[]` with tier, confidence, suggestedActions, computedAt
- `date-fns formatDistanceToNow` — relative timestamp pattern
- `page.evaluate()` SVG click pattern — for any Recharts-based interaction tests

---

## 8. Build Verification

```
npm run build

✓ built in 25.97s
PWA v1.2.0 — generateSW mode
precache: 308 entries (19,801 KiB)
```

**Result: PASS — zero errors, zero warnings related to E56 code.**

(Existing chunk-size warnings for `sql-js`, `index`, `pdf` are pre-existing architectural
trade-offs unrelated to this epic.)

---

## Artifacts

| Type | Path |
|------|------|
| Tracking file | `docs/implementation-artifacts/epic-56-tracking-2026-04-13.md` |
| Story files | `docs/implementation-artifacts/stories/E56-S0{1,2,3,4}.md` |
| Traceability report | `docs/reviews/testarch-trace-2026-04-13-epic-56.md` |
| NFR assessment | `docs/reviews/testarch-nfr/testarch-nfr-2026-04-13-epic-56.md` |
| Retrospective | `docs/implementation-artifacts/epic-56-retro-2026-04-13.md` |
| This report | `docs/implementation-artifacts/epic-56-completion-report-2026-04-13.md` |
