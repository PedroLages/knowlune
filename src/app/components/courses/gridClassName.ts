import type { CourseGridColumns } from '@/stores/useEngagementPrefsStore'

/**
 * Resolves the Tailwind grid className for the Courses page (E99-S02).
 *
 * Returns complete string literals per branch — Tailwind v4 JIT requires
 * literal class names in source files. Dynamic concatenation like
 * `` `grid-cols-${n}` `` would be silently dropped from the production bundle.
 *
 * Every branch starts with `grid-cols-1 sm:grid-cols-2` so mobile (< 640px)
 * always renders a single column regardless of preference (AC6).
 */
export function getGridClassName(columns: CourseGridColumns): string {
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
