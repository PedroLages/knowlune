/**
 * Book review editor — star rating + markdown review text.
 *
 * Integrates StarRating with a textarea for markdown-formatted personal reviews.
 * Auto-saves review text on blur. Includes a simple markdown preview toggle.
 *
 * Note: dangerouslySetInnerHTML is used intentionally for markdown preview.
 * Content is safe because: (1) it's the user's own local data from IndexedDB,
 * (2) HTML entities are escaped before markdown transformation, and
 * (3) no external/untrusted content is ever rendered.
 *
 * @since E113-S01
 */

import { useState, useCallback, useEffect } from 'react'
import { Pencil, Eye, Trash2 } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { Textarea } from '@/app/components/ui/textarea'
import { StarRating } from './StarRating'
import { useBookReviewStore } from '@/stores/useBookReviewStore'
import { cn } from '@/app/components/ui/utils'

interface BookReviewEditorProps {
  bookId: string
  className?: string
}

/**
 * Minimal markdown renderer: bold, italic, line breaks.
 * Intentionally lightweight — no external dependency needed for personal reviews.
 * HTML is escaped first to prevent injection from stored content.
 */
function renderSimpleMarkdown(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br />')
}

export function BookReviewEditor({ bookId, className }: BookReviewEditorProps) {
  const { getReviewForBook, setRating, setReviewText, deleteReview, loadReviews, isLoaded } =
    useBookReviewStore()

  useEffect(() => {
    if (!isLoaded) {
      loadReviews()
    }
  }, [isLoaded, loadReviews])

  const review = getReviewForBook(bookId)
  const [showPreview, setShowPreview] = useState(false)
  const [localText, setLocalText] = useState(review?.reviewText ?? '')
  const [isEditing, setIsEditing] = useState(false)

  // Sync local text when review changes externally
  useEffect(() => {
    setLocalText(review?.reviewText ?? '')
  }, [review?.reviewText])

  const handleRatingChange = useCallback(
    (rating: number) => {
      setRating(bookId, rating)
    },
    [bookId, setRating]
  )

  const handleSaveText = useCallback(() => {
    if (review) {
      setReviewText(bookId, localText)
    }
    setIsEditing(false)
  }, [bookId, localText, review, setReviewText])

  const handleDelete = useCallback(() => {
    deleteReview(bookId)
    setLocalText('')
    setIsEditing(false)
  }, [bookId, deleteReview])

  return (
    <div className={cn('space-y-3', className)} data-testid="book-review-editor">
      {/* Rating row */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-foreground">Your rating</span>
        <StarRating value={review?.rating ?? 0} onChange={handleRatingChange} size="md" />
        {review?.rating ? (
          <span className="text-sm text-muted-foreground">{review.rating}/5</span>
        ) : null}
      </div>

      {/* Review text section — only show if rated */}
      {review?.rating ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">Your review</span>
            <div className="flex items-center gap-1">
              {review.reviewText && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => setShowPreview(!showPreview)}
                  aria-label={showPreview ? 'Edit review' : 'Preview review'}
                >
                  {showPreview ? (
                    <Pencil className="size-3.5" />
                  ) : (
                    <Eye className="size-3.5" />
                  )}
                </Button>
              )}
              {review.reviewText && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                  onClick={handleDelete}
                  aria-label="Delete review"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              )}
            </div>
          </div>

          {showPreview && review.reviewText ? (
            <div
              className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-foreground"
              dangerouslySetInnerHTML={{
                __html: renderSimpleMarkdown(review.reviewText),
              }}
              data-testid="review-preview"
            />
          ) : (
            <>
              {isEditing || !review.reviewText ? (
                <div className="space-y-2">
                  <Textarea
                    value={localText}
                    onChange={e => setLocalText(e.target.value)}
                    placeholder="Write your thoughts about this book... (supports **bold** and *italic*)"
                    className="min-h-[100px] resize-y text-sm"
                    data-testid="review-textarea"
                    onFocus={() => setIsEditing(true)}
                  />
                  <div className="flex justify-end gap-2">
                    {isEditing && review.reviewText && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setLocalText(review.reviewText ?? '')
                          setIsEditing(false)
                        }}
                      >
                        Cancel
                      </Button>
                    )}
                    <Button variant="brand" size="sm" onClick={handleSaveText}>
                      Save review
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="w-full rounded-lg border border-border bg-muted/30 p-3 text-left text-sm text-foreground hover:bg-muted/50 transition-colors"
                  onClick={() => setIsEditing(true)}
                  data-testid="review-display"
                >
                  <div
                    dangerouslySetInnerHTML={{
                      __html: renderSimpleMarkdown(review.reviewText),
                    }}
                  />
                </button>
              )}
            </>
          )}
        </div>
      ) : null}
    </div>
  )
}
