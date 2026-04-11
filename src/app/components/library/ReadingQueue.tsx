/**
 * Reading Queue section for the Library page (E110-S03).
 *
 * Displays an ordered list of books to read next with drag-and-drop
 * reordering via @dnd-kit. Each queue item shows cover, title, author,
 * and current reading progress.
 *
 * @module ReadingQueue
 * @since E110-S03
 */

import { useState, useCallback } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, X, ListOrdered } from 'lucide-react'
import { cn } from '@/app/components/ui/utils'
import { useReadingQueueStore } from '@/stores/useReadingQueueStore'
import { useBookStore } from '@/stores/useBookStore'
import { useBookCoverUrl } from '@/app/hooks/useBookCoverUrl'
import type { Book, ReadingQueueEntry } from '@/data/types'

/** Renders a single book cover thumbnail with fallback */
function QueueItemCover({ book }: { book: Book }) {
  const coverUrl = useBookCoverUrl({ bookId: book.id, coverUrl: book.coverUrl })

  if (coverUrl) {
    return <img src={coverUrl} alt="" className="h-14 w-10 shrink-0 rounded-md object-cover" />
  }

  return (
    <div className="flex h-14 w-10 shrink-0 items-center justify-center rounded-md bg-muted">
      <ListOrdered className="size-4 text-muted-foreground" aria-hidden="true" />
    </div>
  )
}

/** Sortable queue item row */
function SortableQueueItem({
  entry,
  book,
  onRemove,
}: {
  entry: ReadingQueueEntry
  book: Book
  onRemove: (bookId: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: entry.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      // eslint-disable-next-line react-best-practices/no-inline-styles -- dynamic value requires inline style
      style={style}
      {...attributes}
      role="listitem"
      aria-roledescription="sortable"
      className={cn(
        'flex items-center gap-3 rounded-xl border border-border/50 bg-card px-3 py-2',
        isDragging && 'opacity-50 shadow-lg z-10'
      )}
      data-testid={`queue-item-${book.id}`}
    >
      <button
        className="cursor-grab touch-manipulation rounded p-1 text-muted-foreground hover:text-foreground active:cursor-grabbing"
        aria-label={`Drag to reorder ${book.title}`}
        data-testid={`queue-drag-handle-${book.id}`}
        {...listeners}
      >
        <GripVertical className="size-4" aria-hidden="true" />
      </button>

      <QueueItemCover book={book} />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium" title={book.title}>
          {book.title}
        </p>
        {book.author && (
          <p className="truncate text-xs text-muted-foreground" title={book.author}>
            {book.author}
          </p>
        )}
        <div className="mt-1 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-brand transition-all"
              style={{ width: `${Math.min(100, Math.max(0, book.progress))}%` }}
            />
          </div>
          <span className="text-[10px] tabular-nums text-muted-foreground">
            {Math.round(book.progress)}%
          </span>
        </div>
      </div>

      <button
        className="shrink-0 rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        onClick={() => onRemove(book.id)}
        aria-label={`Remove ${book.title} from queue`}
        data-testid={`queue-remove-${book.id}`}
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  )
}

/** Drag overlay shown while dragging a queue item */
function QueueDragOverlay({ book }: { book: Book }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-brand/30 bg-card px-3 py-2 shadow-xl">
      <div className="rounded p-1 text-muted-foreground">
        <GripVertical className="size-4" aria-hidden="true" />
      </div>

      <QueueItemCover book={book} />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{book.title}</p>
        {book.author && <p className="truncate text-xs text-muted-foreground">{book.author}</p>}
      </div>
    </div>
  )
}

export function ReadingQueue() {
  const entries = useReadingQueueStore(s => s.entries)
  const reorderQueue = useReadingQueueStore(s => s.reorderQueue)
  const removeFromQueue = useReadingQueueStore(s => s.removeFromQueue)
  const books = useBookStore(s => s.books)

  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  // Build a map of bookId → Book for quick lookup
  const bookMap = new Map(books.map(b => [b.id, b]))

  // Filter entries to only those with existing books
  const validEntries = entries.filter(e => bookMap.has(e.bookId))

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }, [])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      setActiveId(null)

      if (!over || active.id === over.id) return

      const oldIndex = validEntries.findIndex(e => e.id === active.id)
      const newIndex = validEntries.findIndex(e => e.id === over.id)
      if (oldIndex === -1 || newIndex === -1) return

      reorderQueue(oldIndex, newIndex)
    },
    [validEntries, reorderQueue]
  )

  const activeEntry = activeId ? validEntries.find(e => e.id === activeId) : null
  const activeBook = activeEntry ? bookMap.get(activeEntry.bookId) : null

  if (validEntries.length === 0) {
    return (
      <div
        className="mb-4 rounded-2xl border border-dashed border-border/50 p-4 text-center"
        data-testid="reading-queue-empty"
      >
        <ListOrdered className="mx-auto mb-2 size-6 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">
          Your reading queue is empty. Right-click a book and select &quot;Add to Queue&quot; to get
          started.
        </p>
      </div>
    )
  }

  return (
    <div className="mb-4" data-testid="reading-queue-section">
      <div className="mb-2 flex items-center gap-2">
        <ListOrdered className="size-4 text-brand" aria-hidden="true" />
        <h3 className="text-sm font-semibold">Reading Queue</h3>
        <span
          className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand-soft-foreground"
          data-testid="reading-queue-count"
        >
          {validEntries.length}
        </span>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={validEntries.map(e => e.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-1.5" role="list" aria-label="Reading queue">
            {validEntries.map(entry => {
              const book = bookMap.get(entry.bookId)
              if (!book) return null

              return (
                <SortableQueueItem
                  key={entry.id}
                  entry={entry}
                  book={book}
                  onRemove={removeFromQueue}
                />
              )
            })}
          </div>
        </SortableContext>

        <DragOverlay>{activeBook ? <QueueDragOverlay book={activeBook} /> : null}</DragOverlay>
      </DndContext>
    </div>
  )
}
