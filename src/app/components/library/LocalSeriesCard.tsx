/**
 * Expandable series card for local book series grouping.
 *
 * Collapsed: shows series name, progress count, and cover collage.
 * Expanded: shows all books in sequence order with progress and "Continue" badge.
 *
 * Mirrors the ABS SeriesCard (E102-S02) pattern but uses local Book records
 * instead of AbsSeries objects.
 *
 * @since E110-S02
 */

import { memo, useState } from 'react'
import { useNavigate } from 'react-router'
import { BookOpen, ChevronDown } from 'lucide-react'
import type { LocalSeriesGroup } from '@/data/types'
import { Badge } from '@/app/components/ui/badge'
import { cn } from '@/app/components/ui/utils'

interface LocalSeriesCardProps {
  group: LocalSeriesGroup
}

export const LocalSeriesCard = memo(function LocalSeriesCard({ group }: LocalSeriesCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const navigate = useNavigate()

  const toggleExpanded = () => setIsExpanded(prev => !prev)

  const panelId = `local-series-panel-${group.name.replace(/\s+/g, '-').toLowerCase()}`
  const cardId = `local-series-${group.name.replace(/\s+/g, '-').toLowerCase()}`

  return (
    <div className="rounded-2xl bg-card overflow-hidden shadow-card-ambient" data-testid={cardId}>
      {/* Collapsed header */}
      <button
        type="button"
        onClick={toggleExpanded}
        aria-expanded={isExpanded}
        aria-controls={panelId}
        aria-label={`${group.name} series, ${group.completed} of ${group.total} books complete`}
        className="flex w-full items-center gap-4 p-4 text-left hover:bg-muted/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset min-h-[64px]"
        data-testid={`${cardId}-toggle`}
      >
        {/* Cover collage — show up to 4 book covers */}
        <div className="size-14 flex-shrink-0 grid grid-cols-2 grid-rows-2 gap-0.5 rounded-lg overflow-hidden bg-muted">
          {group.books.slice(0, 4).map(book => (
            <div
              key={book.id}
              className="w-full h-full bg-muted flex items-center justify-center overflow-hidden"
            >
              {book.coverUrl ? (
                <img
                  src={book.coverUrl}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              ) : (
                <BookOpen className="size-3 text-muted-foreground" aria-hidden="true" />
              )}
            </div>
          ))}
          {/* Fill remaining slots if fewer than 4 books */}
          {Array.from({ length: Math.max(0, 4 - group.books.length) }).map((_, i) => (
            <div key={`empty-${i}`} className="w-full h-full bg-muted" />
          ))}
        </div>

        {/* Series info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{group.name}</p>
          <p className="text-xs text-muted-foreground">
            {group.total} {group.total === 1 ? 'book' : 'books'} · {group.completed}/{group.total}{' '}
            complete
          </p>
          <div className="h-1 w-full max-w-[120px] rounded-full bg-muted overflow-hidden mt-1">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand to-brand-hover transition-all"
              style={{ width: `${group.total > 0 ? (group.completed / group.total) * 100 : 0}%` }}
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
          data-testid={`${cardId}-books`}
        >
          {group.books.map(book => {
            const isNextUnfinished = book.id === group.nextUnfinishedId
            const isFinished = book.status === 'finished' || book.progress >= 100
            const progress = book.progress ?? 0

            return (
              <div
                key={book.id}
                role="listitem"
                className={cn(
                  'flex items-center gap-3 px-4 py-3 transition-colors',
                  isNextUnfinished && 'bg-brand-soft'
                )}
                data-testid={`series-book-${book.id}`}
              >
                {/* Book cover */}
                <div className="w-12 h-16 flex-shrink-0 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
                  {book.coverUrl ? (
                    <img
                      src={book.coverUrl}
                      alt={`Cover of ${book.title}`}
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
                    {book.seriesSequence && (
                      <span className="text-xs font-bold text-muted-foreground tabular-nums w-6 flex-shrink-0">
                        {String(book.seriesSequence).padStart(2, '0')}
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
                      {book.title}
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
                    data-testid={`continue-badge-${book.id}`}
                  >
                    Continue
                  </Badge>
                )}

                {/* Navigate to book */}
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation()
                    navigate(`/library/${book.id}/read`)
                  }}
                  className="text-xs text-brand hover:underline flex-shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center"
                  aria-label={`Open ${book.title}`}
                >
                  Open
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
})
