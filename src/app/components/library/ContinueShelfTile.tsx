import { memo, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router'
import { BookOpen, Headphones } from 'lucide-react'
import type { Book } from '@/data/types'
import { useBookCoverUrl } from '@/app/hooks/useBookCoverUrl'

interface ContinueShelfTileProps {
  book: Book
}

function formatRemainingAudio(seconds: number): string {
  const safe = Math.max(0, seconds)
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  if (hours > 0) return `${hours}h ${minutes}m left`
  return `${minutes}m left`
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
    return `${formatRemainingAudio(remaining)} · ${progressLabel}`
  }

  if (
    (book.format === 'epub' || book.format === 'pdf') &&
    typeof book.totalPages === 'number' &&
    book.totalPages > 0 &&
    book.currentPosition?.type === 'page'
  ) {
    return `Page ${book.currentPosition.pageNumber} of ${book.totalPages} · ${progressLabel}`
  }

  return `${progressLabel} complete`
}

export const ContinueShelfTile = memo(function ContinueShelfTile({ book }: ContinueShelfTileProps) {
  const navigate = useNavigate()
  const resolvedCoverUrl = useBookCoverUrl({ bookId: book.id, coverUrl: book.coverUrl })
  const isAudiobook = book.format === 'audiobook'
  const FallbackIcon = isAudiobook ? Headphones : BookOpen
  const FormatIcon = isAudiobook ? Headphones : BookOpen
  const readerPath =
    book.format === 'epub' || book.format === 'audiobook'
      ? `/library/${book.id}/read`
      : `/library/${book.id}`

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
      className="group w-36 sm:w-40 cursor-pointer focus-visible:outline-none"
      data-testid={`continue-shelf-tile-${book.id}`}
      aria-label={`Resume ${book.title}`}
    >
      <div className="relative aspect-square overflow-hidden rounded-xl bg-muted shadow-card-ambient">
        {resolvedCoverUrl ? (
          <img
            src={resolvedCoverUrl}
            alt={`Cover of ${book.title}`}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <FallbackIcon className="size-8 text-muted-foreground" aria-hidden="true" />
          </div>
        )}

        <div className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-1 backdrop-blur">
          <FormatIcon className="size-3 text-white" aria-hidden="true" />
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-white/25">
          <div
            className="h-full rounded-full bg-brand transition-all"
            style={{ width: `${Math.max(0, Math.min(100, book.progress))}%` }}
          />
        </div>
      </div>

      <div className="mt-2 px-0.5 text-center">
        <p className="line-clamp-2 text-xs font-semibold leading-tight text-foreground transition-colors group-hover:text-brand">
          {book.title}
        </p>
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{getProgressMeta(book)}</p>
      </div>
    </div>
  )
})
