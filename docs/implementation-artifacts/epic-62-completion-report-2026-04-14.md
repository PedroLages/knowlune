# Epic 62 Completion Report — FSRS Knowledge Scoring

**Date:** 2026-04-14
**Epic:** E62 — FSRS Knowledge Scoring
**Status:** COMPLETE
**Stories Delivered:** 4 / 4

---

## 1. Executive Summary

Epic 62 delivered FSRS-based retention scoring across the Knowledge Map feature: an aggregation layer integrating FSRS retention into topic scores, a gradient treemap UI with decay prediction tooltips, and a complete test suite (unit + E2E). All four stories shipped to `main` across PRs #332–#335, followed by a post-epic fix pass and validation gates.

The most significant architectural win was discovering the codebase is FSRS-only — eliminating planned SM-2/FSRS branching in S01 and simplifying the implementation compared to the original plan. Security review returned zero findings across all stories.

Post-epic gate results: traceability 96% (PASS), NFR validation PASS, build clean.

---

## 2. Stories Delivered

| Story | Title | PR | Review Rounds | Issues Fixed | Status |
|-------|----|-----|---------------|--------------|--------|
| E62-S01 | FSRS Retention Aggregation and Score Integration | [#332](https://github.com/PedroLages/knowlune/pull/332) | 2 | 4 | done |
| E62-S02 | Retention Gradient Treemap and Decay Predictions UI | [#333](https://github.com/PedroLages/knowlune/pull/333) | 3 | 7 | done |
| E62-S03 | Unit Tests — FSRS Retention Scoring | [#334](https://github.com/PedroLages/knowlune/pull/334) | 3 | 3 | done |
| E62-S04 | E2E Tests — Knowledge Map FSRS Integration | [#335](https://github.com/PedroLages/knowlune/pull/335) | 2 | 9 | done |

**Totals:** 10 review rounds, 23 issues fixed across all stories.

---

## 3. Review Metrics

### Findings by Severity (all stories combined)

| Severity | Count | Notes |
|----------|-------|-------|
| BLOCKER | 0 | — |
| HIGH | 2 | S03: Date.now() indirection (non-deterministic time); S03: inline function replica in tests |
| MEDIUM | 6 | S01: redundant param pass-through, partial AC8 (SM-2 path); S02: MutationObserver HMR leak, duplicated decay formatting; S04: dead code in dark mode test, Radix internal selector |
| LOW / NIT | 6 | Unused interface fields, default `new Date()` param, semantic color assertion complexity, dark mode assertion verbosity |
| SECURITY | 0 | Pure data/UI epic — no auth surface, no I/O, no secrets |

### Review Round Efficiency

| Story | Rounds | Driver |
|-------|--------|--------|
| E62-S01 | 2 | Redundant param, partial AC8 (SM-2 not implemented) |
| E62-S02 | 3 | MutationObserver leak + duplication (subtle); separate fix round |
| E62-S03 | 3 | Two HIGH test anti-patterns required two fix iterations |
| E62-S04 | 2 | Dead code + Radix selector fragility caught in round 1 |

---

## 4. Deferred Issues

### 4a. Pre-Existing Issues Re-Encountered

| ID | Type | Summary | Severity | Action |
|----|------|---------|----------|--------|
| KI-058 | test | 29–30 pre-existing unit test failures in unrelated files (courseAdapter, pkmExport, settings, etc.) | medium | Deferred — pre-dates E62, tracked for future triage |

### 4b. New Issues Registered This Epic

| ID | Type | Summary | File | Severity | Disposition |
|----|------|---------|------|----------|-------------|
| KI-067 | performance | TopicTreemap MutationObserver fires on any `<html>` class change, not just theme toggles — observer scope too coarse | `src/app/components/knowledge/TopicTreemap.tsx` | low | Schedule future epic |
| KI-068 | test | No dedicated test for TopicTreemap color cache invalidation on theme change (S02-AC8 coverage gap) | `src/app/components/knowledge/TopicTreemap.tsx` | low | Schedule future epic |

Both new issues are LOW severity. KI-067 is a performance refinement (the observer works correctly, it just fires more frequently than necessary). KI-068 matches the single uncovered P2 requirement in the traceability report (S02-AC8).

---

## 5. Post-Epic Validation

### 5a. Traceability Gate — PASS

| Metric | Value |
|--------|-------|
| Total Requirements | 23 |
| Fully Covered | 22 |
| Partially Covered | 0 |
| Uncovered | 1 |
| Overall Coverage | **96%** |
| P0 Coverage | **100%** (11/11) |
| P1 Coverage | **100%** (10/10) |
| P2 Coverage | 50% (1/2) |

The single uncovered requirement is S02-AC8 (color cache invalidation on theme change), a P2 item. Fallback hex values are hardcoded and theme toggling is exercised indirectly by E2E-06. Registered as KI-068.

### 5b. NFR Validation — PASS

No performance regressions detected. Build size within baseline. No memory leak in production mode (MutationObserver HMR leak was development-only under React HMR). Accessibility: no new violations introduced. Security: 0 findings.

### 5c. Fix Pass Results

Two fixes applied as a post-epic chore commit (`b8892b5`):

| Fix | File | Finding Source |
|-----|------|---------------|
| Added `group` class for keyboard focus ring visibility on treemap cells | `src/app/components/knowledge/TopicTreemap.tsx` | Design review |
| Clamped retention input values to [0, 1] range | `src/lib/knowledgeScore.ts` | Code review |

Two LOW findings not fixed (deferred as KI-067, KI-068 — see Section 4b).

---

## 6. Lessons Learned

From the epic retrospective (`docs/implementation-artifacts/epic-62-retro-2026-04-14.md`):

### What Went Well

**Simplification over abstraction (S01).** The review process correctly identified that SM-2/FSRS branching was based on a false assumption. The codebase is FSRS-only. Removing the branch simplified the aggregation layer and eliminated a maintenance burden before it was introduced.

**Shared utility extraction (S02).** Duplicated decay formatting logic was caught by the deduplication scan and extracted to `formatDecayLabel()` before merge. The utility is now available to future stories touching decay display.

**Semantic state testing for dark mode (S04).** The dark mode assertion failure forced a more resilient test design — checking CSS class/data-attribute state rather than computed RGB values. This pattern is transferable to any component with theme-sensitive visual states.

**Clean S01/S04 execution.** Both stories shipped in 2 review rounds with real, actionable findings — no noise.

### What Could Be Improved

**Test quality pre-submit self-review (S03).** Two class-one anti-patterns (Date.now() indirection, inline function replica) entered review without being caught by the author. The test quality checklist exists at `_bmad/tea/testarch/knowledge/test-quality.md` — it was not consulted before submission.

**Duplication visibility during implementation (S02).** The duplicated decay formatting was in the same PR, written close together in time. There was no real-time signal that a shared utility should exist at the point of writing the second instance.

**E2E Radix selector pattern recurring (S04).** Fragile Radix internal selectors continue to appear despite documented guidance. The path of least resistance in E2E authorship is selecting against the visible DOM; adding `data-testid` feels like extra scope.

**MutationObserver HMR leak has no static analysis coverage (S02).** The `react-hooks-async/async-cleanup` ESLint rule covers `async` cleanup but not synchronous observer teardown. This class of React lifecycle bug (imperative observer/listener not cleaned up in `useEffect`) has no save-time signal.

---

## 7. Suggestions for Next Epic

1. **Add pre-submit test checklist habit.** Before marking a test story PR as ready for review, consult `_bmad/tea/testarch/knowledge/test-quality.md`. Consider surfacing it as a checklist item in the story template for test-focused stories (S## type = "test").

2. **ESLint rule for synchronous observer teardown.** The `eslint-plugin-react-hooks-async.js` rule could be extended to flag `new MutationObserver(...)` / `new ResizeObserver(...)` / `new IntersectionObserver(...)` inside `useEffect` bodies that lack a `return () => observer.disconnect()` teardown.

3. **Nudge for `data-testid` on Radix components.** A lint rule or code review checklist item to flag E2E tests that select on Radix-internal class names or attributes (e.g., `[data-radix-*]`, `[data-state]` without `data-testid` fallback) would reduce this recurring review finding.

4. **Triage KI-067 in a performance-focused epic.** The MutationObserver attribute filter (`filter: attributeFilter: ['class']` on `document.documentElement`) is a one-line fix that could be batched with other small performance items.

---

## 8. Build Verification

```
npm run build — completed 2026-04-14
Exit code: 0
Build time: 25.77s
PWA: generateSW — 310 entries precached (19893.26 KiB)
Bundle warnings: pre-existing large chunk warnings (sql-js, index, pdf) — not introduced by E62
```

Build is clean. No new errors or warnings attributable to E62.

---

## Appendix: Key Files Delivered

| File | Purpose |
|------|---------|
| `src/lib/knowledgeScore.ts` | `calculateAggregateRetention()`, `calculateDecayDate()`, FSRS weight integration |
| `src/stores/useKnowledgeMapStore.ts` | Store integration — fsrsRetention populated from aggregation |
| `src/app/components/knowledge/TopicTreemap.tsx` | Gradient treemap with MutationObserver theme detection |
| `src/app/components/knowledge/TopicDetailPopover.tsx` | Memory Decay section with retention bar |
| `src/lib/decayFormatting.ts` | Shared `formatDecayLabel()` utility (extracted from S02) |
| `src/lib/__tests__/knowledgeScore.test.ts` | 28 FSRS-specific unit tests (UT-01–UT-28) |
| `src/lib/__tests__/decayFormatting.test.ts` | 13 formatting tests (DT-01–DT-13) |
| `tests/e2e/regression/story-e62-s04.spec.ts` | 7 E2E tests (28 with viewport matrix) |

## Appendix: Git Commits

```
5d47cc88  docs(E62): add post-epic validation reports and retrospective
a9626a35  chore(E62): add KI-067, KI-068 — deferred LOW findings from post-epic fix pass
b8892b5e  fix(E62): post-epic fix pass — focus ring group class, clamp retention inputs
81d040b7  feat(E62-S04): E2E tests for Knowledge Map FSRS integration (#335)
0ed802e4  feat(E62-S03): unit tests for FSRS retention scoring (#334)
6c2007e7  feat(E62-S02): retention gradient treemap and decay predictions UI (#333)
64c7e955  feat(E62-S01): FSRS retention aggregation and score integration (#332)
```
