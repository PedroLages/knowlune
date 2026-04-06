/**
 * Grid-view book card with cover, title, author, progress, and status badge.
 *
 * Navigates to /library/{bookId} on click. Keyboard accessible via Tab/Enter.
 *
 * @since E83-S03
 */

import { memo, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router'
import { BookOpen, Cloud, Headphones } from 'lucide-react'
import type { Book } from '@/data/types'
import { BookStatusBadge } from './BookStatusBadge'

/** Find the current chapter title based on playback position in seconds */
function findCurrentChapterTitle(chapters: Book['chapters'], posSeconds: number): string {
  return (
    chapters.find(
      (_ch, i, arr) =>
        posSeconds >= (_ch.position.type === 'time' ? _ch.position.seconds : 0) &&
        (i === arr.length - 1 ||
          posSeconds < (arr[i + 1].position.type === 'time' ? arr[i + 1].position.seconds : Infinity))
    )?.title ?? 'Chapter 1'
  )
}

/** Format seconds to "Xh Ym" display */
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

interface BookCardProps {
  book: Book
}

export const BookCard = memo(function BookCard({ book }: BookCardProps) {
  const navigate = useNavigate()

  // E84/E87: EPUB and audiobook books open the reader; other formats stay on library detail (future)
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

  return (
    <div
      role="link"
      aria-label={
        book.narrator
          ? `Book: ${book.title} by ${book.author}, narrated by ${book.narrator}, ${book.progress}% complete`
          : `Book: ${book.title} by ${book.author}, ${book.progress}% complete`
      }
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
            {book.format === 'audiobook' ? (
              <Headphones className="h-8 w-8 text-muted-foreground" />
            ) : (
              <BookOpen className="h-8 w-8 text-muted-foreground" />
            )}
          </div>
        )}
        {/* Status badge overlay */}
        <div className="absolute top-2 right-2">
          <BookStatusBadge status={book.status} />
        </div>
        {/* Audiobook format badge */}
        {book.format === 'audiobook' && (
          <div className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-muted/90 px-2 py-0.5 text-[10px] text-muted-foreground backdrop-blur-sm">
            <Headphones className="size-3" aria-hidden="true" />
            Audio
          </div>
        )}
        {/* Remote source badge (E88-S02) */}
        {book.source.type === 'remote' && (
          <div
            className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 text-[10px] text-brand-soft-foreground backdrop-blur-sm"
            data-testid={`remote-badge-${book.id}`}
          >
            <Cloud className="size-3" aria-hidden="true" />
            Remote
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-col gap-1.5 p-3">
        <p className="text-sm font-medium text-foreground line-clamp-2 leading-tight">
          {book.title}
        </p>
        <p className="text-xs text-muted-foreground truncate">{book.author}</p>
        {book.narrator && (
          <p className="text-xs text-muted-foreground/70 truncate">Narrated by {book.narrator}</p>
        )}

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
        {/* Audiobook: current chapter + time remaining (E101-S06: FR32) */}
        {book.format === 'audiobook' &&
          book.chapters.length > 0 &&
          book.currentPosition?.type === 'time' && (
            <p
              className="text-[10px] text-muted-foreground truncate"
              data-testid={`chapter-${book.id}`}
            >
              {book.currentPosition!.type === 'time'
                ? findCurrentChapterTitle(book.chapters, book.currentPosition!.seconds)
                : 'Chapter 1'}
            </p>
          )}
        {book.totalDuration != null && book.totalDuration > 0 && (
          <p className="text-[10px] text-muted-foreground" data-testid={`duration-${book.id}`}>
            {book.format === 'audiobook' && book.currentPosition?.type === 'time'
              ? (book.progress != null && book.progress >= 99) || book.currentPosition.seconds >= book.totalDuration
                ? 'Completed'
                : `${formatDuration(Math.max(0, book.totalDuration - book.currentPosition.seconds))} left`
              : formatDuration(book.totalDuration)}
          </p>
        )}
      </div>
    </div>
  )
})
