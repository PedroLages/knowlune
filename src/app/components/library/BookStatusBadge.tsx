/**
 * Status badge pill for book cards.
 *
 * Maps BookStatus to color-coded pills using design tokens.
 *
 * @since E83-S03
 */

import type { BookStatus } from '@/data/types'
import { cn } from '@/app/components/ui/utils'

const STATUS_CONFIG: Record<BookStatus, { label: string; className: string }> = {
  reading: { label: 'Reading', className: 'bg-brand/90 text-white' },
  finished: { label: 'Finished', className: 'bg-success/90 text-white' },
  unread: { label: 'Want to Read', className: 'bg-gold/90 text-white' },
  abandoned: { label: 'Abandoned', className: 'bg-muted-foreground/70 text-white' },
}

interface BookStatusBadgeProps {
  status: BookStatus
  className?: string
}

export function BookStatusBadge({ status, className }: BookStatusBadgeProps) {
  const config = STATUS_CONFIG[status]
  return (
    <span
      className={cn(
        'text-[10px] px-2 py-0.5 rounded-full font-medium leading-tight',
        config.className,
        className,
      )}
    >
      {config.label}
    </span>
  )
}
