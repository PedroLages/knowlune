import { lazy, Suspense, useCallback, useState } from 'react'
import { useNavigate } from 'react-router'
import { RefreshCw, Settings2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/app/components/ui/button'
import { Skeleton } from '@/app/components/ui/skeleton'
import {
  OverviewLearningFocus,
  OverviewToday,
} from '@/app/components/overview/OverviewLearningFocus'
import { OverviewLibrary } from '@/app/components/overview/OverviewLibrary'
import { OverviewMetrics } from '@/app/components/overview/OverviewMetrics'
import { OverviewNewLearner } from '@/app/components/overview/OverviewNewLearner'
import { useOverviewDashboardModel } from '@/hooks/useOverviewDashboardModel'
import { useDashboardOrder } from '@/hooks/useDashboardOrder'
import { getFirstLesson, getLastWatchedLesson } from '@/lib/progress'
import type { LearningFocus, OverviewLearnerState } from '@/lib/overviewDashboard'
import type { DashboardSectionId } from '@/lib/dashboardOrder'
import { useCourseImportStore } from '@/stores/useCourseImportStore'

const ImportWizardDialog = lazy(() =>
  import('@/app/components/figma/ImportWizardDialog').then(module => ({
    default: module.ImportWizardDialog,
  }))
)

const DashboardCustomizer = lazy(() =>
  import('@/app/components/DashboardCustomizer').then(module => ({
    default: module.DashboardCustomizer,
  }))
)

const OverviewProgress = lazy(() =>
  import('@/app/components/overview/OverviewProgress').then(module => ({
    default: module.OverviewProgress,
  }))
)

const OverviewConsistency = lazy(() =>
  import('@/app/components/overview/OverviewConsistency').then(module => ({
    default: module.OverviewConsistency,
  }))
)

const OverviewInsights = lazy(() =>
  import('@/app/components/overview/OverviewInsights').then(module => ({
    default: module.OverviewInsights,
  }))
)

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function learnerSubtitle(state: OverviewLearnerState): string {
  switch (state) {
    case 'new':
      return 'Build a learning space from the material you already trust.'
    case 'returning':
      return 'One small session is enough to restart your momentum.'
    case 'early':
      return 'Your next step is ready. The deeper patterns will appear as you study.'
    case 'active':
      return 'Choose the next meaningful action, then let the numbers stay in the background.'
  }
}

function OverviewLoading() {
  return (
    <div
      className="mx-auto w-full max-w-[1360px] space-y-8 pb-10 xl:px-2"
      aria-busy="true"
      aria-label="Loading your learning overview"
    >
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-9 w-44" />
        <Skeleton className="h-4 w-full max-w-lg" />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
        <Skeleton className="h-[248px] rounded-3xl md:col-span-8" />
        <Skeleton className="h-[248px] rounded-3xl md:col-span-4" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-32 rounded-2xl" />
        ))}
      </div>
    </div>
  )
}

function OverviewError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="mx-auto flex min-h-[420px] w-full max-w-2xl items-center justify-center px-4">
      <section
        className="w-full rounded-3xl border border-destructive/30 bg-card p-8 text-center"
        role="alert"
      >
        <span className="mx-auto inline-flex size-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <RefreshCw className="size-5" aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-2xl font-semibold">Your overview needs another try</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{message}</p>
        <Button type="button" className="mt-6 min-h-11" onClick={onRetry}>
          Try again
        </Button>
      </section>
    </div>
  )
}

function OverviewSectionFallback({ height = 'h-72' }: { height?: string }) {
  return (
    <Skeleton className={`${height} w-full rounded-3xl`} aria-label="Loading dashboard section" />
  )
}

