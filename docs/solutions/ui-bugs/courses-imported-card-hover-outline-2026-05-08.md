---
title: "Courses page — remove unwanted hover border/outline on imported course cards"
date: 2026-05-08
category: ui-bugs
module: courses
problem_type: ui_bug
component: documentation
symptoms:
  - "On /courses, hovering an imported course card showed a thin light border or ring around the full card (or compact tile)"
  - "Visual clashed with frameless course-card / album-art intent"
root_cause: config_error
resolution_type: code_fix
severity: low
tags:
  - courses
  - imported-course-card
  - imported-course-compact-card
  - tailwind
  - hover
  - ring
  - box-shadow
  - focus-visible
  - design-review
---

# Courses page — remove unwanted hover border/outline on imported course cards

## Problem

Imported course tiles on the Courses page drew a visible perimeter on hover (ring and/or shadow on the card root), which looked like an unwanted border and conflicted with the shared “frameless” course-card language.

## Symptoms

- Grid layout (`ImportedCourseCard`): hover added `hover:shadow-md` on the `<article>`, which could read as a full-card outline depending on theme and stacking.
- Compact layout (`ImportedCourseCompactCard`): `hover:ring-1 hover:ring-muted-foreground/30` plus `hover:shadow-sm` on the `<article>` produced an explicit hover stroke.

## What Didn't Work

- Leaving hover ring/shadow in place — user-visible defect remained.
- Broad changes to `CardCover` in `CourseCardShell.tsx` were intentionally avoided at first pass so `CourseCard` consumers (My Class, Authors, etc.) were not restyled; thumbnail-only brand ambient shadow may still read softly at the cover edge (separate decision).

## Solution

1. **`ImportedCourseCompactCard.tsx`** — Remove from the root `<article>`: `hover:ring-1 hover:ring-muted-foreground/30 hover:shadow-sm`. Keep `focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2`.
2. **`ImportedCourseCard.tsx`** — Remove `hover:shadow-md` from the `<article>`; keep `hover:-translate-y-0.5`, `motion-safe:transition-all`, and reduced-motion guards. Cover elevation remains via `CardCover` / `shadow-card-ambient`.
3. **`tests/e2e/design-review-courses-control-bar.mjs`** — CHECK 9: stop requiring `hover:shadow-md`; assert hover lift (`hover:-translate-y-0.5`), `focus-visible` ring classes, and `motion-safe:transition-all`; keep title `group-hover:text-brand` check.
4. **Tests** — `ImportedCourseCompactCard.test.tsx`: assert absence of hover ring utility strings; retain min `44px` touch-target assertions.

Merged PR: https://github.com/PedroLages/knowlune/pull/549

## Why This Works

The unwanted “border” was coming from **explicit Tailwind hover chrome** (ring and MD shadow) on the interactive root, not from keyboard focus. Removing those utilities eliminates the stroke while **preserving** `focus-visible` rings for accessibility and other hover feedback (translate, title color, cover motion inside `CardCover`).

## Prevention

- When adding hover affordances to course tiles, prefer **lift/motion** and shared shell shadows over **article-level** `hover:ring-*` or heavy `hover:shadow-*` unless design explicitly calls for an outline.
- Extend **`design-review-courses-control-bar.mjs`** (or unit tests) when intentionally changing the card hover contract so checks don’t encode removed classes.
- Cross-reference: [unified-course-card-shared-shell-pattern-2026-04-20.md](../best-practices/unified-course-card-shared-shell-pattern-2026-04-20.md) for cover vs. card-root responsibility split.

## Related Issues

- Plan: [docs/plans/2026-05-08-004-fix-courses-page-card-hover-outline-plan.md](../../plans/2026-05-08-004-fix-courses-page-card-hover-outline-plan.md)
