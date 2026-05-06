---
title: "CE pipeline interactions during visual redesign work: lessons from learning-path detail restructuring"
date: 2026-05-06
category: workflow-issues
module: development_workflow
problem_type: workflow_issue
component: development_workflow
severity: medium
applies_when:
  - "Running the CE pipeline (plan-critic, techdebt dedup, review-story) on visual redesign work involving component extraction and layout restructuring"
  - "Planning a review strategy for changes that produce many new presentational components but few logic changes"
  - "Assessing whether a visual redesign will need 2-3 review rounds to clear medium findings"
tags:
  - ce-pipeline
  - plan-critic
  - techdebt-dedup
  - review-loop
  - visual-redesign
  - component-extraction
  - type-safety
  - test-coverage
  - learning-paths
---

# CE pipeline interactions during visual redesign work: lessons from learning-path detail restructuring

## Context

The learning-path detail page had been a monolithic 1240-line React component with a flat course list, a hero card, and a FocusPanel sidebar. The CE run (`feature/ce-2026-05-06-learning-path-detail-redesign`) restructured it into five extracted components (PathSummaryPanel, ContinueLearningBento, PathTimeline, ControlCenter, CourseThumbnail) plus utility extractions, all wired into a 12-column grid layout. The plan covered 5 implementation units with 7 requirements (R1-R7).

The CE pipeline's quality gates — plan-critic (plan review), techdebt-dedup (mid-run deduplication scan), and review-story (end-of-run agent swarm) — interacted with this visual redesign differently than they do with logic/business-rule changes. This document captures the patterns observed so that future CE runs on similar work can anticipate the findings, plan rounds accordingly, and avoid surprises.

## Guidance

### Lesson 1: Plan-critic is especially valuable for visual redesigns because test coverage is not self-evident

For logic changes (e.g., "add Bearer auth to BookContentService"), the test coverage requirements follow naturally from the API contract: test the new branch, test the error path, test the integration point. For a visual redesign, the plan listed test files for each extracted component (PathSummaryPanel, ContinueLearningBento, PathTimeline, ControlCenter), but the plan-critic mechanism still flagged that the test scenarios were underspecified relative to the visual surface area.

