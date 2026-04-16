/**
 * Reading Queue section for the Library page (E110-S03).
 *
 * Horizontal row of draggable book covers. Users drag covers left/right
 * to reorder their reading priority. Each card shows cover, title, and
 * a remove button on hover.
 *
 * @module ReadingQueue
 * @since E110-S03
 * @modified Library Visual Polish — horizontal card layout
 */

import { useState, useCallback, useMemo } from 'react'
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
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { X, ListOrdered, Headphones, BookOpen } from 'lucide-react'
import { cn } from '@/app/components/ui/utils'
import { useReadingQueueStore } from '@/stores/useReadingQueueStore'
import { useBookStore } from '@/stores/useBookStore'
import { useBookCoverUrl } from '@/app/hooks/useBookCoverUrl'
import type { Book, ReadingQueueEntry } from '@/data/types'

/** Sortable queue card — small cover with title below, X on hover */
function SortableQueueCard({
  entry,
  book,
  onRemove,
}: {
  entry: ReadingQueueEntry
  book: Book
  onRemove: (bookId: string) => void
}) {
  const coverUrl = useBookCoverUrl({ bookId: book.id, coverUrl: book.coverUrl })
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: entry.id,
  })
  const isAudiobook = book.format === 'audiobook'
  const FallbackIcon = isAudiobook ? Headphones : BookOpen

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
      {...listeners}
      role="listitem"
      aria-roledescription="sortable"
      aria-label={`Queue position: ${book.title}. Drag to reorder.`}
      className={cn(
        'group/queue relative w-28 flex-shrink-0 cursor-grab active:cursor-grabbing',
        isDragging && 'opacity-40 z-10'
      )}
      data-testid={`queue-item-${book.id}`}
    >
      {/* Cover */}
      <div className="relative aspect-square rounded-xl overflow-hidden shadow-card-ambient">
        {coverUrl ? (
          <img
            src={coverUrl}
            alt={`Cover of ${book.title}`}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted">
            <FallbackIcon className="size-5 text-muted-foreground" />
          </div>
        )}

        {/* Progress ring at bottom */}
        {book.progress > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-foreground/10">
            <div
              className="h-full bg-brand rounded-full"
              style={{ width: `${Math.min(100, book.progress)}%` }}
            />
          </div>
        )}

        {/* Remove button — visible on hover */}
        <button
          type="button"
          className="absolute top-1 right-1 size-6 flex items-center justify-center rounded-full bg-black/60 text-white opacity-0 group-hover/queue:opacity-100 transition-opacity hover:bg-destructive"
          onClick={e => {
            e.stopPropagation()
            onRemove(book.id)
          }}
          aria-label={`Remove ${book.title} from queue`}
          data-testid={`queue-remove-${book.id}`}
        >
          <X className="size-3.5" />
        </button>

        {/* Queue position number */}
        <div className="absolute top-1 left-1 size-5 flex items-center justify-center rounded-full bg-black/50 text-[10px] font-bold text-white">
          {entry.sortOrder + 1}
        </div>
      </div>

      {/* Title below */}
      <p className="mt-1.5 text-[11px] font-medium text-foreground leading-tight line-clamp-2 text-center px-0.5">
        {book.title}
      </p>
    </div>
  )
}

/** Drag overlay shown while dragging a queue card */
function QueueDragOverlay({ book }: { book: Book }) {
  const coverUrl = useBookCoverUrl({ bookId: book.id, coverUrl: book.coverUrl })
  const isAudiobook = book.format === 'audiobook'
  const FallbackIcon = isAudiobook ? Headphones : BookOpen

  return (
    <div className="w-28 opacity-90">
      <div className="aspect-square rounded-xl overflow-hidden shadow-xl ring-2 ring-brand/40">
        {coverUrl ? (
          <img src={coverUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted">
            <FallbackIcon className="size-5 text-muted-foreground" />
          </div>
        )}
      </div>
      <p className="mt-1.5 text-[11px] font-medium text-foreground leading-tight line-clamp-2 text-center px-0.5">
        {book.title}
      </p>
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
  const bookMap = useMemo(() => new Map(books.map(b => [b.id, b])), [books])

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
        className="mb-6 rounded-2xl border border-dashed border-border/50 p-4 text-center"
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
    <div className="mb-6" data-testid="reading-queue-section">
      <div className="mb-3 flex items-center gap-2">
        <ListOrdered className="size-5 text-brand" aria-hidden="true" />
        <h3 className="text-lg font-semibold text-foreground">Reading Queue</h3>
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
        <SortableContext
          items={validEntries.map(e => e.id)}
          strategy={horizontalListSortingStrategy}
        >
          <div className="flex gap-3" role="list" aria-label="Reading queue">
            {validEntries.map(entry => {
              const book = bookMap.get(entry.bookId)
              if (!book) return null

              return (
                <SortableQueueCard
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
