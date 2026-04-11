/**
 * HighlightItem — renders a single highlight/note row with reader navigation.
 *
 * @module HighlightItem
 * @since E109-S04
 */
import { Link } from 'react-router'
import { BookOpen, StickyNote } from 'lucide-react'
import type { BookHighlight, HighlightColor } from '@/data/types'

const HIGHLIGHT_HEX: Record<HighlightColor, string> = {
  yellow: '#FFEB3B',
  green: '#4CAF50',
  blue: '#42A5F5',
  pink: '#EC407A',
  orange: '#FF9800',
}

interface HighlightItemProps {
  highlight: BookHighlight
  bookId: string
}

export function HighlightItem({ highlight, bookId }: HighlightItemProps) {
  const colorHex = HIGHLIGHT_HEX[highlight.color]
  const date = new Date(highlight.createdAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  return (
    <div
      className="flex items-start gap-3 p-4 border-b border-border/50 hover:bg-muted/30 transition-colors"
      data-testid="annotation-highlight-item"
    >
      <span
        style={{ backgroundColor: colorHex }}
        className="size-3 rounded-full mt-1.5 shrink-0"
        aria-hidden="true"
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm leading-relaxed">{highlight.textAnchor}</p>
        {highlight.note && (
          <div className="flex items-start gap-1.5 mt-2">
            <StickyNote
              className="size-3.5 text-muted-foreground mt-0.5 shrink-0"
              aria-hidden="true"
            />
            <p className="text-xs text-muted-foreground italic">
              {highlight.note}
            </p>
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-1.5">{date}</p>
      </div>
      <Link
        to={`/library/${bookId}/read${highlight.cfiRange ? `?cfi=${encodeURIComponent(highlight.cfiRange)}` : ''}`}
        className="shrink-0 rounded-md p-1.5 hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground"
        aria-label={`Open in reader: ${highlight.textAnchor.substring(0, 40)}`}
        data-testid="annotation-goto-reader"
      >
        <BookOpen className="size-4" aria-hidden="true" />
      </Link>
    </div>
  )
}
