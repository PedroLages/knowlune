/**
 * Library page — book management with grid/list views, search, filters, and empty state.
 *
 * Shows empty state with drag-drop import CTA when no books exist,
 * or a responsive book grid/list with search, status filters, and view toggle.
 *
 * @since E83-S01
 * @modified E83-S02 — added import button and BookImportDialog
 * @modified E83-S03 — full grid/list views, BookCard, BookListItem, empty state redesign
 * @modified E83-S04 — search, status filter pills, context menus
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BookOpen, Plus, WifiOff } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { BookImportDialog } from '@/app/components/library/BookImportDialog'
import { StorageIndicator } from '@/app/components/library/StorageIndicator'
import { BookCard } from '@/app/components/library/BookCard'
import { BookListItem } from '@/app/components/library/BookListItem'
import { BookContextMenu } from '@/app/components/library/BookContextMenu'
import { BookMetadataEditor } from '@/app/components/library/BookMetadataEditor'
import { LibraryFilters } from '@/app/components/library/LibraryFilters'
import { useBookStore } from '@/stores/useBookStore'
import type { Book } from '@/data/types'
import { cn } from '@/app/components/ui/utils'
import { useOnlineStatus } from '@/app/hooks/useOnlineStatus'

export function Library() {
  const isOnline = useOnlineStatus()
  const [importOpen, setImportOpen] = useState(false)
  const [droppedFile, setDroppedFile] = useState<File | null>(null)
  const [editingBook, setEditingBook] = useState<Book | null>(null)
  const books = useBookStore(s => s.books)
  const libraryView = useBookStore(s => s.libraryView)
  const getFilteredBooks = useBookStore(s => s.getFilteredBooks)
  const filters = useBookStore(s => s.filters)
  const setFilters = useBookStore(s => s.setFilters)
  const loadBooks = useBookStore(s => s.loadBooks)

  // Memoize filtered books to avoid new array on every render
  const filteredBooks = useMemo(() => getFilteredBooks(), [getFilteredBooks, books, filters])

  // Load books on mount
  useEffect(() => {
    loadBooks()
  }, [loadBooks])

  // Drag-drop state for empty state zone
  const [isDragOver, setIsDragOver] = useState(false)
  const dropRef = useRef<HTMLDivElement>(null)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (dropRef.current && !dropRef.current.contains(e.relatedTarget as Node)) {
      setIsDragOver(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const files = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith('.epub'))
    if (files.length > 0) {
      setDroppedFile(files[0])
      setImportOpen(true)
    }
  }, [])

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-foreground">Books</h1>
          {!isOnline && (
            <span
              role="status"
              aria-label="You are offline"
              className="inline-flex items-center gap-1 rounded-full bg-warning/10 px-2.5 py-0.5 text-xs font-medium text-warning-foreground"
              data-testid="library-offline-badge"
            >
              <WifiOff className="size-3" aria-hidden="true" />
              Offline
            </span>
          )}
        </div>
        <Button
          variant="brand"
          onClick={() => setImportOpen(true)}
          className="min-h-[44px]"
          data-testid="import-book-trigger"
        >
          <Plus className="mr-2 h-4 w-4" />
          Import Book
        </Button>
      </div>

      {/* Empty state */}
      {books.length === 0 && (
        <div
          ref={dropRef}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            'flex flex-col items-center justify-center gap-4 py-24 rounded-[24px] border-2 border-dashed transition-colors',
            isDragOver ? 'border-brand bg-brand-soft/20' : 'border-border/50'
          )}
        >
          <BookOpen className="size-16 text-muted-foreground/40" />
          <h2 className="text-lg font-medium text-foreground">Your library is empty</h2>
          <p className="max-w-sm text-center text-muted-foreground">
            Import your first book to get started. Drag and drop an EPUB file here, or click the
            button below.
          </p>
          <Button
            variant="brand"
            onClick={() => setImportOpen(true)}
            className="min-h-[44px]"
            data-testid="import-first-book-cta"
          >
            <Plus className="mr-2 h-4 w-4" />
            Import Your First Book
          </Button>
        </div>
      )}

      {/* Filters — only show when books exist */}
      {books.length > 0 && <LibraryFilters />}

      {/* Grid view */}
      {books.length > 0 && libraryView === 'grid' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filteredBooks.map(book => (
            <BookContextMenu key={book.id} book={book} onEdit={() => setEditingBook(book)}>
              <BookCard book={book} />
            </BookContextMenu>
          ))}
        </div>
      )}

      {/* List view */}
      {books.length > 0 && libraryView === 'list' && (
        <div className="flex flex-col divide-y divide-border/50">
          {filteredBooks.map(book => (
            <BookContextMenu key={book.id} book={book} onEdit={() => setEditingBook(book)}>
              <BookListItem book={book} />
            </BookContextMenu>
          ))}
        </div>
      )}

      {/* No results message */}
      {books.length > 0 && filteredBooks.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-12">
          <p className="text-muted-foreground">No books match your filters.</p>
          <Button
            variant="outline"
            onClick={() => setFilters({})}
            className="min-h-[44px]"
            data-testid="clear-filters"
          >
            Clear filters
          </Button>
        </div>
      )}

      {/* Storage indicator — only when books exist */}
      {books.length > 0 && (
        <StorageIndicator bookCount={books.length} refreshKey={books.length} />
      )}

      <BookImportDialog
        open={importOpen}
        onOpenChange={open => {
          setImportOpen(open)
          if (!open) setDroppedFile(null)
        }}
        initialFile={droppedFile}
      />

      <BookMetadataEditor
        book={editingBook}
        open={editingBook !== null}
        onOpenChange={open => {
          if (!open) setEditingBook(null)
        }}
      />
    </div>
  )
}
