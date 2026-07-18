import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { ArrowRight, BarChart3, BookOpenCheck, Clock3 } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { Button } from '@/app/components/ui/button'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/app/components/ui/chart'
import { Progress } from '@/app/components/ui/progress'
import type {
  ActiveCourseProgress,
  OverviewLearnerState,
  StudyTrendPoint,
} from '@/lib/overviewDashboard'

const chartConfig = {
  minutes: {
    label: 'Focused minutes',
    color: 'var(--chart-1)',
  },
} satisfies ChartConfig

interface OverviewProgressProps {
  learnerState: OverviewLearnerState
  sevenDays: StudyTrendPoint[]
  thirtyDays: StudyTrendPoint[]
  activeCourses: ActiveCourseProgress[]
}

function StudyMinutesChart({
  learnerState,
  sevenDays,
  thirtyDays,
}: Pick<OverviewProgressProps, 'learnerState' | 'sevenDays' | 'thirtyDays'>) {
  const [range, setRange] = useState<7 | 30>(learnerState === 'returning' ? 30 : 7)
  const data = range === 7 ? sevenDays : thirtyDays
  const summary = useMemo(() => {
    let total = 0
    let best: StudyTrendPoint | undefined
    for (const point of data) {
      total += point.minutes
      if (!best || point.minutes > best.minutes) best = point
    }
    return { total, best }
  }, [data])

  return (
    <div className="rounded-3xl border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="size-4 text-brand" aria-hidden="true" />
            <h3 className="font-semibold">Focused minutes</h3>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Daily active time from completed study sessions
          </p>
        </div>
        <div className="inline-flex self-start rounded-xl bg-muted p-1" aria-label="Chart range">
          {([7, 30] as const).map(value => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant={range === value ? 'secondary' : 'ghost'}
              className="h-8 min-w-11 px-2 text-xs"
              onClick={() => setRange(value)}
              aria-pressed={range === value}
            >
              {value}D
            </Button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 border-y border-border py-3 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="mt-1 font-semibold tabular-nums">{summary.total} min</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Strongest day</p>
          <p className="mt-1 truncate font-semibold tabular-nums">
            {summary.best?.minutes
              ? `${summary.best.label} · ${summary.best.minutes} min`
              : 'No activity yet'}
          </p>
        </div>
      </div>

      <ChartContainer
        config={chartConfig}
        className="mt-4 h-[210px] w-full aspect-auto"
        role="img"
        aria-label={`Focused minutes for the last ${range} days`}
      >
        <BarChart
          data={data}
          accessibilityLayer
          margin={{ top: 8, right: 4, left: -24, bottom: 0 }}
        >
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            interval={range === 7 ? 0 : 4}
            minTickGap={16}
          />
          <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
          <ChartTooltip
            cursor={false}
            content={<ChartTooltipContent indicator="line" labelKey="label" />}
          />
          <Bar dataKey="minutes" fill="var(--color-minutes)" radius={[6, 6, 2, 2]} />
        </BarChart>
      </ChartContainer>

      <table className="sr-only">
        <caption>Focused minutes for the last {range} days</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Minutes</th>
          </tr>
        </thead>
        <tbody>
          {data.map(point => (
            <tr key={point.date}>
              <td>{point.label}</td>
              <td>{point.minutes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ActiveCourses({ courses }: { courses: ActiveCourseProgress[] }) {
  return (
    <div className="flex h-full flex-col rounded-3xl border border-border bg-card p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <BookOpenCheck className="size-4 text-brand" aria-hidden="true" />
            <h3 className="font-semibold">Active courses</h3>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Your nearest completion milestones</p>
        </div>
        <Link
          to="/courses"
          className="inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-medium text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          aria-label="View all courses"
        >
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>

      {courses.length > 0 ? (
        <div className="mt-5 space-y-5">
          {courses.map(course => (
            <Link
              key={course.courseId}
              to={`/courses/${course.courseId}/overview`}
              className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{course.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {course.completedItems} of {course.totalItems} items
                  </p>
                </div>
                <span className="text-sm font-semibold tabular-nums">
                  {course.completionPercent}%
                </span>
              </div>
              <Progress
                value={course.completionPercent}
                className="mt-2 h-1.5"
                labelFormat={value => `${course.name} is ${value}% complete`}
              />
            </Link>
          ))}
        </div>
      ) : (
        <div className="mt-5 flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-border p-6 text-center">
          <Clock3 className="size-6 text-brand" aria-hidden="true" />
          <p className="mt-2 text-sm font-medium">No course in motion yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Start the focus lesson above to create your first progress line.
          </p>
        </div>
      )}
    </div>
  )
}

export function OverviewProgress({
  learnerState,
  sevenDays,
  thirtyDays,
  activeCourses,
}: OverviewProgressProps) {
  return (
    <section aria-labelledby="overview-progress-title" data-testid="section-progress">
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Progress
        </p>
        <h2 id="overview-progress-title" className="mt-1 text-xl font-semibold">
          Time invested and courses in motion
        </h2>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
        <div className="md:col-span-8">
          <StudyMinutesChart
            learnerState={learnerState}
            sevenDays={sevenDays}
            thirtyDays={thirtyDays}
          />
        </div>
        <div className="md:col-span-4">
          <ActiveCourses courses={activeCourses} />
        </div>
      </div>
    </section>
  )
}
