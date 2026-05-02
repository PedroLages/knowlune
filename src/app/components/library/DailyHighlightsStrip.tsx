import { useEffect, useState, useCallback, useMemo } from 'react'
import { BookOpen, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'
import { useNavigate } from 'react-router'
import { db } from '@/db/schema'
import { useBookStore } from '@/stores/useBookStore'
import { useBookCoverUrl } from '@/app/hooks/useBookCoverUrl'
import type { BookHighlight, Book } from '@/data/types'
import { cn } from '@/app/components/ui/utils'
import { Button } from '@/app/components/ui/button'

interface HighlightEntry {
  highlight: BookHighlight
  book: Book
}

// Deterministic daily seed — same picks all day, rotates each calendar day
function dailySeed(): number {
  let h = 0
  for (const ch of new Date().toDateString()) {
    h = (Math.imul(31, h) + ch.charCodeAt(0)) | 0
  }
  return Math.abs(h)
}

function pickDaily(items: HighlightEntry[], count: number, seed: number): HighlightEntry[] {
  if (items.length <= count) return items
  const arr = [...items]
  let s = seed
  for (let i = arr.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    const j = Math.abs(s) % (i + 1)
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr.slice(0, count)
}

export function DailyHighlightsStrip() {
  const books = useBookStore(s => s.books)
  const [entries, setEntries] = useState<HighlightEntry[]>([])
  const [refreshSeed, setRefreshSeed] = useState(0)
  const [activeIndex, setActiveIndex] = useState(0)

  const load = useCallback(async () => {
    const allHighlights = await db.bookHighlights
      .filter(h => h.textAnchor.length > 40)
      .toArray()
    if (allHighlights.length === 0) return

    const bookMap = new Map(books.map(b => [b.id, b]))
    const joined: HighlightEntry[] = allHighlights
      .map(h => ({ highlight: h, book: bookMap.get(h.bookId)! }))
      .filter(e => e.book)

    const seed = dailySeed() + refreshSeed
    setEntries(pickDaily(joined, 3, seed))
  }, [books, refreshSeed])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    setActiveIndex(0)
  }, [entries])

  const goPrev = useCallback(() => {
    setActiveIndex(i => Math.max(0, i - 1))
  }, [])

  const goNext = useCallback(() => {
    setActiveIndex(i => Math.min(entries.length - 1, i + 1))
  }, [entries.length])

  if (entries.length === 0) return null

  const active = entries[activeIndex]!
  const countLabel = `${activeIndex + 1} of ${entries.length}`

  return (
    <section aria-label="Daily Highlights" role="region">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-heading text-xl font-semibold tracking-tight text-foreground">
          Daily Highlights
        </h2>
        <button
          type="button"
          onClick={() => setRefreshSeed(s => s + 1)}
          className="flex items-center gap-1.5 text-sm text-brand hover:text-brand-hover transition-colors font-medium"
          aria-label="Shuffle daily highlights"
        >
          <RefreshCw className="size-3.5" />
          Refresh
        </button>
      </div>

      <div className="flex flex-col gap-4">
        <div aria-live="polite" aria-atomic="true" className="min-h-[220px] sm:min-h-[260px]">
          <CinematicCard
            key={active.highlight.id}
            highlight={active.highlight}
            book={active.book}
          />
        </div>

        {entries.length > 1 && (
          <div className="flex items-center justify-center gap-3 sm:gap-4">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="shrink-0 size-10"
              onClick={goPrev}
              disabled={activeIndex === 0}
              aria-label="Previous highlight"
            >
              <ChevronLeft className="size-5" aria-hidden="true" />
            </Button>

            <div
              className="flex items-center gap-2 min-w-0"
              role="radiogroup"
              aria-label="Choose daily highlight"
            >
              {entries.map((e, i) => (
                <button
                  key={e.highlight.id}
                  type="button"
                  role="radio"
                  aria-checked={i === activeIndex}
                  aria-label={`Highlight ${i + 1} of ${entries.length}`}
                  onClick={() => setActiveIndex(i)}
                  className={cn(
                    'size-2.5 rounded-full transition-colors shrink-0',
                    i === activeIndex ? 'bg-brand scale-110' : 'bg-muted-foreground/40 hover:bg-muted-foreground/70'
                  )}
                />
              ))}
              <span className="text-xs text-muted-foreground tabular-nums ml-1 hidden sm:inline">
                {countLabel}
              </span>
            </div>

            <Button
              type="button"
              variant="outline"
              size="icon"
              className="shrink-0 size-10"
              onClick={goNext}
              disabled={activeIndex >= entries.length - 1}
              aria-label="Next highlight"
            >
              <ChevronRight className="size-5" aria-hidden="true" />
            </Button>
          </div>
        )}
      </div>
    </section>
  )
}

