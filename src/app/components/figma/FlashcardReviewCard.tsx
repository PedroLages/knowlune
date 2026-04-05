import { motion } from 'motion/react'
import { RotateCcw, Layers, BookOpen } from 'lucide-react'
import { Link } from 'react-router'
import { Card, CardContent } from '@/app/components/ui/card'
import { cn } from '@/app/components/ui/utils'
import { RatingButtons } from './RatingButtons'
import type { ReviewRating, Flashcard } from '@/data/types'

/** Source link for book-sourced flashcards. 'deleted' means the book was removed. */
export type FlashcardSourceLink = { href: string; label: string } | 'deleted'

interface FlashcardReviewCardProps {
  flashcard: Flashcard
  courseName: string
  isFlipped: boolean
  onFlip: () => void
  onRate: (rating: ReviewRating) => void
  isRating?: boolean
  /** Optional back-navigation link for book-sourced flashcards (E85-S05) */
  sourceLink?: FlashcardSourceLink
}

function getReviewCountLabel(count: number): string {
  if (count === 0) return 'New'
  if (count === 1) return '1 review'
  return `${count} reviews`
}

export function FlashcardReviewCard({
  flashcard,
  courseName,
  isFlipped,
  onFlip,
  onRate,
  isRating = false,
  sourceLink,
}: FlashcardReviewCardProps) {
  function handleKeyDown(e: React.KeyboardEvent) {
    if ((e.key === ' ' || e.key === 'Enter') && !isFlipped) {
      e.preventDefault()
      onFlip()
    }
  }

  return (
    <>
      {/* Perspective container for 3D card-flip — no Tailwind equivalents for
          perspective, transformStyle, or backfaceVisibility (CSS 3D transform properties) */}
      {/* eslint-disable react-best-practices/no-inline-styles */}
      <div style={{ perspective: 1000 }} className="mx-auto w-full max-w-lg">
        <motion.div
          animate={{ rotateY: isFlipped ? 180 : 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          style={{ transformStyle: 'preserve-3d' }}
          className="relative min-h-[280px]"
        >
          {/* ── Front face ── */}
          <div
            data-testid="flashcard-front"
            role="button"
            tabIndex={isFlipped ? -1 : 0}
            aria-label="Flip card to reveal answer"
            aria-hidden={isFlipped}
            onClick={!isFlipped ? onFlip : undefined}
            onKeyDown={handleKeyDown}
            className="absolute inset-0 cursor-pointer"
            style={{ backfaceVisibility: 'hidden', visibility: isFlipped ? 'hidden' : 'visible' }}
          >
            <Card className="h-full rounded-2xl transition-shadow duration-200 hover:shadow-lg">
              <CardContent className="flex h-full flex-col justify-between gap-4 p-6">
                {/* Header: course badge */}
                <div className="flex items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-soft-foreground">
                    <Layers className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <p
                      data-testid="flashcard-course-name"
                      className="truncate text-xs font-medium text-muted-foreground"
                    >
                      {courseName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {getReviewCountLabel(flashcard.reps)}
                    </p>
                  </div>
                </div>

                {/* Front text */}
                <p
                  data-testid="flashcard-front-text"
                  className="text-center text-lg font-medium leading-relaxed text-foreground"
                >
                  {flashcard.front}
                </p>

                {/* Flip hint */}
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <RotateCcw className="size-4" />
                  <span>Tap to reveal · Space / ↵</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── Back face ── */}
          <div
            data-testid="flashcard-back"
            aria-hidden={!isFlipped}
            className="absolute inset-0"
            style={{
              backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
              visibility: isFlipped ? 'visible' : 'hidden',
            }}
          >
            <Card className={cn('h-full rounded-2xl shadow-lg', isRating && 'opacity-60')}>
              <CardContent className="flex h-full flex-col gap-4 p-6">
                {/* Header: course */}
                <div className="flex items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-soft-foreground">
                    <Layers className="size-5" />
                  </div>
                  <p className="truncate text-xs font-medium text-muted-foreground">{courseName}</p>
                </div>

                {/* Answer text */}
                <div className="flex-1">
                  <p
                    data-testid="flashcard-back-text"
                    className="text-sm leading-relaxed text-foreground"
                  >
                    {flashcard.back}
                  </p>
                </div>

                {/* Rating */}
                <div>
                  <p className="mb-2 text-xs text-muted-foreground">
                    How well did you recall this? · 1/2/3/4
                  </p>
                  <RatingButtons onRate={onRate} disabled={isRating} />
                </div>
              </CardContent>
            </Card>
          </div>
        </motion.div>

        {/* Source link for book-sourced flashcards (E85-S05) */}
        {sourceLink && (
          <div className="mt-3 flex justify-center">
            {sourceLink === 'deleted' ? (
              <span
                className="flex items-center gap-1.5 text-sm text-muted-foreground cursor-not-allowed select-none"
                aria-label="Source book has been removed"
                data-testid="flashcard-book-removed"
              >
                <BookOpen className="size-3.5" aria-hidden="true" />
                Book removed
              </span>
            ) : (
              <Link
                to={sourceLink.href}
                className="flex items-center gap-1.5 text-sm text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded"
                aria-label={`View source highlight in ${sourceLink.label}`}
                data-testid="flashcard-view-in-book"
              >
                <BookOpen className="size-3.5" aria-hidden="true" />
                {sourceLink.label}
              </Link>
            )}
          </div>
        )}

        {/* Screen reader announcement */}
        {isFlipped && (
          <span className="sr-only" aria-live="polite">
            Answer revealed. Rate your recall.
          </span>
        )}
      </div>
      {/* eslint-enable react-best-practices/no-inline-styles */}
    </>
  )
}
