/**
 * LibraryRail — unified rail primitive for Library media shelves.
 *
 * Composes RailHeader, RailControls, and RailViewport into a single section.
 * Chevrons appear on hover/focus-within (via group/rail CSS classes).
 * Scroll delta is one tile width + gap per click.
 *
 * Replaces the duplicated scroll/chevron logic in LibraryMediaShelfRow and
 * LibraryShelfRow for the Continue Listening + Recently Added shelves.
 */

import { Children, type ReactNode, useRef } from 'react'
import { cn } from '@/app/components/ui/utils'
import { isChildrenEmpty } from '@/lib/react-utils'
import { useShelfScrollAffordances } from '@/app/hooks/useShelfScrollAffordances'
import { RailHeader, type RailHeaderProps } from './RailHeader'
import { RailControls } from './RailControls'
import { RailViewport } from './RailViewport'

export interface LibraryRailProps extends RailHeaderProps {
  /** Tile components to render inside the scroller */
  children?: ReactNode
  /** Whether to apply scroll-snap (defaults to true) */
  snap?: boolean
  /** data-testid for the rail section */
  'data-testid'?: string
}

export function LibraryRail({
  icon,
  title,
  count,
  subtitle,
  viewAll,
  headingLevel,
  headingId,
  children,
  snap = true,
  'data-testid': testId,
}: LibraryRailProps) {
  const scrollerRef = useRef<HTMLDivElement | null>(null)

  const childItems = Children.toArray(children).filter(Boolean)

  const { canScrollLeft, canScrollRight, hasOverflow, update } = useShelfScrollAffordances(
    scrollerRef,
    childItems.length
  )

  if (isChildrenEmpty(children)) return null

  return (
    <section
      className="group/rail mb-8"
      data-testid={testId ?? 'library-rail'}
    >
      <RailHeader
        icon={icon}
        title={title}
        count={count}
        subtitle={subtitle}
        viewAll={viewAll}
        headingLevel={headingLevel}
        headingId={headingId}
        data-testid={testId}
      />

      <div className="relative">
        <RailControls
          viewportRef={scrollerRef}
          canScrollLeft={canScrollLeft}
          canScrollRight={canScrollRight}
          hasOverflow={hasOverflow}
          onScroll={update}
          data-testid={testId}
        />

        <RailViewport
          ref={scrollerRef}
          snap={snap}
          data-testid={testId ? `${testId}-scroller` : undefined}
        >
          {Children.map(children, (child, i) =>
            child === null || child === undefined || child === false ? null : (
              <div key={i} className={cn('snap-start shrink-0')}>
                {child}
              </div>
            )
          )}
        </RailViewport>
      </div>
    </section>
  )
}
