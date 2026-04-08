/**
 * 2x2 grid of book cover thumbnails for Collections and Series cards.
 *
 * Renders up to 4 covers in a compact square grid. Empty slots
 * are filled with muted placeholders.
 *
 * @since Library Redesign
 */

import { memo } from 'react'
import { cn } from '@/app/components/ui/utils'

interface CoverCollageGridProps {
  coverUrls: (string | null)[]
  alt: string
  className?: string
}

export const CoverCollageGrid = memo(function CoverCollageGrid({
  coverUrls,
  alt,
  className,
}: CoverCollageGridProps) {
  // Pad to 4 slots
  const slots = [...coverUrls.slice(0, 4)]
  while (slots.length < 4) slots.push(null)

  return (
    <div
      className={cn(
        'grid grid-cols-2 grid-rows-2 gap-2 overflow-hidden rounded-lg bg-card p-2',
        className
      )}
      role="img"
      aria-label={alt}
    >
      {slots.map((url, i) => (
        <div key={i} className="overflow-hidden aspect-[3/4] rounded-md">
          {url ? (
            <img
              src={url}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover rounded-md"
            />
          ) : (
            <div className="h-full w-full bg-muted" />
          )}
        </div>
      ))}
    </div>
  )
})
