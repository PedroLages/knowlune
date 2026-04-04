import { useMemo } from 'react'
import type { DayOfWeek, StudySchedule } from '@/data/types'

const DAY_ORDER: DayOfWeek[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]

const DAY_LABELS: Record<DayOfWeek, string> = {
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
  saturday: 'Sat',
  sunday: 'Sun',
}

function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const period = h >= 12 ? 'pm' : 'am'
  const hour12 = h % 12 || 12
  return m === 0 ? `${hour12}${period}` : `${hour12}:${m.toString().padStart(2, '0')}${period}`
}

function formatTimeRange(startTime: string, durationMinutes: number): string {
  const [h, m] = startTime.split(':').map(Number)
  const endTotalMinutes = h * 60 + m + durationMinutes
  const endH = Math.floor(endTotalMinutes / 60) % 24
  const endM = endTotalMinutes % 60
  const endTime = `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`
  return `${formatTime(startTime)}-${formatTime(endTime)}`
}

interface StudyScheduleSummaryProps {
  schedules: StudySchedule[]
}

export function StudyScheduleSummary({ schedules }: StudyScheduleSummaryProps) {
  const enabledSchedules = useMemo(() => schedules.filter(s => s.enabled), [schedules])

  const { dayGroups, totalHours, subjectCount } = useMemo(() => {
    const groups: Record<DayOfWeek, { title: string; timeRange: string }[]> = {
      monday: [],
      tuesday: [],
      wednesday: [],
      thursday: [],
      friday: [],
      saturday: [],
      sunday: [],
    }

    let totalMinutes = 0
    const subjects = new Set<string>()

    for (const schedule of enabledSchedules) {
      for (const day of schedule.days) {
        groups[day].push({
          title: schedule.title,
          timeRange: formatTimeRange(schedule.startTime, schedule.durationMinutes),
        })
      }
      totalMinutes += schedule.durationMinutes * schedule.days.length
      subjects.add(schedule.courseId ?? schedule.title)
    }

    return {
      dayGroups: groups,
      totalHours: Math.round((totalMinutes / 60) * 10) / 10,
      subjectCount: subjects.size,
    }
  }, [enabledSchedules])

  if (enabledSchedules.length === 0) {
    return (
      <div data-testid="study-schedule-summary-empty" className="py-4 text-center">
        <p className="text-sm text-muted-foreground">
          No study blocks scheduled yet. Create one to get started!
        </p>
      </div>
    )
  }

  return (
    <div data-testid="study-schedule-summary" className="space-y-2">
      <h4 className="text-sm font-medium">Weekly Summary</h4>
      <div className="space-y-1">
        {DAY_ORDER.map(day => {
          const entries = dayGroups[day]
          if (entries.length === 0) return null
          return (
            <div key={day} className="flex items-baseline gap-2 text-sm">
              <span className="w-8 font-medium text-muted-foreground">{DAY_LABELS[day]}</span>
              <span>
                {entries.map((e, i) => (
                  <span key={i}>
                    {i > 0 && ', '}
                    <span className="text-muted-foreground">{e.timeRange}</span>{' '}
                    <span className="font-medium">{e.title}</span>
                  </span>
                ))}
              </span>
            </div>
          )
        })}
      </div>
      <p className="text-xs text-muted-foreground pt-1">
        Total: {totalHours} hours/week across {subjectCount} subject{subjectCount !== 1 ? 's' : ''}
      </p>
    </div>
  )
}
