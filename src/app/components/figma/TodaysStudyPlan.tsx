import { useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router'
import { Calendar, Layers, Play } from 'lucide-react'
import { Card, CardHeader, CardContent } from '@/app/components/ui/card'
import { Button } from '@/app/components/ui/button'
import { Separator } from '@/app/components/ui/separator'
import { useStudyScheduleStore } from '@/stores/useStudyScheduleStore'
import { useFlashcardStore } from '@/stores/useFlashcardStore'
import type { DayOfWeek, StudySchedule } from '@/data/types'

/** Map JS day index (0=Sun) to our DayOfWeek type */
const DAY_INDEX_MAP: DayOfWeek[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
]

function getTodayDayOfWeek(): DayOfWeek {
  return DAY_INDEX_MAP[new Date().getDay()]
}

function formatTime(time: string): string {
  const [hours, minutes] = time.split(':').map(Number)
  if (isNaN(hours) || isNaN(minutes)) return time
  const d = new Date()
  d.setHours(hours, minutes, 0, 0)
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

function StudyBlockItem({ schedule }: { schedule: StudySchedule }) {
  const navigate = useNavigate()

  const handleStart = () => {
    if (schedule.courseId) {
      navigate(`/courses/${schedule.courseId}`)
    }
  }

  return (
    <div
      className="flex items-center gap-3 py-2"
      aria-label={`${schedule.title} at ${formatTime(schedule.startTime)} for ${formatDuration(schedule.durationMinutes)}`}
    >
      <span className="bg-brand-soft text-brand-soft-foreground rounded-md px-2 py-1 text-xs font-medium shrink-0">
        {formatTime(schedule.startTime)}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-foreground font-medium truncate">{schedule.title}</p>
        <p className="text-muted-foreground text-sm">{formatDuration(schedule.durationMinutes)}</p>
      </div>
      {schedule.courseId && (
        <Button
          variant="brand-ghost"
          size="sm"
          onClick={handleStart}
          aria-label={`Start studying ${schedule.title}`}
          className="shrink-0"
        >
          <Play className="size-3.5 mr-1" aria-hidden="true" />
          Start
        </Button>
      )}
    </div>
  )
}

export function TodaysStudyPlan() {
  const { schedules, isLoaded, loadSchedules, getSchedulesForDay } = useStudyScheduleStore()
  const flashcardStats = useFlashcardStore(s => s.getStats)
  const flashcardsLoaded = useFlashcardStore(s => s.flashcards.length >= 0)
  const loadFlashcards = useFlashcardStore(s => s.loadFlashcards)

  useEffect(() => {
    if (!isLoaded) {
      loadSchedules()
    }
  }, [isLoaded, loadSchedules])

  useEffect(() => {
    loadFlashcards()
  }, [loadFlashcards])

  const todayDay = useMemo(() => getTodayDayOfWeek(), [])

  const todaysBlocks = useMemo(() => {
    if (!isLoaded) return []
    return getSchedulesForDay(todayDay, true).sort((a, b) => a.startTime.localeCompare(b.startTime))
  }, [isLoaded, todayDay, getSchedulesForDay, schedules])

  const { dueToday } = useMemo(() => flashcardStats(), [flashcardStats, flashcardsLoaded])

  const hasContent = todaysBlocks.length > 0 || dueToday > 0

  return (
    <Card role="region" aria-label="Today's study plan" data-testid="todays-study-plan">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Calendar className="size-5 text-brand" aria-hidden="true" />
          <h3 className="text-lg font-semibold">Today&apos;s Study Plan</h3>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {!hasContent ? (
          <div className="py-4 text-center">
            <p className="text-muted-foreground mb-3">No study blocks today.</p>
            <Link
              to="/settings#calendar"
              className="text-brand hover:underline text-sm font-medium"
            >
              Schedule study time
            </Link>
          </div>
        ) : (
          <div className="space-y-1">
            {todaysBlocks.map(schedule => (
              <StudyBlockItem key={schedule.id} schedule={schedule} />
            ))}

            {dueToday > 0 && (
              <>
                {todaysBlocks.length > 0 && <Separator className="my-2" />}
                <div className="flex items-center gap-3 py-2">
                  <Layers className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
                  <p className="text-foreground flex-1">
                    {dueToday} {dueToday === 1 ? 'flashcard' : 'flashcards'} due for review
                  </p>
                  <Button variant="brand-outline" size="sm" asChild className="shrink-0">
                    <Link
                      to="/flashcards"
                      aria-label={`Review ${dueToday} due ${dueToday === 1 ? 'flashcard' : 'flashcards'}`}
                    >
                      Review now
                    </Link>
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        <div className="mt-4 pt-3 border-t border-border/50">
          <Link
            to="/settings#calendar"
            className="text-muted-foreground hover:text-foreground text-sm transition-colors"
          >
            View full schedule
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
