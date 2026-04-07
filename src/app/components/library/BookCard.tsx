/**
 * Grid-view book card with cover, title, author, progress, and status badge.
 *
 * Audiobooks: clean square cover with centered metadata below (album art style).
 * EPUBs/other: portrait cover in a card with metadata section.
 *
 * Navigates to /library/{bookId} on click. Keyboard accessible via Tab/Enter.
 *
 * @since E83-S03
 * @modified Library Redesign — audiobook-style square covers
 */

import { memo, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router'
import { BookOpen, Cloud, Headphones, ArrowRightLeft, Clock } from 'lucide-react'
import type { Book } from '@/data/types'
import { BookStatusBadge } from './BookStatusBadge'
import { useBookCoverUrl } from '@/app/hooks/useBookCoverUrl'

/** Find the current chapter title based on playback position in seconds */
function findCurrentChapterTitle(chapters: Book['chapters'], posSeconds: number): string {
  return (
    chapters.find(
      (_ch, i, arr) =>
        posSeconds >= (_ch.position.type === 'time' ? _ch.position.seconds : 0) &&
        (i === arr.length - 1 ||
          posSeconds <
            (() => {
              const nextPos = arr[i + 1].position
              return nextPos.type === 'time' ? nextPos.seconds : Infinity
            })())
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

  // ── Audiobook: square cover + centered metadata below ─────────────────
  if (book.format === 'audiobook') {
    return (
      <div
        role="link"
        aria-label={
          book.narrator
            ? `Audiobook: ${book.title} by ${book.author}, narrated by ${book.narrator}, ${book.progress}% complete`
            : `Audiobook: ${book.title} by ${book.author}, ${book.progress}% complete`
        }
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className="group cursor-pointer focus-visible:outline-none"
        data-testid={`book-card-${book.id}`}
      >
        {/* Square cover */}
        <div className="relative aspect-square rounded-2xl overflow-hidden shadow-card-ambient group-hover:-translate-y-2 group-hover:shadow-[0_10px_30px_var(--shadow-brand)] transition-all duration-300">
          {resolvedCoverUrl ? (
            <img
              src={resolvedCoverUrl}
              alt={`Cover of ${book.title}`}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-muted">
              <Headphones className="size-8 text-muted-foreground" />
            </div>
          )}
          {/* Status badge */}
          <div className="absolute top-2 right-2">
            <BookStatusBadge status={book.status} />
          </div>
          {/* Progress bar overlaid at bottom of cover */}
          <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-foreground/10">
            <div
              className="h-full bg-brand rounded-full transition-all"
              style={{ width: `${book.progress ?? 0}%` }}
            />
          </div>
          {/* Remote badge */}
          {book.source.type === 'remote' && (
            <div
              className="absolute top-2 left-2 flex items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 text-[10px] text-brand-soft-foreground backdrop-blur-sm"
              data-testid={`remote-badge-${book.id}`}
            >
              <Cloud className="size-3" aria-hidden="true" />
              Remote
            </div>
          )}
        </div>
        {/* Metadata below cover */}
        <div className="mt-3 px-1 text-center">
          <p className="text-sm font-bold text-foreground leading-tight line-clamp-2 group-hover:text-brand transition-colors">
            {book.title}
          </p>
          <p className="text-xs text-muted-foreground mt-1 truncate">{book.author}</p>
          {book.narrator && (
            <p className="text-[11px] text-muted-foreground/70 mt-0.5 truncate">
              {book.narrator}
            </p>
          )}
          {/* Chapter + time remaining when playing */}
          {book.chapters.length > 0 &&
            book.currentPosition?.type === 'time' &&
            (book.progress ?? 0) > 0 && (
              <p className="text-[10px] text-muted-foreground mt-0.5 truncate" data-testid={`chapter-${book.id}`}>
                {findCurrentChapterTitle(book.chapters, book.currentPosition!.seconds)}
              </p>
            )}
          {book.totalDuration != null && book.totalDuration > 0 && (
            <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center justify-center gap-1" data-testid={`duration-${book.id}`}>
              <Clock className="size-3" aria-hidden="true" />
              {book.currentPosition?.type === 'time'
                ? (book.progress != null && book.progress >= 99) ||
                  book.currentPosition.seconds >= book.totalDuration
                  ? 'Completed'
                  : `${formatDuration(Math.max(0, book.totalDuration - book.currentPosition.seconds))} left`
                : formatDuration(book.totalDuration)}
            </p>
          )}
          {book.linkedBookId && (
            <p
              className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground mt-0.5"
              data-testid={`linked-format-badge-${book.id}`}
            >
              <ArrowRightLeft className="size-3 shrink-0" aria-hidden="true" />
              Also as EPUB
            </p>
          )}
        </div>
      </div>
    )
  }

  // ── EPUB / other formats: portrait card layout ────────────────────────
  return (
    <div
      role="link"
      aria-label={`Book: ${book.title} by ${book.author}, ${book.progress}% complete`}
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className="rounded-[24px] bg-card overflow-hidden shadow-card-ambient hover:-translate-y-2 transition-all duration-300 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      data-testid={`book-card-${book.id}`}
    >
      {/* Cover — portrait */}
      <div className="relative overflow-hidden aspect-[2/3]">
        {resolvedCoverUrl ? (
          <img
            src={resolvedCoverUrl}
            alt={`Cover of ${book.title}`}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted">
            <BookOpen className="h-8 w-8 text-muted-foreground" />
          </div>
        )}
        <div className="absolute top-2 right-2">
          <BookStatusBadge status={book.status} />
        </div>
        {/* Progress overlay at bottom of cover */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-foreground/10">
          <div
            className="h-full bg-brand transition-all"
            style={{ width: `${book.progress}%` }}
          />
        </div>
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
      <div className="flex flex-col gap-1 p-3 h-[120px]">
        <p className="text-sm font-medium text-foreground line-clamp-2 leading-tight">
          {book.title}
        </p>
        <p className="text-xs text-muted-foreground truncate">{book.author}</p>
        {book.totalDuration != null && book.totalDuration > 0 && (
          <p className="text-[10px] text-muted-foreground" data-testid={`duration-${book.id}`}>
            {formatDuration(book.totalDuration)}
          </p>
        )}
        {book.linkedBookId && (
          <p
            className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5"
            data-testid={`linked-format-badge-${book.id}`}
          >
            <ArrowRightLeft className="size-3 shrink-0" aria-hidden="true" />
            Also available as audiobook
          </p>
        )}
      </div>
    </div>
  )
})
