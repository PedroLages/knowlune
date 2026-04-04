import { useEffect } from 'react'
import {
  BellRing,
  GraduationCap,
  Flame,
  Download,
  Trophy,
  BookOpen,
  Brain,
  Clock,
  type LucideIcon,
} from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/app/components/ui/card'
import { Switch } from '@/app/components/ui/switch'
import { Label } from '@/app/components/ui/label'
import { Separator } from '@/app/components/ui/separator'
import type { NotificationType } from '@/data/types'
import { useNotificationPrefsStore } from '@/stores/useNotificationPrefsStore'

interface ToggleDefinition {
  type: NotificationType
  label: string
  description: string
  icon: LucideIcon
}

const NOTIFICATION_TOGGLES: ToggleDefinition[] = [
  {
    type: 'course-complete',
    label: 'Course Completions',
    description: 'When you finish a course',
    icon: GraduationCap,
  },
  {
    type: 'streak-milestone',
    label: 'Streak Milestones',
    description: 'When you hit 7, 14, 30, 60, or 100-day streaks',
    icon: Flame,
  },
  {
    type: 'import-finished',
    label: 'Course Imports',
    description: 'When a course import completes',
    icon: Download,
  },
  {
    type: 'achievement-unlocked',
    label: 'Achievement Unlocks',
    description: 'When you earn a new badge',
    icon: Trophy,
  },
  {
    type: 'review-due',
    label: 'Flashcard Reviews',
    description: 'Daily reminder when flashcards are due',
    icon: Clock,
  },
  {
    type: 'srs-due',
    label: 'SRS Due Reminders',
    description: 'When spaced repetition cards are ready for review',
    icon: BookOpen,
  },
  {
    type: 'knowledge-decay',
    label: 'Knowledge Decay Alerts',
    description: 'When topic retention drops below a safe threshold',
    icon: Brain,
  },
]

export function NotificationPreferencesPanel() {
  const { prefs, isLoaded, init, setTypeEnabled, setQuietHours, isTypeEnabled } =
    useNotificationPrefsStore()

  useEffect(() => {
    if (!isLoaded) {
      init()
    }
  }, [isLoaded, init])

  return (
    <Card data-testid="notification-preferences">
      <CardHeader className="border-b border-border/50 bg-surface-sunken/30">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-brand-soft p-2">
            <BellRing className="size-5 text-brand" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-lg font-display leading-none">Notification Preferences</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Choose which notifications you receive
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        {/* Per-type toggles */}
        <div role="group" aria-label="Notification type toggles" className="space-y-3">
          {NOTIFICATION_TOGGLES.map(toggle => {
            const Icon = toggle.icon
            const enabled = isTypeEnabled(toggle.type)
            return (
              <div
                key={toggle.type}
                className="flex items-center justify-between gap-4 min-h-[44px]"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <div className="min-w-0">
                    <Label
                      htmlFor={`notif-${toggle.type}`}
                      className="text-sm font-medium cursor-pointer"
                    >
                      {toggle.label}
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5">{toggle.description}</p>
                  </div>
                </div>
                <Switch
                  id={`notif-${toggle.type}`}
                  checked={enabled}
                  onCheckedChange={checked => setTypeEnabled(toggle.type, checked)}
                  aria-label={`${toggle.label} notifications`}
                />
              </div>
            )
          })}
        </div>

        <Separator />

        {/* Quiet Hours */}
        <div className="space-y-4">
          <div className="flex items-center justify-between min-h-[44px]">
            <div>
              <Label htmlFor="quiet-hours" className="text-sm font-medium cursor-pointer">
                Quiet Hours
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Suppress all notifications during these hours
              </p>
            </div>
            <Switch
              id="quiet-hours"
              checked={prefs.quietHoursEnabled}
              onCheckedChange={checked => setQuietHours({ quietHoursEnabled: checked })}
              aria-label="Enable quiet hours"
            />
          </div>

          <div aria-live="polite">
            {prefs.quietHoursEnabled && (
              <div className="grid grid-cols-2 gap-4 animate-in fade-in-0 slide-in-from-top-1 duration-300">
                <div className="space-y-1.5">
                  <Label htmlFor="quiet-start" className="text-sm text-muted-foreground">
                    Start
                  </Label>
                  <input
                    type="time"
                    id="quiet-start"
                    value={prefs.quietHoursStart}
                    onChange={e => setQuietHours({ quietHoursStart: e.target.value })}
                    className="block w-full h-11 rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="quiet-end" className="text-sm text-muted-foreground">
                    End
                  </Label>
                  <input
                    type="time"
                    id="quiet-end"
                    value={prefs.quietHoursEnd}
                    onChange={e => setQuietHours({ quietHoursEnd: e.target.value })}
                    className="block w-full h-11 rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
