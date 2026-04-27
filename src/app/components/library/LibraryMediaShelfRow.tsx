import { Children, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/app/components/ui/utils'
import {
  LibraryShelfHeading,
  type LibraryShelfHeadingLevel,
} from '@/app/components/library/LibraryShelfHeading'

export interface LibraryMediaShelfRowProps {
  icon: React.ComponentType<{ className?: string }>
  label: string
  count?: number
  subtitle?: string
  children?: ReactNode
  headingLevel?: LibraryShelfHeadingLevel
  headingId?: string
  'data-testid'?: string
}

function isChildrenEmpty(children: ReactNode): boolean {
  if (children === null || children === undefined || children === false) return true
  return Children.toArray(children).length === 0
}

export function LibraryMediaShelfRow({
  icon,
  label,
  count,
  subtitle,
  children,
  headingLevel = 'h2',
  headingId,
  'data-testid': testId,
}: LibraryMediaShelfRowProps) {
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const childItems = useMemo(() => Children.toArray(children).filter(Boolean), [children])

  const scrollerTestId = useMemo(
    () => (testId ? `${testId}-scroller` : 'library-media-shelf-row-scroller'),
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
    const delta = el.clientWidth * 0.9
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
    <section className="group/media-shelf" data-testid={testId ?? 'library-media-shelf-row'}>
      <LibraryShelfHeading
        icon={icon}
        label={label}
        count={count}
        subtitle={subtitle}
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
          className={cn(
            'absolute left-1 top-[38%] z-20 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full bg-card/80 text-foreground shadow-sm ring-1 ring-border/10 backdrop-blur transition-opacity disabled:cursor-not-allowed disabled:opacity-35 md:flex',
            canScrollLeft ? 'opacity-100' : 'opacity-60'
          )}
          data-testid={testId ? `${testId}-scroll-left` : 'library-media-shelf-row-scroll-left'}
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => scrollByViewport('right')}
          disabled={!canScrollRight}
          aria-label="Scroll right"
          className={cn(
            'absolute right-1 top-[38%] z-20 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full bg-card/80 text-foreground shadow-sm ring-1 ring-border/10 backdrop-blur transition-opacity disabled:cursor-not-allowed disabled:opacity-35 md:flex',
            canScrollRight ? 'opacity-100' : 'opacity-60'
          )}
          data-testid={testId ? `${testId}-scroll-right` : 'library-media-shelf-row-scroll-right'}
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

