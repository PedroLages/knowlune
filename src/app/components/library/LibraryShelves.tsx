/**
 * LibraryShelves — two shelf sections wired to real Dexie store data.
 *
 * - "Recently Added": last 8 books from useBookStore sorted newest-first by createdAt
 * - "Continue Reading": books on the 'shelf-currently-reading' default shelf
 *
 * Each shelf is a <section aria-labelledby> landmark with an h2 heading.
 * Falls back gracefully when shelves are empty — LibraryShelfRow handles the
 * empty-scroll-area case inherently (renders zero children).
 *
 * @since E116-S03 (wired to real data: E116 chore)
 */

import { Clock, History } from 'lucide-react'
import { useBookStore } from '@/stores/useBookStore'
import { useShelfStore } from '@/stores/useShelfStore'
import { LibraryShelfRow, ShelfSeeAllLink } from '@/app/components/library'
import type { Book } from '@/data/types'

const CURRENTLY_READING_SHELF_ID = 'shelf-currently-reading'
const RECENTLY_ADDED_HEADING_ID = 'shelf-recently-added-heading'
const CONTINUE_READING_HEADING_ID = 'shelf-continue-reading-heading'
const MAX_RECENT = 8

function ShelfBookTile({ book }: { book: Book }) {
  return (
    <div
      className="w-36 sm:w-40 flex flex-col gap-2"
      data-testid={`shelf-book-tile-${book.id}`}
    >
      <div className="aspect-[2/3] rounded-xl bg-muted border border-border/50 flex items-center justify-center text-muted-foreground text-xs uppercase tracking-wide overflow-hidden">
        {book.coverUrl ? (
          <img src={book.coverUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          book.format === 'audiobook' ? 'Audio' : 'Ebook'
        )}
      </div>
      <div className="flex flex-col gap-0.5">
        <p className="text-sm font-medium text-foreground line-clamp-2">{book.title}</p>
        {book.author && (
          <p className="text-xs text-muted-foreground line-clamp-1">{book.author}</p>
        )}
      </div>
    </div>
  )
}

export function LibraryShelves() {
  const books = useBookStore(s => s.books)
  const getBooksOnShelf = useShelfStore(s => s.getBooksOnShelf)

  const recentBooks = [...books]
    .sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1))
    .slice(0, MAX_RECENT)

  const currentlyReadingIds = getBooksOnShelf(CURRENTLY_READING_SHELF_ID)
  const bookById = new Map(books.map(b => [b.id, b]))
  const currentlyReadingBooks = currentlyReadingIds
    .map(id => bookById.get(id))
    .filter((b): b is Book => b !== undefined)

  return (
    <div className="space-y-8" data-testid="library-shelves">
      <section aria-labelledby={RECENTLY_ADDED_HEADING_ID}>
        <LibraryShelfRow
          icon={Clock}
          label="Recently Added"
          headingLevel="h2"
          headingId={RECENTLY_ADDED_HEADING_ID}
          data-testid="shelf-recently-added"
          actionSlot={<ShelfSeeAllLink />}
        >
          {recentBooks.map(book => (
            <ShelfBookTile key={book.id} book={book} />
          ))}
        </LibraryShelfRow>
      </section>

      <section aria-labelledby={CONTINUE_READING_HEADING_ID}>
        <LibraryShelfRow
          icon={History}
          label="Continue Reading"
          headingLevel="h2"
          headingId={CONTINUE_READING_HEADING_ID}
          data-testid="shelf-continue-reading"
          actionSlot={<ShelfSeeAllLink />}
        >
          {currentlyReadingBooks.map(book => (
            <ShelfBookTile key={book.id} book={book} />
          ))}
        </LibraryShelfRow>
      </section>
    </div>
  )
}
