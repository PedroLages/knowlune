/**
 * LibraryShelfHeading — shared section-heading primitive for the Library page.
 *
 * Renders the heading block used by both `LibraryShelfRow` (E116-S01) and
 * `SmartGroupedView`'s section headings: an `<h3>` with an icon, label, and
 * optional count, plus optional subtitle and right-aligned action slot.
 *
 * Extracted to eliminate duplication — the two call-sites previously defined
 * visually-identical heading components locally. Keeping this primitive
 * minimal (heading only, no scroller/layout logic) lets each caller own its
 * own surrounding structure.
 */
import type { ReactNode } from 'react'

export interface LibraryShelfHeadingProps {
  /** Lucide-style icon component (e.g., `Clock`, `Headphones`) */
  icon: React.ComponentType<{ className?: string }>
  /** Heading label (e.g., "Continue Listening", "Audiobooks") */
  label: string
  /** Optional count badge rendered as `(n)` next to the label */
  count?: number
  /** Optional secondary text below the label */
  subtitle?: string
  /** Optional right-aligned action slot (e.g., "See all" button) */
  actionSlot?: ReactNode
  /**
   * Base data-testid for the heading block. Sub-element test ids are derived
   * by suffixing (`-heading`, `-subtitle`, `-actions`). When omitted, falls
   * back to `library-shelf-row` for consistency with LibraryShelfRow.
   */
  'data-testid'?: string
}

export function LibraryShelfHeading({
  icon: Icon,
  label,
  count,
  subtitle,
  actionSlot,
  'data-testid': testId,
}: LibraryShelfHeadingProps) {
  const headingTestId = testId ? `${testId}-heading` : 'library-shelf-row-heading'
  const subtitleTestId = testId ? `${testId}-subtitle` : 'library-shelf-row-subtitle'
  const actionsTestId = testId ? `${testId}-actions` : 'library-shelf-row-actions'

  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-1">
        <h3
          className="flex items-center gap-2 text-lg font-semibold text-foreground"
          data-testid={headingTestId}
        >
          <Icon className="size-5" aria-hidden="true" />
          <span className="truncate">{label}</span>
          {typeof count === 'number' && (
            <span className="font-normal text-muted-foreground">({count})</span>
          )}
        </h3>
        {subtitle && (
          <p className="text-sm text-muted-foreground" data-testid={subtitleTestId}>
            {subtitle}
          </p>
        )}
      </div>
      {actionSlot && (
        <div className="shrink-0" data-testid={actionsTestId}>
          {actionSlot}
        </div>
      )}
    </div>
  )
}
