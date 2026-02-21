import { Clock, Trash2 } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { type VideoBookmark, formatBookmarkTimestamp, deleteBookmark } from '@/lib/bookmarks'

interface BookmarksListProps {
  bookmarks: VideoBookmark[]
  onSeek?: (timestamp: number) => void
  onBookmarksChange?: () => void
}

export function BookmarksList({ bookmarks, onSeek, onBookmarksChange }: BookmarksListProps) {
  const handleDelete = (bookmarkId: string) => {
    deleteBookmark(bookmarkId)
    onBookmarksChange?.()
  }

  const handleSeek = (timestamp: number) => {
    onSeek?.(timestamp)
  }

  if (bookmarks.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        <Clock className="size-8 mx-auto mb-2 opacity-40" />
        <p>No bookmarks yet</p>
        <p className="text-xs mt-1">
          Click the bookmark icon in the video player to save important moments
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {bookmarks.map(bookmark => (
        <div
          key={bookmark.id}
          className="group flex items-center gap-3 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
        >
          <button
            onClick={() => handleSeek(bookmark.timestamp)}
            className="flex-1 flex items-center gap-3 text-left min-w-0"
          >
            <div className="shrink-0 w-12 h-8 rounded bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <span className="text-xs font-mono font-semibold text-blue-700 dark:text-blue-300">
                {formatBookmarkTimestamp(bookmark.timestamp)}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{bookmark.label}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(bookmark.createdAt).toLocaleDateString()}
              </p>
            </div>
          </button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
            onClick={() => handleDelete(bookmark.id)}
            aria-label="Delete bookmark"
          >
            <Trash2 className="size-4 text-muted-foreground hover:text-destructive" />
          </Button>
        </div>
      ))}
    </div>
  )
}
