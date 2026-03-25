import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react'

interface HybridStatsCardProps {
  label: string
  value: string | number
  icon: LucideIcon
  trend?: 'up' | 'down'
  trendValue?: string
  sparkline?: number[]
}

export function HybridStatsCard({
  label,
  value,
  icon: Icon,
  trend,
  trendValue,
  sparkline,
}: HybridStatsCardProps) {
  return (
    <div className="bg-white rounded-xl border border-neutral-100 shadow-xs hover:shadow-md transition-shadow duration-200 p-5">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <p className="text-sm text-neutral-500 mb-1">{label}</p>
          <p className="text-3xl font-bold text-neutral-900">{value}</p>

          {trend && (
            <div
              className={`flex items-center gap-1 text-xs font-medium mt-2 ${
                trend === 'up' ? 'text-green-600' : 'text-red-500'
              }`}
            >
              {trend === 'up' ? (
                <TrendingUp className="size-3" aria-hidden="true" />
              ) : (
                <TrendingDown className="size-3" aria-hidden="true" />
              )}
              {trendValue && <span>{trendValue}</span>}
            </div>
          )}
        </div>

        <div className="size-10 bg-brand-soft rounded-lg flex items-center justify-center flex-shrink-0">
          <Icon className="size-5 text-brand" aria-hidden="true" />
        </div>
      </div>

      {sparkline && sparkline.length > 0 && (
        <div
          className="h-8 flex items-end gap-0.5"
          role="img"
          aria-label={`Last ${sparkline.length} days activity: ${sparkline.join(', ')} completions`}
        >
          {sparkline.map((val, i) => {
            const max = Math.max(...sparkline)
            const height = max > 0 ? (val / max) * 100 : 0
            return (
              <div
                key={i}
                className="flex-1 bg-brand-soft hover:bg-brand/30 rounded-t-sm transition-colors"
                style={{ height: `${height}%`, minHeight: '4px' }}
                aria-hidden="true"
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
