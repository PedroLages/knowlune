import { useMemo } from 'react'
import { Clock } from 'lucide-react'
import { ScrollArea } from '@/app/components/ui/scroll-area'
import type { DayOfWeek, StudySchedule } from '@/data/types'

const DAY_LABELS: Record<DayOfWeek, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
}

const DAY_INDEX: Record<DayOfWeek, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
}

function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const period = h >= 12 ? 'pm' : 'am'
  const hour12 = h % 12 || 12
  return m === 0 ? `${hour12}${period}` : `${hour12}:${m.toString().padStart(2, '0')}${period}`
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h}h` : `${h}h ${m}min`
}

interface UpcomingEvent {
  title: string
  dayLabel: string
  time: string
  duration: string
  sortKey: number
}

interface FeedPreviewProps {
  schedules: StudySchedule[]
}

export function FeedPreview({ schedules }: FeedPreviewProps) {
  const upcomingEvents = useMemo(() => {
    const today = new Date()
    const todayIndex = today.getDay() // 0=Sun
    const events: UpcomingEvent[] = []

    const enabledSchedules = schedules.filter(s => s.enabled)

    for (const schedule of enabledSchedules) {
      for (const day of schedule.days) {
        const dayIdx = DAY_INDEX[day]
        // Calculate days ahead (0 = today, 7 wraps around)
        let daysAhead = (dayIdx - todayIndex + 7) % 7
        // If today and time has passed, push to next week
        if (daysAhead === 0) {
          const [h, m] = schedule.startTime.split(':').map(Number)
          const now = today.getHours() * 60 + today.getMinutes()
          if (h * 60 + m <= now) daysAhead = 7
        }

        events.push({
          title: schedule.title,
          dayLabel: DAY_LABELS[day],
          time: formatTime(schedule.startTime),
          duration: formatDuration(schedule.durationMinutes),
          sortKey: daysAhead * 10000 + parseInt(schedule.startTime.replace(':', ''), 10),
        })
      }
    }

    events.sort((a, b) => a.sortKey - b.sortKey)
    return events.slice(0, 5)
  }, [schedules])

  if (upcomingEvents.length === 0) {
    return (
      <div data-testid="feed-preview-empty" className="py-4 text-center">
        <p className="text-sm text-muted-foreground">No upcoming study blocks</p>
      </div>
    )
  }

  return (
    <div data-testid="feed-preview">
      <h4 className="text-sm font-medium mb-2">Upcoming Events</h4>
      <ScrollArea className="max-h-48">
        <div className="space-y-2">
          {upcomingEvents.map((event, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-lg border border-border/50 p-3 text-sm"
            >
              <Clock className="size-4 text-muted-foreground flex-shrink-0" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{event.title}</p>
                <p className="text-xs text-muted-foreground">
                  {event.dayLabel} at {event.time} &middot; {event.duration}
                </p>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}
