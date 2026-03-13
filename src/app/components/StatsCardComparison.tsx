import { useState } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '@/app/components/ui/utils'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select'

type Period = 'week' | 'month' | 'year'

interface StatsCardComparisonProps {
  currentValue: number
  label: string
}

/** Generate mock historical data for comparison */
function getMockHistoricalData(currentValue: number, period: Period): number {
  const multipliers = {
    week: 0.85,
    month: 0.75,
    year: 0.5,
  }
  return Math.round(currentValue * multipliers[period])
}

export function StatsCardComparison({ currentValue, label }: StatsCardComparisonProps) {
  const [period, setPeriod] = useState<Period>('week')

  const previousValue = getMockHistoricalData(currentValue, period)
  const change = currentValue - previousValue
  const changePercentage = previousValue > 0 ? ((change / previousValue) * 100).toFixed(1) : '0.0'
  const isIncrease = change > 0

  const currentPercentage = Math.max(currentValue, previousValue) > 0
    ? (currentValue / Math.max(currentValue, previousValue)) * 100
    : 50
  const previousPercentage = Math.max(currentValue, previousValue) > 0
    ? (previousValue / Math.max(currentValue, previousValue)) * 100
    : 50

  return (
    <div className="space-y-4">
      {/* Period selector */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">Compare {label}</h3>
        <Select value={period} onValueChange={(value) => setPeriod(value as Period)}>
          <SelectTrigger className="w-[140px]" aria-label="Select comparison period">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="week">Past Week</SelectItem>
            <SelectItem value="month">Past Month</SelectItem>
            <SelectItem value="year">Past Year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Comparison chart */}
      <div className="space-y-3">
        {/* Current period bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Current</span>
            <span className="font-semibold tabular-nums">{currentValue}</span>
          </div>
          <div className="relative h-8 rounded-lg bg-surface overflow-hidden">
            <div
              className={cn(
                'absolute inset-y-0 left-0 rounded-lg motion-safe:transition-all motion-safe:duration-500',
                isIncrease ? 'bg-success' : 'bg-destructive'
              )}
              style={{ width: `${currentPercentage}%` }}
              role="img"
              aria-label={`Current value: ${currentValue}`}
            />
          </div>
        </div>

        {/* Previous period bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Previous</span>
            <span className="font-semibold tabular-nums">{previousValue}</span>
          </div>
          <div className="relative h-8 rounded-lg bg-surface overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-muted-foreground/30 rounded-lg motion-safe:transition-all motion-safe:duration-500"
              style={{ width: `${previousPercentage}%` }}
              role="img"
              aria-label={`Previous value: ${previousValue}`}
            />
          </div>
        </div>
      </div>

      {/* Change indicator */}
      <div
        className={cn(
          'flex items-center gap-2 p-3 rounded-lg',
          isIncrease ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
        )}
      >
        {isIncrease ? (
          <TrendingUp className="size-4" aria-hidden="true" />
        ) : (
          <TrendingDown className="size-4" aria-hidden="true" />
        )}
        <span className="text-sm font-medium">
          {isIncrease ? '+' : ''}{changePercentage}% vs previous {period}
        </span>
      </div>
    </div>
  )
}
