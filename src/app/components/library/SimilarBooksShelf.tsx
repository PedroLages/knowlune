/**
 * SimilarBooksShelf — "More like this" horizontal scroll shelf.
 *
 * Uses the existing LibraryMediaShelfRow pattern for consistent styling.
 * Each card is a clickable similar-book card linking to the book's detail page.
 *
 * Cards show:
 * - Cover image (2/3 aspect, rounded-xl)
 * - Title (truncated to 1 line)
 * - Author (truncated to 1 line)
 *
 * Card width: 192px (w-48) matching mockup.
 *
 * @since book-detail-page (2026-05-07)
 */

import { memo, useCallback, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router'
import { BookHeart, BookOpen, Headphones } from 'lucide-react'
import type { Book } from '@/data/types'
import { type SimilarBook } from '@/lib/similarity'
import { LibraryMediaShelfRow } from '@/app/components/library/LibraryMediaShelfRow'
import { BookCoverImage } from '@/app/components/library/BookCoverImage'
import { useBookCoverUrl } from '@/app/hooks/useBookCoverUrl'

// ─── Similar Book Card ────────────────────────────────────────────────────────

interface SimilarBookCardProps {
  book: Book
}

const SimilarBookCard = memo(function SimilarBookCard({ book }: SimilarBookCardProps) {
  const navigate = useNavigate()
  const resolvedCoverUrl = useBookCoverUrl({ bookId: book.id, coverUrl: book.coverUrl })
  const isAudio = book.format === 'audiobook'
  const fallbackIcon = isAudio ? Headphones : BookOpen
  const FormatBadgeIcon = isAudio ? Headphones : BookOpen
  const aspectClass = isAudio ? 'aspect-square' : 'aspect-[2/3]'
  const formatLabel = isAudio ? 'Audio format' : 'Ebook format'

  const handleClick = useCallback(() => {
    navigate(`/library/${book.id}`)
  }, [navigate, book.id])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        navigate(`/library/${book.id}`)
      }
    },
    [navigate, book.id]
  )

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className="w-48 cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-lg"
      data-testid={`similar-book-${book.id}`}
      aria-label={`View details for ${book.title}`}
    >
      {/* Cover */}
      <div className={`relative ${aspectClass} overflow-hidden rounded-2xl bg-muted shadow-card-ambient transition-all duration-300 group-hover:-translate-y-2 group-hover:shadow-[0_10px_30px_var(--shadow-brand)]`}>
        <BookCoverImage
          src={resolvedCoverUrl}
          title={book.title}
          fallbackIcon={fallbackIcon}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {/* Format icon badge — top-right corner (matching BookCard pattern) */}
        <div
          className="absolute top-2 right-2 rounded-full bg-black/60 backdrop-blur p-1.5 z-10"
          aria-label={formatLabel}
        >
          <FormatBadgeIcon className="size-3.5 text-white" aria-hidden="true" />
        </div>
      </div>

      {/* Title + Author below cover */}
      <div className="mt-2.5 px-0.5">
        <p className="text-sm font-bold leading-tight text-foreground truncate group-hover:text-brand transition-colors">
          {book.title}
        </p>
        {book.author && (
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {book.author}
          </p>
        )}
      </div>
    </div>
  )
})

// ─── Shelf Component ──────────────────────────────────────────────────────────

interface SimilarBooksShelfProps {
  similarBooks: SimilarBook[]
}

export function SimilarBooksShelf({ similarBooks }: SimilarBooksShelfProps) {
  if (similarBooks.length === 0) return null

  return (
    <section data-testid="similar-books-shelf">
      <LibraryMediaShelfRow
        icon={BookHeart}
        label="More like this"
        count={similarBooks.length}
        data-testid="similar-books-row"
      >
        {similarBooks.map(similar => (
          <SimilarBookCard key={similar.book.id} book={similar.book} />
        ))}
      </LibraryMediaShelfRow>
    </section>
  )
}
