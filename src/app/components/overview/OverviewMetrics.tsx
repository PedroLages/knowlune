import { CalendarDays, Clock3, Flame, RotateCcw, type LucideIcon } from 'lucide-react'
import type { DashboardMetrics } from '@/lib/overviewDashboard'

interface MetricCardProps {
  label: string
  value: string
  context: string
  icon: LucideIcon
  testId: string
}

function MetricCard({ label, value, context, icon: Icon, testId }: MetricCardProps) {
  return (
    <article className="rounded-2xl border border-border bg-card p-4 sm:p-5" data-testid={testId}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight sm:text-3xl">
            {value}
          </p>
        </div>
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-soft-foreground">
          <Icon className="size-4" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-2 truncate text-xs text-muted-foreground">{context}</p>
    </article>
  )
}

function comparisonContext(
  value: number,
  previousValue: number,
  deltaPercent: number | null,
  unit: string
): string {
  if (previousValue === 0 && value > 0) return 'New activity versus the prior week'
  if (deltaPercent === 0) return `Same as the prior week · ${previousValue} ${unit}`
  if (deltaPercent === null) return `Prior week · ${previousValue} ${unit}`
  const direction = deltaPercent > 0 ? 'more' : 'less'
  return `${Math.abs(deltaPercent)}% ${direction} than the prior week`
}

export function OverviewMetrics({ metrics }: { metrics: DashboardMetrics }) {
  return (
    <section aria-labelledby="learning-pulse-title" data-testid="section-pulse">
      <div className="mb-3 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Learning pulse
          </p>
          <h2 id="learning-pulse-title" className="mt-1 text-xl font-semibold">
            The last seven full days
          </h2>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard
          label="Focused minutes"
          value={`${metrics.studyMinutes.value}`}
          context={comparisonContext(
            metrics.studyMinutes.value,
            metrics.studyMinutes.previousValue,
            metrics.studyMinutes.deltaPercent,
            'min'
          )}
          icon={Clock3}
          testId="metric-study-minutes"
        />
        <MetricCard
          label="Active days"
          value={`${metrics.activeDays.value}/7`}
          context={comparisonContext(
            metrics.activeDays.value,
            metrics.activeDays.previousValue,
            metrics.activeDays.deltaPercent,
            'days'
          )}
          icon={CalendarDays}
          testId="metric-active-days"
        />
        <MetricCard
          label="Current streak"
          value={`${metrics.currentStreak}d`}
          context={
            metrics.currentStreak > 0 ? 'Consecutive study days' : 'A fresh streak starts today'
          }
          icon={Flame}
          testId="metric-current-streak"
        />
        <MetricCard
          label="Reviews due"
          value={`${metrics.reviewsDue}`}
          context={metrics.reviewsDue > 0 ? 'Ready in your review queue' : 'Review queue is clear'}
          icon={RotateCcw}
          testId="metric-reviews-due"
        />
      </div>
    </section>
  )
}
