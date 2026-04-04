import { useState, useEffect, useMemo, useCallback } from 'react'
import { Link } from 'react-router'
import { History, ChevronDown, ChevronUp, X } from 'lucide-react'
import { db } from '@/db'
import { cn } from '@/app/components/ui/utils'
import { EmptyState } from '@/app/components/EmptyState'
import { Skeleton } from '@/app/components/ui/skeleton'
import { DelayedFallback } from '@/app/components/DelayedFallback'
import { TrendIndicator } from '@/app/components/session/TrendIndicator'
import { calculateQualityTrend, getQualityTier } from '@/lib/qualityScore'
import type { StudySession, ImportedCourse, ImportedVideo } from '@/data/types'

// Extended session type that includes denormalized display fields
// (may be present when seeded directly, otherwise resolved from related tables)
interface DisplaySession extends StudySession {
  courseTitle?: string
  contentSummary?: string
  contentItems?: Array<{ id: string; title: string; timestamp: number }>
}

const PAGE_SIZE = 20

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

function formatTime(timestamp: string | number): string {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function formatDate(timestamp: string | number): string {
  const date = new Date(timestamp)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function toDate(timestamp: string | number): Date {
  return new Date(timestamp)
}

function QualityBadge({ score }: { score?: number }) {
  if (score == null) {
    return <span className="text-xs text-muted-foreground">—</span>
  }
  const tier = getQualityTier(score)
  const colorClasses =
    tier === 'excellent' || tier === 'good'
      ? 'bg-success-soft text-success'
      : tier === 'fair'
        ? 'bg-gold-muted text-warning'
        : 'bg-destructive/15 text-destructive'

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium tabular-nums',
        colorClasses
      )}
      data-testid="session-quality-score"
      aria-label={`Quality score: ${score}`}
    >
      {score}
    </span>
  )
}

