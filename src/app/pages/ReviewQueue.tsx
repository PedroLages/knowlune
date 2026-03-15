import { useEffect, useMemo, useCallback, useState } from 'react'
import { RotateCcw, CalendarClock } from 'lucide-react'
import { motion, MotionConfig, AnimatePresence } from 'motion/react'
import { format } from 'date-fns'
import { useReviewStore } from '@/stores/useReviewStore'
import { useNoteStore } from '@/stores/useNoteStore'
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
import { allCourses } from '@/data/courses'
import type { Note } from '@/data/types'

/** Map courseId → course title for display */
const courseNameMap = new Map(allCourses.map(c => [c.id, c.title]))

function getCourseName(courseId: string): string {
  return courseNameMap.get(courseId) ?? 'Unknown Course'
}

export function ReviewQueue() {
  const { allReviews, isLoading, getDueReviews, getNextReviewDate, loadReviews, rateNote } =
    useReviewStore()
  const { notes, loadNotes } = useNoteStore()

  // Force re-render after rating — Zustand v5 useSyncExternalStore doesn't
  // always trigger re-renders for state changes inside async event handlers
  const [, forceRender] = useState(0)

  useEffect(() => {
    loadReviews()
    loadNotes()
  }, [loadReviews, loadNotes])

  const handleRate = useCallback(
    async (noteId: string, rating: Parameters<typeof rateNote>[1]) => {
      await rateNote(noteId, rating)
      forceRender(c => c + 1)
    },
    [rateNote]
  )

  const dueReviews = getDueReviews()

  // Build noteId → Note lookup
  const noteMap = useMemo(() => {
    const map = new Map<string, Note>()
    for (const note of notes) {
      map.set(note.id, note)
    }
    return map
  }, [notes])

  const nextReviewDate = getNextReviewDate()

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
    <MotionConfig reducedMotion="user">
      <div className="space-y-6 p-1" data-testid="review-queue">
        {/* Page heading */}
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-brand-soft text-brand">
            <RotateCcw className="size-5" />
          </div>
          <div>
            <h1 className="font-display text-2xl tracking-tight">Review Queue</h1>
            <p className="text-sm text-muted-foreground">
              {dueReviews.length > 0
                ? `${dueReviews.length} note${dueReviews.length === 1 ? '' : 's'} due for review`
                : 'No reviews due'}
            </p>
          </div>
        </div>

        {/* Content */}
        {dueReviews.length === 0 ? (
          <ReviewEmptyState nextReviewDate={nextReviewDate} />
        ) : (
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="mx-auto max-w-2xl space-y-4"
          >
            <AnimatePresence mode="popLayout">
              {dueReviews.map(record => {
                const note = noteMap.get(record.noteId)
                if (!note) return null

                return (
                  <motion.div key={record.id} variants={fadeUp}>
                    <ReviewCard
                      record={record}
                      note={note}
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
    </MotionConfig>
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
