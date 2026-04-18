/**
 * LibraryShelfRow — foundational shelf primitive for the Library page (E116-S01).
 *
 * Renders a section heading (icon + label + optional count + optional subtitle +
 * optional action slot) above a horizontally-scrollable row of children. The
 * scroller uses CSS scroll-snap so items snap cleanly on touch/scroll.
 *
 * Returns `null` when `children` is empty (no empty-row whitespace on the page).
 *
 * The heading pattern matches `SmartGroupedView`'s `SectionHeading` component for
 * visual consistency across the Library page.
 *
 * @since E116-S01
 */

import { Children, type ReactNode } from 'react'

export interface LibraryShelfRowProps {
  /** Lucide-style icon component (e.g., `Clock`, `Headphones`) */
  icon: React.ComponentType<{ className?: string }>
  /** Shelf heading label (e.g., "Continue Listening") */
  label: string
  /** Optional count badge next to label (e.g., number of items) */
  count?: number
  /** Optional secondary text below label (e.g., "Most recently opened") */
  subtitle?: string
  /** Optional right-aligned action slot (e.g., "Shuffle" or "See all" button) */
  actionSlot?: ReactNode
  /** Cards or book tiles to render in the horizontal scroller */
  children?: ReactNode
  /** Optional data-testid for E2E/unit tests */
  'data-testid'?: string
}

/**
 * Determine whether children is effectively empty.
 * Handles `null`, `undefined`, empty arrays, and arrays of falsy nodes.
 * Note: Children.toArray already filters null/undefined/false, so we only
 * need to check length after calling it.
 */
function isChildrenEmpty(children: ReactNode): boolean {
  if (children === null || children === undefined || children === false) return true
  return Children.toArray(children).length === 0
}

export function LibraryShelfRow({
  icon: Icon,
  label,
  count,
  subtitle,
  actionSlot,
  children,
  'data-testid': testId,
}: LibraryShelfRowProps) {
  // AC2: return null when children is empty
  if (isChildrenEmpty(children)) {
    return null
  }

  return (
    <section className="mb-8" data-testid={testId ?? 'library-shelf-row'}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h3
            className="flex items-center gap-2 text-lg font-semibold text-foreground"
            data-testid={testId ? `${testId}-heading` : 'library-shelf-row-heading'}
          >
            <Icon className="size-5" aria-hidden="true" />
            <span className="truncate">{label}</span>
            {typeof count === 'number' && (
              <span className="font-normal text-muted-foreground">({count})</span>
            )}
          </h3>
          {subtitle && (
            <p className="text-sm text-muted-foreground" data-testid={testId ? `${testId}-subtitle` : 'library-shelf-row-subtitle'}>
              {subtitle}
            </p>
          )}
        </div>
        {actionSlot && (
          <div
            className="shrink-0"
            data-testid={testId ? `${testId}-actions` : 'library-shelf-row-actions'}
          >
            {actionSlot}
          </div>
        )}
      </div>

      <div
        className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-2 -mx-2 px-2 scroll-smooth"
        data-testid={testId ? `${testId}-scroller` : 'library-shelf-row-scroller'}
      >
        {Children.map(children, (child, i) =>
          child === null || child === undefined || child === false ? null : (
            <div key={i} className="snap-start shrink-0">
              {child}
            </div>
          )
        )}
      </div>
    </section>
  )
}
