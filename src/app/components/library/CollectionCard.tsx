/**
 * Expandable collection card for the Collections view in the Library page.
 *
 * Collapsed: shows collection name, description excerpt, and book count.
 * Expanded: shows all books in the collection with progress and navigation.
 *
 * Follows the same accordion-style expansion pattern as SeriesCard (E102-S02).
 *
 * @since E102-S03
 */

import { memo, useState, useMemo, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router'
import { BookOpen, ChevronDown, Headphones } from 'lucide-react'
import type { AbsCollection, Book } from '@/data/types'
import { Badge } from '@/app/components/ui/badge'
import { useBookStore } from '@/stores/useBookStore'
import { useAudiobookshelfStore } from '@/stores/useAudiobookshelfStore'
import { getCoverUrl } from '@/services/AudiobookshelfService'
import { cn } from '@/app/components/ui/utils'

interface CollectionCardProps {
  collection: AbsCollection
}

export const CollectionCard = memo(function CollectionCard({ collection }: CollectionCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const navigate = useNavigate()
  const allBooks = useBookStore(s => s.books)
  const servers = useAudiobookshelfStore(s => s.servers)

  // Build O(1) lookup index from allBooks keyed by absItemId, then resolve
  // collection books in a single pass — avoids O(n*m) with allBooks.find() per item.
  const bookMap = useMemo(() => {
    const index = new Map<string, Book>()
    for (const book of allBooks) {
      if (book.absItemId) index.set(book.absItemId, book)
    }
    const map = new Map<string, Book>()
    for (const absBook of collection.books) {
      const local = index.get(absBook.id)
      if (local) map.set(absBook.id, local)
    }
    return map
  }, [collection.books, allBooks])

  const total = collection.books.length

  // Get cover URL from first book
  const server = servers.find(s => s.status === 'connected')
  const firstBookId = collection.books[0]?.id
  const coverUrl = server && firstBookId ? getCoverUrl(server.url, firstBookId, server.apiKey) : null

  const toggleExpanded = () => setIsExpanded(prev => !prev)
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      toggleExpanded()
    }
  }

  const panelId = `collection-panel-${collection.id}`

  return (
    <div
      className="rounded-2xl border border-border/50 bg-card overflow-hidden shadow-sm"
      data-testid={`collection-card-${collection.id}`}
    >
      {/* Collapsed header — always visible */}
      <button
        type="button"
        onClick={toggleExpanded}
        onKeyDown={handleKeyDown}
        aria-expanded={isExpanded}
        aria-controls={panelId}
        aria-label={`${collection.name} collection, ${total} ${total === 1 ? 'audiobook' : 'audiobooks'}`}
        className="flex w-full items-center gap-4 p-4 text-left hover:bg-muted/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset min-h-[64px]"
        data-testid={`collection-toggle-${collection.id}`}
      >
        {/* Collection cover */}
        <div className="size-12 flex-shrink-0 rounded-lg overflow-hidden bg-muted">
          {coverUrl ? (
            <img
              src={coverUrl}
              alt={`${collection.name} collection cover`}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Headphones className="size-5 text-muted-foreground" aria-hidden="true" />
            </div>
          )}
        </div>

        {/* Collection info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{collection.name}</p>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {total} {total === 1 ? 'audiobook' : 'audiobooks'}
            </span>
          </div>
          {collection.description && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {collection.description}
            </p>
          )}
        </div>

        {/* Item count badge */}
        <Badge
          variant="secondary"
          className="flex-shrink-0 text-xs"
          data-testid={`collection-count-${collection.id}`}
        >
          {total}
        </Badge>

        {/* Expand chevron */}
        <ChevronDown
          className={cn(
            'size-5 text-muted-foreground transition-transform flex-shrink-0',
            isExpanded && 'rotate-180'
          )}
          aria-hidden="true"
        />
      </button>

      {/* Expanded book list */}
      {isExpanded && (
        <div
          id={panelId}
          role="list"
          className="border-t border-border/50 divide-y divide-border/30"
          data-testid={`collection-books-${collection.id}`}
        >
          {collection.books.map(absBook => {
            const localBook = bookMap.get(absBook.id)
            const progress = localBook?.progress ?? 0
            const isFinished =
              localBook && (localBook.status === 'finished' || localBook.progress >= 100)
            const title = absBook.media.metadata.title

            return (
              <div
                key={absBook.id}
                role="listitem"
                className="flex items-center gap-3 px-4 py-3 transition-colors"
                data-testid={`collection-book-${absBook.id}`}
              >
                {/* Book cover */}
                <div className="size-8 flex-shrink-0 rounded bg-muted flex items-center justify-center overflow-hidden">
                  {server ? (
                    <img
                      src={getCoverUrl(server.url, absBook.id, server.apiKey)}
                      alt={`Cover of ${title}`}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <BookOpen className="size-4 text-muted-foreground" aria-hidden="true" />
                  )}
                </div>

                {/* Book info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate">{title}</p>
                  {/* Progress bar */}
                  {localBook && (
                    <div className="flex items-center gap-2 mt-1">
                      <div className="h-1 flex-1 rounded-full bg-muted overflow-hidden max-w-[120px]">
                        <div
                          className="h-full rounded-full bg-brand transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground tabular-nums">
                        {isFinished ? 'Done' : `${progress}%`}
                      </span>
                    </div>
                  )}
                </div>

                {/* Navigate to book */}
                {localBook && (
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation()
                      navigate(`/library/${localBook.id}/read`)
                    }}
                    className="text-xs text-brand hover:underline flex-shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center"
                    aria-label={`Open ${title}`}
                  >
                    Open
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
})
