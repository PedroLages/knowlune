/**
 * Library page — book management with grid/list views and empty state.
 *
 * Shows empty state with drag-drop import CTA when no books exist,
 * or a responsive book grid/list with view toggle.
 *
 * @since E83-S01
 * @modified E83-S02 — added import button and BookImportDialog
 * @modified E83-S03 — full grid/list views, BookCard, BookListItem, empty state redesign
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { BookOpen, LayoutGrid, List, Plus } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { BookImportDialog } from '@/app/components/library/BookImportDialog'
import { BookCard } from '@/app/components/library/BookCard'
import { BookListItem } from '@/app/components/library/BookListItem'
import { useBookStore } from '@/stores/useBookStore'
import { cn } from '@/app/components/ui/utils'

export function Library() {
  const [importOpen, setImportOpen] = useState(false)
  const [droppedFile, setDroppedFile] = useState<File | null>(null)
  const books = useBookStore(s => s.books)
  const libraryView = useBookStore(s => s.libraryView)
  const setLibraryView = useBookStore(s => s.setLibraryView)
  const loadBooks = useBookStore(s => s.loadBooks)

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
    // Only leave if actually leaving the drop zone
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
        <h1 className="text-2xl font-semibold text-foreground">Books</h1>
        <div className="flex items-center gap-2">
          {/* View toggle — only show when books exist */}
          {books.length > 0 && (
            <div className="flex items-center rounded-lg border border-border/50 p-0.5">
              <button
                onClick={() => setLibraryView('grid')}
                className={cn(
                  'rounded-md p-1.5 transition-colors',
                  libraryView === 'grid'
                    ? 'bg-brand text-brand-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                aria-label="Grid view"
                aria-pressed={libraryView === 'grid'}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setLibraryView('list')}
                className={cn(
                  'rounded-md p-1.5 transition-colors',
                  libraryView === 'list'
                    ? 'bg-brand text-brand-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                aria-label="List view"
                aria-pressed={libraryView === 'list'}
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          )}
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

      {/* Grid view */}
      {books.length > 0 && libraryView === 'grid' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {books.map(book => (
            <BookCard key={book.id} book={book} />
          ))}
        </div>
      )}

      {/* List view */}
      {books.length > 0 && libraryView === 'list' && (
        <div className="flex flex-col divide-y divide-border/50">
          {books.map(book => (
            <BookListItem key={book.id} book={book} />
          ))}
        </div>
      )}

      <BookImportDialog
        open={importOpen}
        onOpenChange={open => {
          setImportOpen(open)
          if (!open) setDroppedFile(null)
        }}
        initialFile={droppedFile}
      />
    </div>
  )
}
