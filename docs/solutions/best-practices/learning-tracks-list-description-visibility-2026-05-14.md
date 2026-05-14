---
title: "Learning Tracks List — Hide Card Descriptions While Preserving Detail Hero and Description Search"
date: 2026-05-14
category: best-practices
module: learning-tracks
problem_type: best_practice
component: frontend_stimulus
severity: low
applies_when:
  - The `/learning-tracks` index should stay scannable but `LearningPath.description` is still needed on `/learning-tracks/:id` and in list search
  - A shared card component (`LearningPathCard`) is only consumed from one tracks list page
tags:
  - learning-tracks
  - learning-path-card
  - ux
  - search
  - e2e
  - call-site-wiring
---

# Learning Tracks List — Hide Card Descriptions While Preserving Detail Hero and Description Search

## Context

The tracks grid used `LearningPathCard` with `description={path.description}`, so long copy competed with titles and progress on every card. Product intent: keep the list minimal; keep the full description on the detail hero (`PathHeroBanner`); keep description text in the search filter so tracks remain discoverable when keywords live only in the description.

## Resolution

1. **Call-site-only change** — In `LearningTracks.tsx`, `TrackCard` stops passing `description` into `LearningPathCard`. The prop is optional; omitting it hides the paragraph block without new flags or API changes.
2. **Do not narrow search** — `filteredPaths` continues to match `p.description` so R3 holds.
3. **Regression tests** — Playwright uses a stable unique token (`lt-desc-visibility-xyz`) that does not appear in the seeded track title: assert absent on the list, present after navigation to detail, and that filtering by that token still surfaces the track when the title alone would not match.

## Non-obvious invariant

If `LearningPathCard` gains a second consumer that should show descriptions, either pass `description` there or introduce an explicit `showDescription` (or equivalent) once there are two conflicting needs. Until then, YAGNI at the call site keeps tracks-specific behavior localized.

## Related

- Plan: `docs/plans/2026-05-14-004-refactor-learning-tracks-list-description-plan.md`
- Broader tracks vs paths patterns: `docs/solutions/best-practices/learning-tracks-pages-implementation-patterns-2026-05-09.md`
