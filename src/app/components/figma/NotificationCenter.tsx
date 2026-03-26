import { useState, useCallback } from 'react'
import {
  Bell,
  Trophy,
  Flame,
  BookOpen,
  Clock,
  Sparkles,
  GraduationCap,
  CheckCheck,
} from 'lucide-react'
import { cn } from '@/app/components/ui/utils'
import { Button } from '@/app/components/ui/button'
import { Popover, PopoverTrigger, PopoverContent } from '@/app/components/ui/popover'
import { ScrollArea } from '@/app/components/ui/scroll-area'
import { Separator } from '@/app/components/ui/separator'

// --- Types ---

interface Notification {
  id: string
  type: 'achievement' | 'streak' | 'recommendation' | 'reminder' | 'new-content' | 'course-complete'
  title: string
  message: string
  timestamp: Date
  read: boolean
}

// --- Icon mapping ---

const notificationIcons: Record<Notification['type'], typeof Trophy> = {
  achievement: Trophy,
  streak: Flame,
  recommendation: BookOpen,
  reminder: Clock,
  'new-content': Sparkles,
  'course-complete': GraduationCap,
}

const notificationIconColors: Record<Notification['type'], string> = {
  achievement: 'text-warning',
  streak: 'text-destructive',
  recommendation: 'text-brand',
  reminder: 'text-muted-foreground',
  'new-content': 'text-success',
  'course-complete': 'text-brand',
}

// --- Relative time helper ---

function relativeTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  const diffHr = Math.floor(diffMs / 3_600_000)
  const diffDay = Math.floor(diffMs / 86_400_000)

  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin} min ago`
  if (diffHr < 24) return `${diffHr} hour${diffHr > 1 ? 's' : ''} ago`
  if (diffDay === 1) return 'Yesterday'
  if (diffDay < 7) return `${diffDay} days ago`
  return date.toLocaleDateString()
}

// --- Initial mock data (timestamps relative to now) ---
// TODO(notifications): Replace with real notification data source (store or API)

function createMockNotifications(): Notification[] {
  const now = Date.now()
  return [
    {
      id: '1',
      type: 'achievement',
      title: 'Achievement Unlocked!',
      message: 'You earned the "Quick Learner" badge for completing 5 lessons in one day.',
      timestamp: new Date(now - 2 * 60_000), // 2 min ago
      read: false,
    },
    {
      id: '2',
      type: 'streak',
      title: '7-Day Streak!',
      message: 'Incredible! You have studied 7 days in a row. Keep the momentum going!',
      timestamp: new Date(now - 45 * 60_000), // 45 min ago
      read: false,
    },
    {
      id: '3',
      type: 'new-content',
      title: 'New Course Available',
      message: '"Advanced TypeScript Patterns" has just been added to the catalog.',
      timestamp: new Date(now - 3 * 3_600_000), // 3 hours ago
      read: false,
    },
    {
      id: '4',
      type: 'recommendation',
      title: 'Recommended for You',
      message: 'Based on your progress, try "React Performance Optimization" next.',
      timestamp: new Date(now - 8 * 3_600_000), // 8 hours ago
      read: true,
    },
    {
      id: '5',
      type: 'reminder',
      title: 'Study Reminder',
      message: 'You have not studied today yet. A quick 15-minute session can make a difference!',
      timestamp: new Date(now - 24 * 3_600_000), // 1 day ago
      read: true,
    },
    {
      id: '6',
      type: 'course-complete',
      title: 'Course Completed',
      message: 'Congratulations! You finished "Intro to Machine Learning" with a 92% score.',
      timestamp: new Date(now - 3 * 86_400_000), // 3 days ago
      read: true,
    },
  ]
}

// --- Component ---

export function NotificationCenter() {
  const [notifications, setNotifications] = useState<Notification[]>(createMockNotifications)
  const [open, setOpen] = useState(false)
  const [liveMessage, setLiveMessage] = useState('')

  const unreadCount = notifications.filter(n => !n.read).length
  const hasUnread = unreadCount > 0

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, read: true } : n))
    )
  }, [])

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    setLiveMessage('All notifications marked as read')
  }, [])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative min-h-[44px] min-w-[44px]"
          aria-label={`Notifications${hasUnread ? ` (${unreadCount} unread)` : ''}`}
        >
          <Bell className="size-5 text-muted-foreground" aria-hidden="true" />
          {hasUnread && (
            <span
              className="absolute top-2 right-2 flex size-2.5"
              aria-hidden="true"
            >
              <span className="absolute inline-flex size-full motion-safe:animate-ping rounded-full bg-destructive opacity-75" />
              <span className="relative inline-flex size-2.5 rounded-full bg-destructive" />
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        aria-labelledby="notification-heading"
        className="w-[calc(100vw-2rem)] sm:w-[380px] overflow-hidden p-0"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2.5">
          <div className="flex items-center gap-2">
            <h3 id="notification-heading" className="text-sm font-semibold">Notifications</h3>
            {hasUnread && (
              <span className="flex items-center justify-center rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-medium text-destructive-foreground leading-none">
                {unreadCount}
              </span>
            )}
          </div>
          {hasUnread && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
              onClick={markAllAsRead}
            >
              <CheckCheck className="mr-1 size-3.5" aria-hidden="true" />
              Mark all as read
            </Button>
          )}
        </div>

        <Separator />

        {/* Notification list */}
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
            <Bell className="mb-2 size-8 opacity-40" aria-hidden="true" />
            <p className="text-sm">No notifications yet</p>
          </div>
        ) : (
          <ScrollArea className="h-[350px]">
            <div className="flex flex-col">
              {notifications.map((notification) => {
                const Icon = notificationIcons[notification.type]
                const iconColor = notificationIconColors[notification.type]

                return (
                  <button
                    key={notification.id}
                    type="button"
                    className={cn(
                      'flex items-start gap-2.5 px-3 py-2 text-left transition-colors hover:bg-accent/50 cursor-pointer',
                      !notification.read && 'bg-brand-soft/30'
                    )}
                    onClick={() => markAsRead(notification.id)}
                  >
                    {/* Icon */}
                    <div className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted ${iconColor}`}>
                      <Icon className="size-3.5" aria-hidden="true" />
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className={cn('text-sm leading-tight', !notification.read ? 'font-semibold' : 'font-medium text-foreground/80')}>
                          {notification.title}
                        </p>
                        {!notification.read && (
                          <span
                            className="mt-1 flex size-1.5 shrink-0 rounded-full bg-brand"
                            aria-hidden="true"
                          />
                        )}
                      </div>
                      <p className="mt-0.5 text-xs leading-snug text-muted-foreground line-clamp-2">
                        {notification.message}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground/70">
                        {relativeTime(notification.timestamp)}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          </ScrollArea>
        )}

        <Separator />

        {/* Footer */}
        <div className="px-3 py-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-auto w-full px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setOpen(false)}
          >
            View all notifications
          </Button>
        </div>
      </PopoverContent>

      {/* Screen reader announcement for state changes */}
      <span className="sr-only" aria-live="polite" role="status">
        {liveMessage}
      </span>
    </Popover>
  )
}
