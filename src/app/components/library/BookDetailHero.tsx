/**
 * BookDetailHero — two-column hero section for the book detail page.
 *
 * Displays cover, metadata grid (format-adaptive), synopsis, and action buttons.
 *
 * Layout:
 * ----
 * Back button
 * [cover 2/3]  |  Format badge  .  Your rating
 *               |  Title (44px extrabold)
 *               |  Author / Narrator
 *               |  [Time] [Pages/Narrator] [Lang/Fmt] [Year]
 *               |  Synopsis
 *               |  [Read/Listen Now] [Add to Library] [Share]
 * ----
 *
 * @since book-detail-page (2026-05-07)
 */

import { useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router'
import { BookOpen, Headphones, Plus, Share2, Star } from 'lucide-react'
import type { Book } from '@/data/types'
import { Button } from '@/app/components/ui/button'
import { useBookCoverUrl } from '@/app/hooks/useBookCoverUrl'
import { sanitizeDescriptionHtml } from '@/lib/textUtils'
import { getBookDestinationPath } from '@/lib/bookNavigation'
import { FormatBadge } from './FormatBadge'
import { BookCoverImage } from './BookCoverImage'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Format seconds to "Xh Ym" display. */
function formatDuration(seconds: number | undefined): string | null {
  if (seconds == null || seconds <= 0) return null
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

/** Estimate reading time from totalPages at ~2 min/page. */
function estimateReadingTime(pages: number | undefined): string | null {
  if (pages == null || pages <= 0) return null
  const totalMinutes = pages * 2
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

/** Truncate a year from a date string (e.g. "2023-01-15" → "2023"). */
function extractYear(dateStr: string | undefined): string | null {
  if (!dateStr) return null
  const year = dateStr.trim().slice(0, 4)
  return /^\d{4}$/.test(year) ? year : null
}

// ─── Stat Grid ────────────────────────────────────────────────────────────────

interface StatItem {
  label: string
  value: string
}

function StatGrid({ stats }: { stats: StatItem[] }) {
  if (stats.length === 0) return null

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {stats.map(stat => (
        <div
          key={stat.label}
          className="rounded-xl bg-muted/50 px-3 py-2.5"
          data-testid={`detail-stat-${stat.label.toLowerCase().replace(/\s+/g, '-')}`}
        >
          <p className="text-[10px] font-semibold tracking-wider uppercase text-muted-foreground">
            {stat.label}
          </p>
          <p className="mt-0.5 text-sm font-medium text-foreground truncate">
            {stat.value}
          </p>
        </div>
      ))}
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

interface BookDetailHeroProps {
  book: Book
  /**
   * When true, the "Add to Library" button is rendered as a
   * future-proofing stub. Since all books reachable at /library/:bookId
   * are already in the local Dexie database, this button only applies
   * to server-sourced books not yet added to the local library.
   */
  showAddToLibrary?: boolean
  /** Tab to return to in the library (defaults to 'continue'). */
  returnTab?: string
}

export function BookDetailHero({
  book,
  showAddToLibrary = false,
  returnTab = 'continue',
}: BookDetailHeroProps) {
  const navigate = useNavigate()
  const resolvedCoverUrl = useBookCoverUrl({ bookId: book.id, coverUrl: book.coverUrl })
  const isAudio = book.format === 'audiobook'
  const FallbackIcon = isAudio ? Headphones : BookOpen

  const sanitizedDescription = useMemo(
    () => (book.description ? sanitizeDescriptionHtml(book.description) : ''),
    [book.description]
  )

  const readerPath = getBookDestinationPath(book)

  const primaryLabel = isAudio ? 'Listen Now' : 'Read Now'

  // ── Build metadata grid ──────────────────────────────────────────────
  const stats = useMemo((): StatItem[] => {
    const items: StatItem[] = []

    if (isAudio) {
      // Audiobook: Listening Time + Narrator + (Language or Format) + Released
      const time = formatDuration(book.totalDuration)
      if (time) items.push({ label: 'Listening Time', value: time })

      if (book.narrator) {
        items.push({ label: 'Narrator', value: book.narrator })
      }

      // Third stat: show Language if available, otherwise show "Format: Audiobook"
      if (book.language) {
        items.push({ label: 'Language', value: book.language })
      } else {
        items.push({ label: 'Format', value: 'Audiobook' })
      }
    } else {
      // Ebook: Reading Time + Pages + Language
      const readingTime = estimateReadingTime(book.totalPages)
      if (readingTime) items.push({ label: 'Reading Time', value: readingTime })

      if (book.totalPages != null && book.totalPages > 0) {
        items.push({ label: 'Pages', value: `${book.totalPages} Pages` })
      }

      if (book.language) {
        items.push({ label: 'Language', value: book.language })
      }
    }

    // Fourth stat (both formats): Released year
    const year = extractYear(book.publishDate)
    if (year) items.push({ label: 'Released', value: year })

    return items
  }, [book, isAudio])

  // ── Share handler ────────────────────────────────────────────────────
  const handleShare = useCallback(async () => {
    const url = `${window.location.origin}/library/${book.id}`
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: book.title, url })
      } catch (err) {
        // User cancelled native share dialog — not an error
        if (err instanceof DOMException && err.name === 'AbortError') return
        // Log and report unexpected errors instead of throwing (avoids unhandled rejection)
        console.error('Share failed:', err)
        toast.error('Failed to share this book')
      }
    } else {
      try {
        await navigator.clipboard?.writeText(url)
        toast.info('Book URL copied to clipboard')
      } catch {
        toast.info(`Book URL: ${url}`)
      }
    }
  }, [book.id, book.title])

  // ── Back navigation ──────────────────────────────────────────────────
  const handleBack = useCallback(() => {
    navigate(`/library?tab=${returnTab}`)
  }, [navigate, returnTab])

  return (
    <section className="relative overflow-hidden rounded-[28px] border border-border/50 bg-card shadow-card-ambient">
      {/* Blurred cover background */}
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

      <div className="relative p-4 sm:p-8">
        {/* Back button */}
        <button
          type="button"
          onClick={handleBack}
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          data-testid="book-detail-back"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M19 12H5" />
            <path d="M12 19l-7-7 7-7" />
          </svg>
          Back to Library
        </button>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-8 md:gap-12">
          {/* ── Left: Cover ─────────────────────────────────────────── */}
          <div className="flex items-start justify-center md:justify-start">
            <div className="relative w-52 sm:w-60 md:w-full max-w-[280px] aspect-[2/3] overflow-hidden rounded-xl shadow-2xl bg-muted">
              <BookCoverImage
                src={resolvedCoverUrl}
                title={book.title}
                fallbackIcon={FallbackIcon}
                className="h-full w-full object-cover"
              />
            </div>
          </div>

          {/* ── Right: Metadata ─────────────────────────────────────── */}
          <div className="min-w-0">
            {/* Format badge + Rating */}
            <div className="flex flex-wrap items-center gap-3">
              <FormatBadge format={book.format} />
              {book.rating != null && book.rating > 0 && (
                <span
                  className="inline-flex items-center gap-1 text-sm text-brand"
                  data-testid="detail-rating"
                >
                  <Star className="size-4 fill-warning text-warning" aria-hidden="true" />
                  Your rating: {book.rating}
                </span>
              )}
            </div>

            {/* Title */}
            <h1
              className="mt-3 text-[28px] sm:text-[36px] md:text-[44px] leading-tight font-extrabold tracking-tight text-foreground"
              data-testid="detail-title"
            >
              {book.title}
            </h1>

            {/* Author / Narrator */}
            {book.author && (
              <p className="mt-1.5 text-base font-medium text-muted-foreground">
                by {book.author}
                {isAudio && book.narrator && ` . Narrated by ${book.narrator}`}
              </p>
            )}

            {/* Metadata grid */}
            <div className="mt-6">
              <StatGrid stats={stats} />
            </div>

            {/* Synopsis */}
            {book.description && (
              <div className="mt-6" data-testid="detail-synopsis">
                <h2 className="text-xs font-semibold tracking-wider uppercase text-muted-foreground mb-2">
                  Synopsis
                </h2>
                {/* Sanitized via sanitizeDescriptionHtml — same pattern as LibraryMediaHero */}
                <div
                  className="text-sm leading-relaxed text-muted-foreground line-clamp-6 [&>br+br]:hidden"
                  dangerouslySetInnerHTML={{ __html: sanitizedDescription }}
                />
              </div>
            )}

            {/* Action buttons */}
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button
                variant="brand"
                className="min-h-[44px]"
                onClick={() => navigate(readerPath)}
                data-testid="detail-primary-cta"
              >
                {primaryLabel}
              </Button>

              {showAddToLibrary && (
                <Button
                  variant="outline"
                  className="min-h-[44px] gap-2"
                  data-testid="detail-add-to-library"
                  disabled
                >
                  <Plus className="size-4" aria-hidden="true" />
                  {/*
                   * TODO: "Add to Library" — future-proofing stub.
                   * Books reachable at /library/:bookId are already in Dexie.
                   * When a remote browse flow (OPDS/ABS catalog browsing) is
                   * added, wire this button to trigger the import/upsert flow.
                   */}
                  Add to Library
                </Button>
              )}

              <Button
                variant="outline"
                size="icon"
                className="min-h-[44px] min-w-[44px]"
                onClick={handleShare}
                aria-label="Share book"
                data-testid="detail-share"
              >
                <Share2 className="size-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
