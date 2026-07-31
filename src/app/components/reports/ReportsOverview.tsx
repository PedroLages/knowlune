import { lazy, Suspense, useCallback, useState } from 'react'
import { useNavigate } from 'react-router'
import { RefreshCw } from 'lucide-react'
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
import { getFirstLesson, getLastWatchedLesson } from '@/lib/progress'
import type { LearningFocus } from '@/lib/overviewDashboard'
import { useCourseImportStore } from '@/stores/useCourseImportStore'

const ImportWizardDialog = lazy(() =>
  import('@/app/components/figma/ImportWizardDialog').then(module => ({
    default: module.ImportWizardDialog,
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

function ReportsOverviewLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading your learning overview">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
        <Skeleton className="h-[248px] rounded-3xl md:col-span-8" />
        <Skeleton className="h-[248px] rounded-3xl md:col-span-4" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-32 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-[340px] rounded-3xl" />
    </div>
  )
}

function ReportsOverviewError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <section className="flex min-h-[360px] items-center justify-center" role="alert">
      <div className="w-full max-w-xl rounded-3xl border border-destructive/30 bg-card p-8 text-center">
        <span className="mx-auto inline-flex size-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <RefreshCw className="size-5" aria-hidden="true" />
        </span>
        <h2 className="mt-4 text-2xl font-semibold">Reports need another try</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{message}</p>
        <Button type="button" className="mt-6 min-h-11" onClick={onRetry}>
          Try again
        </Button>
      </div>
    </section>
  )
}

export function ReportsOverview() {
  const model = useOverviewDashboardModel()
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
        console.error('[ReportsOverview] Failed to resolve the next lesson:', error)
        toast.error('We could not open the next lesson. Opening the course overview instead.')
        navigate(`/courses/${focus.courseId}/overview`)
      }
    },
    [navigate, updateCourseStatus]
  )

  if (model.status === 'loading') return <ReportsOverviewLoading />
  if (model.status === 'error') {
    return <ReportsOverviewError message={model.error} onRetry={model.retry} />
  }

  return (
    <div className="space-y-8 pb-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Overview
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
            Your learning momentum
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            A clear read on what is moving, what needs attention, and the next useful action.
          </p>
        </div>
      </div>

      {model.learnerState === 'new' ? (
        <OverviewNewLearner onImport={() => setImportOpen(true)} />
      ) : (
        <>
          {model.learningFocus ? (
            <section className="grid grid-cols-1 gap-4 md:grid-cols-12">
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
          ) : null}

          <OverviewMetrics metrics={model.metrics} />

          <Suspense fallback={<Skeleton className="h-[340px] rounded-3xl" />}>
            <OverviewProgress
              learnerState={model.learnerState}
              sevenDays={model.studyTrend.sevenDays}
              thirtyDays={model.studyTrend.thirtyDays}
              activeCourses={model.activeCourses}
            />
          </Suspense>

          <Suspense fallback={<Skeleton className="h-[360px] rounded-3xl" />}>
            <OverviewConsistency heatmap={model.heatmap} recentActivity={model.recentActivity} />
          </Suspense>

          <Suspense fallback={<Skeleton className="h-72 rounded-3xl" />}>
            <OverviewInsights insights={model.insights} />
          </Suspense>

          <OverviewLibrary courses={model.library} allTags={model.allTags} />
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
