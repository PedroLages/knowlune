import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { BookOpen, Clock, Trophy } from 'lucide-react'
import { db } from '@/db/schema'
import { formatReadingTime } from '@/services/ReadingStatsService'
import { DailyGoalRing } from '@/app/components/library/DailyGoalRing'
import { Skeleton } from '@/app/components/ui/skeleton'

interface CurrentlyReading {
  bookId: string
  title: string
  author?: string
  coverUrl?: string
  progress: number
}

interface RecentSession {
  id: string
  bookId: string
  bookTitle: string
  duration: number
  startTime: string
}

export function ReadingOverviewSection() {
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(true)
  const [currentlyReading, setCurrentlyReading] = useState<CurrentlyReading | null>(null)
  const [booksFinishedThisYear, setBooksFinishedThisYear] = useState(0)
  const [totalReadingMinutes, setTotalReadingMinutes] = useState(0)
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([])

  useEffect(() => {
    let cancelled = false

    async function loadData() {
      try {
        // Currently reading: most recent unfinished book (uses indexed status field)
        const inProgressBooks = await db.books
          .where('status')
          .equals('reading')
          .filter(b => b.progress >= 1 && b.progress <= 99)
          .toArray()

        inProgressBooks.sort(
          (a, b) => (b.lastOpenedAt ?? '').localeCompare(a.lastOpenedAt ?? '')
        )

        const current = inProgressBooks[0] ?? null

        // Books finished this year
        const thisYear = new Date().getFullYear()
        const finishedBooks = await db.books
          .where('status')
          .equals('finished')
          .filter(b => b.finishedAt ? new Date(b.finishedAt).getFullYear() === thisYear : false)
          .count()

        // Total reading time from Dexie sessions
        const bookSessions = await db.studySessions
          .where('courseId')
          .equals('')
          .toArray()
        const totalSeconds = bookSessions.reduce((sum, s) => sum + (s.duration || 0), 0)

        // Recent 5 sessions with book titles
        bookSessions.sort(
          (a, b) => (b.startTime ?? '').localeCompare(a.startTime ?? '')
        )
        const recent = bookSessions.slice(0, 5)

        const recentWithTitles: RecentSession[] = recent.map(session => ({
          id: session.id,
          bookId: session.contentItemId || '',
          bookTitle: '...',
          duration: session.duration || 0,
          startTime: session.startTime || '',
        }))

        // Batch-resolve book titles
        const bookIds = [...new Set(recent.map(s => s.contentItemId).filter(Boolean) as string[])]
        if (bookIds.length > 0) {
          const books = await db.books.bulkGet(bookIds)
          const titleMap = new Map<string, string>()
          for (let i = 0; i < bookIds.length; i++) {
            if (books[i]) titleMap.set(bookIds[i], books[i]!.title)
          }
          for (const item of recentWithTitles) {
            if (item.bookId) {
              item.bookTitle = titleMap.get(item.bookId) ?? 'Unknown Book'
            }
          }
        }

        if (!cancelled) {
          setCurrentlyReading(current ? {
            bookId: current.id,
            title: current.title,
            author: current.author,
            coverUrl: current.coverUrl,
            progress: current.progress,
          } : null)
          setBooksFinishedThisYear(finishedBooks)
          setTotalReadingMinutes(Math.round(totalSeconds / 60))
          setRecentSessions(recentWithTitles)
          setIsLoading(false)
        }
      } catch (err) {
        if (!cancelled) {
          console.error('[ReadingOverviewSection] Failed to load reading data:', err)
          setIsLoading(false)
        }
      }
    }

    loadData()

    return () => {
      cancelled = true
    }
  }, [])

  // Hide section for users with no reading activity
  if (!isLoading && !currentlyReading && booksFinishedThisYear === 0 && recentSessions.length === 0) {
    return null
  }

  // Hide during loading to prevent flash
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-3">
          <BookOpen className="w-5 h-5 text-muted-foreground" />
          <Skeleton className="h-6 w-40" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
        </div>
      </div>
    )
  }

  const formatRelativeTime = (isoString: string): string => {
    const diff = Date.now() - new Date(isoString).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    if (mins < 60) return `${mins}m`
    const hrs = Math.floor(mins / 60)
    return `${hrs}h ${mins % 60}m`
  }

  return (
    <div className="space-y-4">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-brand" />
          <h2 className="text-lg font-semibold">Reading</h2>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Currently Reading Card */}
        {currentlyReading && (
          <button
            type="button"
            className="group relative flex items-center gap-4 p-4 rounded-2xl bg-card border border-border hover:border-brand/40 transition-colors text-left"
            onClick={() => navigate(`/library/${currentlyReading.bookId}/read`)}
            aria-label={`Continue reading ${currentlyReading.title}`}
          >
            <div className="w-12 h-16 rounded-lg bg-brand-soft flex items-center justify-center flex-shrink-0 overflow-hidden">
              {currentlyReading.coverUrl ? (
                <img
                  src={currentlyReading.coverUrl}
                  alt=""
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <span className="text-brand text-lg font-semibold">
                  {currentlyReading.title.charAt(0)}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground mb-0.5">Currently Reading</p>
              <p className="text-sm font-medium truncate">{currentlyReading.title}</p>
              {currentlyReading.author && (
                <p className="text-xs text-muted-foreground truncate">{currentlyReading.author}</p>
              )}
              <div className="mt-2 w-full h-1 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand rounded-full transition-all duration-500"
                  style={{ width: `${currentlyReading.progress}%` }}
                />
              </div>
            </div>
          </button>
        )}

        {/* Reading Stats */}
        <div className="flex items-center gap-4 p-4 rounded-2xl bg-card border border-border">
          <div className="w-10 h-10 rounded-full bg-brand-soft flex items-center justify-center flex-shrink-0">
            <Trophy className="w-5 h-5 text-brand" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Books Finished</p>
            <p className="text-2xl font-bold tabular-nums">{booksFinishedThisYear}</p>
            <p className="text-xs text-muted-foreground">this year</p>
          </div>
        </div>

        {/* Reading Goal Ring */}
        <div className="flex items-center gap-4 p-4 rounded-2xl bg-card border border-border">
          <DailyGoalRing className="w-14 h-14" />
          <div>
            <p className="text-xs text-muted-foreground">Daily Reading Goal</p>
            <p className="text-lg font-semibold">{formatReadingTime(totalReadingMinutes)} total</p>
          </div>
        </div>
      </div>

      {/* Recent Reading Sessions */}
      {recentSessions.length > 0 && (
        <div className="rounded-2xl bg-card border border-border p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Recent Reading Sessions</h3>
          </div>
          <div className="space-y-3">
            {recentSessions.map(session => (
              <div
                key={session.id}
                className="flex items-center justify-between"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{session.bookTitle}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDuration(session.duration)} &middot; {formatRelativeTime(session.startTime)}
                  </p>
                </div>
                {session.bookId && (
                  <button
                    type="button"
                    className="text-xs text-brand hover:text-brand-hover ml-2 flex-shrink-0"
                    onClick={() => navigate(`/library/${session.bookId}/read`)}
                  >
                    Resume
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
