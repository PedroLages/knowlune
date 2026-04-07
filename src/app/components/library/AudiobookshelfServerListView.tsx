/**
 * AudiobookshelfServerListView — displays connected ABS servers with edit/remove
 * actions, or an empty state prompting the user to add their first server.
 *
 * @module AudiobookshelfServerListView
 * @since E101-S02
 */

import { Headphones, Plus } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import type { AudiobookshelfServer } from '@/data/types'
import { AudiobookshelfServerCard } from './AudiobookshelfServerCard'

interface AudiobookshelfServerListViewProps {
  servers: AudiobookshelfServer[]
  onAdd: () => void
  onEdit: (server: AudiobookshelfServer) => void
  onDelete: (server: AudiobookshelfServer) => void
  onReauthenticate: (server: AudiobookshelfServer) => void
}

export function AudiobookshelfServerListView({
  servers,
  onAdd,
  onEdit,
  onDelete,
  onReauthenticate,
}: AudiobookshelfServerListViewProps) {
  return (
    <div className="flex flex-col gap-4">
      {servers.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-8">
          <Headphones className="size-12 text-muted-foreground/40" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">No servers connected yet.</p>
          <p className="text-xs text-muted-foreground max-w-xs text-center">
            Connect to your Audiobookshelf server to browse and sync your audiobook library.
          </p>
        </div>
      )}

      {servers.length > 0 && (
        <ul
          className="flex flex-col gap-3"
          role="list"
          aria-label="Connected Audiobookshelf servers"
        >
          {servers.map(server => (
            <AudiobookshelfServerCard
              key={server.id}
              server={server}
              onEdit={onEdit}
              onDelete={onDelete}
              onReauthenticate={onReauthenticate}
            />
          ))}
        </ul>
      )}

      <Button
        variant="brand-outline"
        onClick={onAdd}
        className="min-h-[44px] w-full"
        data-testid="add-abs-server-btn"
      >
        <Plus className="mr-2 size-4" />
        Add Server
      </Button>
    </div>
  )
}
