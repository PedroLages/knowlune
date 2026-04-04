import { useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { Bell, CircleCheck } from 'lucide-react'
import { cn } from '@/app/components/ui/utils'
import { Button } from '@/app/components/ui/button'
import { Popover, PopoverTrigger, PopoverContent } from '@/app/components/ui/popover'
import { ScrollArea } from '@/app/components/ui/scroll-area'
import { Separator } from '@/app/components/ui/separator'
import { useNotificationStore } from '@/stores/useNotificationStore'
import {
  notificationIcons,
  notificationIconColors,
  DEFAULT_ICON,
  DEFAULT_ICON_COLOR,
  relativeTime,
} from '@/lib/notifications'

// --- Component ---

export function NotificationCenter() {
  const notifications = useNotificationStore(s => s.notifications)
  const unreadCount = useNotificationStore(s => s.unreadCount)
  const storeMarkRead = useNotificationStore(s => s.markRead)
  const storeMarkAllRead = useNotificationStore(s => s.markAllRead)
  const storeInit = useNotificationStore(s => s.init)

  const [open, setOpen] = useState(false)
  const [liveMessage, setLiveMessage] = useState('')
  const navigate = useNavigate()

  const hasUnread = unreadCount > 0

  // Initialize notification store on mount (load from Dexie)
  useEffect(() => {
    storeInit()
  }, [storeInit])

  const handleNotificationClick = useCallback(
    (id: string, actionUrl?: string) => {
      storeMarkRead(id)
      if (actionUrl) {
        setOpen(false)
        navigate(actionUrl)
      }
    },
    [storeMarkRead, navigate]
  )

  const markAllAsRead = useCallback(() => {
    storeMarkAllRead()
    setLiveMessage('All notifications marked as read')
  }, [storeMarkAllRead])

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
            <span className="absolute top-2 right-2 flex size-2.5" aria-hidden="true">
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
            <h3 id="notification-heading" className="text-sm font-semibold">
              Notifications
            </h3>
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
              <CircleCheck className="mr-1 size-3.5" aria-hidden="true" />
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
          <ScrollArea className="h-[400px]">
            <div className="flex flex-col">
              {notifications.map(notification => {
                const Icon = notificationIcons[notification.type] ?? DEFAULT_ICON
                const iconColor = notificationIconColors[notification.type] ?? DEFAULT_ICON_COLOR
                const isUnread = notification.readAt === null

                return (
                  <button
                    key={notification.id}
                    type="button"
                    className={cn(
                      'flex items-start gap-2.5 px-3 py-3 text-left transition-colors hover:bg-accent/50 cursor-pointer',
                      isUnread && 'bg-brand-soft/30'
                    )}
                    onClick={() => handleNotificationClick(notification.id, notification.actionUrl)}
                  >
                    {/* Icon */}
                    <div
                      className={cn('mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted', iconColor)}
                    >
                      <Icon className="size-4" aria-hidden="true" />
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p
                          className={cn(
                            'text-sm leading-tight',
                            isUnread ? 'font-semibold' : 'font-medium text-foreground/80'
                          )}
                        >
                          {notification.title}
                        </p>
                        <span
                          className={cn(
                            'mt-1 flex size-2.5 shrink-0 rounded-full',
                            isUnread ? 'bg-brand' : 'bg-muted-foreground/30'
                          )}
                          aria-hidden="true"
                        />
                      </div>
                      <p className="mt-0.5 text-xs leading-snug text-muted-foreground line-clamp-2">
                        {notification.message}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground/70">
                        {relativeTime(notification.createdAt)}
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
            onClick={() => {
              setOpen(false)
              navigate('/notifications')
            }}
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
