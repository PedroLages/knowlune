/**
 * Minimal book card for the "Recently Added" horizontal scroll row.
 *
 * Purpose-built for discovery context: shows cover + title + author only.
 * No badges, no progress bar, no ratings — those belong in the full BookCard.
 *
 * All covers are square for uniform height in the horizontal row.
 * A small format indicator icon distinguishes audiobooks from ebooks.
 */

import { memo, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router'
import { BookOpen, Headphones } from 'lucide-react'
import type { Book } from '@/data/types'
import { useBookCoverUrl } from '@/app/hooks/useBookCoverUrl'
import { LIBRARY_SHELF_CARD_WIDTH_CLASS } from '@/app/components/library/shelfCardSizing'

interface RecentBookCardProps {
  book: Book
}

export const RecentBookCard = memo(function RecentBookCard({ book }: RecentBookCardProps) {
  const navigate = useNavigate()
  const resolvedCoverUrl = useBookCoverUrl({ bookId: book.id, coverUrl: book.coverUrl })

  const readerPath =
    book.format === 'epub' || book.format === 'audiobook'
      ? `/library/${book.id}/read`
      : `/library/${book.id}`

  const handleClick = () => navigate(readerPath)
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      navigate(readerPath)
    }
  }

  const isAudiobook = book.format === 'audiobook'
  const FallbackIcon = isAudiobook ? Headphones : BookOpen
  const FormatIcon = isAudiobook ? Headphones : BookOpen

  return (
    <div
      role="link"
      aria-label={`${book.title} by ${book.author}`}
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={`group ${LIBRARY_SHELF_CARD_WIDTH_CLASS} cursor-pointer focus-visible:outline-none`}
      data-testid={`recent-book-card-${book.id}`}
    >
      {/* Cover — always square for uniform row height */}
      <div className="relative aspect-square rounded-2xl overflow-hidden shadow-card-ambient transition-all duration-300 group-hover:-translate-y-2 group-hover:shadow-[0_10px_30px_var(--shadow-brand)]">
        {resolvedCoverUrl ? (
          <img
            src={resolvedCoverUrl}
            alt={`Cover of ${book.title}`}
            loading="lazy"
            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted">
            <FallbackIcon className="size-6 text-muted-foreground" />
          </div>
        )}
        {/* Format indicator — high contrast pill */}
        <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-black/60 backdrop-blur-md px-2 py-1">
          <FormatIcon className="size-3 text-white" aria-hidden="true" />
          <span className="text-[10px] font-semibold text-white">
            {isAudiobook ? 'Audio' : 'eBook'}
          </span>
        </div>
      </div>

      {/* Title + Author only */}
      <div className="mt-3 px-1 text-center">
        <p className="line-clamp-2 text-sm font-bold leading-tight text-foreground transition-colors group-hover:text-brand">
          {book.title}
        </p>
        <p className="mt-1 truncate text-xs text-muted-foreground">{book.author}</p>
      </div>
    </div>
  )
})
