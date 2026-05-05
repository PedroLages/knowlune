/**
 * BookTile — unified tile component for Library media shelves.
 *
 * Two variants, both using the shared shelf card width class and square covers
 * (matching Discover shelf card sizing for visual consistency):
 * - `small`: used for Recently Added shelf
 * - `denseContinue`: used for Continue Listening/Reading shelf (adds progress bar + meta)
 *
 * All covers use aspect-square with object-cover — square audiobook art fills
 * the frame natively (no padding needed).
 *
 * Overlay on hover/focus shows a format-aware action icon (PlayCircle for
 * audiobooks, BookOpen for ebooks). A persistent "Audio" badge appears for
 * audiobooks in the default (non-hover) state.
 * Progress display (thin bar + meta line) only on the denseContinue variant.
 *
 * Titles use a single token (no "blue title" group-hover:brand bug).
 */

import { memo, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router'
import { BookOpen, Headphones, PlayCircle } from 'lucide-react'
import type { Book } from '@/data/types'
import { useBookCoverUrl } from '@/app/hooks/useBookCoverUrl'
import { getBookDestinationPath } from '@/lib/bookNavigation'
import { cn } from '@/app/components/ui/utils'
import { LIBRARY_SHELF_CARD_WIDTH_CLASS } from '@/app/components/library/shelfCardSizing'

export type BookTileVariant = 'small' | 'denseContinue'

export interface BookTileProps {
  book: Book
  /** Tile variant: small (square) or denseContinue (square + progress) */
  variant: BookTileVariant
  /** When true, show progress bar + meta line (Continue variant only) */
  showProgress?: boolean
  /** Optional className for wrapping/sizing overrides */
  className?: string
}

function formatRemainingTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return '0m'
  const safe = Math.max(0, seconds)
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

function getProgressMeta(book: Book): string {
  const progressLabel = `${Math.round(book.progress)}%`

  if (
    book.format === 'audiobook' &&
    typeof book.totalDuration === 'number' &&
    book.totalDuration > 0 &&
    book.currentPosition?.type === 'time'
  ) {
    const remaining = Math.max(0, book.totalDuration - (book.currentPosition.seconds ?? 0))
    return `${formatRemainingTime(remaining)} left · ${progressLabel}`
  }

  if (
    (book.format === 'epub' || book.format === 'pdf') &&
    typeof book.totalPages === 'number' &&
    book.totalPages > 0 &&
    book.currentPosition?.type === 'page'
  ) {
    const pagesLeft = Math.max(0, book.totalPages - (book.currentPosition.pageNumber ?? 0))
    return `${pagesLeft} pages left · ${progressLabel}`
  }

  return `left · ${progressLabel}`
}

const VARIANT_SIZES: Record<
  BookTileVariant,
  { container: string; cover: string }
> = {
  small: {
    container: LIBRARY_SHELF_CARD_WIDTH_CLASS,
    cover: `${LIBRARY_SHELF_CARD_WIDTH_CLASS} aspect-square`,
  },
  denseContinue: {
    container: LIBRARY_SHELF_CARD_WIDTH_CLASS,
    cover: `${LIBRARY_SHELF_CARD_WIDTH_CLASS} aspect-square`,
  },
}

export const BookTile = memo(function BookTile({
  book,
  variant,
  showProgress = false,
  className,
}: BookTileProps) {
  const navigate = useNavigate()
  const resolvedCoverUrl = useBookCoverUrl({ bookId: book.id, coverUrl: book.coverUrl })
  const isAudiobook = book.format === 'audiobook'
  const FallbackIcon = isAudiobook ? Headphones : BookOpen
  const ActionIcon = isAudiobook ? PlayCircle : BookOpen
  const readerPath = getBookDestinationPath(book)

  const sizes = VARIANT_SIZES[variant]

  const handleClick = () => navigate(readerPath)
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      navigate(readerPath)
    }
  }

  const ariaActionLabel = isAudiobook ? 'Play' : 'Open'

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={cn(
        'group/tile cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-lg',
        sizes.container,
        className
      )}
      data-testid={`book-tile-${book.id}`}
      data-rail-tile
      aria-label={`${ariaActionLabel} ${book.title}`}
    >
      {/* Cover container — square frame, matches Discover card sizing */}
      <div
        className={cn(
          'relative overflow-hidden rounded-2xl shadow-card-ambient transition-all duration-300',
          'group-hover/tile:-translate-y-2 group-hover/tile:shadow-[0_10px_30px_var(--shadow-brand)]',
          'isolate [transform:translateZ(0)]',
          sizes.cover,
          'bg-muted'
        )}
      >
        {resolvedCoverUrl ? (
          <img
            src={resolvedCoverUrl}
            alt={`Cover of ${book.title}`}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover/tile:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <FallbackIcon className="size-8 text-muted-foreground" aria-hidden="true" />
          </div>
        )}

        {/* Hover/Focus overlay with format-aware action icon */}
        <div
          className={cn(
            'absolute inset-0 flex items-center justify-center',
            'bg-foreground/0 transition-colors duration-200',
            'group-hover/tile:bg-foreground/30 group-focus-within/tile:bg-foreground/30'
          )}
        >
          <ActionIcon
            className={cn(
              'size-10 text-white',
              'opacity-0 transition-opacity duration-200',
              'group-hover/tile:opacity-100 group-focus-within/tile:opacity-100'
            )}
            aria-hidden="true"
          />
        </div>

        {/* Audio badge — top-left, audiobooks only (persistent format indicator) */}
        {isAudiobook && (
          <span
            className={cn(
              'absolute top-2 left-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5',
              'bg-brand-soft text-brand-soft-foreground text-[10px] font-medium leading-tight z-10'
            )}
            aria-label="Audio format"
            data-testid={`book-tile-${book.id}-audio-badge`}
          >
            <Headphones className="size-3" aria-hidden="true" />
            Audio
          </span>
        )}

        {/* Progress bar — denseContinue variant only, pinned to bottom of cover */}
        {showProgress && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-foreground/25 z-10">
            <div
              className="h-full rounded-full bg-brand transition-all"
              style={{ width: `${Math.max(0, Math.min(100, book.progress))}%` }}
            />
          </div>
        )}
      </div>

      {/* Title + Author + optional progress meta */}
      <div className="mt-3 px-1 text-center">
        <p className="line-clamp-2 text-sm font-bold leading-tight text-foreground">
          {book.title}
        </p>
        {book.author && (
          <p className="mt-1 truncate text-xs text-muted-foreground">{book.author}</p>
        )}
        {showProgress && (
          <p
            className="mt-1 truncate text-xs text-muted-foreground"
            data-testid={`book-tile-${book.id}-progress-meta`}
          >
            {getProgressMeta(book)}
          </p>
        )}
      </div>
    </div>
  )
})
