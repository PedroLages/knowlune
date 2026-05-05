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

import { Children, type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { cn } from '@/app/components/ui/utils'
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

function isChildrenEmpty(children: ReactNode): boolean {
  if (children === null || children === undefined || children === false) return true
  return Children.toArray(children).length === 0
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
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const childItems = Children.toArray(children).filter(Boolean)

  const updateScrollAffordances = useCallback(() => {
    const el = scrollerRef.current
    if (!el) return
    const maxScrollLeft = Math.max(0, el.scrollWidth - el.clientWidth)
    setCanScrollLeft(el.scrollLeft > 1)
    setCanScrollRight(el.scrollLeft < maxScrollLeft - 1)
  }, [])

  useEffect(() => {
    if (childItems.length === 0) {
      setCanScrollLeft(false)
      setCanScrollRight(false)
      return
    }

    updateScrollAffordances()
    const el = scrollerRef.current
    if (!el) return

    const handleScroll = () => updateScrollAffordances()
    el.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('resize', handleScroll)
    return () => {
      el.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', handleScroll)
    }
  }, [updateScrollAffordances, childItems.length])

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
          onScroll={updateScrollAffordances}
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
