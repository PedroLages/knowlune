import { lazy, Suspense, useCallback, useState } from 'react'
import { useNavigate } from 'react-router'
import {
  ArrowRight,
  BookOpen,
  FileText,
  FolderOpen,
  RefreshCw,
  Settings2,
  Video,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/app/components/ui/button'
import { Skeleton } from '@/app/components/ui/skeleton'
import {
  OverviewLearningFocus,
  OverviewToday,
} from '@/app/components/overview/OverviewLearningFocus'
import { OverviewLibrary } from '@/app/components/overview/OverviewLibrary'
import { OverviewMetrics } from '@/app/components/overview/OverviewMetrics'
import { OverviewProgress } from '@/app/components/overview/OverviewProgress'
import { OverviewConsistency } from '@/app/components/overview/OverviewConsistency'
import { OverviewInsights } from '@/app/components/overview/OverviewInsights'
import { DashboardCustomizer } from '@/app/components/DashboardCustomizer'
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

function NewLearnerPanel({ onImport }: { onImport: () => void }) {
  return (
    <section
      className="relative isolate overflow-hidden rounded-3xl border border-border bg-card p-6 sm:p-10"
      aria-labelledby="new-learner-title"
      data-testid="overview-new-learner"
    >
      <div
        className="pointer-events-none absolute -right-20 -top-24 -z-10 size-72 rounded-full bg-brand-soft/60"
        aria-hidden="true"
      />
      <div className="max-w-2xl">
        <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-brand text-brand-foreground">
          <BookOpen className="size-5" aria-hidden="true" />
        </span>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-brand">
          Your first step
        </p>
        <h2
          id="new-learner-title"
          className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl"
        >
          Bring one course. We will organize the rest.
        </h2>
        <p className="mt-3 max-w-xl text-base leading-relaxed text-muted-foreground">
          Import a folder of lessons and Knowlune will turn your videos and PDFs into a focused,
          trackable learning path.
        </p>
        <Button
          type="button"
          size="lg"
          className="mt-6 min-h-11"
          onClick={onImport}
          data-testid="overview-import-course"
        >
          <FolderOpen className="size-4" aria-hidden="true" />
          Import your first course
          <ArrowRight className="size-4" aria-hidden="true" />
        </Button>
      </div>

      <div className="mt-8 grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { icon: Video, label: 'Video lessons', detail: 'Resume from your last position' },
          { icon: FileText, label: 'PDF material', detail: 'Keep reading progress together' },
          { icon: RefreshCw, label: 'Smart review', detail: 'See what deserves attention next' },
        ].map(item => (
          <div key={item.label} className="rounded-2xl bg-muted/60 p-4">
            <item.icon className="size-4 text-brand" aria-hidden="true" />
            <p className="mt-3 text-sm font-medium">{item.label}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.detail}</p>
          </div>
        ))}
      </div>
    </section>
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
        const firstLesson = await getFirstLesson({
          getLessons: async () => focus.lessonOptions,
        })
        const target = lastWatched ?? firstLesson

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
          <OverviewProgress
            learnerState={model.learnerState}
            sevenDays={model.studyTrend.sevenDays}
            thirtyDays={model.studyTrend.thirtyDays}
            activeCourses={model.activeCourses}
          />
        ) : null
      case 'consistency':
        return model.learnerState !== 'early' ? (
          <OverviewConsistency heatmap={model.heatmap} recentActivity={model.recentActivity} />
        ) : null
      case 'insights':
        return model.learnerState !== 'early' ? (
          <OverviewInsights insights={model.insights} />
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
        <NewLearnerPanel onImport={() => setImportOpen(true)} />
      ) : (
        <>
          <DashboardCustomizer
            sectionOrder={dashboardOrder.sectionOrder}
            hiddenSections={dashboardOrder.hiddenSections}
            preset={dashboardOrder.preset}
            isOpen={dashboardOrder.isCustomizing}
            onClose={() => dashboardOrder.setIsCustomizing(false)}
            onPreset={dashboardOrder.handlePreset}
            onVisibility={dashboardOrder.handleVisibility}
            onReorder={dashboardOrder.handleReorder}
            onReset={dashboardOrder.handleReset}
          />

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
