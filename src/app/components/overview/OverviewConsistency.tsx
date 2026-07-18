import { useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Link } from 'react-router'
import { ArrowRight, CalendarDays, Clock3, ListChecks } from 'lucide-react'
import type { DashboardActivity, DashboardHeatmapDay } from '@/lib/overviewDashboard'
import { cn } from '@/app/components/ui/utils'

interface OverviewConsistencyProps {
  heatmap: DashboardHeatmapDay[]
  recentActivity: DashboardActivity[]
}

const levelClasses = [
  'bg-muted',
  'bg-heatmap-level-1',
  'bg-heatmap-level-2',
  'bg-heatmap-level-3',
  'bg-heatmap-level-4',
] as const

function formatDay(date: string): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date(`${date}T12:00:00`))
}

function StudyHeatmap({ days }: { days: DashboardHeatmapDay[] }) {
  const initialIndex = Math.max(
    0,
    days.findIndex(day => day.isToday)
  )
  const [activeIndex, setActiveIndex] = useState(initialIndex)
  const cellRefs = useRef<Array<HTMLButtonElement | null>>([])
  const activeDay = days[activeIndex]
  const totalMinutes = useMemo(() => days.reduce((sum, day) => sum + day.minutes, 0), [days])
  const activeDays = useMemo(() => days.filter(day => day.minutes > 0).length, [days])

  const moveFocus = (nextIndex: number) => {
    const boundedIndex = Math.max(0, Math.min(days.length - 1, nextIndex))
    setActiveIndex(boundedIndex)
    cellRefs.current[boundedIndex]?.focus()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const movement = {
      ArrowUp: -1,
      ArrowDown: 1,
      ArrowLeft: -7,
      ArrowRight: 7,
    }[event.key]

    if (movement !== undefined) {
      event.preventDefault()
      moveFocus(index + movement)
      return
    }
    if (event.key === 'Home') {
      event.preventDefault()
      moveFocus(0)
    } else if (event.key === 'End') {
      event.preventDefault()
      moveFocus(days.length - 1)
    }
  }

  return (
    <div className="rounded-3xl border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <CalendarDays className="size-4 text-brand" aria-hidden="true" />
            <h3 className="font-semibold">12-week rhythm</h3>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Completed study minutes, grouped by local calendar day
          </p>
        </div>
        <p className="text-sm font-medium tabular-nums">
          {totalMinutes} min · {activeDays} active {activeDays === 1 ? 'day' : 'days'}
        </p>
      </div>

      <div className="mt-5 overflow-x-auto pb-2">
        <div className="min-w-[620px]">
          <div className="mb-2 grid grid-cols-[42px_1fr] gap-3 text-[11px] text-muted-foreground">
            <span aria-hidden="true" />
            <div className="grid grid-cols-12 gap-1.5" aria-hidden="true">
              {Array.from({ length: 12 }, (_, index) => (
                <span key={index} className="truncate">
                  {formatDay(days[index * 7]?.date ?? '')}
                </span>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-[42px_1fr] gap-3">
            <div
              className="grid grid-rows-7 gap-1.5 text-[11px] leading-4 text-muted-foreground"
              aria-hidden="true"
            >
              {['Mon', '', 'Wed', '', 'Fri', '', 'Sun'].map((label, index) => (
                <span key={`${label}-${index}`}>{label}</span>
              ))}
            </div>
            <div
              role="grid"
              aria-label="Study minutes by day for the last 12 weeks"
              aria-describedby="heatmap-instructions heatmap-detail"
              className="grid grid-flow-col grid-rows-7 gap-1.5"
            >
              {days.map((day, index) => (
                <button
                  key={day.date}
                  ref={element => {
                    cellRefs.current[index] = element
                  }}
                  type="button"
                  role="gridcell"
                  tabIndex={index === activeIndex ? 0 : -1}
                  aria-current={day.isToday ? 'date' : undefined}
                  aria-label={`${formatDay(day.date)}: ${day.minutes} ${day.minutes === 1 ? 'minute' : 'minutes'}`}
                  className={cn(
                    'size-4 rounded-[4px] border border-border/30 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2',
                    levelClasses[day.level]
                  )}
                  onClick={() => setActiveIndex(index)}
                  onFocus={() => setActiveIndex(index)}
                  onKeyDown={event => handleKeyDown(event, index)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <p id="heatmap-instructions" className="sr-only">
        Use arrow keys to move by day or week. Home and End move to the first and last day.
      </p>
      <div
        id="heatmap-detail"
        className="mt-3 flex min-h-11 items-center justify-between gap-3 rounded-xl bg-muted/60 px-3 py-2 text-sm"
        aria-live="polite"
      >
        <span className="text-muted-foreground">Selected day</span>
        <span className="font-medium tabular-nums">
          {activeDay
            ? `${formatDay(activeDay.date)} · ${activeDay.minutes} min`
            : 'No day available'}
        </span>
      </div>
    </div>
  )
}

function RecentActivity({ activity }: { activity: DashboardActivity[] }) {
  return (
    <div className="flex h-full flex-col rounded-3xl border border-border bg-card p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ListChecks className="size-4 text-brand" aria-hidden="true" />
            <h3 className="font-semibold">Recent activity</h3>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Completed sessions and quiz attempts</p>
        </div>
        <Link
          to="/reports"
          className="inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-medium text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          aria-label="View learning reports"
        >
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>

      {activity.length > 0 ? (
        <ol className="mt-4 divide-y divide-border">
          {activity.map(item => {
            const content = (
              <div className="flex min-h-14 items-start gap-3 py-3">
                <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
                  <Clock3 className="size-4" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{item.title}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{item.detail}</span>
                </span>
                <time
                  dateTime={item.occurredAt}
                  className="shrink-0 text-[11px] text-muted-foreground"
                >
                  {new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(
                    new Date(item.occurredAt)
                  )}
                </time>
              </div>
            )
            return (
              <li key={item.id}>
                {item.courseId ? (
                  <Link
                    to={`/courses/${item.courseId}/overview`}
                    className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                  >
                    {content}
                  </Link>
                ) : (
                  content
                )}
              </li>
            )
          })}
        </ol>
      ) : (
        <div className="mt-5 flex flex-1 items-center justify-center rounded-2xl border border-dashed border-border p-6 text-center">
          <div>
            <Clock3 className="mx-auto size-6 text-brand" aria-hidden="true" />
            <p className="mt-2 text-sm font-medium">Your next completion appears here</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Finish a study session or quiz to start the timeline.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

export function OverviewConsistency({ heatmap, recentActivity }: OverviewConsistencyProps) {
  return (
    <section aria-labelledby="overview-consistency-title" data-testid="section-consistency">
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Consistency
        </p>
        <h2 id="overview-consistency-title" className="mt-1 text-xl font-semibold">
          A sustainable rhythm, not a perfect streak
        </h2>
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="xl:col-span-8">
          <StudyHeatmap days={heatmap} />
        </div>
        <div className="xl:col-span-4">
          <RecentActivity activity={recentActivity} />
        </div>
      </div>
    </section>
  )
}
