/**
 * Reading Queue view — ordered list of books the user intends to read next (E110-S03).
 *
 * Shows books in queue order with position badge and up/down reorder controls.
 * Empty state provides a helpful CTA explaining how to add books.
 *
 * @since E110-S03
 */

import { ChevronUp, ChevronDown, BookOpen, ListOrdered } from 'lucide-react'
import { useNavigate } from 'react-router'
import type { Book } from '@/data/types'
import { useReadingQueueStore } from '@/stores/useReadingQueueStore'
import { useBookCoverUrl } from '@/app/hooks/useBookCoverUrl'
import { Button } from '@/app/components/ui/button'
import { cn } from '@/app/components/ui/utils'

interface ReadingQueueViewProps {
  books: Book[]
}

interface QueueBookRowProps {
  book: Book
  position: number
  isFirst: boolean
  isLast: boolean
  onMoveUp: () => void
  onMoveDown: () => void
}

function QueueBookRow({
  book,
  position,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
}: QueueBookRowProps) {
  const navigate = useNavigate()
  const resolvedCoverUrl = useBookCoverUrl({ bookId: book.id, coverUrl: book.coverUrl })

  const readerPath =
    book.format === 'epub' || book.format === 'audiobook'
      ? `/library/${book.id}/read`
      : `/library/${book.id}`

  return (
    <div
      className="flex items-center gap-3 p-3 rounded-xl bg-background border border-border/50 hover:border-border transition-colors"
      data-testid={`queue-row-${book.id}`}
    >
      {/* Position badge */}
      <span
        className={cn(
          'flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold',
          position === 1 ? 'bg-brand text-brand-foreground' : 'bg-muted text-muted-foreground'
        )}
        aria-label={`Queue position ${position}`}
        data-testid={`queue-position-${book.id}`}
      >
        {position}
      </span>

      {/* Cover */}
      <button
        className="flex-shrink-0 w-10 h-14 rounded-md overflow-hidden bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        onClick={() => navigate(readerPath)}
        aria-label={`Open ${book.title}`}
      >
        {resolvedCoverUrl ? (
          <img src={resolvedCoverUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <BookOpen className="size-4 text-muted-foreground" aria-hidden="true" />
          </div>
        )}
      </button>

      {/* Metadata */}
      <div
        className="flex-1 min-w-0 cursor-pointer"
        onClick={() => navigate(readerPath)}
        role="button"
        tabIndex={0}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') navigate(readerPath)
        }}
        aria-label={`Open ${book.title}`}
      >
        <p className="text-sm font-semibold truncate text-foreground">{book.title}</p>
        {book.author && <p className="text-xs text-muted-foreground truncate">{book.author}</p>}
        {book.progress > 0 && <p className="text-xs text-brand mt-0.5">{book.progress}% read</p>}
      </div>

      {/* Reorder controls */}
      <div className="flex flex-col gap-0.5 flex-shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={onMoveUp}
          disabled={isFirst}
          aria-label={`Move ${book.title} up in queue`}
          data-testid={`queue-move-up-${book.id}`}
        >
          <ChevronUp className="size-3.5" aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={onMoveDown}
          disabled={isLast}
          aria-label={`Move ${book.title} down in queue`}
          data-testid={`queue-move-down-${book.id}`}
        >
          <ChevronDown className="size-3.5" aria-hidden="true" />
        </Button>
      </div>
    </div>
  )
}

export function ReadingQueueView({ books }: ReadingQueueViewProps) {
  const entries = useReadingQueueStore(s => s.entries)
  const reorderQueue = useReadingQueueStore(s => s.reorderQueue)

  // Build ordered list: match queue entries to books, sort by position
  const bookMap = new Map(books.map(b => [b.id, b]))
  const orderedEntries = [...entries]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(entry => ({ entry, book: bookMap.get(entry.bookId) }))
    .filter((item): item is { entry: typeof item.entry; book: Book } => item.book !== undefined)

  if (orderedEntries.length === 0) {
    // fix/E-ABS-QA: compact single-line empty state (height ≤ 40 px) instead
    // of the former hero-sized block — the reading queue is a secondary affordance
    // and should not dominate the library viewport when unused.
    return (
      <div
        className="flex h-10 items-center gap-2 px-3 text-sm text-muted-foreground"
        data-testid="reading-queue-empty"
      >
        <ListOrdered className="size-4 flex-shrink-0" aria-hidden="true" />
        <span className="truncate">
          Queue is empty — right-click a book and choose &ldquo;Add to Queue&rdquo;.
        </span>
      </div>
    )
  }

  return (
    <div
      className="space-y-2"
      data-testid="reading-queue-view"
      aria-label={`Reading queue with ${orderedEntries.length} book${orderedEntries.length === 1 ? '' : 's'}`}
    >
      {orderedEntries.map(({ entry, book }, index) => (
        <QueueBookRow
          key={entry.bookId}
          book={book}
          position={entry.sortOrder + 1}
          isFirst={index === 0}
          isLast={index === orderedEntries.length - 1}
          onMoveUp={() => reorderQueue(index, index - 1)}
          onMoveDown={() => reorderQueue(index, index + 1)}
        />
      ))}
    </div>
  )
}
