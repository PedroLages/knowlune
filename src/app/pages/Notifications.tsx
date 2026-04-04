import { useState, useCallback, useMemo } from 'react'
import { Bell, CircleCheck, Clock, Settings, Trash2 } from 'lucide-react'
import { cn } from '@/app/components/ui/utils'
import { Button } from '@/app/components/ui/button'
import { EmptyState } from '@/app/components/EmptyState'
import { useNotificationStore } from '@/stores/useNotificationStore'
import type { Notification } from '@/data/types'
import {
  notificationIcons,
  notificationIconColors,
  DEFAULT_ICON,
  DEFAULT_ICON_COLOR,
  relativeTime,
} from '@/lib/notifications'

// --- Timeline grouping ---

function groupByTimeline(notifications: Notification[]) {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterdayStart = new Date(todayStart.getTime() - 86400000)
  const weekStart = new Date(todayStart.getTime() - 7 * 86400000)

  const groups: { label: string; items: Notification[] }[] = [
    { label: 'TODAY', items: [] },
    { label: 'YESTERDAY', items: [] },
    { label: 'THIS WEEK', items: [] },
    { label: 'OLDER', items: [] },
  ]

  for (const n of notifications) {
    const d = new Date(n.createdAt)
    if (d >= todayStart) groups[0].items.push(n)
    else if (d >= yesterdayStart) groups[1].items.push(n)
    else if (d >= weekStart) groups[2].items.push(n)
    else groups[3].items.push(n)
  }

  return groups.filter(g => g.items.length > 0)
}

// --- Notification Card ---

interface NotificationCardProps {
  notification: Notification
  onMarkRead: (id: string) => void
  onDismiss: (id: string) => void
}

