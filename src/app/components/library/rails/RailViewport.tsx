/**
 * RailViewport — horizontally scrollable container for rail tiles.
 *
 * Applies `.scrollbar-none` (from src/styles/index.css) to hide the visual
 * scrollbar while keeping scroll functional for trackpad/touch/swipe.
 * Optional scroll-snap via `snap` prop (defaults to true).
 */

import { forwardRef, type ReactNode } from 'react'
import { cn } from '@/app/components/ui/utils'

export interface RailViewportProps {
  children?: ReactNode
  /** Enable CSS scroll-snap (defaults to true) */
  snap?: boolean
  /** data-testid for the scroller element */
  'data-testid'?: string
  /** Optional className for gap/spacing overrides */
  className?: string
}

export const RailViewport = forwardRef<HTMLDivElement, RailViewportProps>(function RailViewport(
  { children, snap = true, 'data-testid': testId, className },
  ref
) {
  return (
    <div
      ref={ref}
      className={cn(
        'flex gap-4 overflow-x-auto pt-2 pb-2 -mx-2 px-2 scroll-smooth scrollbar-none',
        snap && 'snap-x snap-mandatory',
        className
      )}
      data-testid={testId ?? 'rail-viewport'}
    >
      {children}
    </div>
  )
})
