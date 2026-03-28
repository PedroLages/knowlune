import { useEffect, useMemo, useCallback, useState, useRef } from 'react'
import { Link } from 'react-router'
import { RotateCcw, CalendarClock, Shuffle } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import { format } from 'date-fns'
import { useReviewStore } from '@/stores/useReviewStore'
import { useNoteStore } from '@/stores/useNoteStore'
import { isDue, predictRetention } from '@/lib/spacedRepetition'
import { staggerContainer, fadeUp } from '@/lib/motion'
import { ReviewCard } from '@/app/components/figma/ReviewCard'
import { DelayedFallback } from '@/app/components/DelayedFallback'
import { Skeleton } from '@/app/components/ui/skeleton'
import {
  Empty,
  EmptyMedia,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from '@/app/components/ui/empty'
import { useCourseStore } from '@/stores/useCourseStore'
import type { Note, ReviewRating } from '@/data/types'

export function ReviewQueue() {
  const allCourses = useCourseStore(s => s.courses)

  /** Map courseId → course title for display. */
  const courseNameMap = useMemo(() => new Map(allCourses.map(c => [c.id, c.title])), [allCourses])

  const getCourseName = useCallback(
    (courseId: string): string => courseNameMap.get(courseId) ?? 'Unknown Course',
    [courseNameMap]
  )
  const { allReviews, isLoading, loadReviews, rateNote } = useReviewStore()
  const { notes, loadNotes } = useNoteStore()

  // Refreshing time reference — ensures retention calculations stay current
  // during long review sessions. Updates every 60s so newly-due notes appear.
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(interval)
  }, [])

  const headingRef = useRef<HTMLHeadingElement>(null)
  const cardListRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadReviews().catch(err => {
      // silent-catch-ok — error state handled by store isLoading flag
      console.error(err)
    })
    loadNotes().catch(err => {
      // silent-catch-ok — error state handled by store isLoading flag
      console.error(err)
    })
  }, [loadReviews, loadNotes])

  // Derive due reviews from subscribed allReviews — this triggers re-renders
  // when rateNote updates allReviews via set(), unlike calling getDueReviews()
  // which is a store method outside React's subscription model
  const dueReviews = useMemo(
    () =>
      allReviews
        .filter(r => isDue(r, now))
        .sort((a, b) => predictRetention(a, now) - predictRetention(b, now)),
    [allReviews, now]
  )

  // Build noteId → Note lookup
  const noteMap = useMemo(() => {
    const map = new Map<string, Note>()
    for (const note of notes) {
      map.set(note.id, note)
    }
    return map
  }, [notes])

  // Filter out orphaned reviews (note deleted but review record remains)
  const validReviews = useMemo(
    () =>
      dueReviews.filter(r => {
        if (!noteMap.get(r.noteId)) {
          console.warn(`[ReviewQueue] Review ${r.id} references missing note ${r.noteId}, skipping`)
          return false
        }
        return true
      }),
    [dueReviews, noteMap]
  )

  const handleRate = useCallback(
    async (noteId: string, rating: ReviewRating) => {
      await rateNote(noteId, rating)
      // Focus management: move focus to the next card's button or the heading
      requestAnimationFrame(() => {
        const nextButton = cardListRef.current?.querySelector<HTMLButtonElement>(
          '[data-testid="rating-buttons"] button'
        )
        if (nextButton) {
          nextButton.focus()
        } else {
          headingRef.current?.focus()
        }
      })
    },
    [rateNote]
  )

  // Derive next review date from subscribed allReviews (not via store method)
  // to ensure the component re-renders when allReviews changes
  const nextReviewDate = useMemo(() => {
    if (allReviews.length === 0) return null
    const sorted = [...allReviews].sort(
      (a, b) => new Date(a.nextReviewAt).getTime() - new Date(b.nextReviewAt).getTime()
    )
    return sorted[0].nextReviewAt
  }, [allReviews])

  if (isLoading) {
    return (
      <DelayedFallback>
        <div className="space-y-6 p-1" aria-busy="true" aria-label="Loading review queue">
          <Skeleton className="h-8 w-48" />
          <div className="mx-auto max-w-2xl space-y-4">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-48 w-full rounded-[24px]" />
            ))}
          </div>
        </div>
      </DelayedFallback>
    )
  }

  return (
      <div className="space-y-6 p-1" data-testid="review-queue">
        {/* Page heading */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-brand-soft text-brand">
              <RotateCcw className="size-5" />
            </div>
            <div>
              <h1
                ref={headingRef}
                tabIndex={-1}
                className="font-display text-2xl tracking-tight outline-none"
              >
                Review Queue
              </h1>
              <p className="text-sm text-muted-foreground" aria-live="polite">
                {validReviews.length > 0
                  ? `${validReviews.length} note${validReviews.length === 1 ? '' : 's'} due for review`
                  : 'No reviews due'}
              </p>
            </div>
          </div>
          <Link
            to="/review/interleaved"
            className="inline-flex items-center gap-2 rounded-xl bg-brand-soft px-4 py-2 text-sm font-medium text-brand transition-colors hover:bg-brand-muted"
            data-testid="interleaved-mode-link"
          >
            <Shuffle className="size-4" />
            Interleaved Mode
          </Link>
        </div>

        {/* Content */}
        {validReviews.length === 0 ? (
          <ReviewEmptyState nextReviewDate={nextReviewDate} />
        ) : (
          <motion.div
            ref={cardListRef}
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="mx-auto max-w-2xl space-y-4"
          >
            <AnimatePresence mode="popLayout">
              {validReviews.map(record => {
                const note = noteMap.get(record.noteId)
                if (!note) return null

                return (
                  <motion.div key={record.id} variants={fadeUp}>
                    <ReviewCard
                      record={record}
                      note={note}
                      now={now}
                      courseName={getCourseName(note.courseId)}
                      onRate={handleRate}
                    />
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </motion.div>
        )}
      </div>
  )
}

function ReviewEmptyState({ nextReviewDate }: { nextReviewDate: string | null }) {
  return (
    <div data-testid="review-empty-state" className="mx-auto max-w-2xl pt-12">
      <Empty className="border-none">
        <EmptyMedia variant="icon">
          <CalendarClock className="size-6" />
        </EmptyMedia>
        <EmptyHeader>
          <EmptyTitle>No reviews due right now</EmptyTitle>
          <EmptyDescription>
            {nextReviewDate ? (
              <span data-testid="next-review-date" aria-live="polite">
                Next review: {format(new Date(nextReviewDate), "MMM d, yyyy 'at' h:mm a")}
              </span>
            ) : (
              'Rate a note after studying to start building your review queue.'
            )}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    </div>
  )
}
