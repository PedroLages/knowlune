import { useEffect, useState, useCallback } from 'react'
import { RefreshCw } from 'lucide-react'
import { db } from '@/db/schema'
import { useBookStore } from '@/stores/useBookStore'
import type { BookHighlight, Book } from '@/data/types'
import { cn } from '@/app/components/ui/utils'

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

  useEffect(() => { load() }, [load])

  if (entries.length === 0) return null

  return (
    <section aria-label="Daily Highlights">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-heading text-xl font-semibold tracking-tight text-foreground">
          Daily Highlights
        </h2>
        <button
          onClick={() => setRefreshSeed(s => s + 1)}
          className="flex items-center gap-1.5 text-sm text-brand hover:text-brand-hover transition-colors font-medium"
          aria-label="Refresh highlights"
        >
          <RefreshCw className="size-3.5" />
          Refresh
        </button>
      </div>

      {/* Cinematic card stack */}
      <div aria-live="polite" className="flex flex-col gap-4">
        {entries.map(({ highlight, book }) => (
          <CinematicCard key={highlight.id} highlight={highlight} book={book} />
        ))}
      </div>
    </section>
  )
}

function CinematicCard({ highlight, book }: HighlightEntry) {
  return (
    <div
      className={cn(
        'relative w-full h-[220px] sm:h-[260px] rounded-2xl overflow-hidden cursor-pointer',
        'bg-foreground group'
      )}
    >
      {/* Blurred book cover background */}
      {book.coverUrl && (
        <img
          src={book.coverUrl}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover opacity-40 blur-sm scale-105 motion-safe:group-hover:scale-110 motion-safe:transition-transform motion-safe:duration-700 ease-out"
        />
      )}

      {/* Gradient overlay — bottom fade to near-black */}
      <div className="absolute inset-0 bg-gradient-to-t from-foreground via-foreground/20 to-transparent" />

      {/* Content */}
      <div className="relative z-10 h-full flex flex-col justify-between p-5 sm:p-6">
        {/* Quote — centered vertically */}
        <div className="flex-1 flex items-center justify-center">
          <blockquote className="font-heading text-xl sm:text-2xl font-semibold tracking-tight text-center leading-snug text-white px-2 sm:px-10">
            "{highlight.textAnchor}"
          </blockquote>
        </div>

        {/* Bottom metadata row */}
        <div className="flex items-end gap-3 mt-auto">
          {/* Sharp cover thumbnail */}
          {book.coverUrl && (
            <div className="w-10 h-14 sm:w-12 sm:h-16 rounded-lg overflow-hidden shrink-0 shadow-lg border border-white/10">
              <img
                src={book.coverUrl}
                alt={`${book.title} cover`}
                className="w-full h-full object-cover"
              />
            </div>
          )}
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
