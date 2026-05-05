/**
 * BookTile — unified tile component for Library media shelves.
 *
 * Two variants:
 * - `small` (128×192): used for Recently Added / Discover shelves
 * - `denseContinue` (144×216): used for Continue Listening/Reading shelf
 *
 * All covers use a 2:3 portrait frame. Audiobook square covers are padded
 * inside the frame (no cropping) with a theme-aware brand surface background.
 *
 * Overlay on hover/focus shows the primary action CTA (e.g., "Continue", "Open").
 * A single "Audio" badge appears for audiobooks (no competing top-right icons).
 * Progress display (thin bar + meta line) only on the denseContinue variant.
 *
 * Titles use a single token (no "blue title" group-hover:brand bug).
 */

import { memo, type KeyboardEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { BookOpen, Headphones } from 'lucide-react'
import type { Book } from '@/data/types'
import { useBookCoverUrl } from '@/app/hooks/useBookCoverUrl'
import { getBookDestinationPath } from '@/lib/bookNavigation'
import { cn } from '@/app/components/ui/utils'

export type BookTileVariant = 'small' | 'denseContinue'

export interface BookTileProps {
  book: Book
  /** Tile variant: small (128×192) or denseContinue (144×216) */
  variant: BookTileVariant
  /** Primary action label for the hover/focus overlay */
  overlayAction: ReactNode
  /** When true, show progress bar + meta line (Continue variant only) */
  showProgress?: boolean
  /** Optional className for wrapping/sizing overrides */
  className?: string
}

function formatRemainingTime(seconds: number): string {
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
    const remaining = Math.max(0, book.totalDuration - book.currentPosition.seconds)
    return `${formatRemainingTime(remaining)} left · ${progressLabel}`
  }

  if (
    (book.format === 'epub' || book.format === 'pdf') &&
    typeof book.totalPages === 'number' &&
    book.totalPages > 0 &&
    book.currentPosition?.type === 'page'
  ) {
    const pagesLeft = Math.max(0, book.totalPages - book.currentPosition.pageNumber)
    return `${pagesLeft} pages left · ${progressLabel}`
  }

  return `left · ${progressLabel}`
}

const VARIANT_SIZES: Record<
  BookTileVariant,
  { container: string; cover: string }
> = {
  small: {
    container: 'w-32',
    cover: 'w-32 aspect-[2/3]',
  },
  denseContinue: {
    container: 'w-36',
    cover: 'w-36 aspect-[2/3]',
  },
}

export const BookTile = memo(function BookTile({
  book,
  variant,
  overlayAction,
  showProgress = false,
  className,
}: BookTileProps) {
  const navigate = useNavigate()
  const resolvedCoverUrl = useBookCoverUrl({ bookId: book.id, coverUrl: book.coverUrl })
  const isAudiobook = book.format === 'audiobook'
  const FallbackIcon = isAudiobook ? Headphones : BookOpen
  const readerPath = getBookDestinationPath(book)

  const sizes = VARIANT_SIZES[variant]

  const handleClick = () => navigate(readerPath)
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      navigate(readerPath)
    }
  }

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={cn(
        'group/tile cursor-pointer focus-visible:outline-none',
        sizes.container,
        className
      )}
      data-testid={`book-tile-${book.id}`}
      data-rail-tile
      aria-label={`${overlayAction} ${book.title}`}
    >
      {/* Cover container — fixed 2:3 portrait frame */}
      <div
        className={cn(
          'relative overflow-hidden rounded-2xl shadow-card-ambient transition-all duration-300',
          'group-hover/tile:-translate-y-1 group-hover/tile:shadow-[0_8px_24px_var(--shadow-brand)]',
          sizes.cover,
          isAudiobook ? 'bg-brand-soft' : 'bg-muted'
        )}
      >
        {resolvedCoverUrl ? (
          <img
            src={resolvedCoverUrl}
            alt={`Cover of ${book.title}`}
            loading="lazy"
            className={cn(
              'h-full w-full transition-transform duration-300 group-hover/tile:scale-105',
              isAudiobook ? 'object-contain p-[12%]' : 'object-cover'
            )}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <FallbackIcon className="size-8 text-muted-foreground" aria-hidden="true" />
          </div>
        )}

        {/* Hover/Focus overlay with action CTA */}
        <div
          className={cn(
            'absolute inset-0 flex items-center justify-center',
            'bg-black/0 transition-colors duration-200',
            'group-hover/tile:bg-black/30 group-focus-within/tile:bg-black/30'
          )}
        >
          <span
            className={cn(
              'rounded-full bg-white/90 px-4 py-1.5 text-sm font-semibold text-foreground',
              'opacity-0 transition-opacity duration-200',
              'group-hover/tile:opacity-100 group-focus-within/tile:opacity-100'
            )}
          >
            {overlayAction}
          </span>
        </div>

        {/* Audio badge — top-left, audiobooks only */}
        {isAudiobook && (
          <span
            className={cn(
              'absolute top-2 left-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5',
              'bg-brand-soft text-brand-soft-foreground text-[10px] font-medium leading-tight'
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
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/25">
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