export function Overview() {
  const model = useOverviewDashboardModel()
  const dashboardOrder = useDashboardOrder()
  const navigate = useNavigate()
  const updateCourseStatus = useCourseImportStore(state => state.updateCourseStatus)
  const [importOpen, setImportOpen] = useState(false)

  const handleFocusAction = useCallback(
    async (focus: LearningFocus) => {
      try {
        const lastWatched = await getLastWatchedLesson(focus.courseId)
        const target =
          lastWatched ??
          (await getFirstLesson({
            getLessons: async () => focus.lessonOptions,
          }))

        if (focus.courseStatus === 'not-started') {
          await updateCourseStatus(focus.courseId, 'active')
        }
        if (!target) {
          toast.info('This course does not have a lesson to open yet.')
          navigate(`/courses/${focus.courseId}/overview`)
          return
        }
        navigate(`/courses/${focus.courseId}/lessons/${target.lessonId}`)
      } catch (error) {
        console.error('[Overview] Failed to resolve the next lesson:', error)
        toast.error('We could not open the next lesson. Opening the course overview instead.')
        navigate(`/courses/${focus.courseId}/overview`)
      }
    },
    [navigate, updateCourseStatus]
  )

  if (model.status === 'loading') return <OverviewLoading />
  if (model.status === 'error') {
    return <OverviewError message={model.error} onRetry={model.retry} />
  }

  const renderSection = (sectionId: DashboardSectionId) => {
    if (dashboardOrder.hiddenSections.has(sectionId)) return null
    switch (sectionId) {
      case 'focus':
        return model.learningFocus ? (
          <section className="grid grid-cols-1 gap-4 md:grid-cols-12" data-testid="section-focus">
            <div className="md:col-span-8">
              <OverviewLearningFocus
                focus={model.learningFocus}
                learnerState={model.learnerState}
                onAction={() => void handleFocusAction(model.learningFocus!)}
              />
            </div>
            <div className="md:col-span-4">
              <OverviewToday today={model.today} />
            </div>
          </section>
        ) : null
      case 'pulse':
        return <OverviewMetrics metrics={model.metrics} />
      case 'progress':
        return model.learnerState !== 'early' ? (
          <Suspense fallback={<OverviewSectionFallback height="h-[340px]" />}>
            <OverviewProgress
              learnerState={model.learnerState}
              sevenDays={model.studyTrend.sevenDays}
              thirtyDays={model.studyTrend.thirtyDays}
              activeCourses={model.activeCourses}
            />
          </Suspense>
        ) : null
      case 'consistency':
        return model.learnerState !== 'early' ? (
          <Suspense fallback={<OverviewSectionFallback height="h-[360px]" />}>
            <OverviewConsistency heatmap={model.heatmap} recentActivity={model.recentActivity} />
          </Suspense>
        ) : null
      case 'insights':
        return model.learnerState !== 'early' ? (
          <Suspense fallback={<OverviewSectionFallback />}>
            <OverviewInsights insights={model.insights} />
          </Suspense>
        ) : null
      case 'library':
        return <OverviewLibrary courses={model.library} allTags={model.allTags} />
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1360px] space-y-8 pb-10 sm:space-y-10 xl:px-2">
      <header className="flex items-start justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {getGreeting()}
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">Overview</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
            {learnerSubtitle(model.learnerState)}
          </p>
        </div>
        {model.learnerState !== 'new' && (
          <Button
            type="button"
            variant="outline"
            className="min-h-11 shrink-0"
            onClick={() => dashboardOrder.setIsCustomizing(!dashboardOrder.isCustomizing)}
            aria-expanded={dashboardOrder.isCustomizing}
            aria-controls="dashboard-customizer-panel"
            data-testid="customize-dashboard-toggle"
          >
            <Settings2 className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">Customize</span>
            <span className="sr-only sm:hidden">Customize overview</span>
          </Button>
        )}
      </header>

      {model.learnerState === 'new' ? (
        <OverviewNewLearner onImport={() => setImportOpen(true)} />
      ) : (
        <>
          {dashboardOrder.isCustomizing ? (
            <Suspense fallback={<OverviewSectionFallback height="h-80" />}>
              <DashboardCustomizer
                sectionOrder={dashboardOrder.sectionOrder}
                hiddenSections={dashboardOrder.hiddenSections}
                preset={dashboardOrder.preset}
                isOpen
                onClose={() => dashboardOrder.setIsCustomizing(false)}
                onPreset={dashboardOrder.handlePreset}
                onVisibility={dashboardOrder.handleVisibility}
                onReorder={dashboardOrder.handleReorder}
                onReset={dashboardOrder.handleReset}
              />
            </Suspense>
          ) : null}

          {dashboardOrder.sectionOrder.map(sectionId => {
            const section = renderSection(sectionId)
            return section ? (
              <div key={sectionId} data-dashboard-section={sectionId}>
                {section}
              </div>
            ) : null
          })}
        </>
      )}

      {importOpen && (
        <Suspense fallback={null}>
          <ImportWizardDialog open={importOpen} onOpenChange={setImportOpen} />
        </Suspense>
      )}
    </div>
  )
}
