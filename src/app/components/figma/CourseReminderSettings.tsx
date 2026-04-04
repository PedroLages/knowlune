import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { CalendarClock, Bell, AlertTriangle, Plus } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card'
import { Button } from '@/app/components/ui/button'
import { Label } from '@/app/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select'
import { DaySelector } from './DaySelector'
import { CourseReminderRow } from './CourseReminderRow'
import {
  getCourseReminders,
  saveCourseReminder,
  toggleCourseReminder,
  getNotificationPermission,
  requestNotificationPermission,
} from '@/lib/courseReminders'
import { db } from '@/db/schema'
import type { CourseReminder, DayOfWeek, ImportedCourse } from '@/data/types'

type PermissionState = NotificationPermission | 'unsupported'

export function CourseReminderSettings() {
  const [reminders, setReminders] = useState<CourseReminder[]>([])
  const [courses, setCourses] = useState<ImportedCourse[]>([])
  const [permission, setPermission] = useState<PermissionState>(getNotificationPermission)
  const [showAddForm, setShowAddForm] = useState(false)
  const [showPermissionPrompt, setShowPermissionPrompt] = useState(false)
  const [showDeniedGuidance, setShowDeniedGuidance] = useState(false)

  // Add form state
  const [selectedCourseId, setSelectedCourseId] = useState('')
  const [selectedDays, setSelectedDays] = useState<DayOfWeek[]>([])
  const [selectedTime, setSelectedTime] = useState('09:00')

  const loadReminders = useCallback(async () => {
    try {
      const data = await getCourseReminders()
      setReminders(data)
    } catch (error) {
      // silent-catch-ok: error logged to console
      console.error('[CourseReminderSettings] Failed to load reminders:', error)
    }
  }, [])

  const loadCourses = useCallback(async () => {
    try {
      const data = await db.importedCourses.toArray()
      setCourses(data)
    } catch (error) {
      // silent-catch-ok: error logged to console
      console.error('[CourseReminderSettings] Failed to load courses:', error)
    }
  }, [])

  useEffect(() => {
    loadReminders()
    loadCourses()

    function handleUpdate() {
      loadReminders()
    }

    window.addEventListener('course-reminders-updated', handleUpdate)
    return () => window.removeEventListener('course-reminders-updated', handleUpdate)
  }, [loadReminders, loadCourses])

  async function handleAddClick() {
    const currentPerm = getNotificationPermission()
    setPermission(currentPerm)

    if (currentPerm === 'default') {
      // Show prompt but don't block — user can skip via "Skip for now"
      setShowPermissionPrompt(true)
      return
    }

    if (currentPerm === 'denied') {
      setShowDeniedGuidance(true)
    }

    // AC4: allow configuration regardless of permission state
    openAddForm()
  }

  function handleSkipPermission() {
    setShowPermissionPrompt(false)
    openAddForm()
  }

  async function handleEnableNotifications() {
    const result = await requestNotificationPermission()
    setPermission(result)

    if (result === 'granted') {
      setShowPermissionPrompt(false)
      setShowDeniedGuidance(false)
      openAddForm()
    } else {
      setShowPermissionPrompt(false)
      setShowDeniedGuidance(true)
    }
  }

  function handleContinueWithout() {
    setShowDeniedGuidance(false)
    setShowPermissionPrompt(false)
    openAddForm()
  }

  function openAddForm() {
    setSelectedCourseId('')
    setSelectedDays([])
    setSelectedTime('09:00')
    setShowAddForm(true)
  }

  function handleCancelAdd() {
    setShowAddForm(false)
    setShowPermissionPrompt(false)
    setShowDeniedGuidance(false)
  }

  async function handleSaveNew() {
    if (!selectedCourseId || selectedDays.length === 0) return

    const course = courses.find(c => c.id === selectedCourseId)
    if (!course) return

    const now = new Date().toISOString()
    const reminder: CourseReminder = {
      id: crypto.randomUUID(),
      courseId: course.id,
      courseName: course.name,
      days: selectedDays,
      time: selectedTime,
      enabled: true,
      createdAt: now,
      updatedAt: now,
    }

    try {
      await saveCourseReminder(reminder)
      setShowAddForm(false)
    } catch (error) {
      console.error('[CourseReminderSettings] Failed to save reminder:', error)
      toast.error('Failed to save reminder. Please try again.')
    }
  }

  async function handleToggle(id: string, enabled: boolean) {
    try {
      await toggleCourseReminder(id, enabled)
    } catch (error) {
      console.error('[CourseReminderSettings] Failed to toggle reminder:', error)
      toast.error('Failed to update reminder. Please try again.')
      loadReminders() // Revert UI by reloading actual state
    }
  }

  async function handleSaveEdit(updated: CourseReminder) {
    try {
      await saveCourseReminder(updated)
    } catch (error) {
      console.error('[CourseReminderSettings] Failed to save changes:', error)
      toast.error('Failed to save changes. Please try again.')
      loadReminders() // Revert UI
    }
  }

  // Filter out courses that already have a reminder
  const availableCourses = courses.filter(c => !reminders.some(r => r.courseId === c.id))

  return (
    <Card data-testid="course-reminders-section" className="rounded-2xl">
      <CardHeader className="border-b border-border/50 bg-surface-sunken/30">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-brand-soft p-2">
            <CalendarClock className="size-5 text-brand" aria-hidden="true" />
          </div>
          <div>
            <CardTitle className="text-lg font-display">Course Reminders</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Set study reminders for specific courses, independent of your streak reminders
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-6">
        {/* Permission prompt */}
        {showPermissionPrompt && (
          <div
            data-testid="course-reminder-permission-prompt"
            role="alert"
            aria-live="polite"
            className="flex items-start gap-3 rounded-xl border border-brand/20 bg-brand-soft p-4 animate-in fade-in-0 slide-in-from-top-1 duration-300"
          >
            <Bell className="size-5 text-brand flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div className="space-y-2">
              <p className="text-sm font-medium">Notifications required for reminders</p>
              <p className="text-xs text-muted-foreground">
                Enable browser notifications to receive study reminders at your scheduled times.
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleEnableNotifications}
                  className="gap-1.5 min-h-[44px]"
                  aria-label="Enable notifications"
                >
                  <Bell className="size-4" />
                  Enable Notifications
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSkipPermission}
                  className="min-h-[44px] text-muted-foreground"
                  aria-label="Skip for now"
                >
                  Skip for now
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Permission denied guidance */}
        {showDeniedGuidance && (
          <div
            data-testid="course-reminder-permission-denied"
            role="alert"
            aria-live="polite"
            className="flex items-start gap-3 rounded-xl border border-warning/20 bg-warning/10 p-4 animate-in fade-in-0 slide-in-from-top-1 duration-300"
          >
            <AlertTriangle
              className="size-5 text-warning flex-shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <div className="space-y-2">
              <p className="text-sm font-medium text-warning">Notifications are blocked</p>
              <p className="text-xs text-muted-foreground">
                Please enable notifications in your browser settings. Your reminder configuration
                will be saved and will activate once permissions are granted.
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleContinueWithout}
                className="min-h-[44px] text-muted-foreground"
                aria-label="Continue without notifications"
              >
                Continue without notifications
              </Button>
            </div>
          </div>
        )}

        {/* Reminder list */}
        {reminders.length > 0 && (
          <div className="space-y-3">
            {reminders.map(reminder => (
              <CourseReminderRow
                key={reminder.id}
                reminder={reminder}
                onToggle={handleToggle}
                onSave={handleSaveEdit}
              />
            ))}
          </div>
        )}

        {/* Empty state */}
        {reminders.length === 0 && !showAddForm && !showPermissionPrompt && (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <CalendarClock className="size-12 text-muted-foreground/30" aria-hidden="true" />
            <div>
              <p className="text-sm text-muted-foreground">No course reminders yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Add a reminder to stay on track with specific courses
              </p>
            </div>
          </div>
        )}

        {/* Add reminder form */}
        {showAddForm && (
          <div className="rounded-xl border border-brand/30 bg-brand-soft/30 p-4 space-y-4 animate-in fade-in-0 slide-in-from-top-1 duration-300">
            <h4 className="text-sm font-medium">New Course Reminder</h4>

            {/* Course select */}
            <div className="space-y-1.5">
              <Label htmlFor="course-select" className="text-sm text-muted-foreground">
                Course
              </Label>
              <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
                <SelectTrigger
                  id="course-select"
                  data-testid="course-reminder-course-select"
                  className="min-h-[44px]"
                >
                  <SelectValue placeholder="Select a course..." />
                </SelectTrigger>
                <SelectContent>
                  {availableCourses.map(course => (
                    <SelectItem key={course.id} value={course.id}>
                      {course.name}
                    </SelectItem>
                  ))}
                  {availableCourses.length === 0 && (
                    <div className="px-2 py-4 text-center text-xs text-muted-foreground">
                      All courses already have reminders
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Day selector */}
            <div className="space-y-1.5">
              <Label id="new-reminder-days-label" className="text-sm text-muted-foreground">
                Days
              </Label>
              <DaySelector
                selectedDays={selectedDays}
                onChange={setSelectedDays}
                aria-labelledby="new-reminder-days-label"
              />
            </div>

            {/* Time input */}
            <div className="space-y-1.5">
              <Label htmlFor="new-reminder-time" className="text-sm text-muted-foreground">
                Reminder time
              </Label>
              <input
                type="time"
                id="new-reminder-time"
                data-testid="course-reminder-time-input"
                value={selectedTime}
                onChange={e => setSelectedTime(e.target.value)}
                className="block w-full max-w-40 h-11 rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                onClick={handleSaveNew}
                disabled={!selectedCourseId || selectedDays.length === 0}
                className="gap-1.5 min-h-[44px]"
                aria-label="Save reminder"
              >
                Save reminder
              </Button>
              <Button variant="ghost" size="sm" onClick={handleCancelAdd} className="min-h-[44px]">
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Add button (show when not adding) */}
        {!showAddForm && !showPermissionPrompt && (
          <div className="space-y-1.5">
            <Button
              variant="outline"
              onClick={handleAddClick}
              className="gap-2 min-h-[44px] w-full"
              aria-label="Add course reminder"
            >
              <Plus className="size-4" />
              Add Reminder
            </Button>
            {permission === 'denied' && reminders.length > 0 && (
              <p className="text-xs text-warning text-center">
                Notifications are blocked — reminders will activate once enabled in browser settings
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
