# E99-S05 Virtualized Grid Integration and Polish — Requirements

**Story ID:** E99-S05
**Source story:** [docs/implementation-artifacts/stories/E99-S05-virtualized-grid-integration-and-polish.md](../implementation-artifacts/stories/E99-S05-virtualized-grid-integration-and-polish.md)
**Date:** 2026-04-25
**Epic:** E99 — Courses page view modes & polish (final story)

## Goal

Make the Courses page render smoothly at any library size (especially 100–500+ courses) by introducing row-based virtualization for all three view modes, while preserving accessibility, focus management, motion preferences, and existing E2E coverage.

## Context

E99 has shipped four prior stories establishing list / compact-grid / cozy-grid view modes, density toggles, and resolved column counts. With heavy users reaching hundreds of courses, the plain grid render is the next bottleneck: scroll FPS dips and initial mount cost grows linearly with row count. This story introduces a virtualized wrapper that replaces the plain grid render in `Courses.tsx` only.

## Acceptance Criteria (from story)

1. With ≥100 courses, only visible rows are mounted; scroll ≥50fps; initial render <150ms.
2. While scrolling rapidly, skeleton placeholders fill yet-to-be-measured rows; no layout shift.
3. Below 30 courses, virtualization is bypassed (plain grid) — overhead exceeds benefit.
4. Focus inside a virtualized row that scrolls out and back is preserved or falls back to the list container (never lost to `document.body`).
5. Screen reader announces total course count via `aria-rowcount` / `aria-rowindex` (or list equivalent).
6. `prefers-reduced-motion` disables scroll-triggered animations.
7. Existing Courses E2E tests continue to pass (scroll-into-view as needed, do not delete coverage).

## In Scope

- Add `@tanstack/react-virtual` dependency.
- New `src/app/components/courses/VirtualizedCoursesList.tsx` wrapper with:
  - Row-based virtualization (one row = N cards for grid modes; one row = one course for list mode).
  - `useVirtualizer` with dynamic measurement (`measureElement`).
  - Bypass threshold constant `VIRTUALIZATION_THRESHOLD = 30`.
  - Responsive column detection (ResizeObserver or `matchMedia` synced via `useSyncExternalStore`), throttled re-measure.
  - Skeleton placeholders sized to estimated row height to prevent CLS.
  - ARIA: `role="list"`, `aria-rowcount`, per-row `aria-rowindex`.
  - Focus rescue: blur → refocus container when focused row is recycled.
  - Honor `prefers-reduced-motion`: no smooth-scroll behaviors.
- Wire wrapper into `src/app/pages/Courses.tsx` for all three view modes.
- New E2E spec `tests/e2e/e99-s05-virtualization.spec.ts` covering: 100-course seed renders subset, scroll-to-bottom reveals last course, mode switches preserve virtualization, <30 bypasses.
- Update existing Courses E2E specs to scroll-into-view if needed.
- Document FPS / TTI baseline + new metrics in story Challenges section.

## Out of Scope

- Virtualizing Library / Books page.
- Virtualizing AuthorList or ReportsList.
- Infinite scroll / pagination (all data remains in memory).
- New UX for "X / Y courses" scroll indicator (decide post-design-review only if needed).

## Dependencies

- Blocked by: E99-S01..S04 (already done — view modes + column resolver in place).
- Synergistic with: E64-S03 bundle baseline (record gzipped delta), E67 bulk selection (future).

## Constraints

- ES2020 target — no `Promise.any`, but `Promise.allSettled`, `?.`, `??` are fine.
- Design tokens only — no hardcoded Tailwind colors.
- Do not break E2E coverage; update assertions to scroll-into-view rather than removing them.
- Do not hardcode row heights — list (~72px) and grid (~280px) rows differ.
- Do not virtualize below threshold.
- Bundle delta: `@tanstack/react-virtual` ~6KB gzipped — record in baseline if E64-S03 is shipped.

## Success Signals

- 500-course seed: scroll FPS ≥50 measured (Performance panel / `performance.now()` between rAFs).
- Initial Courses page mount→first paint <150ms with 500 courses.
- All existing Courses E2E + new virtualization E2E green on Chromium.
- VoiceOver / NVDA announces "list, X items" with course count.
- No console errors or warnings during scroll.

## Risk Notes

- Grid virtualization with variable column counts is the trickiest part — row-based (N cards per virtual row) is the chosen lower-risk approach over per-cell virtualization.
- `measureElement` + dynamic row heights can cause flicker on first measurement — skeletons mitigate.
- Focus management is the most overlooked AC — explicit unmount-blur logic required.
- Keep `react-window` as documented fallback if `@tanstack/react-virtual` proves insufficient for grid case.
