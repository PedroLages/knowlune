import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import type { QualityTrend } from '@/data/types'

interface TrendIndicatorProps {
  trend: QualityTrend
}

const TREND_CONFIG: Record<QualityTrend, { icon: typeof TrendingUp; label: string; className: string }> = {
  improving: { icon: TrendingUp, label: 'Improving', className: 'text-success' },
  stable: { icon: Minus, label: 'Stable', className: 'text-muted-foreground' },
  declining: { icon: TrendingDown, label: 'Declining', className: 'text-warning' },
}

export function TrendIndicator({ trend }: TrendIndicatorProps) {
  const config = TREND_CONFIG[trend]
  const Icon = config.icon

  return (
    <span
      className={`inline-flex items-center gap-1 text-sm font-medium ${config.className}`}
      aria-label={`Session quality trend: ${config.label.toLowerCase()}`}
      data-testid="quality-trend-indicator"
    >
      <Icon className="size-4" />
      <span>{config.label}</span>
    </span>
  )
}
