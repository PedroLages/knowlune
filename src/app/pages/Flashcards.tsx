// eslint-disable-next-line component-size/max-lines -- page orchestrator: manages flashcard review phases (loading, dashboard, reviewing, summary) and book back-navigation
import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { Link } from 'react-router'
import { motion } from 'motion/react'
import {
  Layers,
  CheckCircle2,
  RotateCcw,
  ChevronRight,
  CalendarDays,
  BookOpen,
  WifiOff,
} from 'lucide-react'
import { useFlashcardStore } from '@/stores/useFlashcardStore'
import { useCourseStore } from '@/stores/useCourseStore'
import { useCourseImportStore } from '@/stores/useCourseImportStore'
import { useBookStore } from '@/stores/useBookStore'
import { FlashcardReviewCard } from '@/app/components/figma/FlashcardReviewCard'
import type { FlashcardSourceLink } from '@/app/components/figma/FlashcardReviewCard'
import { Button } from '@/app/components/ui/button'
import { Card, CardContent } from '@/app/components/ui/card'
import { Progress } from '@/app/components/ui/progress'
import { Badge } from '@/app/components/ui/badge'
import { Skeleton } from '@/app/components/ui/skeleton'
import {
  Empty,
  EmptyMedia,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from '@/app/components/ui/empty'
import { cn } from '@/app/components/ui/utils'
import { useOnlineStatus } from '@/app/hooks/useOnlineStatus'
import { fadeUp, scaleIn, staggerContainer } from '@/lib/motion'
import type { ReviewRating } from '@/data/types'
import { toast } from 'sonner'
import type { FlashcardSessionSummary } from '@/stores/useFlashcardStore'
import { dispatchFocusRequest, dispatchFocusRelease } from '@/lib/focusModeEvents'
import { getSettings } from '@/lib/settings'

type FlashcardPhase = 'loading' | 'dashboard' | 'reviewing' | 'summary'

interface FlashcardsProps {
  courseId?: string
}

function formatNextReviewDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  const date = new Date(dateStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  if (date < tomorrow) return 'Tomorrow'
  const diff = Math.ceil((date.getTime() - today.getTime()) / 86400000)
  if (diff <= 7) return `In ${diff} days`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** Group flashcards by upcoming review day (next 7 days) */
function getUpcomingSchedule(
  flashcards: ReturnType<typeof useFlashcardStore.getState>['flashcards'],
  now: Date
): Array<{ label: string; count: number }> {
  const schedule: Record<string, number> = {}
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)

  for (const card of flashcards) {
    if (!card.last_review) continue // Only show upcoming for cards that have been reviewed
    const reviewDate = new Date(card.due)
    reviewDate.setHours(0, 0, 0, 0)
    const diffDays = Math.round((reviewDate.getTime() - today.getTime()) / 86400000)
    if (diffDays >= 1 && diffDays <= 7) {
      const key = reviewDate.toLocaleDateString('sv-SE')
      schedule[key] = (schedule[key] ?? 0) + 1
    }
  }

  return Object.entries(schedule)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateStr, count]) => ({
      label: formatNextReviewDate(dateStr),
      count,
    }))
}

