# E99-S04 Compact Grid View — Requirements

**Story ID:** E99-S04
**Source:** docs/implementation-artifacts/stories/E99-S04-compact-grid-view.md
**Date:** 2026-04-25

## Title

Compact Grid View for Courses page — thumbnail-centric dense grid (~6-8 cols at lg+).

## User Story

As a learner with a large catalog, I want a compact grid view that strips metadata down to title and thumbnail only, so that I can scan many courses at a glance like an app-icon grid.

## Acceptance Criteria (Gherkin)

1. Given `courseViewMode === 'compact'` When Courses renders Then dense grid with smaller cards is shown; each card displays only thumbnail (proportionally larger), title (2-line truncate), and minimal progress indicator. Tags, author, status badge, timestamp, overflow menu are hidden or revealed via hover/long-press.
2. Given compact view at `lg` breakpoint with `courseGridColumns === 'auto'` Then grid uses `grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8` (~6-8 cols).
3. Given compact + explicit column choice Then compact applies `~1.6×` scaling (capped) of the chosen value (Approach A from Dev Notes); document the scaling rule.
4. Given hover on desktop Then overflow menu and status badge fade in; title gets `text-foreground` emphasis.
5. Given long-press > 500ms on mobile (without > 10px movement) Then a context menu (edit/delete/status) appears; short tap navigates to course. Fallback: always-visible 3-dot button if long-press proves fragile.
6. Given short click Then navigate to course detail same as grid/list.
7. Given `progress > 0` Then a 2px progress bar overlays the bottom edge of the thumbnail; no numeric percent.

## Context

- Knowlune Courses page already supports list and grid view modes (E99-S01) and configurable column count (E99-S02). Compact is a third `courseViewMode`.
- Tech stack: React 19 + TypeScript, Tailwind v4, shadcn/ui, Radix primitives.
- Design tokens only — no hardcoded colors. Use `bg-brand` for progress bar.

## Dependencies

- **Blocked by E99-S01** — `courseViewMode` setting exists.
- **Blocked by E99-S02** — `gridClassName` helper exists and accepts `viewMode` extension.

## Files to Create / Modify

- NEW `src/app/components/figma/ImportedCourseCompactCard.tsx`
- MOD `src/app/components/courses/gridClassName.ts` (extend with `viewMode` arg + scaling rule)
- MOD `src/app/pages/Courses.tsx` (conditional render compact card)
- NEW `tests/e2e/e99-s04-compact-view.spec.ts`
- NEW `src/app/components/figma/ImportedCourseCompactCard.test.tsx`
- MOD `src/app/components/courses/gridClassName.test.ts`

## Out of Scope

- Adding a separate `compactGridColumns` setting (Approach B). Default to scaling (Approach A) per Dev Notes.
- Re-architecting `ImportedCourseCard` itself.
- Changing list view behavior.
- New per-card animations beyond the 150ms hover transition.

## Constraints

- WCAG 2.1 AA — 44×44 minimum touch target on the card itself; verify at densest breakpoint.
- `prefers-reduced-motion` respected for hover transitions.
- Design tokens only.
- Gap is `gap-3` (tight).
- Long-press must NOT block scrolling (cancel on pointer move > 10px).
- Title: `text-xs font-medium` desktop, `text-sm` mobile, 2-line clamp.
- Progress bar: `h-0.5 bg-brand`, flush to bottom of thumbnail, inside rounded corners.

## Test Plan

- Unit: ImportedCourseCompactCard renders only thumbnail + title; progress overlay when >0; hover reveals menu.
- Unit: `gridClassName('auto', 'compact')` returns expected dense classes; explicit columns scaled ~1.6× and capped.
- E2E: switch to compact, assert ≥6 columns at lg viewport, click navigates, long-press opens menu (or dot button works on mobile).

## Success Definition

User can switch to compact view and scan many courses by cover at a glance, with overflow actions reachable via hover (desktop) or long-press / dot button (mobile), passing all quality gates with no design-token violations and no a11y regressions.
