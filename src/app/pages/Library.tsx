/**
 * Library page — book management and reading.
 *
 * Shows empty state with import CTA, or book grid (E83-S03).
 * Import dialog handles EPUB file import with metadata extraction.
 *
 * @since E83-S01
 * @modified E83-S02 — added import button and BookImportDialog
 */

import { useState } from 'react'
import { Library as LibraryIcon, Plus } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { BookImportDialog } from '@/app/components/library/BookImportDialog'
import { useBookStore } from '@/stores/useBookStore'

export function Library() {
  const [importOpen, setImportOpen] = useState(false)
  const books = useBookStore(s => s.books)

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Your Library</h1>
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

      {/* Empty state — shown when no books exist */}
      {books.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-4 py-24">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-soft">
            <LibraryIcon className="h-8 w-8 text-brand-soft-foreground" />
          </div>
          <p className="max-w-sm text-center text-muted-foreground">
            Import your first book to get started. Supports EPUB, PDF, and
            audiobook formats.
          </p>
          <Button
            variant="brand-outline"
            onClick={() => setImportOpen(true)}
            className="min-h-[44px]"
            data-testid="import-first-book-cta"
          >
            <Plus className="mr-2 h-4 w-4" />
            Import Your First Book
          </Button>
        </div>
      )}

      {/* Book grid placeholder — implemented in E83-S03 */}
      {books.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {books.map(book => (
            <div
              key={book.id}
              className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3"
              data-testid={`book-card-${book.id}`}
            >
              {book.coverUrl ? (
                <div className="aspect-[2/3] overflow-hidden rounded-lg bg-muted">
                  <div className="flex h-full items-center justify-center">
                    <LibraryIcon className="h-8 w-8 text-muted-foreground" />
                  </div>
                </div>
              ) : (
                <div className="flex aspect-[2/3] items-center justify-center rounded-lg bg-muted">
                  <LibraryIcon className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {book.title}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {book.author}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      <BookImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  )
}
