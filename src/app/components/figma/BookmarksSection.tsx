import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { Trash2, Clock, AlertTriangle } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import {
  getAllBookmarks,
  deleteBookmark,
  addBookmark,
  formatBookmarkTimestamp,
} from '@/lib/bookmarks'
import { toastWithUndo, toastError } from '@/lib/toastHelpers'
import { useCourseStore } from '@/stores/useCourseStore'
import type { VideoBookmark, Course } from '@/data/types'

function findCourseAndLesson(
  courseId: string,
  lessonId: string,
  allCourses: Course[]
): { courseTitle: string; lessonTitle: string } {
  const course = allCourses.find(c => c.id === courseId)
  if (!course) return { courseTitle: courseId, lessonTitle: lessonId }
  const lesson = course.modules.flatMap(m => m.lessons).find(l => l.id === lessonId)
  return { courseTitle: course.shortTitle, lessonTitle: lesson?.title || lessonId }
}

export function BookmarksSection() {
  const allCourses = useCourseStore(s => s.courses)
  const navigate = useNavigate()
  const [bookmarks, setBookmarks] = useState<VideoBookmark[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let ignore = false

    getAllBookmarks()
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
  }, [])

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

  const handleBookmarkClick = (bookmark: VideoBookmark) => {
    navigate(`/courses/${bookmark.courseId}/${bookmark.lessonId}?t=${bookmark.timestamp}`)
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
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Clock className="mb-3 size-12 opacity-40" />
        <p>No bookmarks yet</p>
        <p className="text-xs mt-1">Bookmark important moments in videos to find them later</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {bookmarks.map(bookmark => {
        const { courseTitle, lessonTitle } = findCourseAndLesson(
          bookmark.courseId,
          bookmark.lessonId,
          allCourses
        )
        return (
          <div
            key={bookmark.id}
            data-testid="bookmark-entry"
            className="group flex items-center gap-3 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
          >
            <button
              type="button"
              className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg"
              onClick={() => handleBookmarkClick(bookmark)}
            >
              <div className="shrink-0 w-14 h-9 rounded-lg bg-warning/10 flex items-center justify-center">
                <span className="text-xs font-mono font-semibold text-warning">
                  {formatBookmarkTimestamp(bookmark.timestamp)}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{lessonTitle}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {courseTitle} &middot;{' '}
                  {new Date(bookmark.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
              </div>
            </button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-11 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 focus-visible:opacity-100 transition-opacity shrink-0"
              onClick={e => {
                e.stopPropagation()
                handleDelete(bookmark)
              }}
              aria-label="Delete bookmark"
            >
              <Trash2 className="size-4 text-muted-foreground hover:text-destructive" />
            </Button>
          </div>
        )
      })}
    </div>
  )
}
