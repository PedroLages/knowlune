/**
 * RailControls — prev/next chevron buttons for rail horizontal scrolling.
 *
 * Visibility: hidden by default; appears on hover/focus-within of the
 * parent rail container (uses `group-hover/rail` and `group-focus-within/rail`
 * peer classes). Buttons are real `<button type="button">` with aria-labels.
 *
 * Scroll delta: one tile width + gap per click, measured from the first tile
 * in the viewport.
 */

import { useCallback } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/app/components/ui/utils'

export interface RailControlsProps {
  /** Ref to the scrollable viewport element */
  viewportRef: React.RefObject<HTMLDivElement | null>
  /** Whether a left scroll is possible */
  canScrollLeft: boolean
  /** Whether a right scroll is possible */
  canScrollRight: boolean
  /** When false, the row fits the viewport — no chevrons rendered */
  hasOverflow: boolean
  /** Callback after scroll state changes */
  onScroll?: () => void
  /** data-testid prefix for the buttons */
  'data-testid'?: string
}

export function RailControls({
  viewportRef,
  canScrollLeft,
  canScrollRight,
  hasOverflow,
  onScroll,
  'data-testid': testId,
}: RailControlsProps) {
  const scrollBy = useCallback(
    (direction: 'left' | 'right') => {
      const el = viewportRef.current
      if (!el) return

      // Measure one tile width + gap from the first visible tile
      const firstTile = el.querySelector(
        '[data-rail-tile]'
      ) as HTMLElement | null

      let delta: number
      if (firstTile) {
        const tileWidth = firstTile.getBoundingClientRect().width
        const computedStyle = getComputedStyle(el)
        const gap = parseFloat(computedStyle.columnGap) || parseFloat(computedStyle.gap) || 16
        delta = (tileWidth + gap) * 1
      } else {
        // Fallback: use viewport percentage (should not happen if tiles exist)
        delta = el.clientWidth * 0.8
      }

      el.scrollBy({
        left: direction === 'left' ? -delta : delta,
        behavior: 'smooth',
      })

      // Let scroll event handler update affordances; fire callback after a tick
      if (onScroll) {
        requestAnimationFrame(() => {
          requestAnimationFrame(onScroll)
        })
      }
    },
    [viewportRef, onScroll]
  )

  if (!hasOverflow) {
    return null
  }

  return (
    <>
      <button
        type="button"
        onClick={() => scrollBy('left')}
        disabled={!canScrollLeft}
        aria-label="Scroll left"
        className={cn(
          'pointer-events-none absolute left-1 top-[38%] z-20 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full border border-border/60 bg-background/90 text-foreground opacity-0 shadow-sm backdrop-blur transition-opacity duration-200 disabled:cursor-not-allowed disabled:opacity-35',
          'group-hover/rail:pointer-events-auto group-hover/rail:opacity-100',
          'group-focus-within/rail:pointer-events-auto group-focus-within/rail:opacity-100',
          'md:flex'
        )}
        data-testid={testId ? `${testId}-scroll-left` : 'rail-scroll-left'}
      >
        <ChevronLeft className="size-6" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => scrollBy('right')}
        disabled={!canScrollRight}
        aria-label="Scroll right"
        className={cn(
          'pointer-events-none absolute right-1 top-[38%] z-20 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full border border-border/60 bg-background/90 text-foreground opacity-0 shadow-sm backdrop-blur transition-opacity duration-200 disabled:cursor-not-allowed disabled:opacity-35',
          'group-hover/rail:pointer-events-auto group-hover/rail:opacity-100',
          'group-focus-within/rail:pointer-events-auto group-focus-within/rail:opacity-100',
          'md:flex'
        )}
        data-testid={testId ? `${testId}-scroll-right` : 'rail-scroll-right'}
      >
        <ChevronRight className="size-6" aria-hidden="true" />
      </button>
    </>
  )
}
