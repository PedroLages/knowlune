import type { CourseGridColumns } from '@/stores/useEngagementPrefsStore'

export type CourseGridViewMode = 'grid' | 'compact'

/**
 * Resolves the Tailwind grid className for the Courses page.
 *
 * Returns complete string literals per branch — Tailwind v4 JIT requires
 * literal class names in source files. Dynamic concatenation like
 * `` `grid-cols-${n}` `` would be silently dropped from the production bundle.
 *
 * Grid mode (E99-S02): every branch starts with `grid-cols-1 sm:grid-cols-2`
 * so mobile (< 640px) always renders a single column regardless of
 * preference (AC6).
 *
 * Compact mode (E99-S04): a denser thumbnail-only layout. The scaling rule
 * for explicit column choices is approximately 1.6× the user's grid
 * preference, capped at 8:
 *
 *   grid → compact
 *   ────   ───────
 *   2    →  3
 *   3    →  5
 *   4    →  6
 *   5    →  8
 *   auto →  auto-compact (2 / 3 / 4 / 6 / 8 across breakpoints)
 *
 * Compact uses `gap-3` instead of `gap-[var(--content-gap)]` because the
 * dense thumbnail-only layout needs tighter spacing to scan at a glance.
 * If user testing shows the 1.6× ratio is unintuitive, promote to a separate
 * `compactGridColumns` setting (Approach B in the E99-S04 plan).
 */
export function getGridClassName(
  columns: CourseGridColumns,
  viewMode: CourseGridViewMode = 'grid'
): string {
  if (viewMode === 'compact') {
    switch (columns) {
      case 'auto':
        return 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3'
      case 2:
        return 'grid grid-cols-2 sm:grid-cols-3 gap-3'
      case 3:
        return 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3'
      case 4:
        return 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3'
      case 5:
        return 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3'
      default: {
        const _exhaustive: never = columns
        void _exhaustive
        return 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3'
      }
    }
  }

  switch (columns) {
    case 'auto':
      return 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-[var(--content-gap)]'
    case 2:
      return 'grid grid-cols-1 sm:grid-cols-2 gap-[var(--content-gap)]'
    case 3:
      return 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-[var(--content-gap)]'
    case 4:
      return 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-[var(--content-gap)]'
    case 5:
      return 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-[var(--content-gap)]'
    default: {
      // Exhaustiveness check — TypeScript will error if a new union member
      // is added without a case here.
      const _exhaustive: never = columns
      void _exhaustive
      return 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-[var(--content-gap)]'
    }
  }
}