function NotificationCard({ notification, onMarkRead, onDismiss }: NotificationCardProps) {
  const Icon = notificationIcons[notification.type] ?? DEFAULT_ICON
  const iconColor = notificationIconColors[notification.type] ?? DEFAULT_ICON_COLOR
  const isUnread = notification.readAt === null

  return (
    <div
      role="listitem"
      className={cn(
        'group relative flex items-start gap-3 rounded-2xl p-4 transition-colors',
        isUnread
          ? 'border border-l-[3px] border-border border-l-brand bg-brand-soft/20'
          : 'border border-border'
      )}
      data-testid="notification-item"
      data-notification-id={notification.id}
      data-read={!isUnread}
    >
      {/* Icon */}
      <div
        className={cn('mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-muted', iconColor)}
      >
        <Icon className="size-4" aria-hidden="true" />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p
                className={cn(
                  'text-sm leading-tight',
                  isUnread ? 'font-bold' : 'font-medium text-foreground/80'
                )}
              >
                {notification.title}
              </p>
              <span
                className={cn(
                  'size-2 shrink-0 rounded-full',
                  isUnread ? 'bg-brand' : 'bg-muted-foreground/30'
                )}
                aria-label={isUnread ? 'Unread' : 'Read'}
              />
            </div>
            <p className="mt-1 text-sm leading-snug text-muted-foreground">
              {notification.message}
            </p>
            <p className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground/70">
              <Clock className="size-3" aria-hidden="true" />
              {relativeTime(notification.createdAt)}
            </p>
          </div>

          {/* Hover-reveal actions */}
          <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
            {isUnread && (
              <Button
                variant="outline"
                size="icon"
                className="size-8"
                onClick={() => onMarkRead(notification.id)}
                aria-label={`Mark "${notification.title}" as read`}
              >
                <CircleCheck className="size-3.5" aria-hidden="true" />
              </Button>
            )}
            <Button
              variant="outline"
              size="icon"
              className="size-8 hover:text-destructive"
              onClick={() => onDismiss(notification.id)}
              aria-label={`Dismiss "${notification.title}"`}
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// --- Main Component ---

export function Notifications() {
  const notifications = useNotificationStore(s => s.notifications)
  const unreadCount = useNotificationStore(s => s.unreadCount)
  const storeMarkRead = useNotificationStore(s => s.markRead)
  const storeMarkAllRead = useNotificationStore(s => s.markAllRead)
  const storeDismiss = useNotificationStore(s => s.dismiss)

  const [readFilter, setReadFilter] = useState<'all' | 'unread'>('all')
  const [liveMessage, setLiveMessage] = useState('')

  const filteredNotifications = useMemo(() => {
    return notifications.filter(n => {
      if (readFilter === 'unread' && n.readAt !== null) return false
      return true
    })
  }, [notifications, readFilter])

  const timelineGroups = useMemo(
    () => groupByTimeline(filteredNotifications),
    [filteredNotifications]
  )

  const handleMarkRead = useCallback(
    (id: string) => {
      storeMarkRead(id)
      setLiveMessage('Notification marked as read')
    },
    [storeMarkRead]
  )

  const handleMarkAllRead = useCallback(() => {
    storeMarkAllRead()
    setLiveMessage('All notifications marked as read')
  }, [storeMarkAllRead])

  const handleDismiss = useCallback(
    (id: string) => {
      storeDismiss(id)
      setLiveMessage('Notification dismissed')
    },
    [storeDismiss]
  )

  const hasActiveFilter = readFilter !== 'all'

  return (
    <div className="mx-auto max-w-3xl space-y-6" data-testid="notifications-page">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <Bell className="size-6 text-brand" aria-hidden="true" />
            <h1 className="font-display text-2xl font-semibold">Notifications</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Stay on top of your learning milestones and updates.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Button
              variant="brand"
              size="sm"
              onClick={handleMarkAllRead}
              aria-label="Mark all notifications as read"
            >
              <CircleCheck className="mr-1.5 size-4" aria-hidden="true" />
              Mark all as read
            </Button>
          )}
          <Button
            variant="outline"
            size="icon"
            className="size-9"
            aria-label="Notification settings"
          >
            <Settings className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </div>

      {/* Filter pills */}
      <div className="flex items-center gap-2" role="group" aria-label="Notification filters">
        <button
          type="button"
          onClick={() => setReadFilter('all')}
          aria-pressed={readFilter === 'all'}
          className={cn(
            'min-h-[44px] sm:min-h-[36px] rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
            readFilter === 'all'
              ? 'bg-brand text-brand-foreground'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          )}
        >
          All
        </button>
        <button
          type="button"
          onClick={() => setReadFilter('unread')}
          aria-pressed={readFilter === 'unread'}
          className={cn(
            'min-h-[44px] sm:min-h-[36px] rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
            readFilter === 'unread'
              ? 'bg-brand text-brand-foreground'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          )}
        >
          Unread {unreadCount > 0 && unreadCount}
        </button>
      </div>

      {/* Notification list grouped by timeline */}
      {filteredNotifications.length === 0 ? (
        hasActiveFilter ? (
          <EmptyState
            icon={Bell}
            title="No unread notifications"
            description="You're all caught up! Switch to All to see past notifications."
            actionLabel="Show all"
            onAction={() => setReadFilter('all')}
            className="border border-dashed"
            data-testid="notifications-empty-filtered"
          />
        ) : (
          <EmptyState
            icon={Bell}
            title="No notifications yet"
            description="You're all caught up! Notifications about your learning progress will appear here."
            className="border border-dashed"
            data-testid="notifications-empty"
          />
        )
      ) : (
        <div className="space-y-6" data-testid="notifications-list">
          {timelineGroups.map(group => (
            <section key={group.label} aria-label={`${group.label} notifications`}>
              {/* Timeline header */}
              <div className="mb-3 flex items-center gap-3">
                <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground font-mono">
                  {group.label}
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>

              {/* Cards */}
              <div className="space-y-3" role="list" aria-label={`${group.label} notifications`}>
                {group.items.map(notification => (
                  <NotificationCard
                    key={notification.id}
                    notification={notification}
                    onMarkRead={handleMarkRead}
                    onDismiss={handleDismiss}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Screen reader announcement for state changes */}
      <span className="sr-only" aria-live="polite" role="status">
        {liveMessage}
      </span>
    </div>
  )
}
