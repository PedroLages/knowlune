import { useState, useEffect, useCallback } from 'react'
import { Calendar, Clock, Target } from 'lucide-react'
import { Link } from 'react-router'
import { getStudyLog } from '@/lib/studyLog'
import { getStudyGoal } from '@/lib/studyGoals'
import { getCourseCompletionPercent } from '@/lib/progress'
import { calculateMomentumScore } from '@/lib/momentum'
import { computeStudySchedule } from '@/lib/studySchedule'
import type { StudyScheduleResult, CourseWithMomentum } from '@/lib/studySchedule'
import { useSessionStore } from '@/stores/useSessionStore'
import type { StudySession, Course } from '@/data/types'
import { useCourseStore } from '@/stores/useCourseStore'
import { Progress } from '@/app/components/ui/progress'

function formatHour(hour: number): string {
  const d = new Date()
  d.setHours(hour, 0, 0, 0)
  return d.toLocaleTimeString([], { hour: 'numeric', hour12: true })
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m} min`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

function buildActiveCoursesWithMomentum(
  sessions: StudySession[],
  allCourses: Course[]
): CourseWithMomentum[] {
  return allCourses
    .map(course => {
      const completionPercent = getCourseCompletionPercent(course.id, course.totalLessons)
      return { course, completionPercent }
    })
    .filter(({ completionPercent }) => completionPercent > 0 && completionPercent < 100)
    .map(({ course, completionPercent }) => {
      const courseSessions = sessions.filter(s => typeof s.courseId === 'string' && s.courseId === course.id)
      const momentumScore = calculateMomentumScore({
        courseId: course.id,
        totalLessons: course.totalLessons,
        completionPercent,
        sessions: courseSessions,
      })
      return { course, momentumScore }
    })
}

export function StudyScheduleWidget() {
  const [schedule, setSchedule] = useState<StudyScheduleResult | null>(null)
  const allCourses = useCourseStore(s => s.courses)
  // Subscribe reactively so refresh captures fresh sessions whenever the store updates
  const sessions = useSessionStore(state => state.sessions)

  const refresh = useCallback(() => {
    const studyLog = getStudyLog()
    const goal = getStudyGoal()
    const activeCourses = buildActiveCoursesWithMomentum(sessions, allCourses)
    const result = computeStudySchedule({ studyLog, goal, activeCourses })
    setSchedule(result)
  }, [sessions, allCourses])

  useEffect(() => {
    refresh()
    window.addEventListener('study-log-updated', refresh)
    window.addEventListener('study-goals-updated', refresh)
    return () => {
      window.removeEventListener('study-log-updated', refresh)
      window.removeEventListener('study-goals-updated', refresh)
    }
  }, [refresh])

  if (!schedule) return null

  return (
    <div data-testid="study-schedule-widget">
      {schedule.status === 'insufficient-data' && (
        <InsufficientDataState distinctStudyDays={schedule.distinctStudyDays} minDaysRequired={7} />
      )}
      {schedule.status === 'no-goal' && schedule.optimalHour !== null && (
        <NoGoalState optimalHour={schedule.optimalHour} />
      )}
      {schedule.status === 'ready' && schedule.optimalHour !== null && (
        <ReadyState schedule={schedule} />
      )}
    </div>
  )
}

function InsufficientDataState({
  distinctStudyDays,
  minDaysRequired,
}: {
  distinctStudyDays: number
  minDaysRequired: number
}) {
  return (
    <div
      data-testid="schedule-insufficient-data"
      className="flex flex-col items-center justify-center rounded-[24px] border border-dashed border-border bg-card p-8 text-center"
    >
      <Calendar className="size-10 text-muted-foreground mb-3" aria-hidden="true" />
      <h3 className="text-sm font-semibold text-foreground mb-1">Build Your Study Pattern</h3>
      <p className="text-xs text-muted-foreground mb-4">
        You need at least {minDaysRequired} days of study activity to unlock personalized
        recommendations.
      </p>
      <div className="w-full max-w-xs mb-3">
        <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
          <span>
            {distinctStudyDays} / {minDaysRequired} days recorded
          </span>
          <span>{Math.round((distinctStudyDays / minDaysRequired) * 100)}%</span>
        </div>
        <Progress
          value={(distinctStudyDays / minDaysRequired) * 100}
          className="h-1.5 [&_[data-slot=progress-indicator]]:bg-brand"
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Keep studying to unlock your optimal schedule!
      </p>
    </div>
  )
}

function NoGoalState({ optimalHour }: { optimalHour: number }) {
  return (
    <div data-testid="schedule-no-goal" className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Clock className="size-4 text-muted-foreground" aria-hidden="true" />
        <span className="text-sm text-muted-foreground">Your Peak Study Hour:</span>
        <span data-testid="schedule-optimal-hour" className="text-sm font-semibold text-foreground">
          {formatHour(optimalHour)}
        </span>
      </div>
      <div className="flex flex-col items-center justify-center rounded-[24px] border border-dashed border-border bg-card p-6 text-center gap-3">
        <Target className="size-8 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">
          Set a weekly study goal to see your full personalized schedule.
        </p>
        <Link
          to="/settings"
          data-testid="schedule-settings-link"
          className="py-2 inline-block text-sm font-medium text-brand hover:text-brand-hover motion-safe:transition-colors underline underline-offset-2"
        >
          Go to Settings
        </Link>
      </div>
    </div>
  )
}

function ReadyState({ schedule }: { schedule: StudyScheduleResult }) {
  const maxMinutes = schedule.courseAllocations.reduce((max, a) => Math.max(max, a.minutes), 1)

  return (
    <div data-testid="schedule-ready" className="flex flex-col gap-4">
      {/* Header row */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Clock className="size-4 text-muted-foreground" aria-hidden="true" />
          <span className="text-sm text-muted-foreground">Your Peak Study Hour:</span>
          <span
            data-testid="schedule-optimal-hour"
            className="text-sm font-semibold text-foreground"
          >
            {formatHour(schedule.optimalHour!)}
          </span>
        </div>
        {schedule.activeCourseCount > 0 && (
          <span className="text-xs text-muted-foreground">
            {schedule.activeCourseCount} active{' '}
            {schedule.activeCourseCount === 1 ? 'course' : 'courses'}
          </span>
        )}
      </div>

      {/* Recommended duration */}
      {schedule.recommendedDailyMinutes !== null && (
        <div className="rounded-xl bg-muted/50 px-4 py-3 flex items-center justify-between">
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
            Recommended Daily
          </span>
          <span
            data-testid="schedule-daily-duration"
            className="text-sm font-semibold text-foreground"
          >
            {formatDuration(schedule.recommendedDailyMinutes)}
          </span>
        </div>
      )}

      {/* Course allocations */}
      {schedule.courseAllocations.length > 0 && (
        <div className="flex flex-col gap-3">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Course Time Allocation
          </h4>
          {schedule.courseAllocations.map(allocation => (
            <div key={allocation.courseId} className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-foreground truncate flex-1 min-w-0">
                  {allocation.courseTitle}
                </span>
                <span className="text-xs font-medium text-muted-foreground shrink-0">
                  {allocation.minutes} min
                </span>
              </div>
              <Progress
                value={(allocation.minutes / maxMinutes) * 100}
                className="h-1.5 [&_[data-slot=progress-indicator]]:bg-brand"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
