import { Suspense } from 'react'
import { RefreshCw } from 'lucide-react'
import { useOverviewDashboardModel } from '@/hooks/useOverviewDashboardModel'
import { OverviewConsistency } from '@/app/components/overview/OverviewConsistency'
import { OverviewInsights } from '@/app/components/overview/OverviewInsights'
import { OverviewProgress } from '@/app/components/overview/OverviewProgress'
import { Skeleton } from '@/app/components/ui/skeleton'
import { Button } from '@/app/components/ui/button'
import { ThisWeekSection } from '@/app/components/reports/ThisWeekSection'
import { ReadingSection } from '@/app/components/reports/ReadingSection'

export function StudyAnalyticsTab() {
  const model = useOverviewDashboardModel()

  if (model.status === 'loading') {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Loading study analytics">
        <Skeleton className="h-52 rounded-3xl" />
        <Skeleton className="h-80 rounded-3xl" />
        <Skeleton className="h-72 rounded-3xl" />
      </div>
    )
  }

  if (model.status === 'error') {
    return (
      <section className="flex min-h-[360px] items-center justify-center rounded-3xl border border-destructive/30 bg-card p-8 text-center" role="alert">
        <div>
          <RefreshCw className="mx-auto size-6 text-destructive" aria-hidden="true" />
          <h2 className="mt-3 text-xl font-semibold">Study analytics need another try</h2>
          <p className="mt-2 text-sm text-muted-foreground">{model.error}</p>
          <Button className="mt-5 min-h-11" onClick={model.retry}>Try again</Button>
        </div>
      </section>
    )
  }

  return (
    <div className="space-y-8">
      <section aria-labelledby="study-goal-title">
        <div className="mb-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Goal</p>
          <h2 id="study-goal-title" className="mt-1 text-xl font-semibold">Your weekly rhythm</h2>
        </div>
        <ThisWeekSection />
      </section>

      <OverviewProgress
        learnerState={model.learnerState}
        sevenDays={model.studyTrend.sevenDays}
        thirtyDays={model.studyTrend.thirtyDays}
        activeCourses={model.activeCourses}
      />

      <Suspense fallback={<Skeleton className="h-[360px] rounded-3xl" />}>
        <OverviewConsistency heatmap={model.heatmap} recentActivity={model.recentActivity} />
      </Suspense>

      <Suspense fallback={<Skeleton className="h-72 rounded-3xl" />}>
        <OverviewInsights insights={model.insights} />
      </Suspense>

      <section aria-labelledby="study-reading-title">
        <div className="mb-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Reading</p>
          <h2 id="study-reading-title" className="mt-1 text-xl font-semibold">Reading momentum</h2>
        </div>
        <ReadingSection />
      </section>
    </div>
  )
}
