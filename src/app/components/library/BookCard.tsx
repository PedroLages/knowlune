/**
 * Grid-view book card with cover, title, author, progress, and status badge.
 *
 * Navigates to /library/{bookId} on click. Keyboard accessible via Tab/Enter.
 *
 * @since E83-S03
 */

import React from 'react'
import { useNavigate } from 'react-router'
import { BookOpen } from 'lucide-react'
import type { Book } from '@/data/types'
import { BookStatusBadge } from './BookStatusBadge'

interface BookCardProps {
  book: Book
}

export const BookCard = React.memo(function BookCard({ book }: BookCardProps) {
  const navigate = useNavigate()

  const handleClick = () => navigate(`/library/${book.id}`)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      navigate(`/library/${book.id}`)
    }
  }

  return (
    <div
      role="article"
      aria-label={`${book.title} by ${book.author}, ${book.progress}% complete`}
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className="rounded-[24px] bg-card border border-border/50 overflow-hidden shadow-sm hover:shadow-md hover:scale-[1.02] transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      data-testid={`book-card-${book.id}`}
    >
      {/* Cover */}
      <div className="relative aspect-[2/3] overflow-hidden">
        {book.coverUrl ? (
          <img
            src={book.coverUrl}
            alt={`Cover of ${book.title}`}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted">
            <BookOpen className="h-8 w-8 text-muted-foreground" />
          </div>
        )}
        {/* Status badge overlay */}
        <div className="absolute top-2 right-2">
          <BookStatusBadge status={book.status} />
        </div>
      </div>

      {/* Info */}
      <div className="flex flex-col gap-1.5 p-3">
        <p className="text-sm font-medium text-foreground line-clamp-2 leading-tight">
          {book.title}
        </p>
        <p className="text-xs text-muted-foreground truncate">{book.author}</p>

        {/* Progress bar */}
        <div className="flex items-center gap-2 mt-1">
          <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-brand transition-all"
              style={{ width: `${book.progress}%` }}
            />
          </div>
          <span className="text-[10px] text-muted-foreground tabular-nums">{book.progress}%</span>
        </div>
      </div>
    </div>
  )
})
