/**
 * Reusable book cover image with automatic fallback on missing or broken URLs.
 *
 * Renders `<img>` when a truthy `src` is provided. On `onError` (e.g. 404 from
 * ABS cover endpoint, Cloudflare 429 drop, network blip) or when `src` is
 * nullish, substitutes a muted fallback tile showing the title's initial or a
 * glyph icon. Replaces the ad-hoc `e.currentTarget.style.display = 'none'`
 * pattern that leaves an empty hole instead of a recognizable placeholder.
 *
 * @since fix/E-ABS-QA (2026-04-24)
 */

import { memo, useState, type ElementType } from 'react'
import { BookOpen, Headphones } from 'lucide-react'
import { cn } from '@/app/components/ui/utils'

interface BookCoverImageProps {
  /** Cover image URL. When nullish or the img fires onError, a fallback renders instead. */
  src?: string | null
  /** Book title — used for alt text and first-letter fallback. */
  title: string
  /** Image className (grid-card aspect ratio, border-radius, etc. applied by parent). */
  className?: string
  /**
   * Glyph shown when the title is empty or whitespace-only. Defaults to the
   * BookOpen icon. Audiobook callers should pass `Headphones` for consistency.
   */
  fallbackIcon?: ElementType
  /** `<img loading="…">` passthrough. Defaults to `lazy`. */
  loading?: 'eager' | 'lazy'
}

/**
 * The first printable character of the title, uppercased. Returns null for
 * empty/whitespace-only titles so the caller can render a glyph instead.
 */
function firstInitial(title: string): string | null {
  const trimmed = title.trim()
  if (trimmed.length === 0) return null
  // Grapheme-safe: Array.from splits surrogate pairs correctly for emoji / CJK.
  const first = Array.from(trimmed)[0]
  return first ? first.toUpperCase() : null
}

export const BookCoverImage = memo(function BookCoverImage({
  src,
  title,
  className,
  fallbackIcon,
  loading = 'lazy',
}: BookCoverImageProps) {
  const [errored, setErrored] = useState(false)

  const showFallback = !src || errored

  if (showFallback) {
    const initial = firstInitial(title)
    const GlyphIcon = fallbackIcon ?? BookOpen
    return (
      <div
        className={cn(
          'flex h-full w-full items-center justify-center bg-muted',
          className
        )}
        role="img"
        aria-label={`${title || 'Book'} — cover unavailable`}
        data-testid="book-cover-fallback"
      >
        {initial ? (
          <span
            aria-hidden="true"
            className="text-4xl font-semibold text-brand-soft-foreground"
          >
            {initial}
          </span>
        ) : (
          <GlyphIcon className="size-8 text-muted-foreground" aria-hidden="true" />
        )}
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={`Cover of ${title}`}
      loading={loading}
      className={className}
      onError={() => setErrored(true)}
    />
  )
})

// Re-export Headphones so audiobook callers can pass it as the glyph icon
// without a separate lucide-react import in their file.
export { Headphones as AudiobookCoverGlyph }
