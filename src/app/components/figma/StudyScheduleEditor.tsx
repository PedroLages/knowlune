/**
 * StudyScheduleEditor — Sheet-based form for creating/editing study schedules.
 *
 * Opens from Settings "Add Study Block" or course detail "Schedule study time".
 * Supports create mode (new schedule) and edit mode (pre-populated fields).
 * Pre-selects course when opened from a course page.
 *
 * @see E50-S05
 */

import { useState, useEffect, useCallback, useId } from 'react'
import { toast } from 'sonner'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/app/components/ui/sheet'
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
import { useStudyScheduleStore } from '@/stores/useStudyScheduleStore'
import { useCourseImportStore } from '@/stores/useCourseImportStore'
import { DayPicker } from './DayPicker'
import { TimePicker } from './TimePicker'
import type { DayOfWeek } from '@/data/types'

const FREE_STUDY = '__free__'

const DURATION_OPTIONS = [
  { value: '30', label: '30 min' },
  { value: '45', label: '45 min' },
  { value: '60', label: '60 min' },
  { value: '90', label: '90 min' },
  { value: '120', label: '120 min' },
]

const REMINDER_OPTIONS = [
  { value: '0', label: 'None' },
  { value: '5', label: '5 min before' },
  { value: '10', label: '10 min before' },
  { value: '15', label: '15 min before' },
  { value: '30', label: '30 min before' },
]

interface StudyScheduleEditorProps {
  courseId?: string
  scheduleId?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function StudyScheduleEditor({
  courseId,
  scheduleId,
  open,
  onOpenChange,
}: StudyScheduleEditorProps) {
  const formId = useId()
  const { schedules, addSchedule, updateSchedule } = useStudyScheduleStore()
  const { importedCourses } = useCourseImportStore()

  const isEdit = Boolean(scheduleId)
  const existing = isEdit ? schedules.find(s => s.id === scheduleId) : undefined

  // Form state
  const [title, setTitle] = useState('')
  const [selectedCourseId, setSelectedCourseId] = useState(FREE_STUDY)
  const [days, setDays] = useState<DayOfWeek[]>([])
  const [startTime, setStartTime] = useState('09:00')
  const [durationMinutes, setDurationMinutes] = useState('60')
  const [reminderMinutes, setReminderMinutes] = useState('15')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  // Reset form when sheet opens
  useEffect(() => {
    if (!open) return

    if (existing) {
      // Edit mode: populate from existing schedule
      setTitle(existing.title)
      setSelectedCourseId(existing.courseId ?? FREE_STUDY)
      setDays([...existing.days])
      setStartTime(existing.startTime)
      setDurationMinutes(String(existing.durationMinutes))
      setReminderMinutes(String(existing.reminderMinutes))
    } else {
      // Create mode: sensible defaults
      const course = courseId ? importedCourses.find(c => c.id === courseId) : undefined
      setSelectedCourseId(courseId ?? FREE_STUDY)
      setTitle(course ? `Study: ${course.name}` : '')
      setDays([])
      setStartTime('09:00')
      setDurationMinutes('60')
      setReminderMinutes('15')
    }
    setErrors({})
  }, [open, existing, courseId, importedCourses])

  // Auto-update title when course changes (create mode only)
  const handleCourseChange = useCallback(
    (value: string) => {
      setSelectedCourseId(value)
      if (!isEdit) {
        if (value === FREE_STUDY) {
          setTitle('')
        } else {
          const course = importedCourses.find(c => c.id === value)
          if (course) {
            setTitle(`Study: ${course.name}`)
          }
        }
      }
    },
    [isEdit, importedCourses]
  )

  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {}
    if (!title.trim()) {
      newErrors.title = 'Title is required.'
    }
    if (days.length === 0) {
      newErrors.days = 'Select at least one day.'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }, [title, days])

  const handleSave = useCallback(async () => {
    if (!validate()) return

    setSaving(true)
    try {
      const scheduleData = {
        title: title.trim(),
        courseId: selectedCourseId === FREE_STUDY ? undefined : selectedCourseId,
        days,
        startTime,
        durationMinutes: Number(durationMinutes),
        reminderMinutes: Number(reminderMinutes),
        recurrence: 'weekly' as const,
        enabled: true,
      }

      if (isEdit && scheduleId) {
        await updateSchedule(scheduleId, scheduleData)
        toast.success('Schedule updated')
      } else {
        const result = await addSchedule(scheduleData)
        if (result) {
          toast.success('Schedule created')
        }
      }
      onOpenChange(false)
    } catch (error) {
      console.error('[StudyScheduleEditor] Save failed:', error)
      toast.error('Failed to save schedule')
    } finally {
      setSaving(false)
    }
  }, [
    validate,
    title,
    selectedCourseId,
    days,
    startTime,
    durationMinutes,
    reminderMinutes,
    isEdit,
    scheduleId,
    updateSchedule,
    addSchedule,
    onOpenChange,
  ])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-foreground">
            {isEdit ? 'Edit Study Block' : 'Add Study Block'}
          </SheetTitle>
          <SheetDescription className="text-muted-foreground">
            {isEdit
              ? 'Update your study schedule.'
              : 'Create a recurring study block for your calendar.'}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-1 py-4">
          {/* Title */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${formId}-title`}>Title</Label>
            <Input
              id={`${formId}-title`}
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Study: React Fundamentals"
              data-testid="schedule-title-input"
            />
            {errors.title && (
              <p className="text-sm text-destructive" role="alert">
                {errors.title}
              </p>
            )}
          </div>

          {/* Course selector */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${formId}-course`}>Course</Label>
            <Select value={selectedCourseId} onValueChange={handleCourseChange}>
              <SelectTrigger
                id={`${formId}-course`}
                className="min-h-[44px]"
                data-testid="schedule-course-select"
              >
                <SelectValue placeholder="Select a course" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={FREE_STUDY}>Free study block</SelectItem>
                {importedCourses.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Day picker */}
          <div className="flex flex-col gap-1.5">
            <Label>Days</Label>
            <DayPicker value={days} onChange={setDays} />
            {errors.days && (
              <p className="text-sm text-destructive" role="alert" aria-live="assertive">
                {errors.days}
              </p>
            )}
          </div>

          {/* Start time */}
          <div className="flex flex-col gap-1.5">
            <Label>Start time</Label>
            <TimePicker value={startTime} onChange={setStartTime} />
          </div>

          {/* Duration */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${formId}-duration`}>Duration</Label>
            <Select value={durationMinutes} onValueChange={setDurationMinutes}>
              <SelectTrigger
                id={`${formId}-duration`}
                className="min-h-[44px]"
                data-testid="schedule-duration-select"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DURATION_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Reminder */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${formId}-reminder`}>Reminder</Label>
            <Select value={reminderMinutes} onValueChange={setReminderMinutes}>
              <SelectTrigger
                id={`${formId}-reminder`}
                className="min-h-[44px]"
                data-testid="schedule-reminder-select"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REMINDER_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <SheetFooter className="flex flex-row gap-2 pt-2">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={saving}
            data-testid="schedule-cancel-button"
          >
            Cancel
          </Button>
          <Button
            variant="brand"
            onClick={handleSave}
            disabled={saving}
            className="min-h-[44px]"
            data-testid="schedule-save-button"
          >
            {saving ? 'Saving...' : isEdit ? 'Update' : 'Save'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
