import { useMemo } from 'react'
import { useNavigate } from 'react-router'
import { BookOpen, Headphones, Play } from 'lucide-react'
import type { Book } from '@/data/types'
import { Button } from '@/app/components/ui/button'
import { useBookCoverUrl } from '@/app/hooks/useBookCoverUrl'
import { cn } from '@/app/components/ui/utils'

function toTimestamp(value: string | undefined): number {
  if (!value) return 0
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? 0 : parsed
}

function isInProgress(book: Book): boolean {
  return book.progress > 0 && book.progress < 100 && book.status !== 'finished'
}

function pickHeroBook(books: Book[]): Book | null {
  const inProgress = books
    .filter(b => !!b.lastOpenedAt && isInProgress(b))
    .sort((a, b) => toTimestamp(b.lastOpenedAt) - toTimestamp(a.lastOpenedAt))
  if (inProgress.length > 0) return inProgress[0]

  const recent = [...books].sort((a, b) => toTimestamp(b.createdAt) - toTimestamp(a.createdAt))
  return recent[0] ?? null
}

export function LibraryMediaHero({
  books,
  modeLabel,
}: {
  books: Book[]
  modeLabel: 'Audiobooks' | 'Ebooks'
}) {
  const navigate = useNavigate()
  const heroBook = useMemo(() => pickHeroBook(books), [books])

  const resolvedCoverUrl = useBookCoverUrl({
    bookId: heroBook?.id ?? '',
    coverUrl: heroBook?.coverUrl,
  })

  if (!heroBook) return null

  const isAudio = heroBook.format === 'audiobook'
  const readerPath =
    heroBook.format === 'epub' || heroBook.format === 'audiobook'
      ? `/library/${heroBook.id}/read`
      : `/library/${heroBook.id}`

  const primaryLabel = isInProgress(heroBook)
    ? isAudio
      ? 'Continue listening'
      : 'Continue reading'
    : `Explore ${modeLabel.toLowerCase()}`

  const FallbackIcon = isAudio ? Headphones : BookOpen

  return (
    <section
      className="relative overflow-hidden rounded-[28px] border border-border/50 bg-card shadow-card-ambient"
      data-testid="library-media-hero"
    >
      <div className="absolute inset-0">
        {resolvedCoverUrl ? (
          <img
            src={resolvedCoverUrl}
            alt=""
            className="h-full w-full object-cover opacity-20 blur-2xl scale-110"
          />
        ) : (
          <div className="h-full w-full bg-muted" />
        )}
        <div className="absolute inset-0 bg-gradient-to-br from-background/60 via-background/70 to-background/90" />
      </div>

      <div className="relative grid grid-cols-1 gap-6 p-6 sm:p-8 md:grid-cols-[180px_1fr] md:items-center">
        <div className="flex items-center justify-center md:justify-start">
          <div className="relative aspect-square w-40 sm:w-44 md:w-44 overflow-hidden rounded-2xl bg-muted shadow-card-ambient">
            {resolvedCoverUrl ? (
              <img
                src={resolvedCoverUrl}
                alt={`Cover of ${heroBook.title}`}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <FallbackIcon className="size-10 text-muted-foreground" aria-hidden="true" />
              </div>
            )}
            <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-foreground/10">
              <div
                className="h-full bg-brand rounded-full transition-all"
                style={{ width: `${Math.max(0, Math.min(100, heroBook.progress ?? 0))}%` }}
              />
            </div>
          </div>
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
              {modeLabel}
            </span>
            {heroBook.status !== 'unread' && (
              <span className="rounded-full bg-brand/10 px-2.5 py-1 text-xs font-semibold text-brand">
                {Math.round(heroBook.progress)}% complete
              </span>
            )}
          </div>

          <h2 className="mt-3 text-xl sm:text-2xl font-semibold tracking-tight text-foreground line-clamp-2">
            {heroBook.title}
          </h2>
          {heroBook.author && (
            <p className="mt-1 text-sm text-muted-foreground truncate">by {heroBook.author}</p>
          )}

          {heroBook.description && (
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground line-clamp-3">
              {heroBook.description}
            </p>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Button
              variant="brand"
              className={cn('min-h-[44px]', isInProgress(heroBook) && 'gap-2')}
              onClick={() => navigate(readerPath)}
              data-testid="library-media-hero-primary"
            >
              {isInProgress(heroBook) ? <Play className="size-4" aria-hidden="true" /> : null}
              {primaryLabel}
            </Button>
            <Button
              variant="outline"
              className="min-h-[44px]"
              onClick={() => navigate(`/library/${heroBook.id}`)}
              data-testid="library-media-hero-details"
            >
              Details
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}

