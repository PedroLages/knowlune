/**
 * HighlightReviewCard — Readwise-style quote card for daily highlight review.
 *
 * Shows: large italic quoted text, book title/author, chapter, user note,
 * dot position indicators, and action buttons (Open in Book, Create/Review Flashcard, Next).
 *
 * @module HighlightReviewCard
 */
import { BookOpen, Layers, ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router'
import { Card, CardContent } from '@/app/components/ui/card'
import { Button } from '@/app/components/ui/button'
import { cn } from '@/app/components/ui/utils'
import type { BookHighlight } from '@/data/types'

export interface HighlightReviewCardProps {
  highlight: BookHighlight
  bookTitle: string
  bookAuthor?: string
  currentIndex: number
  totalCount: number
  onNext: () => void
  onFlashcard?: (highlight: BookHighlight) => void
}

export function HighlightReviewCard({
  highlight,
  bookTitle,
  bookAuthor,
  currentIndex,
  totalCount,
  onNext,
  onFlashcard,
}: HighlightReviewCardProps) {
  const navigate = useNavigate()
  const isLast = currentIndex === totalCount - 1

  const handleOpenInBook = () => {
    const params = new URLSearchParams()
    if (highlight.id) params.set('sourceHighlightId', highlight.id)
    navigate(`/library/${highlight.bookId}/read?${params.toString()}`)
  }

  const handleFlashcard = () => {
    if (highlight.flashcardId) {
      // Navigate to flashcard review queue
      navigate('/flashcards')
    } else {
      onFlashcard?.(highlight)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Quote card */}
      <Card className="rounded-[24px] shadow-sm">
        <CardContent className="p-6 flex flex-col gap-4">
          {/* Quoted text */}
          <blockquote
            className="text-lg italic text-foreground leading-relaxed"
            data-testid="highlight-review-quote"
          >
            &ldquo;{highlight.text}&rdquo;
          </blockquote>

          {/* Book metadata */}
          <div className="border-t border-border/50 pt-3 space-y-0.5">
            <p
              className="text-sm font-medium text-foreground"
              data-testid="highlight-review-book-title"
            >
              {bookTitle}
            </p>
            {bookAuthor && (
              <p className="text-xs text-muted-foreground" data-testid="highlight-review-author">
                {bookAuthor}
              </p>
            )}
            {highlight.chapterHref && (
              <p className="text-xs text-muted-foreground truncate">
                {highlight.chapterHref.split('#')[0].split('/').pop() ?? ''}
              </p>
            )}
          </div>

          {/* User note */}
          {highlight.note && (
            <div className="bg-muted/30 rounded-xl px-3 py-2">
              <p
                className="text-sm text-muted-foreground italic"
                data-testid="highlight-review-note"
              >
                {highlight.note}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dot position indicators */}
      <div
        className="flex items-center justify-center gap-1.5"
        role="tablist"
        aria-label={`Card ${currentIndex + 1} of ${totalCount}`}
      >
        {Array.from({ length: totalCount }, (_, i) => (
          <span
            key={i}
            role="tab"
            aria-selected={i === currentIndex}
            aria-label={`Card ${i + 1}`}
            className={cn(
              'size-2 rounded-full transition-all',
              i === currentIndex ? 'bg-brand scale-125' : 'bg-muted'
            )}
            data-testid={`review-dot-${i}`}
          />
        ))}
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <Button
          variant="brand-outline"
          size="sm"
          onClick={handleOpenInBook}
          className="gap-1.5"
          data-testid="review-open-in-book"
        >
          <BookOpen className="size-3.5" aria-hidden="true" />
          Open in Book
        </Button>

        <Button
          variant="brand-outline"
          size="sm"
          onClick={handleFlashcard}
          className="gap-1.5"
          data-testid="review-flashcard-btn"
        >
          <Layers className="size-3.5" aria-hidden="true" />
          {highlight.flashcardId ? 'Review Flashcard' : 'Create Flashcard'}
        </Button>

        <Button
          variant="brand"
          size="sm"
          onClick={onNext}
          className="gap-1.5"
          data-testid="review-next-btn"
        >
          {isLast ? 'Done' : 'Next'}
          {!isLast && <ChevronRight className="size-3.5" aria-hidden="true" />}
        </Button>
      </div>
    </div>
  )
}
