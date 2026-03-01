import type { LucideIcon } from 'lucide-react'

interface SwissStatsCardProps {
  label: string
  value: string | number
  icon: LucideIcon
  trend?: 'up' | 'down'
  trendValue?: string
  sparkline?: number[]
}

export function SwissStatsCard({
  label,
  value,
  icon: Icon,
  trend,
  trendValue,
  sparkline,
}: SwissStatsCardProps) {
  const maxSpark = sparkline ? Math.max(...sparkline, 1) : 1

  return (
    <div className="border border-neutral-200 bg-white p-5 transition-colors hover:border-neutral-900 relative">
      {/* Icon - top right */}
      <Icon className="absolute top-5 right-5 w-5 h-5 text-black" strokeWidth={1.5} />

      {/* Label */}
      <p className="text-xs font-medium uppercase tracking-[0.1em] text-neutral-400 mb-2">
        {label}
      </p>

      {/* Value */}
      <p className="text-5xl font-bold text-black leading-none mb-2">{value}</p>

      {/* Trend */}
      {trend && trendValue && (
        <p className={`text-xs font-medium ${trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
          {trend === 'up' ? '+' : ''}
          {trendValue} vs last week
        </p>
      )}

      {/* Sparkline */}
      {sparkline && sparkline.length > 0 && (
        <div className="flex items-end gap-[2px] mt-4 h-8">
          {sparkline.map((val, i) => (
            <div
              key={i}
              className="flex-1"
              style={{
                height: `${Math.max((val / maxSpark) * 100, 4)}%`,
                backgroundColor: '#DC2626',
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
