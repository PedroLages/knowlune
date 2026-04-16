/**
 * Smart grouped view for the Library page.
 *
 * Extends LocalSeriesView's approach: renders series rows first (via
 * LocalSeriesCard), then splits ungrouped books into format sections
 * ("Audiobooks" / "Ebooks") when the "All" format tab is active.
 *
 * When a specific format tab is selected, behaves identically to
 * LocalSeriesView (flat ungrouped grid, no sub-sections).
 */

import { useMemo, useState } from 'react'
import { Headphones, BookOpen, Sparkles } from 'lucide-react'
import { LocalSeriesCard } from '@/app/components/library/LocalSeriesCard'
import { BookContextMenu } from '@/app/components/library/BookContextMenu'
import { BookCard } from '@/app/components/library/BookCard'
import { RecentBookCard } from '@/app/components/library/RecentBookCard'
import { BookListItem } from '@/app/components/library/BookListItem'
import type { Book, LocalSeriesGroup } from '@/data/types'

type FormatTab = 'all' | 'audiobooks' | 'ebooks'

interface SmartGroupedViewProps {
  getBooksBySeries: () => { groups: LocalSeriesGroup[]; ungrouped: Book[] }
  onEdit: (book: Book) => void
  filteredBookIds: string[]
  formatTab: FormatTab
  viewMode: 'grid' | 'list'
}

const GRID_CLASSES = 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6'

function BookGrid({ books, onEdit }: { books: Book[]; onEdit: (book: Book) => void }) {
  return (
    <div className={GRID_CLASSES}>
      {books.map(book => (
        <BookContextMenu key={book.id} book={book} onEdit={() => onEdit(book)}>
          <BookCard book={book} />
        </BookContextMenu>
      ))}
    </div>
  )
}

function BookList({ books, onEdit }: { books: Book[]; onEdit: (book: Book) => void }) {
  return (
    <div className="flex flex-col gap-2">
      {books.map(book => (
        <BookContextMenu key={book.id} book={book} onEdit={() => onEdit(book)}>
          <BookListItem book={book} />
        </BookContextMenu>
      ))}
    </div>
  )
}

function SectionHeading({
  icon: Icon,
  label,
  count,
  testId,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  count: number
  testId: string
}) {
  return (
    <h3
      className="flex items-center gap-2 text-lg font-semibold text-foreground mb-4"
      data-testid={testId}
    >
      <Icon className="size-5" aria-hidden="true" />
      {label} <span className="text-muted-foreground font-normal">({count})</span>
    </h3>
  )
}

function CollapsibleSection({
  books,
  onEdit,
  viewMode,
  icon,
  label,
  testId,
}: {
  books: Book[]
  onEdit: (book: Book) => void
  viewMode: 'grid' | 'list'
  icon: React.ComponentType<{ className?: string }>
  label: string
  testId: string
}) {
  const [expanded, setExpanded] = useState(false)
  const SECTION_LIMIT = 10
  const displayedBooks = expanded ? books : books.slice(0, SECTION_LIMIT)
  const BooksView = viewMode === 'list' ? BookList : BookGrid

  return (
    <div className="mb-8">
      <SectionHeading icon={icon} label={label} count={books.length} testId={testId} />
      <BooksView books={displayedBooks} onEdit={onEdit} />
      {books.length > SECTION_LIMIT && !expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="mt-4 text-sm font-medium text-brand hover:text-brand-hover transition-colors"
          data-testid={`${testId}-show-all`}
        >
          Show All ({books.length})
        </button>
      )}
    </div>
  )
}

export function SmartGroupedView({
  getBooksBySeries,
  onEdit,
  filteredBookIds,
  formatTab,
  viewMode,
}: SmartGroupedViewProps) {
  const { groups, ungrouped } = useMemo(() => getBooksBySeries(), [filteredBookIds])

  // Split ungrouped books by format (only used when "All" tab is active)
  const { audiobooks, ebooks } = useMemo(() => {
    if (formatTab !== 'all') return { audiobooks: [], ebooks: [] }
    return {
      audiobooks: ungrouped.filter(b => b.format === 'audiobook'),
      ebooks: ungrouped.filter(b => b.format === 'epub' || b.format === 'pdf'),
    }
  }, [ungrouped, formatTab])

  const recentlyAdded = useMemo(() => {
    if (formatTab !== 'all') return []
    const allBooks = [...groups.flatMap(g => g.books), ...ungrouped]
    return [...allBooks]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 12)
  }, [groups, ungrouped, formatTab])

  const hasMultipleFormats = audiobooks.length > 0 && ebooks.length > 0
  const BooksView = viewMode === 'list' ? BookList : BookGrid

  // Empty state — no books match filters at all
  if (groups.length === 0 && ungrouped.length === 0) {
    const formatMessages: Record<FormatTab, string> = {
      all: 'No books match your filters.',
      audiobooks: 'No audiobooks in your library yet.',
      ebooks: 'No ebooks in your library yet.',
    }
    return (
      <div className="flex flex-col items-center gap-3 py-12" data-testid="smart-grouped-empty">
        <p className="text-muted-foreground">{formatMessages[formatTab]}</p>
      </div>
    )
  }

  return (
    <div data-testid="smart-grouped-view">
      {/* Recently Added */}
      {recentlyAdded.length > 0 && (
        <div className="mb-8">
          <SectionHeading
            icon={Sparkles}
            label="Recently Added"
            count={recentlyAdded.length}
            testId="section-heading-recently-added"
          />
          <div className="flex gap-4 overflow-x-auto scrollbar-none">
            {recentlyAdded.map(book => (
              <div key={book.id} className="w-44 flex-shrink-0">
                <BookContextMenu book={book} onEdit={() => onEdit(book)}>
                  <RecentBookCard book={book} />
                </BookContextMenu>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Series groups (only render when series exist — no empty state hint needed) */}
      {groups.length > 0 && (
        <div className="flex flex-col gap-3">
          {groups.map(group => (
            <LocalSeriesCard key={group.name} group={group} />
          ))}
        </div>
      )}

      {/* Ungrouped books — format-split when "All" tab, flat otherwise */}
      {ungrouped.length > 0 && (
        <div className="mt-6">
          {formatTab === 'all' && hasMultipleFormats ? (
            <>
              {/* Audiobooks section */}
              {audiobooks.length > 0 && (
                <CollapsibleSection books={audiobooks} onEdit={onEdit} viewMode={viewMode} icon={Headphones} label="Audiobooks" testId="section-heading-audiobooks" />
              )}
              {/* Ebooks section */}
              {ebooks.length > 0 && (
                <CollapsibleSection books={ebooks} onEdit={onEdit} viewMode={viewMode} icon={BookOpen} label="Ebooks" testId="section-heading-ebooks" />
              )}
            </>
          ) : (
            <>
              <h3
                className="text-lg font-semibold text-foreground mb-4"
                data-testid="ungrouped-heading"
              >
                Ungrouped <span className="text-muted-foreground font-normal">({ungrouped.length})</span>
              </h3>
              <BooksView books={ungrouped} onEdit={onEdit} />
            </>
          )}
        </div>
      )}
    </div>
  )
}
