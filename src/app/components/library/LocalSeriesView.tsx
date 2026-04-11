/**
 * Local series grouping view (E110-S02).
 *
 * Renders LocalSeriesCard rows for each series group with ungrouped
 * books shown in a grid at the bottom. Extracted from Library.tsx to
 * keep the page component under the 500-line threshold.
 *
 * @since E110-S02
 */

import { Layers } from 'lucide-react'
import { LocalSeriesCard } from '@/app/components/library/LocalSeriesCard'
import { BookContextMenu } from '@/app/components/library/BookContextMenu'
import { BookCard } from '@/app/components/library/BookCard'
import type { Book, LocalSeriesGroup } from '@/data/types'

interface LocalSeriesViewProps {
  getBooksBySeries: () => { groups: LocalSeriesGroup[]; ungrouped: Book[] }
  onEdit: (book: Book) => void
}

export function LocalSeriesView({ getBooksBySeries, onEdit }: LocalSeriesViewProps) {
  const { groups, ungrouped } = getBooksBySeries()

  return (
    <div data-testid="local-series-view">
      {groups.length === 0 && ungrouped.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-12">
          <p className="text-muted-foreground" data-testid="local-series-empty-state">
            No books match your filters.
          </p>
        </div>
      )}
      {groups.length === 0 && ungrouped.length > 0 && (
        <div className="flex flex-col items-center gap-3 py-12">
          <Layers className="size-8 text-muted-foreground/50" aria-hidden="true" />
          <p className="text-muted-foreground" data-testid="local-series-no-series">
            No books have series metadata yet.
          </p>
          <p className="text-xs text-muted-foreground">
            Edit a book&apos;s details to assign it to a series.
          </p>
        </div>
      )}
      {groups.length > 0 && (
        <div className="flex flex-col gap-3">
          {groups.map(group => (
            <LocalSeriesCard key={group.name} group={group} />
          ))}
        </div>
      )}
      {/* Ungrouped books — shown after series groups */}
      {ungrouped.length > 0 && groups.length > 0 && (
        <div className="mt-6">
          <h3
            className="text-sm font-medium text-muted-foreground mb-3"
            data-testid="ungrouped-heading"
          >
            Ungrouped ({ungrouped.length})
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {ungrouped.map(book => (
              <BookContextMenu key={book.id} book={book} onEdit={() => onEdit(book)}>
                <BookCard book={book} />
              </BookContextMenu>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
