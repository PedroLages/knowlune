import { useState, useMemo } from 'react'
import { Clock, Trash2, Calendar, ChevronDown } from 'lucide-react'
import { cn } from '@/app/components/ui/utils'
import { Button } from '@/app/components/ui/button'
import { Card, CardContent } from '@/app/components/ui/card'
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/app/components/ui/collapsible'
import { useStudyScheduleStore } from '@/stores/useStudyScheduleStore'
import type { DayOfWeek, StudySchedule } from '@/data/types'

const DAY_LABELS: Record<DayOfWeek, string> = {
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
  saturday: 'Sat',
  sunday: 'Sun',
}

interface PathScheduleListProps {
  pathId: string
}

/**
 * Inline collapsible list of study schedules for a learning path.
 * Rendered on the path detail page as a toggleable section.
 * Supports basic editing (opens StudyScheduleEditor) and deletion.
 */
export function PathScheduleList({ pathId }: PathScheduleListProps) {
  const { schedules, deleteSchedule } = useStudyScheduleStore()
  const [isOpen, setIsOpen] = useState(true)

  const pathSchedules = useMemo(
    () => schedules.filter(s => s.learningPathId === pathId),
    [schedules, pathId]
  )

  if (pathSchedules.length === 0) {
    return (
      <Card className="rounded-2xl">
        <CardContent className="p-6 text-center">
          <Calendar className="size-8 text-muted-foreground/30 mx-auto mb-2" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">
            No scheduled sessions yet. Use Plan My Week to create them.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex w-full items-center justify-between py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
        <span className="flex items-center gap-2">
          <Calendar className="size-4" aria-hidden="true" />
          Scheduled Sessions ({pathSchedules.length})
        </span>
        <ChevronDown
          className={cn(
            'size-4 transition-transform',
            isOpen && 'rotate-180'
          )}
          aria-hidden="true"
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-2 pt-2">
          {pathSchedules.map(schedule => (
            <ScheduleRow
              key={schedule.id}
              schedule={schedule}
              onDelete={id => deleteSchedule(id)}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

function ScheduleRow({
  schedule,
  onDelete,
}: {
  schedule: StudySchedule
  onDelete: (id: string) => Promise<void>
}) {
  const dayStr = schedule.days.map(d => DAY_LABELS[d]).join(', ')

  const formatTime = (time: string) => {
    const [h, m] = time.split(':').map(Number)
    const ampm = h >= 12 ? 'PM' : 'AM'
    const hour = h % 12 || 12
    return `${hour}:${String(m).padStart(2, '0')} ${ampm}`
  }

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return m > 0 ? `${h}h ${m}m` : `${h}h`
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{schedule.title}</p>
        <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
          <Clock className="size-3" aria-hidden="true" />
          {dayStr} at {formatTime(schedule.startTime)} &middot;{' '}
          {formatDuration(schedule.durationMinutes)}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
        onClick={() => onDelete(schedule.id)}
        aria-label={`Delete schedule: ${schedule.title}`}
      >
        <Trash2 className="size-4" aria-hidden="true" />
      </Button>
    </div>
  )
}
