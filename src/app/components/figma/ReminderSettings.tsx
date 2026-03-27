import { useState, useEffect } from 'react'
import { Bell, CheckCircle2, AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card'
import { Switch } from '@/app/components/ui/switch'
import { Label } from '@/app/components/ui/label'
import {
  getReminderSettings,
  saveReminderSettings,
  requestNotificationPermission,
  getNotificationPermission,
  type StudyReminderSettings,
} from '@/lib/studyReminders'
import { getStreakPauseStatus } from '@/lib/studyLog'

export function ReminderSettings() {
  const [settings, setSettings] = useState<StudyReminderSettings>(getReminderSettings)
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(
    getNotificationPermission
  )
  const [showDenied, setShowDenied] = useState(false)
  const [isPaused, setIsPaused] = useState(() => getStreakPauseStatus()?.enabled ?? false)

  // Sync settings and pause status from external changes
  useEffect(() => {
    function handleReminderUpdate() {
      setSettings(getReminderSettings())
    }
    function handleStudyLogUpdate() {
      setIsPaused(getStreakPauseStatus()?.enabled ?? false)
    }
    function handlePauseUpdate() {
      setIsPaused(getStreakPauseStatus()?.enabled ?? false)
    }
    window.addEventListener('study-reminders-updated', handleReminderUpdate)
    window.addEventListener('study-log-updated', handleStudyLogUpdate)
    window.addEventListener('streak-pause-updated', handlePauseUpdate)
    return () => {
      window.removeEventListener('study-reminders-updated', handleReminderUpdate)
      window.removeEventListener('study-log-updated', handleStudyLogUpdate)
      window.removeEventListener('streak-pause-updated', handlePauseUpdate)
    }
  }, [])

  function update(patch: Partial<StudyReminderSettings>) {
    const next = { ...settings, ...patch }
    setSettings(next)
    saveReminderSettings(next)
  }

  async function handleMasterToggle(checked: boolean) {
    if (checked) {
      const result = await requestNotificationPermission()
      setPermission(result)
      if (result === 'granted') {
        setShowDenied(false)
        update({ enabled: true })
      } else {
        // Permission denied or unsupported — revert toggle
        setShowDenied(true)
        update({ enabled: false })
      }
    } else {
      setShowDenied(false)
      update({ enabled: false })
    }
  }

  return (
    <Card data-testid="reminders-section">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Bell className="size-4" aria-hidden="true" />
          Study Reminders
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Master toggle */}
        <div className="flex items-center justify-between min-h-[44px]">
          <Label htmlFor="enable-reminders" className="cursor-pointer">
            Enable reminders
          </Label>
          <Switch
            id="enable-reminders"
            checked={settings.enabled}
            onCheckedChange={handleMasterToggle}
            aria-label="Enable reminders"
          />
        </div>

        {/* Permission status feedback */}
        <div aria-live="polite" aria-atomic="true">
          {settings.enabled && permission === 'granted' && (
            <div
              data-testid="notification-permission-status"
              className="flex items-center gap-2 text-sm text-success"
            >
              <CheckCircle2 className="size-4" aria-hidden="true" />
              Notifications enabled
            </div>
          )}

          {/* Permission denied guidance */}
          {showDenied && (
            <div
              data-testid="permission-denied-guidance"
              className="flex items-center gap-2 text-sm text-warning"
            >
              <AlertTriangle className="size-4" aria-hidden="true" />
              Notifications are blocked. Please enable them in your browser settings.
            </div>
          )}
        </div>

        {/* Sub-toggles — only visible when enabled */}
        {settings.enabled && permission === 'granted' && (
          <div className="space-y-4 pt-2 border-t border-border animate-in fade-in-0 slide-in-from-top-1 duration-300">
            {/* Daily reminder */}
            <div className="space-y-2">
              <div className="flex items-center justify-between min-h-[44px]">
                <Label htmlFor="daily-reminder" className="cursor-pointer">
                  Daily reminder
                </Label>
                <Switch
                  id="daily-reminder"
                  checked={settings.dailyReminder}
                  onCheckedChange={checked => update({ dailyReminder: checked })}
                  aria-label="Daily reminder"
                />
              </div>
              {settings.dailyReminder && (
                <div data-testid="reminder-time-picker" className="ml-0">
                  <Label htmlFor="reminder-time" className="text-sm text-muted-foreground">
                    Reminder time
                  </Label>
                  <input
                    type="time"
                    id="reminder-time"
                    value={settings.dailyReminderTime}
                    onChange={e => update({ dailyReminderTime: e.target.value })}
                    className="mt-1 block w-full max-w-40 h-11 rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
              )}
            </div>

            {/* Streak at risk */}
            <div className="space-y-1">
              <div className="flex items-center justify-between min-h-[44px]">
                <div>
                  <Label htmlFor="streak-at-risk" className="cursor-pointer">
                    Streak at risk
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Notify when 22 hours have passed since your last study session
                  </p>
                </div>
                <Switch
                  id="streak-at-risk"
                  checked={settings.streakAtRisk}
                  onCheckedChange={checked => update({ streakAtRisk: checked })}
                  disabled={isPaused}
                  aria-label="Streak at risk"
                />
              </div>
              {isPaused && (
                <p className="text-xs text-muted-foreground italic">
                  Streak is currently paused — at-risk notifications are disabled.
                </p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
