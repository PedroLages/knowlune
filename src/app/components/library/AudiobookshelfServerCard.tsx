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
    borderClass: 'border-l-success',
    dotClass: 'bg-success',
    badgeBg: 'bg-success/10',
  },
  offline: {
    icon: CloudOff,
    label: 'Offline',
    className: 'text-warning-foreground',
    borderClass: 'border-l-warning',
    dotClass: 'bg-warning',
    badgeBg: 'bg-warning/10',
  },
  'auth-failed': {
    icon: AlertTriangle,
    label: 'Auth Failed',
    className: 'text-destructive',
    borderClass: 'border-l-destructive',
    dotClass: 'bg-destructive',
    badgeBg: 'bg-destructive/10',
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
      className={`rounded-xl bg-card p-4 shadow-card-ambient border-l-4 ${status.borderClass} flex flex-col gap-3`}
      data-testid={`abs-server-item-${server.id}`}
    >
      {/* Header: name + actions */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-bold text-foreground truncate">{server.name}</span>
          <span className="text-xs text-muted-foreground truncate">{server.url}</span>
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
              Re-auth
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
      </div>
      {/* Status + metadata row */}
      <div className="flex items-center gap-4 text-xs">
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-medium ${status.badgeBg} ${status.className}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${status.dotClass}`} />
          <span data-testid="abs-server-status">{status.label}</span>
        </span>
        {server.libraryIds.length > 0 && (
          <span className="text-muted-foreground">{server.libraryIds.length} {server.libraryIds.length === 1 ? 'library' : 'libraries'}</span>
        )}
        {server.lastSyncedAt && (
          <span className="text-muted-foreground">Synced {new Date(server.lastSyncedAt).toLocaleTimeString()}</span>
        )}
      </div>
    </li>
  )
}
