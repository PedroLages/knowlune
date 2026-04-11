import { Badge } from '@/app/components/ui/badge'
import { cn } from '@/app/components/ui/utils'

export const MASTERY_LABELS: Record<number, string> = {
  0: 'New',
  1: 'Learning',
  2: 'Familiar',
  3: 'Mastered',
}

export const MASTERY_COLORS: Record<number, string> = {
  0: 'bg-muted text-muted-foreground',
  1: 'bg-warning/15 text-warning',
  2: 'bg-brand-soft text-brand-soft-foreground',
  3: 'bg-success/15 text-success',
}

export function MasteryBadge({ level }: { level: number }) {
  return (
    <Badge
      variant="outline"
      className={cn('text-xs font-medium', MASTERY_COLORS[level])}
      data-testid="mastery-badge"
    >
      {MASTERY_LABELS[level]}
    </Badge>
  )
}
