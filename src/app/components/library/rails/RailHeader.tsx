/**
 * RailHeader — standardised heading block for Library rails.
 *
 * Wraps `LibraryShelfHeading` with rail-specific defaults, making it easy
 * for shelves to pass icon, title, count, subtitle, and a view-all action.
 */

import type { ReactNode } from 'react'
import {
  LibraryShelfHeading,
  type LibraryShelfHeadingLevel,
} from '@/app/components/library/LibraryShelfHeading'

export interface RailHeaderProps {
  /** Lucide-style icon component */
  icon: React.ComponentType<{ className?: string }>
  /** Shelf heading label (e.g., "Continue Listening") */
  title: string
  /** Optional count badge next to label */
  count?: number
  /** Optional secondary text below label */
  subtitle?: string
  /** Optional right-aligned action slot (e.g., "See all" button) */
  viewAll?: ReactNode
  /** Semantic heading level (defaults to 'h2') */
  headingLevel?: LibraryShelfHeadingLevel
  /** Optional heading id for aria-labelledby */
  headingId?: string
  /** data-testid prefix */
  'data-testid'?: string
}

export function RailHeader({
  icon,
  title,
  count,
  subtitle,
  viewAll,
  headingLevel = 'h2',
  headingId,
  'data-testid': testId,
}: RailHeaderProps) {
  return (
    <LibraryShelfHeading
      icon={icon}
      label={title}
      count={count}
      subtitle={subtitle}
      actionSlot={viewAll}
      headingLevel={headingLevel}
      id={headingId}
      data-testid={testId}
    />
  )
}
