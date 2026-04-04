import { useState, useCallback, useMemo } from 'react'
import { Bell, CheckCheck, X, Filter } from 'lucide-react'
import { cn } from '@/app/components/ui/utils'
import { Button } from '@/app/components/ui/button'
import { Badge } from '@/app/components/ui/badge'
import { Card } from '@/app/components/ui/card'
import { EmptyState } from '@/app/components/EmptyState'
import { useNotificationStore } from '@/stores/useNotificationStore'
import type { NotificationType } from '@/data/types'
import {
  notificationIcons,
  notificationIconColors,
  DEFAULT_ICON,
  DEFAULT_ICON_COLOR,
  relativeTime,
} from '@/lib/notifications'

// --- Notification type labels ---

const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  'course-complete': 'Course Complete',
  'streak-milestone': 'Streak Milestone',
  'import-finished': 'Import Finished',
  'achievement-unlocked': 'Achievement',
  'review-due': 'Review Due',
  'srs-due': 'SRS Due',
  'knowledge-decay': 'Knowledge Decay',
}

const ALL_TYPES: NotificationType[] = [
  'course-complete',
  'streak-milestone',
  'import-finished',
  'achievement-unlocked',
  'review-due',
  'srs-due',
  'knowledge-decay',
]

type ReadFilter = 'all' | 'unread' | 'read'

// --- Component ---

export function Notifications() {
  const notifications = useNotificationStore(s => s.notifications)
  const unreadCount = useNotificationStore(s => s.unreadCount)
  const storeMarkRead = useNotificationStore(s => s.markRead)
  const storeMarkAllRead = useNotificationStore(s => s.markAllRead)
  const storeDismiss = useNotificationStore(s => s.dismiss)

  const [selectedType, setSelectedType] = useState<NotificationType | null>(null)
  const [readFilter, setReadFilter] = useState<ReadFilter>('all')
  const [liveMessage, setLiveMessage] = useState('')

  const filteredNotifications = useMemo(() => {
    return notifications.filter(n => {
      if (selectedType && n.type !== selectedType) return false
      if (readFilter === 'unread' && n.readAt !== null) return false
      if (readFilter === 'read' && n.readAt === null) return false
      return true
    })
  }, [notifications, selectedType, readFilter])

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

  const clearFilters = useCallback(() => {
    setSelectedType(null)
    setReadFilter('all')
  }, [])

  const hasActiveFilters = selectedType !== null || readFilter !== 'all'

  return (
    <div className="space-y-6" data-testid="notifications-page">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-2xl font-semibold">Notifications</h1>
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="text-xs"
              aria-label={`${unreadCount} unread notifications`}
            >
              {unreadCount} unread
            </Badge>
          )}
        </div>
        {unreadCount > 0 && (
          <Button
            variant="brand-outline"
            size="sm"
            onClick={handleMarkAllRead}
            aria-label="Mark all notifications as read"
          >
            <CheckCheck className="mr-1.5 size-4" aria-hidden="true" />
            Mark all as read
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="space-y-3" role="group" aria-label="Notification filters">
        {/* Read status filter */}
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="size-4 text-muted-foreground" aria-hidden="true" />
          {(['all', 'unread', 'read'] as const).map(status => (
            <Button
              key={status}
              variant={readFilter === status ? 'brand' : 'outline'}
              size="sm"
              onClick={() => setReadFilter(status)}
              aria-pressed={readFilter === status}
              aria-label={`Filter by ${status} notifications`}
              className="min-h-[44px] capitalize sm:min-h-[36px]"
            >
              {status}
            </Button>
          ))}
        </div>

        {/* Type filter */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={selectedType === null ? 'brand' : 'outline'}
            size="sm"
            onClick={() => setSelectedType(null)}
            aria-pressed={selectedType === null}
            aria-label="Show all notification types"
            className="min-h-[44px] sm:min-h-[36px]"
          >
            All types
          </Button>
          {ALL_TYPES.map(type => {
            const Icon = notificationIcons[type]
            const label = NOTIFICATION_TYPE_LABELS[type]
            return (
              <Button
                key={type}
                variant={selectedType === type ? 'brand' : 'outline'}
                size="sm"
                onClick={() => setSelectedType(type)}
                aria-pressed={selectedType === type}
                aria-label={`Filter by ${label}`}
                className="min-h-[44px] sm:min-h-[36px]"
              >
                <Icon className="mr-1.5 size-3.5" aria-hidden="true" />
                {label}
              </Button>
            )
          })}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              aria-label="Clear all filters"
              className="min-h-[44px] text-muted-foreground sm:min-h-[36px]"
            >
              <X className="mr-1 size-3.5" aria-hidden="true" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Notification list */}
      {filteredNotifications.length === 0 ? (
        hasActiveFilters ? (
          <EmptyState
            icon={Filter}
            title="No matching notifications"
            description="Try adjusting your filters to see more notifications."
            actionLabel="Clear filters"
            onAction={clearFilters}
            data-testid="notifications-empty-filtered"
          />
        ) : (
          <EmptyState
            icon={Bell}
            title="No notifications yet"
            description="You're all caught up! Notifications about your learning progress will appear here."
            data-testid="notifications-empty"
          />
        )
      ) : (
        <div
          className="space-y-2"
          role="list"
          aria-label="Notifications list"
          data-testid="notifications-list"
        >
          {filteredNotifications.map(notification => {
            const Icon = notificationIcons[notification.type] ?? DEFAULT_ICON
            const iconColor = notificationIconColors[notification.type] ?? DEFAULT_ICON_COLOR
            const isUnread = notification.readAt === null

            return (
              <Card
                key={notification.id}
                role="listitem"
                className={cn(
                  'flex items-start gap-3 p-4 transition-colors',
                  isUnread && 'bg-brand-soft/30'
                )}
                data-testid="notification-item"
                data-notification-id={notification.id}
                data-read={!isUnread}
              >
                {/* Icon */}
                <div
                  className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-muted ${iconColor}`}
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
                            isUnread ? 'font-semibold' : 'font-medium text-foreground/80'
                          )}
                        >
                          {notification.title}
                        </p>
                        {isUnread && (
                          <span
                            className="flex size-2 shrink-0 rounded-full bg-brand"
                            aria-label="Unread"
                          />
                        )}
                      </div>
                      <p className="mt-1 text-sm leading-snug text-muted-foreground">
                        {notification.message}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground/70">
                        {relativeTime(notification.createdAt)}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex shrink-0 items-center gap-1">
                      {isUnread && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground min-w-[44px]"
                          onClick={() => handleMarkRead(notification.id)}
                          aria-label={`Mark "${notification.title}" as read`}
                        >
                          <CheckCheck className="size-3.5" aria-hidden="true" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-xs text-muted-foreground hover:text-destructive min-w-[44px]"
                        onClick={() => handleDismiss(notification.id)}
                        aria-label={`Dismiss "${notification.title}"`}
                      >
                        <X className="size-3.5" aria-hidden="true" />
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Screen reader announcement for state changes */}
      <span className="sr-only" aria-live="polite" role="status">
        {liveMessage}
      </span>
    </div>
  )
}
