/**
 * BookmarkListPanel — Sheet panel listing all bookmarks for the current audiobook.
 *
 * Slides in from the right. Each row shows chapter name, timestamp, optional
 * note preview, and a delete button. Tapping a row seeks to that bookmark.
 *
 * @module BookmarkListPanel
 * @since E87-S04
 */
import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/app/components/ui/sheet'
import { ScrollArea } from '@/app/components/ui/scroll-area'
import { Button } from '@/app/components/ui/button'
import { cn } from '@/app/components/ui/utils'
import { db } from '@/db/schema'
import { formatAudioTime } from '@/app/hooks/useAudioPlayer'
import type { AudioBookmark } from '@/data/types'
import type { BookChapter } from '@/data/types'

interface BookmarkListPanelProps {
  open: boolean
  onClose: () => void
  bookId: string
  chapters: BookChapter[]
  onSeek: (chapterIndex: number, timestamp: number) => void
  /** Called after a bookmark is deleted from Dexie, with the deleted bookmark's ID */
  onBookmarkDeleted?: (id: string) => void
}

export function BookmarkListPanel({
  open,
  onClose,
  bookId,
  chapters,
  onSeek,
  onBookmarkDeleted,
}: BookmarkListPanelProps) {
  const [bookmarks, setBookmarks] = useState<AudioBookmark[]>([])

  // Load bookmarks when panel opens
  useEffect(() => {
    if (!open) return
    let ignore = false

    db.audioBookmarks
      .where('bookId')
      .equals(bookId)
      .sortBy('timestamp')
      .then(results => {
        if (!ignore) setBookmarks(results)
      })
      .catch(() => {
        // silent-catch-ok: panel stays empty on error
      })

    return () => {
      ignore = true
    }
  }, [open, bookId])

  const handleDelete = async (id: string) => {
    try {
      // sync: local-only — audioBookmarks insertOnly; hard deletes are not propagated to Supabase
      await db.audioBookmarks.delete(id)
      setBookmarks(prev => prev.filter(b => b.id !== id))
      onBookmarkDeleted?.(id)
    } catch {
      // silent-catch-ok: surfaced via toast
      toast.error('Failed to delete bookmark')
    }
  }

  const handleSeek = (bookmark: AudioBookmark) => {
    onSeek(bookmark.chapterIndex, bookmark.timestamp)
    onClose()
  }

  return (
    <Sheet
      open={open}
      onOpenChange={v => {
        if (!v) onClose()
      }}
    >
      <SheetContent
        side="right"
        overlayClassName="z-[130]"
        className={cn('z-[130] flex flex-col w-full sm:max-w-md p-0')}
      >
        <SheetHeader className="px-4 pt-4 pb-2 border-b border-border/50">
          <SheetTitle>Bookmarks</SheetTitle>
        </SheetHeader>

        {bookmarks.length === 0 ? (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground px-4">
            No bookmarks yet. Tap the bookmark button while listening to save a moment.
          </div>
        ) : (
          <ScrollArea className="flex-1">
            <ul role="list" className="divide-y divide-border/50">
              {bookmarks.map(bookmark => {
                const chapterTitle =
                  chapters[bookmark.chapterIndex]?.title ?? `Chapter ${bookmark.chapterIndex + 1}`

                return (
                  <li key={bookmark.id} className="flex items-start gap-2 px-4 py-3">
                    {/* Seek target area */}
                    <button
                      onClick={() => handleSeek(bookmark)}
                      className="flex flex-1 flex-col gap-0.5 text-left hover:text-brand transition-colors min-h-[44px] justify-center"
                      aria-label={`Go to ${chapterTitle} at ${formatAudioTime(bookmark.timestamp)}`}
                    >
                      <span className="text-xs font-medium text-muted-foreground truncate">
                        {chapterTitle} · {formatAudioTime(bookmark.timestamp)}
                      </span>
                      {bookmark.note && (
                        <span className="text-sm text-foreground line-clamp-2">
                          {bookmark.note}
                        </span>
                      )}
                    </button>

                    {/* Delete */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="flex-shrink-0 size-8 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(bookmark.id)}
                      aria-label="Delete bookmark"
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </Button>
                  </li>
                )
              })}
            </ul>
          </ScrollArea>
        )}
      </SheetContent>
    </Sheet>
  )
}
