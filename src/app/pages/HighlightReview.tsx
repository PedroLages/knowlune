/**
 * HighlightReview — daily highlight review page.
 *
 * Loads 5 random highlights from the bookHighlights Dexie table,
 * joins with books for title/author, and presents them as Readwise-style
 * quote cards with navigation and action buttons.
 *
 * Route: /highlight-review
 *
 * @module HighlightReview
 */
import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router'
import { ChevronLeft, ChevronRight, BookOpen } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
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
import type { BookHighlight } from '@/data/types'

const REVIEW_CARD_COUNT = 5

/** Reservoir-sample N items from an array without sorting the whole array */
function sampleN<T>(arr: T[], n: number): T[] {
  if (arr.length <= n) return [...arr]
  const result = arr.slice(0, n)
  for (let i = n; i < arr.length; i++) {
    const j = Math.floor(Math.random() * (i + 1))
    if (j < n) result[j] = arr[i]
  }
  return result
}

export function HighlightReview() {
  const navigate = useNavigate()
  const books = useBookStore(s => s.books)

  const [highlights, setHighlights] = useState<BookHighlight[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [direction, setDirection] = useState<'forward' | 'back'>('forward')

  // Cloze flashcard creator state
  const [clozeOpen, setClozeOpen] = useState(false)
  const [clozeHighlight, setClozeHighlight] = useState<BookHighlight | null>(null)

  // Load random highlights on mount
  useEffect(() => {
    let ignore = false
    db.bookHighlights
      .toArray()
      .then(all => {
        if (ignore) return
        const sampled = sampleN(all, REVIEW_CARD_COUNT)
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
      <div className="flex min-h-[60vh] items-center justify-center px-6">
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
    <div className="mx-auto max-w-lg p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          ← Back
        </Button>
        <h1 className="text-base font-semibold">Highlight Review</h1>
        <span className="text-sm tabular-nums text-muted-foreground">
          {currentIndex + 1} / {highlights.length}
        </span>
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
          text={clozeHighlight.text}
          highlightId={clozeHighlight.id}
          bookId={clozeHighlight.bookId}
        />
      )}
    </div>
  )
}
