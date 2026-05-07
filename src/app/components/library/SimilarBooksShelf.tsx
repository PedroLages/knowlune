/**
 * SimilarBooksShelf — "More like this" horizontal scroll shelf.
 *
 * Uses `LibraryRail` (same as Library Continue / Discover / Recently Added):
 * hover- and focus-within-revealed chevrons, `scrollbar-none` viewport, and
 * tile-width scroll steps via `data-rail-tile`.
 *
 * All covers use a **square** frame (audiobook footprint) so mixed formats
 * align in row height; format is still shown with the headphones / book badge.
 *
 * @since book-detail-page (2026-05-07)
 */

import { memo, useCallback, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router'
import { BookHeart, BookOpen, Headphones } from 'lucide-react'
import type { Book } from '@/data/types'
import { type SimilarBook } from '@/lib/similarity'
import { LibraryRail } from '@/app/components/library/rails/LibraryRail'
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
      data-rail-tile
      aria-label={`View details for ${book.title}`}
    >
      {/* Cover — square for all formats so the row height matches audiobook tiles */}
      <div
        className="relative aspect-square overflow-hidden rounded-2xl bg-muted shadow-card-ambient transition-all duration-300 group-hover:-translate-y-2 group-hover:shadow-[0_10px_30px_var(--shadow-brand)]"
        data-testid={`similar-book-${book.id}-cover`}
      >
        <BookCoverImage
          src={resolvedCoverUrl}
          title={book.title}
          fallbackIcon={fallbackIcon}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div
          className="absolute top-2 right-2 rounded-full bg-black/60 backdrop-blur p-1.5 z-10"
          aria-label={formatLabel}
        >
          <FormatBadgeIcon className="size-3.5 text-white" aria-hidden="true" />
        </div>
      </div>

      <div className="mt-2.5 px-0.5">
        <p className="text-sm font-bold leading-tight text-foreground truncate group-hover:text-brand transition-colors">
          {book.title}
        </p>
        {book.author && (
          <p className="mt-1 truncate text-xs text-muted-foreground">{book.author}</p>
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
    <LibraryRail
      icon={BookHeart}
      title="More like this"
      count={similarBooks.length}
      data-testid="similar-books-shelf"
    >
      {similarBooks.map(similar => (
        <SimilarBookCard key={similar.book.id} book={similar.book} />
      ))}
    </LibraryRail>
  )
}