function CinematicCard({ highlight, book }: HighlightEntry) {
  const navigate = useNavigate()
  const coverUrlForHook = useMemo(
    () => book.coverUrl?.trim() || undefined,
    [book.coverUrl]
  )
  const resolvedCoverUrl = useBookCoverUrl({ bookId: book.id, coverUrl: coverUrlForHook })

  const [coverFailed, setCoverFailed] = useState(false)
  const [thumbLoaded, setThumbLoaded] = useState(false)
  const [bgLoaded, setBgLoaded] = useState(false)

  useEffect(() => {
    setCoverFailed(false)
    setThumbLoaded(false)
    setBgLoaded(false)
  }, [book.id, resolvedCoverUrl])

  const showCoverAttempt = Boolean(resolvedCoverUrl) && !coverFailed
  const titleInitial = book.title.trim().charAt(0).toUpperCase() || '?'

  const openHighlightInReader = () => {
    const params = new URLSearchParams()
    params.set('sourceHighlightId', highlight.id)
    navigate(`/library/${book.id}/read?${params.toString()}`)
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={openHighlightInReader}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          openHighlightInReader()
        }
      }}
      className={cn(
        'relative w-full h-[220px] sm:h-[260px] rounded-2xl overflow-hidden cursor-pointer group',
        'bg-slate-950',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background'
      )}
      aria-label={`Open highlight in ${book.title}`}
      data-testid="daily-highlight-card"
    >
      {/* Blurred book cover — stays invisible until loaded to avoid broken-image flash */}
      {showCoverAttempt && resolvedCoverUrl && (
        <img
          src={resolvedCoverUrl}
          alt=""
          aria-hidden="true"
          loading="lazy"
          onLoad={() => setBgLoaded(true)}
          onError={() => setCoverFailed(true)}
          className={cn(
            'absolute inset-0 w-full h-full object-cover blur-sm scale-105 motion-safe:group-hover:scale-110 motion-safe:transition-all motion-safe:duration-700 ease-out',
            bgLoaded ? 'opacity-40' : 'opacity-0'
          )}
        />
      )}

      {/* Gradient overlay — stable dark fade (not theme foreground, which inverts in dark mode) */}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/55 to-slate-950/10" />

      {/* Content */}
      <div className="relative z-10 h-full flex flex-col justify-between p-5 sm:p-6 pointer-events-none">
        {/* Quote — centered vertically */}
        <div className="flex-1 flex items-center justify-center min-h-0">
          <blockquote className="font-heading text-xl sm:text-2xl font-semibold tracking-tight text-center leading-snug text-white px-2 sm:px-10 line-clamp-6 sm:line-clamp-5">
            "{highlight.textAnchor}"
          </blockquote>
        </div>

        {/* Bottom metadata row */}
        <div className="flex items-end gap-3 mt-4 shrink-0">
          {/* Sharp cover thumbnail: fallback visible until thumb image loads */}
          <div className="relative w-10 h-14 sm:w-12 sm:h-16 rounded-lg overflow-hidden shrink-0 shadow-lg border border-white/10 bg-white/10">
            <div
              data-testid="daily-highlight-cover-fallback"
              className={cn(
                'absolute inset-0 flex flex-col items-center justify-center gap-0.5 bg-slate-900/80 px-1 text-center transition-opacity',
                showCoverAttempt && thumbLoaded ? 'opacity-0' : 'opacity-100'
              )}
              aria-hidden
            >
              <BookOpen className="size-4 text-white/70" />
              <span className="text-[10px] font-semibold leading-none text-white/90 sm:text-xs">
                {titleInitial}
              </span>
            </div>
            {showCoverAttempt && resolvedCoverUrl && (
              <img
                src={resolvedCoverUrl}
                alt={`${book.title} cover`}
                loading="lazy"
                onLoad={() => setThumbLoaded(true)}
                onError={() => setCoverFailed(true)}
                className={cn(
                  'absolute inset-0 h-full w-full object-cover transition-opacity',
                  thumbLoaded ? 'opacity-100' : 'opacity-0'
                )}
              />
            )}
          </div>
          <div className="pb-0.5 min-w-0">
            <p className="font-heading text-white font-semibold text-sm sm:text-base leading-tight truncate">
              {book.title}
            </p>
            <p className="text-white/60 text-xs sm:text-sm mt-0.5">
              {book.author && `${book.author} · `}
              {new Date(highlight.createdAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              })}
            </p>
            {highlight.note && (
              <p className="text-white/50 text-xs mt-1 italic line-clamp-1">
                {highlight.note}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
