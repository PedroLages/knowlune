import { useState, useEffect, useMemo } from 'react'
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  Minus,
  MessageCircle,
  Route,
  Tags,
  Search,
  AlertCircle,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/app/components/ui/chart'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts'
import { Button } from '@/app/components/ui/button'
import { Badge } from '@/app/components/ui/badge'
import { Skeleton } from '@/app/components/ui/skeleton'
import { cn } from '@/app/components/ui/utils'
import { Link } from 'react-router'
import { isAIAvailable } from '@/lib/aiConfiguration'
import {
  getAIUsageStats,
  getAIUsageTimeline,
  AI_FEATURE_LABELS,
  AI_FEATURES,
  type TimePeriod,
  type TrendDirection,
  type AIUsageStats,
} from '@/lib/aiEventTracking'
import type { AIFeatureType, AIUsageEvent } from '@/data/types'

const PERIOD_LABELS: Record<TimePeriod, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
}

const FEATURE_ICONS: Record<AIFeatureType, typeof Sparkles> = {
  summary: Sparkles,
  qa: MessageCircle,
  learning_path: Route,
  note_organization: Tags,
  knowledge_gaps: Search,
  auto_analysis: Sparkles,
}

const FEATURE_CHART_COLORS: Record<AIFeatureType, string> = {
  summary: 'var(--chart-1)',
  qa: 'var(--chart-2)',
  learning_path: 'var(--chart-3)',
  note_organization: 'var(--chart-4)',
  knowledge_gaps: 'var(--chart-5)',
  auto_analysis: 'var(--chart-1)',
}

const TREND_CONFIG: Record<
  TrendDirection,
  { icon: typeof TrendingUp; className: string; label: string }
> = {
  up: { icon: TrendingUp, className: 'text-success', label: 'Up from previous period' },
  down: { icon: TrendingDown, className: 'text-destructive', label: 'Down from previous period' },
  stable: { icon: Minus, className: 'text-muted-foreground', label: 'Same as previous period' },
}

/** Static chart config — AI_FEATURES and FEATURE_CHART_COLORS are constants */
const CHART_CONFIG: ChartConfig = Object.fromEntries(
  AI_FEATURES.map(feature => [
    feature,
    { label: AI_FEATURE_LABELS[feature], color: FEATURE_CHART_COLORS[feature] },
  ])
)

/**
 * Groups timeline events into date buckets for chart rendering.
 */
function buildChartData(events: AIUsageEvent[], period: TimePeriod) {
  const buckets = new Map<string, Record<string, number>>()

  for (const event of events) {
    const date = new Date(event.timestamp)
    let key: string

    if (period === 'daily') {
      key = `${date.getHours()}:00`
    } else if (period === 'weekly') {
      key = date.toLocaleDateString('en-US', { weekday: 'short' })
    } else {
      key = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }

    if (!buckets.has(key)) {
      buckets.set(key, {})
    }
    const bucket = buckets.get(key)!
    bucket[event.featureType] = (bucket[event.featureType] ?? 0) + 1
  }

  return Array.from(buckets.entries()).map(([label, counts]) => ({
    label,
    ...counts,
  }))
}

