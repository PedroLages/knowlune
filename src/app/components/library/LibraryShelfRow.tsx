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

import { Children, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  LibraryShelfHeading,
  type LibraryShelfHeadingLevel,
} from '@/app/components/library/LibraryShelfHeading'

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
  /**
   * Semantic heading level for the internal `LibraryShelfHeading`. Passed
   * through to the primitive so page-level integrations (E116-S03) can
   * promote the heading to `h2` when the shelf is a top-level section
   * without restyling. Defaults to `'h3'` to preserve prior behaviour.
   */
  headingLevel?: LibraryShelfHeadingLevel
  /**
   * Optional explicit `id` applied to the heading element. Enables
   * `<section aria-labelledby={...}>` landmark wiring at call-sites.
   */
  headingId?: string
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
  icon,
  label,
  count,
  subtitle,
  actionSlot,
  children,
  headingLevel,
  headingId,
  'data-testid': testId,
}: LibraryShelfRowProps) {
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const scrollerTestId = useMemo(
    () => (testId ? `${testId}-scroller` : 'library-shelf-row-scroller'),
    [testId]
  )

  const updateScrollAffordances = useCallback(() => {
    const el = scrollerRef.current
    if (!el) return
    const maxScrollLeft = Math.max(0, el.scrollWidth - el.clientWidth)
    setCanScrollLeft(el.scrollLeft > 1)
    setCanScrollRight(el.scrollLeft < maxScrollLeft - 1)
  }, [])

  const scrollByViewport = useCallback((direction: 'left' | 'right') => {
    const el = scrollerRef.current
    if (!el) return
    const delta = el.clientWidth * 0.85
    el.scrollBy({ left: direction === 'left' ? -delta : delta, behavior: 'smooth' })
  }, [])

  const handleScrollerKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        scrollByViewport('left')
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        scrollByViewport('right')
      }
    },
    [scrollByViewport]
  )

  // AC2: return null when children is empty
  if (isChildrenEmpty(children)) {
    return null
  }

  const childItems = Children.toArray(children).filter(Boolean)

  useEffect(() => {
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

  return (
    <section className="mb-8 group/shelf" data-testid={testId ?? 'library-shelf-row'}>
      <LibraryShelfHeading
        icon={icon}
        label={label}
        count={count}
        subtitle={subtitle}
        actionSlot={actionSlot}
        headingLevel={headingLevel}
        id={headingId}
        data-testid={testId}
      />

      <div className="relative">
        <button
          type="button"
          onClick={() => scrollByViewport('left')}
          disabled={!canScrollLeft}
          aria-label="Scroll left"
          className="pointer-events-none absolute left-1 top-[38%] z-20 hidden size-9 -translate-y-1/2 items-center justify-center rounded-full border border-border/60 bg-background/90 text-foreground opacity-0 shadow-sm backdrop-blur transition-opacity duration-200 disabled:cursor-not-allowed disabled:opacity-35 group-hover/shelf:pointer-events-auto group-hover/shelf:opacity-100 md:flex"
          data-testid={testId ? `${testId}-scroll-left` : 'library-shelf-row-scroll-left'}
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => scrollByViewport('right')}
          disabled={!canScrollRight}
          aria-label="Scroll right"
          className="pointer-events-none absolute right-1 top-[38%] z-20 hidden size-9 -translate-y-1/2 items-center justify-center rounded-full border border-border/60 bg-background/90 text-foreground opacity-0 shadow-sm backdrop-blur transition-opacity duration-200 disabled:cursor-not-allowed disabled:opacity-35 group-hover/shelf:pointer-events-auto group-hover/shelf:opacity-100 md:flex"
          data-testid={testId ? `${testId}-scroll-right` : 'library-shelf-row-scroll-right'}
        >
          <ChevronRight className="size-4" aria-hidden="true" />
        </button>
        <div
          ref={scrollerRef}
          className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-2 -mx-2 px-2 scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          data-testid={scrollerTestId}
          tabIndex={0}
          onKeyDown={handleScrollerKeyDown}
        >
          {Children.map(children, (child, i) =>
            child === null || child === undefined || child === false ? null : (
              <div key={i} className="snap-start shrink-0">
                {child}
              </div>
            )
          )}
        </div>
      </div>
    </section>
  )
}
