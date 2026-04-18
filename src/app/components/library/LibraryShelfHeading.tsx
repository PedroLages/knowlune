/**
 * LibraryShelfHeading — shared section-heading primitive for the Library page.
 *
 * Renders the heading block used by both `LibraryShelfRow` (E116-S01) and
 * `SmartGroupedView`'s section headings: a configurable heading tag with an
 * icon, label, and optional count, plus optional subtitle and right-aligned
 * action slot.
 *
 * E116-S02 extends this primitive with:
 * - `headingLevel` prop (`'h2' | 'h3' | 'h4'`, default `'h3'`) for callers
 *   that need different semantic levels without restyling.
 * - `className` pass-through on the root wrapper, merged via `cn()` so
 *   callers can override spacing (e.g. `mb-2` instead of the default `mb-4`).
 * - Co-located `ShelfSeeAllLink` helper for the standard "See all" affordance
 *   that callers drop into `actionSlot`.
 *
 * Extracted to eliminate duplication — the two call-sites previously defined
 * visually-identical heading components locally. Keeping this primitive
 * minimal (heading only, no scroller/layout logic) lets each caller own its
 * own surrounding structure.
 */
import type { ReactNode } from 'react'
import { cn } from '@/app/components/ui/utils'

export type LibraryShelfHeadingLevel = 'h2' | 'h3' | 'h4'

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
   * Semantic heading level for the label element. Defaults to `'h3'` to
   * preserve the original behaviour; callers can opt into `'h2'` or `'h4'`
   * when section context demands a different outline level. Visual styling
   * is identical across levels.
   */
  headingLevel?: LibraryShelfHeadingLevel
  /**
   * Optional className merged onto the root wrapper via `cn()`. Intended for
   * spacing overrides (e.g. `mb-2`); inner layout classes remain
   * encapsulated. Uses `tailwind-merge` semantics via `cn()`, so later
   * margin utilities override the default `mb-4`.
   */
  className?: string
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
  headingLevel = 'h3',
  className,
  'data-testid': testId,
}: LibraryShelfHeadingProps) {
  const headingTestId = testId ? `${testId}-heading` : 'library-shelf-row-heading'
  const subtitleTestId = testId ? `${testId}-subtitle` : 'library-shelf-row-subtitle'
  const actionsTestId = testId ? `${testId}-actions` : 'library-shelf-row-actions'

  const Tag = headingLevel

  return (
    <div className={cn('mb-4 flex items-start justify-between gap-3', className)}>
      <div className="flex min-w-0 flex-col gap-1">
        <Tag
          className="flex items-center gap-2 text-lg font-semibold text-foreground"
          data-testid={headingTestId}
        >
          <Icon className="size-5" aria-hidden="true" />
          <span className="truncate">{label}</span>
          {typeof count === 'number' && (
            <span className="font-normal text-muted-foreground">({count})</span>
          )}
        </Tag>
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

export interface ShelfSeeAllLinkProps {
  /**
   * When provided, renders an `<a href={href}>`. When omitted, renders a
   * `<button type="button" onClick={onClick}>`. If both `href` and `onClick`
   * are provided, `href` wins and `onClick` is not attached to the anchor
   * (callers that need both should use their own element).
   */
  href?: string
  /** Click handler used when `href` is not provided. */
  onClick?: () => void
  /** Visible label. Defaults to "See all". */
  label?: string
}

/**
 * Standardised "See all" affordance for use inside `LibraryShelfHeading`'s
 * `actionSlot`. Uses design tokens only (`text-brand` / `hover:text-brand-hover`)
 * and preserves the ≥44×44px touch-target floor via `h-11`.
 *
 * Element choice is driven by the presence of `href`:
 * - With `href` → `<a>` (navigation)
 * - Without `href` → `<button type="button">` (in-page action)
 *
 * Routing (e.g., wiring to React Router) happens at the call-site; this
 * helper stays framework-agnostic.
 */
export function ShelfSeeAllLink({ href, onClick, label = 'See all' }: ShelfSeeAllLinkProps) {
  const className =
    'flex h-11 items-center px-2 text-sm font-medium text-brand hover:text-brand-hover'

  if (href) {
    return (
      <a href={href} className={className}>
        {label}
      </a>
    )
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {label}
    </button>
  )
}
