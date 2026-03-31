/**
 * LessonBookmarksTab — Bookmark CRUD sub-panel for PlayerSidePanel.
 *
 * Extracted from PlayerSidePanel.tsx to reduce god-component complexity.
 */

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { Trash2, BookmarkIcon, BookmarkPlus, AlertTriangle } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { EmptyState } from '@/app/components/EmptyState'
import {
  getLessonBookmarks,
  deleteBookmark,
  addBookmark,
  formatBookmarkTimestamp,
} from '@/lib/bookmarks'
import { toastWithUndo, toastError } from '@/lib/toastHelpers'
import type { VideoBookmark } from '@/data/types'

export interface LessonBookmarksTabProps {
  courseId: string
  lessonId: string
  /** Callback to seek the video to a specific time */
  onSeek?: (time: number) => void
  /** Current video playback time in seconds */
  currentTime?: number
  /** Whether the current lesson is a PDF (hides Add Bookmark button) */
  isPdf?: boolean
}

export function LessonBookmarksTab({
  courseId,
  lessonId,
  onSeek,
  currentTime,
  isPdf,
}: LessonBookmarksTabProps) {
  const [bookmarks, setBookmarks] = useState<VideoBookmark[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadBookmarks = useCallback(() => {
    let ignore = false
    setIsLoading(true)

    getLessonBookmarks(courseId, lessonId)
      .then(bm => {
        if (!ignore) {
          setBookmarks(bm)
          setIsLoading(false)
        }
      })
      .catch(() => {
        // silent-catch-ok — error state handled by component
        if (!ignore) {
          setError('Failed to load bookmarks')
          setIsLoading(false)
        }
      })

    return () => {
      ignore = true
    }
  }, [courseId, lessonId])

  useEffect(() => {
    return loadBookmarks()
  }, [loadBookmarks])

  const handleAddBookmark = useCallback(async () => {
    const time = currentTime ?? 0
    const timestamp = Math.floor(time)

    // Optimistic UI: insert in chronological order
    const optimisticBookmark: VideoBookmark = {
      id: crypto.randomUUID(),
      courseId,
      lessonId,
      timestamp,
      label: formatBookmarkTimestamp(timestamp),
      createdAt: new Date().toISOString(),
    }

    setBookmarks(prev => {
      const next = [...prev, optimisticBookmark]
      next.sort((a, b) => a.timestamp - b.timestamp)
      return next
    })

    toast.success(`Bookmarked at ${formatBookmarkTimestamp(timestamp)}`)

    try {
      await addBookmark(courseId, lessonId, time)
      // Refresh from DB to get the real ID
      const fresh = await getLessonBookmarks(courseId, lessonId)
      setBookmarks(fresh)
    } catch {
      // Revert optimistic update
      setBookmarks(prev => prev.filter(b => b.id !== optimisticBookmark.id))
      toast.error('Failed to add bookmark')
    }
  }, [courseId, lessonId, currentTime])

  const handleDelete = async (bookmark: VideoBookmark) => {
    const bookmarkBackup = { ...bookmark }

    try {
      setBookmarks(prev => prev.filter(b => b.id !== bookmark.id))
      await deleteBookmark(bookmark.id)

      toastWithUndo({
        message: `Bookmark at ${formatBookmarkTimestamp(bookmark.timestamp)} deleted`,
        onUndo: async () => {
          await addBookmark(
            bookmarkBackup.courseId,
            bookmarkBackup.lessonId,
            bookmarkBackup.timestamp,
            bookmarkBackup.label
          )
          setBookmarks(prev => [...prev, bookmarkBackup])
          toast.success('Bookmark restored')
        },
        duration: 5000,
      })
    } catch {
      setBookmarks(prev => [...prev, bookmarkBackup])
      toastError.deleteFailed('bookmark')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
        Loading bookmarks...
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-destructive">
        <AlertTriangle className="mb-3 size-12 opacity-60" />
        <p>{error}</p>
        <p className="text-xs mt-1 text-muted-foreground">Try refreshing the page</p>
      </div>
    )
  }

  if (bookmarks.length === 0) {
    return (
      <div className="flex flex-col items-center">
        {!isPdf && (
          <div className="w-full p-2 pb-0">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={handleAddBookmark}
              aria-label="Add bookmark at current time"
              data-testid="add-bookmark-button"
            >
              <BookmarkPlus className="size-4 mr-2" aria-hidden="true" />
              Add Bookmark
            </Button>
          </div>
        )}
        <EmptyState
          icon={BookmarkIcon}
          title="No bookmarks yet"
          description="Bookmark moments in this video to find them later"
        />
      </div>
    )
  }

  return (
    <div className="space-y-2 p-2">
      {!isPdf && (
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={handleAddBookmark}
          aria-label="Add bookmark at current time"
          data-testid="add-bookmark-button"
        >
          <BookmarkPlus className="size-4 mr-2" aria-hidden="true" />
          Add Bookmark
        </Button>
      )}
      {bookmarks.map(bookmark => (
        <div
          key={bookmark.id}
          data-testid="bookmark-entry"
          className="group flex items-center gap-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
        >
          <button
            type="button"
            className="flex items-center gap-3 flex-1 min-w-0 p-3 cursor-pointer hover:text-brand transition-colors text-left"
            onClick={() => onSeek?.(bookmark.timestamp)}
            aria-label={`Seek to ${formatBookmarkTimestamp(bookmark.timestamp)}`}
          >
            <div className="shrink-0 w-14 h-9 rounded-lg bg-warning/10 flex items-center justify-center">
              <span className="text-xs font-mono font-semibold text-warning">
                {formatBookmarkTimestamp(bookmark.timestamp)}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {bookmark.label || formatBookmarkTimestamp(bookmark.timestamp)}
              </p>
              <p className="text-xs text-muted-foreground">
                {new Date(bookmark.createdAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}
              </p>
            </div>
          </button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-11 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 focus-visible:opacity-100 transition-opacity shrink-0 mr-1"
            onClick={() => handleDelete(bookmark)}
            aria-label="Delete bookmark"
          >
            <Trash2 className="size-4 text-muted-foreground hover:text-destructive" />
          </Button>
        </div>
      ))}
    </div>
  )
}
