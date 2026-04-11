/**
 * HighlightListPanel — Sheet panel listing all highlights for the current book.
 *
 * Slides in from the right when "Highlights" is selected from the reader menu.
 * Shows highlights filtered by color, with navigation to each highlight's
 * location in the EPUB, and a shortcut to create flashcards.
 *
 * @module HighlightListPanel
 */
import { useState } from 'react'
import { StickyNote, Layers, Highlighter, Download } from 'lucide-react'
import type { Rendition } from 'epubjs'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/app/components/ui/sheet'
import { Button } from '@/app/components/ui/button'
import { ScrollArea } from '@/app/components/ui/scroll-area'
import { cn } from '@/app/components/ui/utils'
import { useHighlightStore } from '@/stores/useHighlightStore'
import { HighlightExportDialog } from '@/app/components/highlights/HighlightExportDialog'
import type { BookHighlight, HighlightColor } from '@/data/types'

const HIGHLIGHT_HEX: Record<HighlightColor, string> = {
  yellow: '#FFEB3B',
  green: '#4CAF50',
  blue: '#42A5F5',
  pink: '#EC407A',
  orange: '#FF9800',
}

const COLOR_FILTERS: { id: HighlightColor | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'yellow', label: 'Yellow' },
  { id: 'green', label: 'Green' },
  { id: 'blue', label: 'Blue' },
  { id: 'pink', label: 'Pink' },
]

interface HighlightCardProps {
  highlight: BookHighlight
  onNavigate: (cfiRange: string) => void
  onFlashcard: (highlight: BookHighlight) => void
}

function HighlightCard({ highlight, onNavigate, onFlashcard }: HighlightCardProps) {
  const colorHex = HIGHLIGHT_HEX[highlight.color]
  const date = new Date(highlight.createdAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })

  return (
    <div
      className="p-3 border-b border-border/50 hover:bg-muted/30 cursor-pointer transition-colors"
      data-testid="highlight-card"
    >
      {/* Color dot + text */}
      <button
        className="w-full text-left"
        onClick={() => highlight.cfiRange && onNavigate(highlight.cfiRange)}
        aria-label={`Go to highlight: ${highlight.textAnchor.substring(0, 50)}`}
      >
        <div className="flex items-start gap-2">
          <span
            style={{ backgroundColor: colorHex }}
            className="size-3 rounded-full mt-1 shrink-0"
            aria-hidden="true"
          />
          <p className="text-sm line-clamp-3 flex-1 text-left">{highlight.textAnchor}</p>
        </div>

        {/* Chapter + date */}
        <p className="text-xs text-muted-foreground mt-1 pl-5">
          {date}
          {highlight.chapterHref && (
            <span className="ml-2 opacity-60">
              ·{' '}
              {highlight.chapterHref
                .split('/')
                .pop()
                ?.replace(/\.[^.]+$/, '') ?? ''}
            </span>
          )}
        </p>
      </button>

      {/* Note (if exists) */}
      {highlight.note && (
        <div className="flex items-start gap-1.5 mt-1.5 pl-5">
          <StickyNote className="size-3 text-muted-foreground mt-0.5 shrink-0" aria-hidden="true" />
          <p className="text-xs text-muted-foreground italic line-clamp-2">{highlight.note}</p>
        </div>
      )}

      {/* Flashcard indicator */}
      <div className="flex justify-end mt-1.5">
        <button
          onClick={() => onFlashcard(highlight)}
          aria-label={
            highlight.flashcardId ? 'View linked flashcard' : 'Create flashcard from highlight'
          }
          className={cn(
            'p-1 rounded hover:bg-muted/60 transition-colors',
            highlight.flashcardId ? 'text-brand' : 'text-muted-foreground'
          )}
          data-testid="highlight-card-flashcard-button"
        >
          <Layers className="size-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}

interface HighlightListPanelProps {
  open: boolean
  onClose: () => void
  rendition: Rendition | null
  onFlashcardRequest?: (text: string, highlightId?: string) => void
  /** Current book ID for per-book export scoping */
  bookId?: string
  /** Current book title for export dialog label */
  bookTitle?: string
}

export function HighlightListPanel({
  open,
  onClose,
  rendition,
  onFlashcardRequest,
  bookId,
  bookTitle,
}: HighlightListPanelProps) {
  const [exportOpen, setExportOpen] = useState(false)
  const highlights = useHighlightStore(s => s.highlights)
  const colorFilter = useHighlightStore(s => s.colorFilter)
  const setColorFilter = useHighlightStore(s => s.setColorFilter)
  const getFilteredHighlights = useHighlightStore(s => s.getFilteredHighlights)

  const filtered = getFilteredHighlights()

  const handleNavigate = (cfiRange: string) => {
    if (!rendition) return
    // silent-catch-ok: navigation failure is non-fatal; user can tap again
    rendition.display(cfiRange).catch(() => {
      /* silent-catch-ok */
    })
    onClose()
  }

  const handleFlashcard = (highlight: BookHighlight) => {
    onClose()
    onFlashcardRequest?.(highlight.textAnchor, highlight.id)
  }

  return (
    <Sheet open={open} onOpenChange={open => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-80 p-0 flex flex-col"
        data-testid="highlight-list-panel"
      >
        <SheetHeader className="px-4 py-3 border-b border-border/50">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-base font-semibold">
              Highlights ({highlights.length})
            </SheetTitle>
            {highlights.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExportOpen(true)}
                aria-label="Export highlights"
                data-testid="highlight-panel-export-btn"
              >
                <Download className="size-4" aria-hidden="true" />
              </Button>
            )}
          </div>
        </SheetHeader>

        {/* Color filter pills */}
        <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border/50 overflow-x-auto">
          {COLOR_FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => setColorFilter(f.id)}
              aria-pressed={colorFilter === f.id}
              className={cn(
                'px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors',
                colorFilter === f.id
                  ? 'bg-brand text-brand-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              )}
              data-testid={`highlight-filter-${f.id}`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <ScrollArea className="flex-1">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 px-6 text-center">
              <Highlighter className="size-8 text-muted-foreground/40" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium text-foreground">No highlights yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Select text while reading to create highlights
                </p>
              </div>
            </div>
          ) : (
            <div>
              {filtered.map(h => (
                <HighlightCard
                  key={h.id}
                  highlight={h}
                  onNavigate={handleNavigate}
                  onFlashcard={handleFlashcard}
                />
              ))}
            </div>
          )}
        </ScrollArea>

        {filtered.length > 0 && colorFilter !== 'all' && (
          <div className="px-4 py-2 border-t border-border/50">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setColorFilter('all')}
              className="text-xs text-muted-foreground w-full"
            >
              Show all highlights
            </Button>
          </div>
        )}
      </SheetContent>

      {/* Per-book export dialog (E109-S03) */}
      <HighlightExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        bookId={bookId}
        bookTitle={bookTitle}
      />
    </Sheet>
  )
}
