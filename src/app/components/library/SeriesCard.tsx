/**
 * Expandable series card for the Series view in the Library page.
 *
 * Collapsed: shows series cover, name, and progress count.
 * Expanded: shows all books in sequence order with progress and "Continue" highlight.
 *
 * @since E102-S02
 */

import { memo, useState, useMemo, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router'
import { BookOpen, ChevronDown } from 'lucide-react'
import type { AbsSeries, Book } from '@/data/types'
import { Badge } from '@/app/components/ui/badge'
import { CoverCollageGrid } from '@/app/components/library/CoverCollageGrid'
import { useBookStore } from '@/stores/useBookStore'
import { useAudiobookshelfStore } from '@/stores/useAudiobookshelfStore'
import { getCoverUrl } from '@/services/AudiobookshelfService'
import { cn } from '@/app/components/ui/utils'
import { useAbsApiKey } from '@/lib/credentials/absApiKeyResolver'

/** Sort series books by sequence, null sequences go to end */
function sortBySequence(books: AbsSeries['books']): AbsSeries['books'] {
  return [...books].sort((a, b) => {
    const seqA = a.sequence != null ? parseFloat(a.sequence) : Infinity
    const seqB = b.sequence != null ? parseFloat(b.sequence) : Infinity
    return seqA - seqB
  })
}

interface SeriesCardProps {
  series: AbsSeries
}

export const SeriesCard = memo(function SeriesCard({ series }: SeriesCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const navigate = useNavigate()
  const allBooks = useBookStore(s => s.books)
  const servers = useAudiobookshelfStore(s => s.servers)

  const sortedBooks = useMemo(() => sortBySequence(series.books), [series.books])

  // Map ABS series books to local Book records
  const bookMap = useMemo(() => {
    const map = new Map<string, Book>()
    for (const absBook of sortedBooks) {
      const local = allBooks.find(b => b.absItemId === absBook.id)
      if (local) map.set(absBook.id, local)
    }
    return map
  }, [sortedBooks, allBooks])

  const completed = useMemo(
    () =>
      Array.from(bookMap.values()).filter(b => b.status === 'finished' || b.progress >= 100).length,
    [bookMap]
  )
  const total = series.books.length

  // Next unfinished book: first in sequence order where not finished
  const nextUnfinishedId = useMemo(() => {
    for (const absBook of sortedBooks) {
      const local = bookMap.get(absBook.id)
      if (!local || (local.status !== 'finished' && local.progress < 100)) {
        return absBook.id
      }
    }
    return null
  }, [sortedBooks, bookMap])

  // Get connected server for cover URLs
  const server = servers.find(s => s.status === 'connected')
  // Resolve the apiKey through the vault broker (E95-S05). While the resolver
  // is in flight, cover URLs fall back to the placeholder slot.
  const { value: apiKey } = useAbsApiKey(server?.id)

  const toggleExpanded = () => setIsExpanded(prev => !prev)
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      toggleExpanded()
    }
  }

  const panelId = `series-panel-${series.id}`

  return (
    <div
      className="rounded-2xl bg-card overflow-hidden shadow-card-ambient"
      data-testid={`series-card-${series.id}`}
    >
      {/* Collapsed header — always visible */}
      <button
        type="button"
        onClick={toggleExpanded}
        onKeyDown={handleKeyDown}
        aria-expanded={isExpanded}
        aria-controls={panelId}
        aria-label={`${series.name} series, ${completed} of ${total} books complete`}
        className="flex w-full items-center gap-4 p-4 text-left hover:bg-muted/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset min-h-[64px]"
        data-testid={`series-toggle-${series.id}`}
      >
        {/* Series cover collage */}
        <CoverCollageGrid
          coverUrls={sortedBooks
            .slice(0, 4)
            .map(b => (server && apiKey ? getCoverUrl(server.url, b.id, apiKey) : null))}
          alt={`${series.name} series covers`}
          className="size-14 flex-shrink-0"
        />

        {/* Series info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{series.name}</p>
          <p className="text-xs text-muted-foreground">
            {total} {total === 1 ? 'book' : 'books'} · {completed}/{total} complete
          </p>
          <div className="h-1 w-full max-w-[120px] rounded-full bg-muted overflow-hidden mt-1">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand to-brand-hover transition-all"
              style={{ width: `${total > 0 ? (completed / total) * 100 : 0}%` }}
            />
          </div>
        </div>

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
          className="flex flex-col gap-1 pt-2 pb-1"
          data-testid={`series-books-${series.id}`}
        >
          {sortedBooks.map(absBook => {
            const localBook = bookMap.get(absBook.id)
            const isNextUnfinished = absBook.id === nextUnfinishedId
            const isFinished =
              localBook && (localBook.status === 'finished' || localBook.progress >= 100)
            const progress = localBook?.progress ?? 0
            const title = absBook.media.metadata.title

            return (
              <div
                key={absBook.id}
                role="listitem"
                className={cn(
                  'flex items-center gap-3 px-4 py-3 transition-colors',
                  isNextUnfinished && 'bg-brand-soft'
                )}
                data-testid={`series-book-${absBook.id}`}
              >
                {/* Book icon or cover */}
                <div className="w-12 h-16 flex-shrink-0 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
                  {server && apiKey ? (
                    <img
                      src={getCoverUrl(server.url, absBook.id, apiKey)}
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
                  <div className="flex items-center gap-2">
                    {absBook.sequence && (
                      <span className="text-xs font-bold text-muted-foreground tabular-nums w-6 flex-shrink-0">
                        {String(absBook.sequence).padStart(2, '0')}
                      </span>
                    )}
                    <p
                      className={cn(
                        'text-sm truncate',
                        isNextUnfinished
                          ? 'font-medium text-brand-soft-foreground'
                          : 'text-foreground'
                      )}
                    >
                      {title}
                    </p>
                  </div>
                  {/* Progress bar */}
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
                </div>

                {/* Continue badge */}
                {isNextUnfinished && (
                  <Badge
                    className="bg-brand text-brand-foreground border-transparent text-[10px] px-1.5 py-0 flex-shrink-0"
                    data-testid={`continue-badge-${absBook.id}`}
                  >
                    Continue
                  </Badge>
                )}

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
