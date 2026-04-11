/**
 * HighlightReview — daily highlight review page with priority-based rating.
 *
 * Loads highlights from the bookHighlights Dexie table, prioritizing
 * unreviewed and least-recently-reviewed highlights. Users can rate
 * each highlight as "keep" (resurface later) or "dismiss" (hide from future reviews).
 *
 * Note: This uses a simple keep/dismiss priority system, not SM-2 or FSRS
 * spaced repetition scheduling.
 *
 * Route: /highlight-review
 *
 * @module HighlightReview
 * @since E86-S02 (created), E109-S02 (priority review rating)
 */
import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router'
import { ChevronLeft, ChevronRight, BookOpen, Download } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import { toast } from 'sonner'
import { db } from '@/db/schema'
import { useBookStore } from '@/stores/useBookStore'
import { Button } from '@/app/components/ui/button'
import { Skeleton } from '@/app/components/ui/skeleton'
import { HighlightReviewCard } from '@/app/components/highlights/HighlightReviewCard'
import { ClozeFlashcardCreator } from '@/app/components/reader/ClozeFlashcardCreator'
import {
  Empty,
  EmptyMedia,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from '@/app/components/ui/empty'
import { HighlightExportDialog } from '@/app/components/highlights/HighlightExportDialog'
import type { BookHighlight } from '@/data/types'

const REVIEW_CARD_COUNT = 20

/**
 * Selects highlights for daily review, prioritizing:
 * 1. Never-reviewed highlights (no lastReviewedAt)
 * 2. Least-recently-reviewed "keep" highlights
 * 3. Excludes "dismiss"-rated highlights
 *
 * Uses Dexie index-based filtering to avoid loading all highlights into memory.
 */
async function loadDailyHighlights(): Promise<BookHighlight[]> {
  // Full table scan with client-side filter: .where().notEqual() is unreliable
  // across Dexie versions for sparse/nullable fields. Cap at 80 records for safety.
  const candidates = await db.bookHighlights
    .toCollection()
    .filter(h => h.reviewRating !== 'dismiss')
    .limit(80)
    .toArray()

  // Sort: unreviewed first, then by oldest lastReviewedAt
  candidates.sort((a, b) => {
    if (!a.lastReviewedAt && b.lastReviewedAt) return -1
    if (a.lastReviewedAt && !b.lastReviewedAt) return 1
    if (!a.lastReviewedAt && !b.lastReviewedAt) return 0
    return (a.lastReviewedAt ?? '').localeCompare(b.lastReviewedAt ?? '')
  })

  return candidates.slice(0, REVIEW_CARD_COUNT)
}

export function HighlightReview() {
  const navigate = useNavigate()
  const books = useBookStore(s => s.books)

  const [highlights, setHighlights] = useState<BookHighlight[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [direction, setDirection] = useState<'forward' | 'back'>('forward')
  const [ratings, setRatings] = useState<Record<string, 'keep' | 'dismiss'>>({})

  // Export dialog state
  const [exportOpen, setExportOpen] = useState(false)

  // Cloze flashcard creator state
  const [clozeOpen, setClozeOpen] = useState(false)
  const [clozeHighlight, setClozeHighlight] = useState<BookHighlight | null>(null)

  // Load highlights for daily review on mount
  useEffect(() => {
    let ignore = false
    loadDailyHighlights()
      .then(sampled => {
        if (ignore) return
        setHighlights(sampled)
        setIsLoading(false)
      })
      .catch(err => {
        if (ignore) return
        // silent-catch-ok: highlight load failure shows empty state
        console.error('[HighlightReview] Failed to load highlights:', err)
        setIsLoading(false)
      })
    return () => {
      ignore = true
    }
  }, [])

  // Always-current refs for rollback — avoid stale closure capture
  const highlightsRef = useRef(highlights)
  const ratingsRef = useRef(ratings)
  useEffect(() => {
    highlightsRef.current = highlights
  }, [highlights])
  useEffect(() => {
    ratingsRef.current = ratings
  }, [ratings])

  const handleRate = useCallback(
    async (highlightId: string, rating: 'keep' | 'dismiss') => {
      const now = new Date().toISOString()

      // Snapshot current state immediately inside the handler (not from closure)
      const snapshotHighlights = highlightsRef.current
      const snapshotRatings = ratingsRef.current

      // Optimistic update: record rating and remove dismissed cards immediately
      setRatings(prev => ({ ...prev, [highlightId]: rating }))
      if (rating === 'dismiss') {
        setHighlights(prev => {
          const next = prev.filter(h => h.id !== highlightId)
          // If the dismissed card was not the last one, keep current index; otherwise step back
          setCurrentIndex(idx => Math.min(idx, Math.max(0, next.length - 1)))
          return next
        })
      }

      try {
        await db.bookHighlights.update(highlightId, {
          reviewRating: rating,
          lastReviewedAt: now,
          updatedAt: now,
        })
      } catch (err) {
        console.error('[HighlightReview] Failed to persist rating:', err)
        // Rollback to snapshot captured before the optimistic update
        setHighlights(snapshotHighlights)
        setRatings(snapshotRatings)
        toast.error('Failed to save rating. Please try again.')
      }
    },
    [] // no closure deps — reads state via refs
  )

  const handleNext = useCallback(() => {
    if (currentIndex >= highlights.length - 1) {
      navigate(-1)
      return
    }
    setDirection('forward')
    setCurrentIndex(i => i + 1)
  }, [currentIndex, highlights.length, navigate])

  const handlePrev = useCallback(() => {
    if (currentIndex === 0) return
    setDirection('back')
    setCurrentIndex(i => i - 1)
  }, [currentIndex])

  // Keyboard navigation: left/right arrow keys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') handleNext()
      if (e.key === 'ArrowLeft') handlePrev()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleNext, handlePrev])

  const currentHighlight = highlights[currentIndex]
  const currentBook = currentHighlight
    ? books.find(b => b.id === currentHighlight.bookId)
    : undefined

  if (isLoading) {
    return (
      <div className="mx-auto max-w-lg p-6 space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-64 rounded-[24px]" />
        <Skeleton className="h-10 w-full" />
      </div>
    )
  }

  if (highlights.length === 0) {
    return (
      <div
        className="flex min-h-[60vh] items-center justify-center px-6"
        data-testid="highlight-review-empty"
      >
        <Empty>
          <EmptyMedia>
            <BookOpen className="size-8 text-muted-foreground" />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle>No highlights yet</EmptyTitle>
            <EmptyDescription>
              Highlight passages while reading to build your review collection.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    )
  }

  const slideVariants = {
    enter: (dir: string) => ({ x: dir === 'forward' ? 60 : -60, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: string) => ({ x: dir === 'forward' ? -60 : 60, opacity: 0 }),
  }

  return (
    <div className="mx-auto max-w-lg p-6 space-y-6" data-testid="highlight-review-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          ← Back
        </Button>
        <h1 className="text-base font-semibold">Daily Highlight Review</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExportOpen(true)}
            aria-label="Export highlights"
            data-testid="highlight-export-btn"
          >
            <Download className="size-4" aria-hidden="true" />
          </Button>
          <span className="text-sm tabular-nums text-muted-foreground">
            {currentIndex + 1} / {highlights.length}
          </span>
        </div>
      </div>

      {/* Card with slide animation */}
      <div className="overflow-hidden">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentIndex}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          >
            {currentHighlight && (
              <HighlightReviewCard
                highlight={currentHighlight}
                bookTitle={currentBook?.title ?? 'Unknown Book'}
                bookAuthor={currentBook?.author}
                currentIndex={currentIndex}
                totalCount={highlights.length}
                onNext={handleNext}
                onFlashcard={h => {
                  setClozeHighlight(h)
                  setClozeOpen(true)
                }}
                onRate={handleRate}
                currentRating={ratings[currentHighlight.id] ?? currentHighlight.reviewRating}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Desktop arrow navigation */}
      <div className="hidden sm:flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={handlePrev}
          disabled={currentIndex === 0}
          aria-label="Previous highlight"
          data-testid="review-prev-btn"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          Previous
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleNext}
          aria-label="Next highlight"
          data-testid="review-next-desktop-btn"
        >
          Next
          <ChevronRight className="size-4" aria-hidden="true" />
        </Button>
      </div>

      {/* Cloze flashcard creator */}
      {clozeHighlight && (
        <ClozeFlashcardCreator
          open={clozeOpen}
          onClose={() => {
            setClozeOpen(false)
            setClozeHighlight(null)
          }}
          text={clozeHighlight.textAnchor}
          highlightId={clozeHighlight.id}
          bookId={clozeHighlight.bookId}
        />
      )}

      {/* Highlight export dialog (E109-S03) */}
      <HighlightExportDialog open={exportOpen} onOpenChange={setExportOpen} />
    </div>
  )
}