export function SessionHistory() {
  const [sessions, setSessions] = useState<DisplaySession[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [courseFilter, setCourseFilter] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  // Load sessions and resolve display names
  useEffect(() => {
    let ignore = false

    async function load() {
      setIsLoading(true)
      setLoadError(null)
      try {
        const allSessions = (await db.studySessions.toArray()) as DisplaySession[]

        // Only show completed sessions (with endTime)
        const completed = allSessions.filter(s => s.endTime != null)

        // Collect unique courseIds referenced by sessions
        const courseIds = [...new Set(completed.map(s => s.courseId))]

        // Only fetch courses and videos referenced by sessions
        const courses =
          courseIds.length > 0
            ? await db.importedCourses.where('id').anyOf(courseIds).toArray()
            : []
        const videoIds = completed.flatMap(s => s.videosWatched ?? [])
        const videos =
          videoIds.length > 0 ? await db.importedVideos.where('id').anyOf(videoIds).toArray() : []

        const courseMap = new Map<string, ImportedCourse>(courses.map(c => [c.id, c]))
        const videoMap = new Map<string, ImportedVideo>(videos.map(v => [v.id, v]))

        // Create enriched copies (don't mutate Dexie results)
        const enriched = completed.map(session => {
          const courseTitle = session.courseTitle || courseMap.get(session.courseId)?.name
          const contentSummary =
            session.contentSummary ||
            ((session.videosWatched?.length ?? 0) > 0
              ? session.videosWatched!.map(vid => videoMap.get(vid)?.filename ?? vid).join(', ')
              : undefined)
          return { ...session, courseTitle, contentSummary }
        })

        // Sort reverse chronological
        enriched.sort((a, b) => toDate(b.startTime).getTime() - toDate(a.startTime).getTime())

        if (!ignore) {
          setSessions(enriched)
        }
      } catch (error) {
        // silent-catch-ok: error logged to console
        console.error('[SessionHistory] Failed to load sessions:', error)
        if (!ignore) {
          setLoadError('Failed to load study sessions. Please try refreshing the page.')
        }
      } finally {
        if (!ignore) {
          setIsLoading(false)
        }
      }
    }

    load()

    return () => {
      ignore = true
    }
  }, [])

  // Unique courses for filter dropdown
  const courseOptions = useMemo(() => {
    const seen = new Map<string, string>()
    for (const s of sessions) {
      if (!seen.has(s.courseId)) {
        seen.set(s.courseId, s.courseTitle || s.courseId)
      }
    }
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }))
  }, [sessions])

  // Apply filters
  const filteredSessions = useMemo(() => {
    let result = sessions

    if (courseFilter) {
      result = result.filter(s => s.courseId === courseFilter)
    }

    if (startDate) {
      const start = new Date(startDate + 'T00:00:00')
      result = result.filter(s => toDate(s.startTime) >= start)
    }

    if (endDate) {
      const end = new Date(endDate + 'T23:59:59.999')
      result = result.filter(s => toDate(s.startTime) <= end)
    }

    return result
  }, [sessions, courseFilter, startDate, endDate])

  // Quality trend scoped to filtered sessions (respects course/date filters)
  const qualityTrend = useMemo(() => {
    const scores = filteredSessions.filter(s => s.qualityScore != null).map(s => s.qualityScore!)
    return calculateQualityTrend(scores)
  }, [filteredSessions])

  const hasQualityScores = sessions.some(s => s.qualityScore != null)

  // Paginated slice
  const visibleSessions = filteredSessions.slice(0, visibleCount)
  const hasMore = visibleCount < filteredSessions.length
  const hasActiveFilters = !!(courseFilter || startDate || endDate)

  const handleClearFilters = useCallback(() => {
    setCourseFilter('')
    setStartDate('')
    setEndDate('')
  }, [])

  const handleShowMore = useCallback(() => {
    setVisibleCount(prev => prev + PAGE_SIZE)
  }, [])

  // Reset visible count when filters change
  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [courseFilter, startDate, endDate])

  if (isLoading) {
    return (
      <DelayedFallback>
        <div className="space-y-6" aria-busy="true" aria-label="Loading study sessions">
          <Skeleton className="h-8 w-64" />
          <div className="flex flex-wrap gap-4">
            <Skeleton className="h-10 w-40" />
            <Skeleton className="h-10 w-36" />
            <Skeleton className="h-10 w-36" />
          </div>
          <div className="space-y-3">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-2xl" />
            ))}
          </div>
        </div>
      </DelayedFallback>
    )
  }

  if (loadError) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Study Session History</h1>
        <div className="rounded-2xl border border-destructive/50 bg-destructive/10 p-8 text-center">
          <p className="text-sm text-destructive">{loadError}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Study Session History</h1>
        {hasQualityScores && <TrendIndicator trend={qualityTrend} />}
      </div>

      {sessions.length === 0 ? (
        <EmptyState
          icon={History}
          title="No Study Sessions Yet"
          description="Start learning to see your study history here"
          actionLabel="Browse Courses"
          actionHref="/courses"
        />
      ) : (
        <>
          {/* Filters */}
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1">
              <label htmlFor="course-filter" className="text-sm font-medium">
                Filter by course
              </label>
              <select
                id="course-filter"
                value={courseFilter}
                onChange={e => setCourseFilter(e.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="">All Courses</option>
                {courseOptions.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {hasActiveFilters && (
              <button
                onClick={handleClearFilters}
                className="flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent"
              >
                <X className="size-3" />
                Clear filters
              </button>
            )}

            <div className="flex flex-col gap-1">
              <label htmlFor="start-date" className="text-sm font-medium">
                Start date
              </label>
              <input
                id="start-date"
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="end-date" className="text-sm font-medium">
                End date
              </label>
              <input
                id="end-date"
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>

          {/* Live region for filter result announcements */}
          <span role="status" aria-live="polite" className="sr-only">
            {hasActiveFilters
              ? `${filteredSessions.length} ${filteredSessions.length === 1 ? 'session' : 'sessions'} found`
              : ''}
          </span>

          {/* Session List */}
          <ul className="space-y-3" data-testid="session-history" aria-label="Study sessions">
            {visibleSessions.map(session => (
              <li
                key={session.id}
                data-testid="session-row"
                className="list-none rounded-2xl border border-border bg-card transition-colors hover:bg-accent/50"
              >
                {/* Clickable header — native button for a11y */}
                <button
                  onClick={() => setExpandedId(prev => (prev === session.id ? null : session.id))}
                  aria-expanded={expandedId === session.id}
                  aria-controls={`session-detail-${session.id}`}
                  aria-label={`${session.courseTitle || session.courseId} — ${formatDate(session.startTime)}, ${formatDuration(session.duration)}`}
                  className="w-full cursor-pointer p-4 text-left"
                >
                  <div className="flex w-full items-center justify-between">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
                      <span className="text-sm text-muted-foreground" data-testid="session-date">
                        {formatDate(session.startTime)}
                      </span>
                      <span className="font-semibold" data-testid="session-course-name">
                        {session.courseTitle || session.courseId}
                      </span>
                      <span
                        className="text-sm font-medium text-brand"
                        data-testid="session-duration"
                      >
                        {formatDuration(session.duration)}
                      </span>
                      <QualityBadge score={session.qualityScore} />
                    </div>
                    {expandedId === session.id ? (
                      <ChevronUp className="size-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="size-4 text-muted-foreground" />
                    )}
                  </div>

                  {/* Content summary (hidden when expanded to avoid duplicate text) */}
                  {session.contentSummary && expandedId !== session.id && (
                    <p className="mt-1 text-sm text-muted-foreground">{session.contentSummary}</p>
                  )}
                </button>

                {/* Expanded details — outside the button to avoid nested interactive elements */}
                {expandedId === session.id && (
                  <div
                    id={`session-detail-${session.id}`}
                    className="border-t border-border px-4 pb-4 pt-4 space-y-3"
                  >
                    <div className="flex gap-[var(--content-gap)] text-sm">
                      <div>
                        <span className="text-muted-foreground">Start: </span>
                        <span data-testid="session-start-time">
                          {formatTime(session.startTime)}
                        </span>
                      </div>
                      {session.endTime && (
                        <div>
                          <span className="text-muted-foreground">End: </span>
                          <span data-testid="session-end-time">{formatTime(session.endTime)}</span>
                        </div>
                      )}
                    </div>

                    {/* Content items */}
                    {session.contentItems && session.contentItems.length > 0 && (
                      <div className="space-y-1">
                        <h4 className="text-sm font-medium">Content Accessed</h4>
                        <ul className="space-y-1">
                          {session.contentItems.map(item => (
                            <li
                              key={item.id}
                              className="flex items-center gap-2 text-sm text-muted-foreground"
                            >
                              <span>{item.title}</span>
                              <span className="text-xs text-muted-foreground/70">
                                {toDate(item.timestamp).toLocaleTimeString('en-US', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  hour12: false,
                                })}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Videos watched (from real sessions without contentItems) */}
                    {!session.contentItems && (session.videosWatched?.length ?? 0) > 0 && (
                      <div className="space-y-1">
                        <h4 className="text-sm font-medium">Videos Watched</h4>
                        <ul className="space-y-1">
                          {session.videosWatched!.map(vid => (
                            <li key={vid} className="text-sm text-muted-foreground">
                              {vid}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <Link
                      to={`/courses/${session.courseId}`}
                      className="inline-flex items-center text-sm font-medium text-brand hover:underline"
                    >
                      Resume Course
                    </Link>
                  </div>
                )}
              </li>
            ))}

            {/* Filtered empty state */}
            {filteredSessions.length === 0 && hasActiveFilters && (
              <li className="list-none" data-testid="empty-state-filtered-sessions">
                <EmptyState
                  icon={History}
                  headingLevel={3}
                  title="No sessions match your filters"
                  description="Try adjusting your filters to find what you're looking for."
                  actionLabel="Clear all filters"
                  onAction={handleClearFilters}
                />
              </li>
            )}
          </ul>

          {/* Show more */}
          {hasMore && (
            <div className="flex justify-center">
              <button
                onClick={handleShowMore}
                className="rounded-xl border border-border px-6 py-2 text-sm font-medium hover:bg-accent"
              >
                Show more
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
