/**
 * AudiobookshelfServerCard — displays a connected ABS server with status badge
 * and edit/remove actions.
 *
 * Status variants use icon + text (NFR12: never color-alone indicators).
 * All status badge colors use design tokens (never hardcoded).
 *
 * @module AudiobookshelfServerCard
 * @since E101-S02
 */

import { CheckCircle2, CloudOff, AlertTriangle, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import type { AudiobookshelfServer } from '@/data/types'

interface AudiobookshelfServerCardProps {
  server: AudiobookshelfServer
  onEdit: (server: AudiobookshelfServer) => void
  onDelete: (server: AudiobookshelfServer) => void
  onReauthenticate: (server: AudiobookshelfServer) => void
}

const STATUS_CONFIG = {
  connected: {
    icon: CheckCircle2,
    label: 'Connected',
    className: 'text-success',
  },
  offline: {
    icon: CloudOff,
    label: 'Offline',
    className: 'text-warning-foreground',
  },
  'auth-failed': {
    icon: AlertTriangle,
    label: 'Auth Failed',
    className: 'text-destructive',
  },
} as const

export function AudiobookshelfServerCard({
  server,
  onEdit,
  onDelete,
  onReauthenticate,
}: AudiobookshelfServerCardProps) {
  const status = STATUS_CONFIG[server.status]
  const StatusIcon = status.icon

  return (
    <li
      className="flex items-center justify-between gap-3 py-3"
      data-testid={`abs-server-item-${server.id}`}
    >
      <div className="flex flex-col min-w-0">
        <span className="text-sm font-medium text-foreground truncate">{server.name}</span>
        <span className="text-xs text-muted-foreground truncate">{server.url}</span>
        <div className="flex items-center gap-1.5 mt-1">
          <StatusIcon className={`size-3.5 ${status.className}`} aria-hidden="true" />
          <span className={`text-xs font-medium ${status.className}`} data-testid="abs-server-status">
            {status.label}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {server.status === 'auth-failed' && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onReauthenticate(server)}
            className="min-h-[44px] text-xs"
            data-testid="abs-reauthenticate-btn"
          >
            Re-authenticate
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onEdit(server)}
          className="size-9"
          aria-label={`Edit ${server.name}`}
        >
          <Pencil className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDelete(server)}
          className="size-9 text-destructive hover:text-destructive"
          aria-label={`Remove ${server.name}`}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </li>
  )
}