**Why**: Visual components have many rendering states (loading, empty, error, each breakpoint, each status variant) that are easy to overlook during planning. The plan for this run did include test scenarios for edge cases (zero progress, full completion, missing thumbnail, etc. — see the plan's Units 1-4), but the critic correctly identified that implementation could drift from those scenarios since the plan doesn't enforce test creation.

**Evidence**: In R2 of the review loop, the testing reviewer found that all 4 planned test files were missing. The implementation had focused on the visual output and integration test, deferring unit tests. By R3, all 4 test files existed with 35 passing tests covering happy paths, edge cases, and interaction tests. The plan-critic had flagged this gap at the plan stage, but it was left to the review loop to enforce it.

**Takeaway**: For visual redesigns, the plan should specify not just *that* test files exist but *what* visual states and interactions each component must test. Consider adding a review checklist item: "unit tests created for every extracted component before page integration."

### Lesson 2: Techdebt dedup finds extraction opportunities mid-run, particularly in visual redesigns that touch many files

During implementation, the CE run naturally discovered two extraction opportunities:
- **CourseThumbnail**: extracted into `src/app/components/shared/CourseThumbnail.tsx` (a shared component used from SortableCourseRow, CourseTimelineEntry, and the Timeline view)
- **Gap justification utilities**: `extractGapSearchTerm` and `cleanGapJustification` extracted into `src/data/learningPathUtils.ts`

These were not planned up-front. They emerged because the visual redesign touched the same data rendering patterns across multiple files, making the duplication visible. The techdebt dedup scan, running mid-run, correctly identified both as extraction opportunities and suggested them.

**Why this matters for visual redesigns**: Unlike a logic fix that targets one function or file, a visual redesign typically touches the page component, 3-5 new subcomponents, 2-3 existing components being refactored, and potentially shared utilities. This breadth of file touch naturally reveals shared patterns that were previously invisible. The techdebt dedup scan timing (mid-run, after core implementation but before review) is optimal for catching these — early enough to extract before review, late enough that the pattern has emerged.

**Evidence**: The techdebt extraction commit (`740ab671`) touched 8 files across 4 directories (components, pages, data, stores). Both extractions were clean — the CourseThumbnail component replaced inline thumbnail rendering in 3 call sites, and the utility functions consolidated gap string manipulation that was previously duplicated in PathTimeline and RoadmapListView.

**Takeaway**: Always run the techdebt dedup scan during visual redesign CE runs. The breadth-of-touch pattern makes extraction opportunities more likely than in focused logic changes. Budget time for mid-run extraction commits between the implementation and review phases.

### Lesson 3: Visual redesign review loops predictably need 2-3 rounds, driven by test coverage and type safety findings

This CE run's review story phase followed this progression:

| Round | Key Findings | Outcome |
|-------|-------------|---------|
| R1 | Missing unit tests for 4 components; unsafe type assertion on FocusTargetType | Created tests + fixed type cast |
| R2 | safe_auto (useMemo for Set reference stability); missing tests confirmed fixed; residual P3 on utility function test coverage | Applied safe_auto + remaining fixes |
| R3 (final) | Import consolidation; silent-catch-ok annotation; all R2 fixes verified; one residual P3 (component 1 line over complexity threshold); pre-existing test failure confirmed | Clean state, ready to merge |

**Why 3 rounds for visual redesigns**: The finding archetypes are predictable:
1. **Test coverage** (highest frequency): New presentational components need unit tests for rendering states, edge cases, and interactions. These are easy to defer during implementation because the visual output looks correct in the browser.
2. **Type safety** (medium frequency): Component extraction creates new prop interfaces and callback types. Type assertions (`as FocusTargetType`) are a common shortcut that the gated_auto reviewer catches reliably.
3. **Safe_auto findings** (medium frequency): Re-render optimization (useMemo for Set references), import deduplication, and lint annotations are automatically fixable but accumulate across rounds.
4. **Accessibility** (lower frequency): The CourseThumbnail alt text advisory finding was a P3 caught by maintainability review.

**Takeaway**: When planning a visual redesign CE run, budget for 2-3 review rounds. Round 1 typically catches the structural gaps (missing tests, type issues). Round 2 clears the medium findings and addresses safe_auto fixes. Round 3 (if needed) confirms all fixes and catches any residual low-severity issues. The pattern is consistent enough that you can plan the schedule accordingly rather than discovering multiple rounds as a surprise.

### Lesson 4: The gated_auto reviewer catches type safety issues that manual review might miss during visual restructuring

The R2 finding "Unsafe type assertion on focus target type" was flagged by the correctness reviewer (gated_auto mode). The issue: `dispatchFocusRequest(pathId, 'interleaved-review' as FocusTargetType)` used a type cast to pass a string literal that may or may not exist in the FocusTargetType union. Without the gated_auto reviewer, this would have passed into production because:
- TypeScript compiles it without error (the `as` cast explicitly suppresses the type checker)
- Visual testing doesn't exercise the focus dispatch path directly
- The string `'interleaved-review'` happened to be valid in the union (verified in R3 when the cast was removed and the build passed), but the reviewer's concern was correct in principle — the cast was a silent gap in type safety

**Why this matters for visual redesigns**: Component extraction creates new callback chains. Props flow from page -> new component -> existing store/dispatch. Each layer in the chain is an opportunity for an `as` cast to appear as a "temporary" shortcut during implementation. These shortcuts are rarely revisited unless a reviewer flags them.

**Takeaway**: The gated_auto reviewers (correctness, maintainability) are particularly important for visual redesigns because the type-safety surface area expands with each extracted component. Trust the gated_auto findings even when they seem pedantic — they catch the shortcuts that visual testing won't.

## Why This Matters

1. **Predictable review round count** means you can schedule accurately. A visual redesign CE run needing 2-3 review rounds is normal, not a failure. Budget the schedule accordingly rather than expecting a single clean round.

2. **Plan-critic + techdebt-dedup + review-story form a complementary chain**: plan-critic catches test gaps at the plan stage, techdebt-dedup finds extraction opportunities mid-run, and review-story enforces quality at the end. Each tool plays a distinct role and missing any one would create a blind spot.

3. **The CE pipeline behaves differently for visual vs. logic work**, and knowing the difference helps interpret findings correctly. A visual redesign with "missing tests" findings in R1 is not a poorly executed run — it's the pipeline working as designed.

4. **The gated_auto reviewer's type safety findings are worth more attention in visual redesigns** because the expanded callback/component surface area creates more opportunities for shortcuts.

## When to Apply

- When planning a visual redesign CE run: budget 2-3 review rounds in the schedule
- When a plan-critic flags underspecified test coverage for visual components: add concrete test scenarios to the plan before implementation, not after
- During implementation of a visual redesign: run techdebt-dedup mid-run (not after review) to catch extraction opportunities found through breadth-of-touch
- When reviewing gated_auto findings about type assertions in new component chains: treat them as high-confidence even if they seem pedantic — they catch shortcuts visual testing misses

## Examples

### Expected finding pattern for a visual redesign review round

| Finding Archetype | Typical Severity | Reviewer | When to Expect | Likelihood |
|---|---|---|---|---|
| Missing unit tests for extracted components | P2 | testing | R1 | High |
| Unsafe type assertions in callback chains | P2 | correctness (gated_auto) | R1-R2 | Medium |
| Re-render optimization (useMemo/useCallback gaps) | P3 | correctness (safe_auto) | R1-R2 | Medium |
| Import deduplication or lint annotations | P3 | project-standards (safe_auto) | R2+ | Medium |
| Accessibility gaps (alt text, ARIA) | P3 | maintainability | R1-R2 | Low |
| Component over complexity threshold | P3 | maintainability | R2+ | Low |

### Review round budget for a typical visual redesign CE run

```
Planning phase
  ├── Plan creation (1-2h)
  ├── Plan-critic review (30 min)
  └── Fix plan gaps from critic feedback
Implementation phase
  ├── Core implementation (3-5h)
  ├── Techdebt-dedup scan (15 min)
  ├── Extraction commit from dedup findings (30 min)
  └── Continue implementation + tests
Review phase (budget 2-3 rounds)
  ├── R1: Structural review (30 min) → fixes (1-2h)
  ├── R2: Medium findings review (30 min) → fixes (30 min-1h)
  └── R3 (if needed): Final verification (15 min)
Merge
```

## Related

- Plan: `docs/plans/2026-05-06-002-feat-learning-path-detail-redesign-plan.md`
- PR: <https://github.com/PedroLages/knowlune/pull/524>
- Branch: `feature/ce-2026-05-06-learning-path-detail-redesign`
- R2 review artifact: `.context/compound-engineering/ce-review/20260506-164920-bf23284c/run-artifact.md`
- R3 review artifact: `.context/compound-engineering/ce-review/20260506-170350-b0be6608/run-artifact.md`
- Techdebt extraction commit: `740ab671`
- Review loop max rounds memo: `docs/solutions/best-practices/2026-04-25-e2e-tests-need-guest-mode-init-script-post-e92-auth-gate.md` (auto memory [claude])
- Learning paths roadmap UX lessons: `docs/solutions/best-practices/learning-paths-authors-roadmap-ux-implementation-lessons-2026-05-05.md`
- Learning paths roadmap simplification lessons: `docs/solutions/best-practices/learning-paths-roadmap-simplification-card-sizing-dialog-fixes-2026-05-05.md`
