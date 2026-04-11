/**
 * AnnotationSummary — per-book annotation summary page.
 *
 * Shows all highlights and notes for a specific book in one place,
 * with statistics (total count, by color), color filtering, chapter
 * grouping, and navigation back to the reader at the highlight location.
 *
 * Route: /library/:bookId/annotations
 *
 * @module AnnotationSummary
 * @since E109-S04
 */
import { useEffect, useState, useMemo, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router'
import { toast } from 'sonner'
import {
  ArrowLeft,
  BookOpen,
  Highlighter,
  StickyNote,
  Download,
  Filter,
} from 'lucide-react'
import { db } from '@/db/schema'
import { useBookStore } from '@/stores/useBookStore'
import { Button } from '@/app/components/ui/button'
import { Card } from '@/app/components/ui/card'
import { Badge } from '@/app/components/ui/badge'
import { ScrollArea } from '@/app/components/ui/scroll-area'
import { Skeleton } from '@/app/components/ui/skeleton'
import {
  Empty,
  EmptyMedia,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from '@/app/components/ui/empty'
import { HighlightExportDialog } from '@/app/components/highlights/HighlightExportDialog'
import { StatCard } from '@/app/components/annotations/StatCard'
import { HighlightItem } from '@/app/components/annotations/HighlightItem'
import type { Book, BookHighlight, HighlightColor } from '@/data/types'

const HIGHLIGHT_HEX: Record<HighlightColor, string> = {
  yellow: '#FFEB3B',
  green: '#4CAF50',
  blue: '#42A5F5',
  pink: '#EC407A',
  orange: '#FF9800',
}

const COLOR_LABELS: Record<HighlightColor, string> = {
  yellow: 'Yellow',
  green: 'Green',
  blue: 'Blue',
  pink: 'Pink',
  orange: 'Orange',
}

type ColorFilter = HighlightColor | 'all'

interface ChapterGroup {
  chapter: string
  highlights: BookHighlight[]
}

/**
 * Groups highlights by chapterHref, falling back to "Ungrouped" for
 * highlights without chapter info.
 */
function groupByChapter(highlights: BookHighlight[]): ChapterGroup[] {
  const map = new Map<string, BookHighlight[]>()
  for (const h of highlights) {
    const key = h.chapterHref ?? '__ungrouped__'
    const arr = map.get(key) ?? []
    arr.push(h)
    map.set(key, arr)
  }
  return Array.from(map.entries()).map(([key, items]) => ({
    chapter:
      key === '__ungrouped__'
        ? 'Ungrouped'
        : key
            .split('/')
            .pop()
            ?.replace(/\.[^.]+$/, '') ?? key,
    highlights: items,
  }))
}

export function AnnotationSummary() {
  const { bookId } = useParams<{ bookId: string }>()
  const navigate = useNavigate()
  const books = useBookStore(s => s.books)

  const [highlights, setHighlights] = useState<BookHighlight[]>([])
  const [loading, setLoading] = useState(true)
  const [colorFilter, setColorFilter] = useState<ColorFilter>('all')
  const [exportOpen, setExportOpen] = useState(false)

  const book: Book | undefined = useMemo(
    () => books.find(b => b.id === bookId),
    [books, bookId]
  )

  useEffect(() => {
    if (!bookId) return
    let cancelled = false

    async function load() {
      try {
        const data = await db.bookHighlights
          .where('bookId')
          .equals(bookId!)
          .sortBy('createdAt')
        if (!cancelled) {
          setHighlights(data)
          setLoading(false)
        }
      } catch {
        if (!cancelled) {
          toast.error('Failed to load annotations')
          setLoading(false)
        }
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [bookId])

  const filtered = useMemo(
    () =>
      colorFilter === 'all'
        ? highlights
        : highlights.filter(h => h.color === colorFilter),
    [highlights, colorFilter]
  )

  const chapters = useMemo(() => groupByChapter(filtered), [filtered])

  const colorCounts = useMemo(() => {
    const counts: Partial<Record<HighlightColor, number>> = {}
    for (const h of highlights) {
      counts[h.color] = (counts[h.color] ?? 0) + 1
    }
    return counts
  }, [highlights])

  const notesCount = useMemo(
    () => highlights.filter(h => h.note).length,
    [highlights]
  )

  const handleBack = useCallback(() => {
    navigate('/library')
  }, [navigate])

  if (!bookId) return null

  return (
    <div className="space-y-6" data-testid="annotation-summary-page">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleBack}
          aria-label="Back to library"
          data-testid="annotation-back-btn"
        >
          <ArrowLeft className="size-5" aria-hidden="true" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold truncate">
            {book?.title ?? 'Book'} — Annotations
          </h1>
          {book?.author && (
            <p className="text-sm text-muted-foreground truncate">
              {book.author}
            </p>
          )}
        </div>
        {highlights.length > 0 && (
          <Button
            variant="brand-outline"
            size="sm"
            onClick={() => setExportOpen(true)}
            data-testid="annotation-export-btn"
          >
            <Download className="size-4 mr-1.5" aria-hidden="true" />
            Export
          </Button>
        )}
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-64 rounded-xl" />
        </div>
      ) : highlights.length === 0 ? (
        <Empty data-testid="annotation-empty">
          <EmptyMedia>
            <Highlighter className="size-10 text-muted-foreground/40" />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle>No annotations yet</EmptyTitle>
            <EmptyDescription>
              Open the book and highlight text to see your annotations here.
            </EmptyDescription>
          </EmptyHeader>
          <Button
            variant="brand"
            onClick={() => navigate(`/library/${bookId}/read`)}
            data-testid="annotation-open-reader"
          >
            <BookOpen className="size-4 mr-1.5" aria-hidden="true" />
            Open Reader
          </Button>
        </Empty>
      ) : (
        <>
          {/* Stats */}
          <div
            className="grid grid-cols-2 md:grid-cols-3 gap-4"
            data-testid="annotation-stats"
          >
            <StatCard
              label="Total Highlights"
              value={highlights.length}
              icon={Highlighter}
            />
            <StatCard
              label="With Notes"
              value={notesCount}
              icon={StickyNote}
            />
            <StatCard
              label="Colors Used"
              value={Object.keys(colorCounts).length}
              icon={Filter}
            />
          </div>

          {/* Color breakdown badges */}
          <div className="flex flex-wrap gap-2" data-testid="annotation-color-badges">
            {(Object.entries(colorCounts) as [HighlightColor, number][]).map(
              ([color, count]) => (
                <Badge
                  key={color}
                  variant="outline"
                  className="cursor-pointer gap-1.5 px-3 py-1"
                  onClick={() =>
                    setColorFilter(colorFilter === color ? 'all' : color)
                  }
                  aria-pressed={colorFilter === color}
                  data-testid={`annotation-color-badge-${color}`}
                >
                  <span
                    style={{ backgroundColor: HIGHLIGHT_HEX[color] }}
                    className="size-2.5 rounded-full"
                    aria-hidden="true"
                  />
                  {COLOR_LABELS[color]} ({count})
                </Badge>
              )
            )}
            {colorFilter !== 'all' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setColorFilter('all')}
                className="text-xs"
                data-testid="annotation-clear-filter"
              >
                Clear filter
              </Button>
            )}
          </div>

          {/* Grouped highlight list */}
          <Card>
            <ScrollArea className="max-h-[600px]">
              {chapters.map(group => (
                <div key={group.chapter}>
                  <div className="sticky top-0 z-10 bg-card px-4 py-2 border-b border-border/50">
                    <h2 className="text-sm font-semibold text-muted-foreground">
                      {group.chapter}{' '}
                      <span className="font-normal">
                        ({group.highlights.length})
                      </span>
                    </h2>
                  </div>
                  {group.highlights.map(h => (
                    <HighlightItem
                      key={h.id}
                      highlight={h}
                      bookId={bookId}
                    />
                  ))}
                </div>
              ))}
            </ScrollArea>
          </Card>
        </>
      )}

      {/* Export dialog */}
      <HighlightExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        bookId={bookId}
        bookTitle={book?.title}
      />
    </div>
  )
}