export function Flashcards({ courseId }: FlashcardsProps = {}) {
  const [phase, setPhase] = useState<FlashcardPhase>('loading')
  const [isFlipped, setIsFlipped] = useState(false)
  const [isRating, setIsRating] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [summary, setSummary] = useState<FlashcardSessionSummary | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const now = useMemo(() => new Date(), [phase])
  const isOnline = useOnlineStatus()

  const {
    flashcards,
    isLoading,
    loadFlashcards,
    reviewQueue,
    reviewIndex,
    startReviewSession,
    rateFlashcard,
    getSessionSummary,
    resetReviewSession,
    getDueFlashcards,
    getStats,
  } = useFlashcardStore()

  const allCourses = useCourseStore(s => s.courses)
  const { importedCourses, loadImportedCourses } = useCourseImportStore()
  const allBooks = useBookStore(s => s.books)

  // Build course name lookup
  const courseNameMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const c of allCourses) map.set(c.id, c.title)
    for (const c of importedCourses) map.set(c.id, c.name)
    return map
  }, [allCourses, importedCourses])

  const isCourseScoped = courseId !== undefined
  const courseName = courseId ? (courseNameMap.get(courseId) ?? 'Unknown Course') : null
  const visibleFlashcards = useMemo(
    () =>
      courseId === undefined ? flashcards : flashcards.filter(card => card.courseId === courseId),
    [flashcards, courseId]
  )
  const courseDecks = useMemo(() => {
    if (isCourseScoped) return []

    const grouped = new Map<string, { courseId: string; total: number }>()
    for (const card of flashcards) {
      const key = card.courseId ?? ''
      const existing = grouped.get(key)
      if (existing) {
        existing.total += 1
      } else {
        grouped.set(key, { courseId: key, total: 1 })
      }
    }

    return [...grouped.values()]
      .map(deck => ({
        ...deck,
        name: deck.courseId
          ? (courseNameMap.get(deck.courseId) ?? 'Unknown Course')
          : 'Unknown Course',
        due: getDueFlashcards(now, deck.courseId).length,
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [isCourseScoped, flashcards, courseNameMap, getDueFlashcards, now])

  // Initial data load
  const handleLoadFlashcards = useCallback(async () => {
    setLoadError(null)
    try {
      await loadFlashcards()
      await loadImportedCourses()
    } catch (err) {
      console.error('[Flashcards] Failed to load flashcards:', err)
      const message = isOnline
        ? 'Failed to load flashcards. Please try again.'
        : "You're offline. Please check your connection and try again."
      setLoadError(message)
      toast.error(message)
    }
  }, [loadFlashcards, loadImportedCourses, isOnline])

  useEffect(() => {
    void handleLoadFlashcards()
  }, [handleLoadFlashcards])

  // Transition from loading to dashboard once data arrives
  useEffect(() => {
    if (!isLoading && phase === 'loading') {
      setPhase('dashboard')
    }
  }, [isLoading, phase])

  // Cleanup session on unmount
  useEffect(() => {
    return () => {
      resetReviewSession()
    }
  }, [resetReviewSession])

  // Release focus mode on unmount to prevent stuck focus state (E65-S04)
  useEffect(() => {
    return () => {
      dispatchFocusRelease()
    }
  }, [])

  const handleStartReview = useCallback(() => {
    startReviewSession(now, courseId)
    setIsFlipped(false)
    setPhase('reviewing')

    // Auto-activate focus mode if enabled (E65-S04)
    const settings = getSettings()
    if (settings.focusAutoFlashcard !== false) {
      requestAnimationFrame(() => {
        dispatchFocusRequest('flashcard-review', 'flashcard')
      })
    }
  }, [startReviewSession, now, courseId])

  const handleFlip = useCallback(() => {
    setIsFlipped(true)
  }, [])

  const handleRate = useCallback(
    async (rating: ReviewRating) => {
      setIsRating(true)
      try {
        await rateFlashcard(rating, now)
        setIsFlipped(false)

        // Check if session is complete
        const { reviewIndex: nextIndex, reviewQueue: queue } = useFlashcardStore.getState()
        if (nextIndex >= queue.length) {
          const sessionSummary = getSessionSummary(courseId)
          setSummary(sessionSummary)
          setPhase('summary')
          dispatchFocusRelease()
        } else {
          // Focus the card front after flip animation (500ms)
          setTimeout(() => {
            cardRef.current?.querySelector<HTMLElement>('[data-testid="flashcard-front"]')?.focus()
          }, 500)
        }
      } catch {
        toast.error('Failed to save your rating. Please try again.')
      } finally {
        setIsRating(false)
      }
    },
    [rateFlashcard, getSessionSummary, now, courseId]
  )

  const handleBackToDashboard = useCallback(() => {
    resetReviewSession()
    setSummary(null)
    setPhase('dashboard')
    dispatchFocusRelease()
  }, [resetReviewSession])

  const handleReviewMore = useCallback(() => {
    const due = getDueFlashcards(now, courseId)
    if (due.length > 0) {
      handleStartReview()
    } else {
      handleBackToDashboard()
    }
  }, [getDueFlashcards, now, courseId, handleStartReview, handleBackToDashboard])

  // Keyboard shortcuts during review
  useEffect(() => {
    if (phase !== 'reviewing') return

    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      if (target.closest('[role="dialog"]')) return

      if (!isFlipped && (e.key === ' ' || e.key === 'Enter')) {
        if (
          target.closest('[data-testid="flashcard-front"]') ||
          target === document.body ||
          target.tagName === 'MAIN'
        ) {
          e.preventDefault()
          setIsFlipped(true)
        }
      }

      if (isFlipped && !isRating) {
        const ratingKeys: Record<string, ReviewRating> = {
          '1': 'again',
          '2': 'hard',
          '3': 'good',
          '4': 'easy',
        }
        const rating = ratingKeys[e.key]
        if (rating) {
          e.preventDefault()
          void handleRate(rating)
        }
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [phase, isFlipped, isRating, handleRate])

  // ── Loading skeleton ──
  if (phase === 'loading' && !loadError) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 p-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-24 rounded-[16px]" />
          <Skeleton className="h-24 rounded-[16px]" />
          <Skeleton className="h-24 rounded-[16px]" />
        </div>
      </div>
    )
  }

  // ── Error state ──
  if (loadError) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 p-6">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-brand-soft text-brand-soft-foreground">
            <Layers className="size-5" />
          </div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Flashcards</h1>
        </div>
        <div className="rounded-2xl border border-destructive/50 bg-destructive/10 p-8 text-center">
          {!isOnline && (
            <WifiOff className="mx-auto mb-3 size-6 text-destructive" aria-hidden="true" />
          )}
          <p className="text-sm text-destructive">{loadError}</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={handleLoadFlashcards}>
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  const stats = getStats(now, courseId)
  const currentCard = reviewQueue[reviewIndex]
  const currentCourseName =
    (currentCard && courseNameMap.get(currentCard.courseId)) ?? 'Unknown Course'

  // Compute back-navigation source link for book-sourced flashcards (E85-S05)
  // BookReader resolves sourceHighlightId → cfiRange via Dexie on open
  const currentCardSourceLink: FlashcardSourceLink | undefined = (() => {
    if (!currentCard || currentCard.sourceType !== 'book') return undefined
    const sourceBook = allBooks.find(b => b.id === currentCard.sourceBookId)
    if (!sourceBook) return 'deleted'
    const params = new URLSearchParams()
    if (currentCard.sourceHighlightId) {
      params.set('sourceHighlightId', currentCard.sourceHighlightId)
    }
    const href = `/library/${sourceBook.id}/read?${params.toString()}`
    return { href, label: `View in "${sourceBook.title}"` }
  })()

  // ── Dashboard phase ──
  if (phase === 'dashboard') {
    const upcomingSchedule = getUpcomingSchedule(visibleFlashcards, now)

    if (visibleFlashcards.length === 0) {
      return (
        <div className="flex min-h-[60vh] items-center justify-center px-6">
          <Empty>
            <EmptyMedia>
              <Layers className="size-8 text-muted-foreground" />
            </EmptyMedia>
            <EmptyHeader>
              <EmptyTitle>
                {isCourseScoped
                  ? `No flashcards for ${courseName ?? 'this course'} yet`
                  : 'No flashcards yet'}
              </EmptyTitle>
              <EmptyDescription>
                {isCourseScoped ? (
                  <>
                    Create flashcards from notes in this course, then return here to review this
                    deck.
                  </>
                ) : (
                  <>
                    Select text in your notes and click the{' '}
                    <span className="inline-flex items-center gap-1 font-medium">
                      <Layers className="size-3.5" /> flashcard
                    </span>{' '}
                    icon to create your first card.
                  </>
                )}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      )
    }

    return (
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="mx-auto max-w-2xl space-y-6 p-6"
      >
        {/* Page header */}
        <motion.div variants={fadeUp} className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-brand-soft text-brand-soft-foreground">
            <Layers className="size-5" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">Flashcards</h1>
            <p className="text-sm text-muted-foreground">
              {courseName ? `${courseName} deck` : 'Spaced repetition review'}
            </p>
          </div>
        </motion.div>

        {/* Stats grid */}
        <motion.div variants={fadeUp} className="grid grid-cols-3 gap-4">
          <StatCard label="Total Cards" value={stats.total} data-testid="flashcard-stats-total" />
          <StatCard
            label="Due Today"
            value={stats.dueToday}
            highlight={stats.dueToday > 0}
            data-testid="flashcard-stats-due"
          />
          <StatCard
            label="Next Review"
            value={formatNextReviewDate(stats.nextReviewDate)}
            data-testid="flashcard-stats-next"
          />
        </motion.div>

        {/* Start Review CTA */}
        {stats.dueToday > 0 && (
          <motion.div variants={fadeUp}>
            <Button
              variant="brand"
              size="lg"
              className="w-full"
              onClick={handleStartReview}
              data-testid="start-review-button"
            >
              Start Review
              <ChevronRight className="ml-1 size-4" />
            </Button>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              {stats.dueToday} card{stats.dueToday !== 1 ? 's' : ''} due for review
            </p>
          </motion.div>
        )}

        {/* Upcoming schedule */}
        {upcomingSchedule.length > 0 && (
          <motion.div variants={fadeUp}>
            <Card className="rounded-[20px]">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <CalendarDays className="size-4 text-muted-foreground" />
                  <h2 className="text-sm font-medium">Upcoming Reviews</h2>
                </div>
                <div className="space-y-2">
                  {upcomingSchedule.map(({ label, count }) => (
                    <div key={label} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{label}</span>
                      <Badge variant="secondary" className="tabular-nums">
                        {count} card{count !== 1 ? 's' : ''}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {!isCourseScoped && courseDecks.length > 0 && (
          <motion.div variants={fadeUp}>
            <Card className="rounded-[20px]" data-testid="course-decks-section">
              <CardContent className="p-5">
                <div className="mb-4 flex items-center gap-2">
                  <Layers className="size-4 text-muted-foreground" />
                  <h2 className="text-sm font-medium">Course Decks</h2>
                </div>
                <div className="space-y-2">
                  {courseDecks.map(deck => (
                    <div
                      key={deck.courseId || 'unknown-course'}
                      data-testid={`course-deck-card-${deck.courseId || 'unknown-course'}`}
                      className="flex items-center justify-between gap-3 rounded-xl border border-border/50 p-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{deck.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {deck.total} card{deck.total !== 1 ? 's' : ''} - {deck.due} due
                        </p>
                      </div>
                      {deck.courseId ? (
                        <Button asChild variant="ghost" size="sm" className="shrink-0">
                          <Link
                            to={`/courses/${deck.courseId}/flashcards`}
                            data-testid={`course-deck-link-${deck.courseId}`}
                          >
                            Open
                            <ChevronRight className="size-4" />
                          </Link>
                        </Button>
                      ) : (
                        <Badge variant="secondary" className="shrink-0">
                          Unassigned
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* No cards due state */}
        {stats.dueToday === 0 && (
          <motion.div variants={fadeUp}>
            <Card className="rounded-[20px]">
              <CardContent className="flex items-center gap-4 p-5">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-success-soft text-success">
                  <BookOpen className="size-5" />
                </div>
                <div>
                  <p className="text-sm font-medium">All caught up!</p>
                  <p className="text-xs text-muted-foreground">
                    Next review: {formatNextReviewDate(stats.nextReviewDate)}
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </motion.div>
    )
  }

  // ── Review phase ──
  if (phase === 'reviewing' && currentCard) {
    const progressPct =
      reviewQueue.length > 0 ? Math.round((reviewIndex / reviewQueue.length) * 100) : 0

    return (
      <div className="mx-auto max-w-2xl space-y-6 p-6" data-focus-target="flashcard">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={handleBackToDashboard}>
            ← Back
          </Button>
          <span className="text-sm tabular-nums text-muted-foreground">
            {reviewIndex + 1} / {reviewQueue.length}
          </span>
          <Button variant="ghost" size="sm" onClick={handleBackToDashboard}>
            End Session
          </Button>
        </div>

        {/* Progress bar */}
        <Progress value={progressPct} className="h-1.5" aria-label="Review session progress" />

        {/* Card */}
        <div ref={cardRef}>
          <FlashcardReviewCard
            flashcard={currentCard}
            courseName={currentCourseName}
            isFlipped={isFlipped}
            onFlip={handleFlip}
            onRate={rating => void handleRate(rating)}
            isRating={isRating}
            sourceLink={currentCardSourceLink}
          />
        </div>
      </div>
    )
  }

  // ── Summary phase ──
  if (phase === 'summary' && summary) {
    const totalRatings =
      summary.ratings.again + summary.ratings.hard + summary.ratings.good + summary.ratings.easy

    return (
      <div className="mx-auto max-w-lg p-6">
        <motion.div variants={scaleIn} initial="hidden" animate="visible">
          <Card className="rounded-2xl">
            <CardContent className="flex flex-col items-center gap-[var(--content-gap)] p-[var(--content-padding)]">
              {/* Header */}
              <div className="flex flex-col items-center gap-2 text-center">
                <div className="flex size-12 items-center justify-center rounded-full bg-success-soft text-success">
                  <CheckCircle2 className="size-6" />
                </div>
                <h2 className="font-display text-xl tracking-tight">Session Complete</h2>
                <p className="text-sm text-muted-foreground">
                  Great work reviewing your flashcards!
                </p>
              </div>

              {/* Stats grid */}
              <div className="grid w-full grid-cols-2 gap-4">
                <div className="rounded-xl bg-brand-soft p-4">
                  <p className="text-xs font-medium text-muted-foreground">Cards Reviewed</p>
                  <p
                    data-testid="summary-total-reviewed"
                    className="mt-1 text-2xl font-semibold tabular-nums text-foreground"
                  >
                    {summary.totalReviewed}
                  </p>
                </div>

                <div className="rounded-xl bg-muted/50 p-4">
                  <p className="text-xs font-medium text-muted-foreground">Next Review</p>
                  <p
                    data-testid="summary-next-review"
                    className="mt-1 text-sm font-semibold text-foreground"
                  >
                    {formatNextReviewDate(summary.nextReviewDate)}
                  </p>
                </div>

                {/* Ratings distribution */}
                <div className="col-span-2 rounded-xl bg-muted/50 p-4">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">
                    Rating Distribution
                  </p>
                  <div className="space-y-1.5">
                    <RatingBar
                      label="Again"
                      count={summary.ratings.again}
                      total={totalRatings}
                      className="bg-warning"
                      testId="rating-again-count"
                    />
                    <RatingBar
                      label="Hard"
                      count={summary.ratings.hard}
                      total={totalRatings}
                      className="bg-destructive/60"
                      testId="rating-hard-count"
                    />
                    <RatingBar
                      label="Good"
                      count={summary.ratings.good}
                      total={totalRatings}
                      className="bg-brand"
                      testId="rating-good-count"
                    />
                    <RatingBar
                      label="Easy"
                      count={summary.ratings.easy}
                      total={totalRatings}
                      className="bg-success"
                      testId="rating-easy-count"
                    />
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex w-full gap-3">
                <Button variant="outline" className="flex-1" onClick={handleBackToDashboard}>
                  Back to Dashboard
                </Button>
                <Button variant="brand" className="flex-1" onClick={handleReviewMore}>
                  <RotateCcw className="mr-2 size-4" />
                  Review More
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    )
  }

  // Fallback (empty queue reached while in reviewing phase)
  return null
}

function StatCard({
  label,
  value,
  highlight = false,
  'data-testid': testId,
}: {
  label: string
  value: string | number
  highlight?: boolean
  'data-testid'?: string
}) {
  return (
    <Card
      className={cn(
        'rounded-[16px] transition-colors',
        highlight && 'border-brand/30 bg-brand-soft'
      )}
    >
      <CardContent className="p-4">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p
          data-testid={testId}
          className={cn(
            'mt-1 text-2xl font-semibold tabular-nums',
            highlight ? 'text-brand-soft-foreground' : 'text-foreground'
          )}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  )
}

function RatingBar({
  label,
  count,
  total,
  className,
  testId,
}: {
  label: string
  count: number
  total: number
  className: string
  testId?: string
}) {
  const pct = total > 0 ? (count / total) * 100 : 0

  return (
    <div className="flex items-center gap-2">
      <span className="w-8 text-[10px] font-medium text-muted-foreground">{label}</span>
      <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className={cn('absolute inset-y-0 left-0 rounded-full transition-all', className)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span
        data-testid={testId}
        className="w-4 text-right text-[10px] tabular-nums text-muted-foreground"
      >
        {count}
      </span>
    </div>
  )
}
