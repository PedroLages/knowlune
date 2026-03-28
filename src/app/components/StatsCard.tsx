import { LucideIcon, TrendingUp, TrendingDown, Download, Activity } from 'lucide-react'
import { cn } from '@/app/components/ui/utils'
import NumberFlow from '@number-flow/react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/app/components/ui/tooltip'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/app/components/ui/sheet'
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

/** SVG sparkline — smooth curve with interactive tooltips */
function Sparkline({
  data,
  label,
  className,
}: {
  data: number[]
  label: string
  className?: string
}) {
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
    <TooltipProvider delayDuration={0}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className={cn('overflow-visible', className)}
        role="img"
        aria-label={`Last 7 days activity: ${data.join(', ')} ${label.toLowerCase()}`}
      >
        {/* Sparkline path */}
        <path
          d={d}
          fill="none"
          stroke="var(--brand)"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.6}
        />

        {/* Interactive circles with tooltips at each data point */}
        {points.map((point, i) => (
          <Tooltip key={i}>
            <TooltipTrigger asChild>
              <circle
                cx={point.x}
                cy={point.y}
                r={4}
                fill="var(--brand)"
                className="opacity-0 hover:opacity-100 transition-opacity cursor-pointer motion-safe:transition-all motion-safe:duration-200"
                aria-label={`Day ${i + 1}: ${data[i]} ${label.toLowerCase()}`}
              />
            </TooltipTrigger>
            <TooltipContent side="top" className="bg-popover border-border">
              <div className="text-xs">
                <span className="font-medium">{data[i]}</span> {label.toLowerCase()}
              </div>
            </TooltipContent>
          </Tooltip>
        ))}

        {/* End dot (always visible) */}
        <circle
          cx={points[points.length - 1]?.x}
          cy={points[points.length - 1]?.y}
          r={2}
          fill="var(--brand)"
          className="pointer-events-none"
        />
      </svg>
    </TooltipProvider>
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
  // Extract numeric value and suffix (e.g., "12.5h" → 12.5, "h")
  const stringValue = String(value)
  const numericMatch = stringValue.match(/^([\d.]+)(.*)$/)
  const numericValue = numericMatch ? parseFloat(numericMatch[1]) : NaN
  const suffix = numericMatch ? numericMatch[2] : ''

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          className="group relative p-[var(--content-padding)] rounded-2xl bg-surface-elevated border border-border/50 hover:border-brand-muted motion-safe:hover:shadow-studio-hover motion-safe:transition-[box-shadow,border-color] motion-safe:duration-300 overflow-hidden w-full text-left cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
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

            <div
              className="text-2xl font-bold tabular-nums block"
              data-testid={testId || 'stat-value'}
            >
              <NumberFlow
                value={isNaN(numericValue) ? 0 : numericValue}
                format={{
                  notation: 'standard',
                  maximumFractionDigits: stringValue.includes('.') ? 1 : 0,
                }}
                locales="en-US"
                aria-live="polite"
              />
              {suffix && <span className="ml-0.5">{suffix}</span>}
            </div>

            {/* Trend indicator */}
            {trend && (
              <div
                className={cn(
                  'flex items-center gap-1 text-xs font-medium mt-1',
                  trend === 'up' ? 'text-success' : 'text-destructive'
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

            {/* SVG sparkline with interactive tooltips */}
            {sparkline && sparkline.length > 0 && (
              <Sparkline data={sparkline} label={label} className="h-6 w-full mt-2" />
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
          <SheetDescription>
            Detailed view and comparison for {label.toLowerCase()}
          </SheetDescription>
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
            <Button
              variant="outline"
              className="w-full justify-start"
              aria-label="View all activity"
            >
              <Activity className="size-4 mr-2" aria-hidden="true" />
              View All Activity
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
