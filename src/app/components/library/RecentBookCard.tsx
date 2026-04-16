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
      className="group cursor-pointer focus-visible:outline-none"
      data-testid={`recent-book-card-${book.id}`}
    >
      {/* Cover — always square for uniform row height */}
      <div className="relative aspect-square rounded-xl overflow-hidden shadow-card-ambient group-hover:-translate-y-1 group-hover:shadow-[0_8px_24px_var(--shadow-brand)] transition-all duration-300">
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
      <div className="mt-2 px-0.5 text-center">
        <p className="text-xs font-semibold text-foreground leading-tight line-clamp-2 group-hover:text-brand transition-colors">
          {book.title}
        </p>
        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
          {book.author}
        </p>
      </div>
    </div>
  )
})
