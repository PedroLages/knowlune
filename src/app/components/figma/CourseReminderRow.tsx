import { useState } from 'react'
import { Pencil, X, Check } from 'lucide-react'
import { cn } from '@/app/components/ui/utils'
import { Switch } from '@/app/components/ui/switch'
import { Button } from '@/app/components/ui/button'
import { Label } from '@/app/components/ui/label'
import { DaySelector } from './DaySelector'
import type { CourseReminder, DayOfWeek } from '@/data/types'

const DAY_ABBREV: Record<DayOfWeek, string> = {
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
  saturday: 'Sat',
  sunday: 'Sun',
}

const DAY_ORDER: DayOfWeek[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]

function formatDays(days: DayOfWeek[]): string {
  const sorted = [...days].sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b))
  return sorted.map(d => DAY_ABBREV[d]).join(', ')
}

interface CourseReminderRowProps {
  reminder: CourseReminder
  onToggle: (id: string, enabled: boolean) => void
  onSave: (reminder: CourseReminder) => void
}

export function CourseReminderRow({ reminder, onToggle, onSave }: CourseReminderRowProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editDays, setEditDays] = useState<DayOfWeek[]>(reminder.days)
  const [editTime, setEditTime] = useState(reminder.time)

  function handleEdit() {
    setEditDays(reminder.days)
    setEditTime(reminder.time)
    setIsEditing(true)
  }

  function handleCancel() {
    setIsEditing(false)
  }

  function handleSave() {
    if (editDays.length === 0) return
    onSave({
      ...reminder,
      days: editDays,
      time: editTime,
      updatedAt: new Date().toISOString(),
    })
    setIsEditing(false)
  }

  if (isEditing) {
    return (
      <div
        data-testid={`course-reminder-${reminder.courseId}`}
        className="rounded-xl border border-brand/30 bg-brand-soft/30 p-4 space-y-4 animate-in fade-in-0 duration-200"
      >
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium">{reminder.courseName}</h4>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCancel}
            className="min-h-[44px] min-w-[44px]"
            aria-label="Cancel editing"
          >
            <X className="size-4" />
          </Button>
        </div>

        <DaySelector selectedDays={editDays} onChange={setEditDays} />

        <div className="space-y-1.5">
          <Label htmlFor={`edit-time-${reminder.id}`} className="text-sm text-muted-foreground">
            Reminder time
          </Label>
          <input
            type="time"
            id={`edit-time-${reminder.id}`}
            data-testid="course-reminder-time-input"
            value={editTime}
            onChange={e => setEditTime(e.target.value)}
            className="block w-full max-w-40 h-11 rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <div className="flex gap-2 pt-1">
          <Button
            size="sm"
            onClick={handleSave}
            disabled={editDays.length === 0}
            className="gap-1.5 min-h-[44px]"
            aria-label="Save reminder changes"
          >
            <Check className="size-4" />
            Save reminder
          </Button>
          <Button variant="ghost" size="sm" onClick={handleCancel} className="min-h-[44px]">
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div
      data-testid={`course-reminder-${reminder.courseId}`}
      className="rounded-xl border border-border bg-surface-elevated p-4 hover:bg-surface-elevated/80 transition-colors animate-in fade-in-0 slide-in-from-top-1 duration-300"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={cn(
              'size-2 rounded-full flex-shrink-0',
              reminder.enabled ? 'bg-success' : 'bg-muted'
            )}
            aria-hidden="true"
          />
          <div className="min-w-0">
            <h4 className="text-sm font-medium truncate">{reminder.courseName}</h4>
            <p className="text-xs text-muted-foreground">
              {formatDays(reminder.days)} · {reminder.time}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <Switch
            checked={reminder.enabled}
            onCheckedChange={checked => onToggle(reminder.id, checked)}
            aria-label={`Enable ${reminder.courseName} reminder`}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={handleEdit}
            className="min-h-[44px] min-w-[44px]"
            aria-label={`Edit ${reminder.courseName} reminder`}
          >
            <Pencil className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
