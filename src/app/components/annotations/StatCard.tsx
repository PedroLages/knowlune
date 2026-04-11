/**
 * StatCard — displays a single annotation statistic (icon + value + label).
 *
 * @module StatCard
 * @since E109-S04
 */
import { Card, CardContent } from '@/app/components/ui/card'

interface StatCardProps {
  label: string
  value: number | string
  icon: React.ComponentType<{ className?: string }>
}

export function StatCard({ label, value, icon: Icon }: StatCardProps) {
  return (
    <Card data-testid="annotation-stat-card">
      <CardContent className="flex items-center gap-3 p-4">
        <div className="rounded-lg bg-brand-soft p-2">
          <Icon className="size-5 text-brand-soft-foreground" aria-hidden="true" />
        </div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  )
}
