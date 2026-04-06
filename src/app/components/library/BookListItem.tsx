/**
 * List-view book row with thumbnail, metadata, progress, and status.
 *
 * Navigates to /library/{bookId} on click. Keyboard accessible via Tab/Enter.
 *
 * @since E83-S03
 */

import { memo, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router'
import { BookOpen, Cloud, Headphones } from 'lucide-react'
import type { Book, BookStatus } from '@/data/types'
import { BookStatusBadge } from './BookStatusBadge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select'
import { useBookStore } from '@/stores/useBookStore'

interface BookListItemProps {
  book: Book
}

/**
 * Lightweight relative time formatter — no external dependency.
 */
function relativeTime(date: string | undefined, now: number = Date.now()): string {
  if (!date) return ''
  const diff = now - new Date(date).getTime()
  const hours = Math.floor(diff / 3600000)
  if (hours < 1) return 'Just now'
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(date).toLocaleDateString('sv-SE')
}

const STATUS_OPTIONS: { value: BookStatus; label: string }[] = [
  { value: 'unread', label: 'Want to Read' },
  { value: 'reading', label: 'Reading' },
  { value: 'finished', label: 'Finished' },
  { value: 'abandoned', label: 'Abandoned' },
]

export const BookListItem = memo(function BookListItem({ book }: BookListItemProps) {
  const navigate = useNavigate()
  const updateBookStatus = useBookStore(s => s.updateBookStatus)

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

  const handleStatusChange = (value: string) => {
    // Stop propagation handled by Select portal — no need to stopPropagation
    updateBookStatus(book.id, value as BookStatus)
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
      className="flex items-center gap-4 p-3 rounded-xl hover:bg-muted/50 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      data-testid={`book-list-item-${book.id}`}
    >
      {/* Thumbnail */}
      <div className="size-16 flex-shrink-0 rounded-lg overflow-hidden">
        {book.coverUrl ? (
          <img
            src={book.coverUrl}
            alt={`Cover of ${book.title}`}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted rounded-lg">
            {book.format === 'audiobook' ? (
              <Headphones className="h-5 w-5 text-muted-foreground" />
            ) : (
              <BookOpen className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
        )}
      </div>

      {/* Title + Author */}
      <div className="flex flex-col gap-0.5 min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground truncate">{book.title}</p>
        <p className="text-xs text-muted-foreground truncate">{book.author}</p>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          {book.format === 'audiobook' ? (
            <span className="flex items-center gap-1">
              <Headphones className="size-3" aria-hidden="true" />
              Audiobook
            </span>
          ) : (
            <span className="uppercase">{book.format}</span>
          )}
          {book.source.type === 'remote' && (
            <span
              className="flex items-center gap-1 text-brand-soft-foreground"
              data-testid={`remote-badge-${book.id}`}
            >
              <Cloud className="size-3" aria-hidden="true" />
              Remote
            </span>
          )}
          {book.totalPages && book.format !== 'audiobook' && <span>{book.totalPages} pages</span>}
          {book.format === 'audiobook' && book.totalDuration != null && book.totalDuration > 0 && (
            <span>
              {book.currentPosition?.type === 'time'
                ? (book.progress != null && book.progress >= 99) || book.currentPosition.seconds >= book.totalDuration
                  ? 'Completed'
                  : `${Math.floor(Math.max(0, book.totalDuration - book.currentPosition.seconds) / 60)} min left`
                : `${Math.floor(book.totalDuration / 60)} min`}
            </span>
          )}
        </div>
      </div>

      {/* Progress */}
      <div className="hidden sm:flex flex-col items-end gap-1 min-w-[120px]">
        <div className="flex items-center gap-2 w-full">
          <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-brand transition-all"
              style={{ width: `${book.progress}%` }}
            />
          </div>
          <span className="text-[10px] text-muted-foreground tabular-nums w-8 text-right">
            {book.progress}%
          </span>
        </div>
        {book.lastOpenedAt && (
          <span className="text-[10px] text-muted-foreground">
            {relativeTime(book.lastOpenedAt)}
          </span>
        )}
      </div>

      {/* Status dropdown */}
      <div
        className="hidden md:block flex-shrink-0"
        onClick={e => e.stopPropagation()}
        onKeyDown={e => e.stopPropagation()}
      >
        <Select value={book.status} onValueChange={handleStatusChange}>
          <SelectTrigger className="h-8 w-[130px] text-xs" aria-label="Book status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value} className="text-xs">
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Mobile status badge (shown when dropdown hidden) */}
      <div className="md:hidden flex-shrink-0">
        <BookStatusBadge status={book.status} />
      </div>
    </div>
  )
})
