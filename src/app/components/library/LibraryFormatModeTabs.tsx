import { useMemo } from 'react'
import { BookOpen, Headphones } from 'lucide-react'
import { useBookStore } from '@/stores/useBookStore'
import { cn } from '@/app/components/ui/utils'

export type LibraryFormatMode = 'audiobooks' | 'ebooks'

const AUDIOBOOKS_FILTER = ['audiobook']
const EBOOKS_FILTER = ['epub', 'pdf']

function getActiveMode(formatFilter: string[] | undefined): LibraryFormatMode {
  if (!formatFilter || formatFilter.length === 0) return 'audiobooks'
  if (formatFilter.length === 1 && formatFilter[0] === 'audiobook') return 'audiobooks'
  if (formatFilter.every(v => v === 'epub' || v === 'pdf')) return 'ebooks'
  return 'audiobooks'
}

export function LibraryFormatModeTabs() {
  const books = useBookStore(s => s.books)
  const filters = useBookStore(s => s.filters)
  const setFilter = useBookStore(s => s.setFilter)

  const activeMode = useMemo(() => getActiveMode(filters.format), [filters.format])

  const counts = useMemo(() => {
    // Respect source filter while computing counts (matches FormatTabs behavior).
    const sourceFiltered =
      filters.source && filters.source !== 'all'
        ? books.filter(b => (filters.source === 'audiobookshelf' ? b.absServerId : !b.absServerId))
        : books

    return {
      audiobooks: sourceFiltered.filter(b => b.format === 'audiobook').length,
      ebooks: sourceFiltered.filter(b => b.format === 'epub' || b.format === 'pdf').length,
    }
  }, [books, filters.source])

  return (
    <div
      className="flex gap-2 overflow-x-auto py-0.5 scrollbar-none"
      role="tablist"
      aria-label="Library format mode"
      data-testid="library-format-mode-tabs"
    >
      <button
        role="tab"
        aria-selected={activeMode === 'audiobooks'}
        aria-label={`Audiobooks — ${counts.audiobooks} book${counts.audiobooks !== 1 ? 's' : ''}`}
        onClick={() => setFilter('format', AUDIOBOOKS_FILTER)}
        className={cn(
          'whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-colors min-h-[28px] flex-shrink-0 inline-flex items-center gap-1 outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1',
          activeMode === 'audiobooks'
            ? 'bg-brand text-brand-foreground'
            : 'bg-muted text-muted-foreground hover:bg-muted/80',
          activeMode !== 'audiobooks' && counts.audiobooks === 0 && 'opacity-40'
        )}
        data-testid="library-format-mode-audiobooks"
      >
        <Headphones className="size-3.5" aria-hidden="true" />
        Audiobooks
        <span className="ml-0.5 text-[11px]">({counts.audiobooks})</span>
      </button>

      <button
        role="tab"
        aria-selected={activeMode === 'ebooks'}
        aria-label={`Ebooks — ${counts.ebooks} book${counts.ebooks !== 1 ? 's' : ''}`}
        onClick={() => setFilter('format', EBOOKS_FILTER)}
        className={cn(
          'whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-colors min-h-[28px] flex-shrink-0 inline-flex items-center gap-1 outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1',
          activeMode === 'ebooks'
            ? 'bg-brand text-brand-foreground'
            : 'bg-muted text-muted-foreground hover:bg-muted/80',
          activeMode !== 'ebooks' && counts.ebooks === 0 && 'opacity-40'
        )}
        data-testid="library-format-mode-ebooks"
      >
        <BookOpen className="size-3.5" aria-hidden="true" />
        Ebooks
        <span className="ml-0.5 text-[11px]">({counts.ebooks})</span>
      </button>
    </div>
  )
}

