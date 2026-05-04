import { useState, useMemo } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/app/components/ui/button'
import { Input } from '@/app/components/ui/input'
import { Label } from '@/app/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog'
import { useStudyScheduleStore } from '@/stores/useStudyScheduleStore'
import type { PathProgressSummary } from '@/app/hooks/usePathProgress'
import type { LearningPathEntry, DayOfWeek } from '@/data/types'

const WEEKDAYS: { value: DayOfWeek; label: string }[] = [
  { value: 'monday', label: 'Monday' },
  { value: 'tuesday', label: 'Tuesday' },
  { value: 'wednesday', label: 'Wednesday' },
  { value: 'thursday', label: 'Thursday' },
  { value: 'friday', label: 'Friday' },
]

interface PreviewEntry {
  title: string
  courseId: string
  courseName: string
  day: DayOfWeek
  startTime: string
  durationMinutes: number
}

interface PlanMyWeekPreviewProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  pathId: string
  pathName: string
  entries: LearningPathEntry[]
  progress: PathProgressSummary
}

/**
 * Editable multi-entry schedule preview dialog.
 * Auto-populates one schedule entry per incomplete course,
 * distributed across weekdays with estimated durations.
 * User must explicitly confirm before saving.
 */
export function PlanMyWeekPreview({
  open,
  onOpenChange,
  pathId,
  pathName,
  entries,
  progress,
}: PlanMyWeekPreviewProps) {
  const { addSchedules } = useStudyScheduleStore()
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Generate preview entries from incomplete courses
  const initialEntries = useMemo(() => {
    const incompleteCourses: Array<{
      courseId: string
      courseName: string
    }> = []

    for (const entry of entries) {
      const cp = progress.courseProgress.get(entry.courseId)
      if (cp && cp.completionPct < 100) {
        incompleteCourses.push({
          courseId: entry.courseId,
          courseName: cp.courseId, // We'll resolve names below
        })
      }
    }

    if (incompleteCourses.length === 0) return []

    const remainingHours = progress.estimatedRemainingHours
    const hoursPerCourse =
      incompleteCourses.length > 0
        ? Math.max(0.5, Math.round((remainingHours / incompleteCourses.length) * 4) / 4)
        : 1

    return incompleteCourses.map((course, index) => ({
      title: `Study: ${pathName}`,
      courseId: course.courseId,
      courseName: course.courseName,
      day: WEEKDAYS[index % WEEKDAYS.length].value,
      startTime: '09:00',
      durationMinutes: Math.max(30, Math.round(hoursPerCourse * 60 / 15) * 15),
    }))
  }, [entries, progress, pathName])

  const [scheduleEntries, setScheduleEntries] = useState<PreviewEntry[]>(initialEntries)

  // Reset state when dialog opens/closes
  const handleOpenChange = (v: boolean) => {
    if (!v) {
      if (!saved) {
        setScheduleEntries(initialEntries)
      }
      onOpenChange(v)
    } else {
      setSaved(false)
      setScheduleEntries([...initialEntries])
      onOpenChange(true)
    }
  }

  function updateEntry(index: number, updates: Partial<PreviewEntry>) {
    setScheduleEntries(prev =>
      prev.map((e, i) => (i === index ? { ...e, ...updates } : e))
    )
  }

  function removeEntry(index: number) {
    setScheduleEntries(prev => prev.filter((_, i) => i !== index))
  }

  function addEntry() {
    setScheduleEntries(prev => [
      ...prev,
      {
        title: `Study: ${pathName}`,
        courseId: '',
        courseName: 'Custom',
        day: 'monday',
        startTime: '09:00',
        durationMinutes: 60,
      },
    ])
  }

  async function handleSave() {
    if (scheduleEntries.length === 0) return

    setIsSaving(true)
    try {
      const result = await addSchedules(
        scheduleEntries.map(entry => ({
          courseId: entry.courseId || undefined,
          learningPathId: pathId,
          title: entry.title,
          days: [entry.day],
          startTime: entry.startTime,
          durationMinutes: entry.durationMinutes,
          recurrence: 'weekly' as const,
          reminderMinutes: 15,
          enabled: true,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }))
      )

      if (result.failed.length === 0) {
        toast.success(`${result.created.length} schedule${result.created.length !== 1 ? 's' : ''} created`)
      } else {
        toast.warning(
          `${result.created.length} of ${scheduleEntries.length} entries created. ${result.failed.length} failed.`
        )
      }

      setSaved(true)
      setScheduleEntries(initialEntries) // Reset form
      onOpenChange(false)
    } catch (err) {
      console.error('[PlanMyWeekPreview] Failed to save schedules:', err)
      toast.error('Failed to create schedules')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Plan My Week</DialogTitle>
          <DialogDescription>
            Review and edit your schedule before saving. Each entry represents one
            study session for a course in the &quot;{pathName}&quot; path.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0 space-y-3 -mx-6 px-6">
          {scheduleEntries.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              All courses are complete — nothing to schedule.
            </p>
          ) : (
            scheduleEntries.map((entry, index) => (
              <div
                key={index}
                className="rounded-xl border border-border p-4 space-y-3"
              >
                {/* Title + remove */}
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm font-medium">
                    {entry.title} — {entry.courseName}
                  </h4>
                  <button
                    onClick={() => removeEntry(index)}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                    aria-label="Remove entry"
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                </div>

                {/* Day + Start Time */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Day</Label>
                    <Select
                      value={entry.day}
                      onValueChange={v =>
                        updateEntry(index, { day: v as DayOfWeek })
                      }
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {WEEKDAYS.map(d => (
                          <SelectItem key={d.value} value={d.value}>
                            {d.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Start Time</Label>
                    <Input
                      type="time"
                      value={entry.startTime}
                      onChange={e =>
                        updateEntry(index, { startTime: e.target.value })
                      }
                      className="h-9"
                    />
                  </div>
                </div>

                {/* Duration */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Duration (minutes)</Label>
                  <Select
                    value={String(entry.durationMinutes)}
                    onValueChange={v =>
                      updateEntry(index, { durationMinutes: Number(v) })
                    }
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[15, 30, 45, 60, 75, 90, 105, 120, 150, 180].map(m => (
                        <SelectItem key={m} value={String(m)}>
                          {m < 60 ? `${m} min` : `${m / 60}h${m % 60 > 0 ? ` ${m % 60}m` : ''}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Add entry button */}
        {scheduleEntries.length > 0 && (
          <Button
            variant="outline"
            className="w-full"
            onClick={addEntry}
          >
            <Plus className="mr-2 size-4" />
            Add Entry
          </Button>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="brand"
            onClick={handleSave}
            disabled={isSaving || scheduleEntries.length === 0}
          >
            {isSaving ? 'Saving...' : 'Save Schedule'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
