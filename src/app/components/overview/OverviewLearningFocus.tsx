import { Link } from 'react-router'
import {
  ArrowRight,
  BookOpenCheck,
  Brain,
  CalendarClock,
  Clock3,
  RotateCcw,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { Progress } from '@/app/components/ui/progress'
import type { LearningFocus, OverviewLearnerState, TodayOverview } from '@/lib/overviewDashboard'

interface OverviewLearningFocusProps {
  focus: LearningFocus
  learnerState: OverviewLearnerState
  onAction: () => void
}

function focusCopy(focus: LearningFocus, learnerState: OverviewLearnerState) {
  if (learnerState === 'returning') {
    return {
      eyebrow: 'A gentle restart',
      title: 'Pick up the thread',
      description: focus.lessonTitle
        ? `Your place in “${focus.lessonTitle}” is ready when you are.`
        : 'Your course is ready when you are.',
      action: 'Resume where you left off',
      icon: RotateCcw,
    }
  }
  if (focus.variant === 'review') {
    return {
      eyebrow: 'Keep it fresh',
      title: 'Review a completed course',
      description: 'A short revisit now will make the material easier to recall later.',
      action: 'Review course',
      icon: Brain,
    }
  }
  if (focus.variant === 'start') {
    return {
      eyebrow: 'Your next step',
      title: 'Start with one focused lesson',
      description: focus.lessonTitle
        ? `Begin with “${focus.lessonTitle}” and build momentum from there.`
        : 'Open the course overview and choose your first lesson.',
      action: 'Start course',
      icon: Sparkles,
    }
  }
  return {
    eyebrow: 'Continue learning',
    title: focus.lessonTitle ?? 'Resume your course',
    description: 'Your most recent learning thread is ready to continue.',
    action: 'Resume lesson',
    icon: BookOpenCheck,
  }
}

export function OverviewLearningFocus({
  focus,
  learnerState,
  onAction,
}: OverviewLearningFocusProps) {
  const copy = focusCopy(focus, learnerState)
  const Icon = copy.icon

  return (
    <section
      className="relative isolate flex min-h-[248px] flex-col overflow-hidden rounded-3xl bg-brand p-5 text-brand-foreground shadow-sm sm:p-7"
      aria-labelledby="learning-focus-title"
      data-testid="overview-learning-focus"
    >
      <div
        className="pointer-events-none absolute -right-16 -top-20 -z-10 size-64 rounded-full border-[40px] border-brand-foreground/10"
        aria-hidden="true"
      />
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-foreground/75">
          {copy.eyebrow}
        </p>
        <span className="inline-flex size-10 items-center justify-center rounded-full bg-brand-foreground/10">
          <Icon className="size-5" aria-hidden="true" />
        </span>
      </div>

      <div className="mt-4 max-w-2xl">
        <p className="text-sm font-medium text-brand-foreground/75">{focus.courseName}</p>
        <h2 id="learning-focus-title" className="mt-1 text-2xl font-semibold sm:text-3xl">
          {copy.title}
        </h2>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-brand-foreground/80 sm:text-base">
          {copy.description}
        </p>
      </div>

      <div className="mt-auto flex flex-col gap-4 pt-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 flex-1 sm:max-w-sm">
          <div className="mb-2 flex items-center justify-between gap-4 text-xs text-brand-foreground/75">
            <span>
              {focus.completedItems} of {focus.totalItems} items
            </span>
            <span className="font-semibold text-brand-foreground">{focus.completionPercent}%</span>
          </div>
          <Progress
            value={focus.completionPercent}
            className="h-1.5 bg-brand-foreground/15 [&_[data-slot=progress-indicator]]:bg-brand-foreground"
            aria-label={`${focus.courseName} is ${focus.completionPercent}% complete`}
          />
        </div>
        <Button
          type="button"
          size="lg"
          onClick={onAction}
          className="min-h-11 shrink-0 bg-brand-foreground text-brand hover:bg-brand-foreground/90 hover:text-brand"
          data-testid="overview-primary-action"
        >
          {copy.action}
          <ArrowRight className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </section>
  )
}

function formatScheduleDate(startsAt: string): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(startsAt))
}

export function OverviewToday({ today }: { today: TodayOverview }) {
  const hasPlan = Boolean(today.nextSchedule || today.dueReviews || today.focusArea)

  return (
    <section
      className="flex min-h-[248px] flex-col rounded-3xl border border-border bg-card p-5 sm:p-6"
      aria-labelledby="today-overview-title"
      data-testid="overview-today"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Today
          </p>
          <h2 id="today-overview-title" className="mt-1 text-xl font-semibold">
            Your learning pulse
          </h2>
        </div>
        <Clock3 className="size-5 text-brand" aria-hidden="true" />
      </div>

      <div className="mt-5 flex flex-1 flex-col gap-3">
        {today.nextSchedule && (
          <Link
            to={
              today.nextSchedule.courseId
                ? `/courses/${today.nextSchedule.courseId}/overview`
                : '/courses'
            }
            className="group flex min-h-11 items-start gap-3 rounded-2xl bg-muted/60 p-3 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            <CalendarClock className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{today.nextSchedule.title}</span>
              <span className="block text-xs text-muted-foreground">
                {formatScheduleDate(today.nextSchedule.startsAt)} ·{' '}
                {today.nextSchedule.durationMinutes} min
              </span>
            </span>
          </Link>
        )}

        {today.dueReviews > 0 && (
          <Link
            to="/flashcards"
            className="group flex min-h-11 items-center justify-between gap-3 rounded-2xl bg-muted/60 p-3 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            <span className="flex items-center gap-3 text-sm font-medium">
              <RotateCcw className="size-4 text-brand" aria-hidden="true" />
              {today.dueReviews} {today.dueReviews === 1 ? 'review' : 'reviews'} due
            </span>
            <ArrowRight className="size-4 text-muted-foreground" aria-hidden="true" />
          </Link>
        )}

        {today.focusArea && (
          <Link
            to="/knowledge-map"
            className="group flex min-h-11 items-start gap-3 rounded-2xl bg-muted/60 p-3 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            <Brain className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{today.focusArea.name}</span>
              <span className="block text-xs text-muted-foreground">{today.focusArea.action}</span>
            </span>
          </Link>
        )}

        {!hasPlan && (
          <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-border p-4 text-center">
            <BookOpenCheck className="size-6 text-brand" aria-hidden="true" />
            <p className="mt-2 text-sm font-medium">Your day is open</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Resume the course beside this card when you are ready.
            </p>
          </div>
        )}
      </div>
    </section>
  )
}
