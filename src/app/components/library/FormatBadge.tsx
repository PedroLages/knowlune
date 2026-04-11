/**
 * Format badge pill for book cards — shows book type with icon and color.
 *
 * Maps BookFormat to color-coded pills using design tokens.
 * Each format has a distinct icon and accessible label.
 *
 * @since E108-S02
 */

import { BookOpen, FileText, Headphones } from 'lucide-react'
import type { BookFormat } from '@/data/types'
import { cn } from '@/app/components/ui/utils'

const FORMAT_CONFIG: Record<
  BookFormat,
  { label: string; icon: typeof BookOpen; className: string }
> = {
  epub: {
    label: 'EPUB',
    icon: BookOpen,
    className: 'bg-brand-soft text-brand-soft-foreground',
  },
  audiobook: {
    label: 'Audiobook',
    icon: Headphones,
    className: 'bg-warning/10 text-warning',
  },
  pdf: {
    label: 'PDF',
    icon: FileText,
    className: 'bg-muted text-muted-foreground',
  },
}

interface FormatBadgeProps {
  format: BookFormat
  className?: string
}

export function FormatBadge({ format, className }: FormatBadgeProps) {
  const config = FORMAT_CONFIG[format]
  // Intentional: type guard in case format is unexpected at runtime — render plain text fallback instead of null
  if (!config) return <span aria-label={format} data-testid="format-badge-unknown">{format}</span>

  const Icon = config.icon

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium leading-tight',
        config.className,
        className
      )}
      aria-label={`${config.label} format`}
      data-testid={`format-badge-${format}`}
    >
      <Icon className="size-3" aria-hidden="true" />
      {config.label}
    </span>
  )
}