export function AIAnalyticsTab() {
  const [period, setPeriod] = useState<TimePeriod>('weekly')
  const [stats, setStats] = useState<AIUsageStats | null>(null)
  const [chartData, setChartData] = useState<Record<string, unknown>[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const aiAvailable = isAIAvailable()

  useEffect(() => {
    let ignore = false

    async function loadData() {
      setIsLoading(true)
      setError(null)
      try {
        const [usageStats, timeline] = await Promise.all([
          getAIUsageStats(period),
          getAIUsageTimeline(period),
        ])
        if (!ignore) {
          setStats(usageStats)
          setChartData(buildChartData(timeline, period))
          setIsLoading(false)
        }
      } catch (err) {
        console.error('[AIAnalytics] Failed to load stats:', err)
        if (!ignore) {
          setError('Failed to load analytics data.')
          setIsLoading(false)
        }
      }
    }

    loadData()

    return () => {
      ignore = true
    }
  }, [period, retryCount])

  // Period status announcement for screen readers (single region instead of 5)
  const periodStatusMessage = useMemo(() => {
    if (!stats) return ''
    return `${PERIOD_LABELS[period]} stats loaded`
  }, [stats, period])

  if (isLoading) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Loading AI analytics">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-28 rounded-[24px]" />
          ))}
        </div>
        <Skeleton className="h-[300px] rounded-[24px]" />
      </div>
    )
  }

  if (!aiAvailable) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <AlertCircle className="size-10 text-muted-foreground mb-3" aria-hidden="true" />
          <p className="text-muted-foreground">
            AI provider not configured. Set up an AI provider in{' '}
            <Link to="/settings" className="text-brand underline hover:text-brand-hover">
              Settings
            </Link>{' '}
            to see analytics.
          </p>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <AlertCircle className="size-10 text-destructive mb-3" aria-hidden="true" />
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button variant="outline" onClick={() => setRetryCount(c => c + 1)}>
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  const hasData = stats && stats.totalEvents > 0

  return (
    <section aria-labelledby="ai-analytics-heading" className="space-y-6">
      {/* Screen reader announcement for period changes */}
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {periodStatusMessage}
      </span>

      {/* Section heading for screen reader navigation */}
      <h2 id="ai-analytics-heading" className="sr-only">
        AI Feature Analytics
      </h2>

      {/* Period toggle */}
      <div role="group" aria-label="Time period selection" className="flex gap-1">
        {(Object.keys(PERIOD_LABELS) as TimePeriod[]).map(p => (
          <Button
            key={p}
            variant={period === p ? 'default' : 'outline'}
            size="sm"
            className="min-h-[44px]"
            onClick={() => setPeriod(p)}
            aria-pressed={period === p}
          >
            {PERIOD_LABELS[p]}
          </Button>
        ))}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {stats?.features.map(feature => {
          const Icon = FEATURE_ICONS[feature.featureType]
          const trendConfig = TREND_CONFIG[feature.trend]
          const TrendIcon = trendConfig.icon
          const isKnowledgeGaps = feature.featureType === 'knowledge_gaps'
          const showComingSoon = isKnowledgeGaps && feature.count === 0

          return (
            <Card
              key={feature.featureType}
              className={cn(showComingSoon && 'opacity-60')}
              data-testid={`ai-stat-${feature.featureType}`}
            >
              <CardContent className="p-5 min-h-[7rem]">
                <div className="flex items-center justify-between mb-2">
                  <div className="rounded-xl bg-brand-soft p-2">
                    <Icon className="size-4 text-brand" aria-hidden="true" />
                  </div>
                  {!showComingSoon && (
                    <div
                      className={cn('flex items-center gap-1 text-xs', trendConfig.className)}
                      aria-label={`${trendConfig.label}, was ${feature.previousCount}`}
                    >
                      <TrendIcon className="size-3" aria-hidden="true" />
                      <span aria-hidden="true">{feature.previousCount}</span>
                    </div>
                  )}
                </div>
                <p className="text-2xl font-bold tabular-nums">
                  {showComingSoon ? '—' : feature.count}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {showComingSoon ? (
                    <Badge variant="secondary" className="text-xs">
                      Coming soon
                    </Badge>
                  ) : (
                    AI_FEATURE_LABELS[feature.featureType]
                  )}
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Usage trend chart */}
      {hasData ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">AI Feature Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <div role="img" aria-label="AI feature usage over time">
              <ChartContainer config={CHART_CONFIG} className="h-[300px] w-full">
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis tickLine={false} axisLine={false} tickMargin={8} allowDecimals={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  {AI_FEATURES.filter(f => f !== 'knowledge_gaps').map(feature => (
                    <Area
                      key={feature}
                      type="monotone"
                      dataKey={feature}
                      stackId="1"
                      stroke={FEATURE_CHART_COLORS[feature]}
                      fill={FEATURE_CHART_COLORS[feature]}
                      fillOpacity={0.15}
                    />
                  ))}
                </AreaChart>
              </ChartContainer>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Sparkles className="size-10 text-muted-foreground/30 mb-3" aria-hidden="true" />
            <p className="text-muted-foreground">
              No AI usage data yet. Use AI features like video summaries, Q&A, or learning paths to
              see analytics here.
            </p>
          </CardContent>
        </Card>
      )}
    </section>
  )
}
