import { LucideIcon, TrendingUp, TrendingDown, Download, Activity } from 'lucide-react'
import { cn } from '@/app/components/ui/utils'
import { AnimatedCounter } from './AnimatedCounter'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/app/components/ui/sheet'
import { Button } from '@/app/components/ui/button'
import { StatsCardComparison } from './StatsCardComparison'

interface StatsCardProps {
  label: string
  value: string | number
  icon: LucideIcon
  trend?: 'up' | 'down'
  trendValue?: string
  sparkline?: number[]
  testId?: string
}

/** SVG sparkline — smooth curve instead of bar chart */
function Sparkline({ data, className }: { data: number[]; className?: string }) {
  const max = Math.max(...data, 1)
  const width = 80
  const height = 24
  const padding = 2

  const points = data.map((v, i) => ({
    x: padding + (i / (data.length - 1)) * (width - padding * 2),
    y: padding + (1 - v / max) * (height - padding * 2),
  }))

  // Build smooth path using cardinal spline approximation
  const d = points.reduce((acc, point, i) => {
    if (i === 0) return `M ${point.x} ${point.y}`
    return `${acc} L ${point.x} ${point.y}`
  }, '')

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={cn('overflow-visible', className)}
      role="img"
      aria-label={`Last 7 days activity: ${data.join(', ')} completions`}
    >
      <path
        d={d}
        fill="none"
        stroke="var(--brand)"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.6}
      />
      {/* End dot */}
      <circle
        cx={points[points.length - 1]?.x}
        cy={points[points.length - 1]?.y}
        r={2}
        fill="var(--brand)"
      />
    </svg>
  )
}

export function StatsCard({
  label,
  value,
  icon: Icon,
  trend,
  trendValue,
  sparkline,
  testId,
}: StatsCardProps) {
  // Convert value to number for comparison component
  const numericValue = typeof value === 'string' ? parseFloat(value) || 0 : value

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          className="group relative p-4 rounded-2xl bg-surface-elevated border border-border/50 hover:border-brand-muted motion-safe:hover:shadow-studio-hover motion-safe:transition-[box-shadow,border-color] motion-safe:duration-300 overflow-hidden w-full text-left cursor-pointer"
          aria-label={`View details for ${label}`}
        >
          {/* Subtle gradient on hover */}
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-brand-soft/0 group-hover:from-brand-soft/50 to-transparent motion-safe:transition-opacity motion-safe:duration-300 pointer-events-none" />

          <div className="relative">
            <div className="flex items-start justify-between mb-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
              <Icon
                className="size-4 text-brand opacity-60 group-hover:opacity-100 motion-safe:transition-opacity"
                aria-hidden="true"
              />
            </div>

            <AnimatedCounter
              value={value}
              className="text-2xl font-bold tabular-nums block"
              testId={testId || 'stat-value'}
            />

            {/* Trend indicator */}
            {trend && (
              <div
                className={cn(
                  'flex items-center gap-1 text-xs font-medium mt-1',
                  trend === 'up'
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                )}
              >
                {trend === 'up' ? (
                  <TrendingUp className="size-3" aria-hidden="true" />
                ) : (
                  <TrendingDown className="size-3" aria-hidden="true" />
                )}
                {trendValue && <span>{trendValue}</span>}
              </div>
            )}

            {/* SVG sparkline */}
            {sparkline && sparkline.length > 0 && (
              <Sparkline data={sparkline} className="h-6 w-full mt-2" />
            )}
          </div>
        </button>
      </SheetTrigger>

      <SheetContent side="right" className="max-w-2xl w-full">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Icon className="size-5 text-brand" aria-hidden="true" />
            {label}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Comparison section */}
          <StatsCardComparison currentValue={numericValue} label={label} />

          {/* Action buttons */}
          <div className="flex flex-col gap-2 pt-4 border-t border-border">
            <Button variant="outline" className="w-full justify-start" aria-label="Export data">
              <Download className="size-4 mr-2" aria-hidden="true" />
              Export Data
            </Button>
            <Button variant="outline" className="w-full justify-start" aria-label="View all activity">
              <Activity className="size-4 mr-2" aria-hidden="true" />
              View All Activity
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
