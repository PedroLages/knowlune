/**
 * HighlightSearchResult — displays a book highlight match in the search palette.
 *
 * Shows: color dot, matched text preview (with search terms bolded),
 * book title, and chapter. Clicking navigates to the highlight in the reader.
 *
 * @module HighlightSearchResult
 */
import { highlightMatches, type HighlightPatterns } from '@/lib/searchUtils'
import type { HighlightColor } from '@/data/types'

/** Hex color values per highlight color key (matches HighlightLayer) */
const HIGHLIGHT_HEX: Record<HighlightColor, string> = {
  yellow: '#FFEB3B',
  green: '#4CAF50',
  blue: '#42A5F5',
  pink: '#EC407A',
  orange: '#FF9800',
}

export interface HighlightSearchResultData {
  id: string
  text: string
  bookId: string
  bookTitle: string
  color: HighlightColor
  chapterHref?: string
  cfiRange?: string
}

interface HighlightSearchResultProps {
  result: HighlightSearchResultData
  patterns: HighlightPatterns | null
}

export function HighlightSearchResult({ result, patterns }: HighlightSearchResultProps) {
  const colorHex = HIGHLIGHT_HEX[result.color] ?? '#FFEB3B'
  const chapterLabel = result.chapterHref
    ? (result.chapterHref.split('#')[0].split('/').pop() ?? '')
    : ''

  return (
    <div className="flex items-start gap-2 min-w-0">
      {/* Highlight color dot — backgroundColor is user-chosen content color, not UI chrome */}
      <span
        className="mt-1 size-3 shrink-0 rounded-full"
        style={{ backgroundColor: colorHex }}
        aria-label={`${result.color} highlight`}
      />
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-sm line-clamp-2">
          {highlightMatches(
            result.text.length > 120 ? result.text.slice(0, 120) + '…' : result.text,
            patterns
          )}
        </span>
        <span className="text-xs text-muted-foreground truncate">
          {result.bookTitle}
          {chapterLabel ? ` · ${chapterLabel}` : ''}
        </span>
      </div>
    </div>
  )
}
