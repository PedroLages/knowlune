/**
 * Format filter tabs for the Library page: All | Audiobooks | Ebooks.
 *
 * Reads/writes `filters.format` from the book store. Derives the active tab
 * from the current filter value so the sidebar and tabs stay in sync.
 *
 * Uses the same pill styling as LibrarySourceTabs for visual consistency.
 */

import { useMemo } from 'react'
import { Headphones, BookOpen } from 'lucide-react'
import { useBookStore } from '@/stores/useBookStore'
import { cn } from '@/app/components/ui/utils'
import type { LucideIcon } from 'lucide-react'

type FormatTab = 'all' | 'audiobooks' | 'ebooks'

const FORMAT_TABS: { value: FormatTab; label: string; icon?: LucideIcon; filterValue: string[] | undefined }[] = [
  { value: 'all', label: 'All', filterValue: undefined },
  { value: 'audiobooks', label: 'Audiobooks', icon: Headphones, filterValue: ['audiobook'] },
  { value: 'ebooks', label: 'Ebooks', icon: BookOpen, filterValue: ['epub', 'pdf'] },
]

export function FormatTabs() {
  const books = useBookStore(s => s.books)
  const filters = useBookStore(s => s.filters)
  const setFilter = useBookStore(s => s.setFilter)

  const activeTab: FormatTab = useMemo(() => {
    const f = filters.format
    if (!f || f.length === 0) return 'all'
    if (f.length === 1 && f[0] === 'audiobook') return 'audiobooks'
    // Treat any combination of epub/pdf as the ebooks tab
    if (f.every(v => v === 'epub' || v === 'pdf')) return 'ebooks'
    return 'all'
  }, [filters.format])

  const counts = useMemo(() => {
    // Count against all books (ignoring current format filter) but respecting source filter
    const sourceFiltered = filters.source && filters.source !== 'all'
      ? books.filter(b => filters.source === 'audiobookshelf' ? b.absServerId : !b.absServerId)
      : books
    return {
      all: sourceFiltered.length,
      audiobooks: sourceFiltered.filter(b => b.format === 'audiobook').length,
      ebooks: sourceFiltered.filter(b => b.format === 'epub' || b.format === 'pdf').length,
    }
  }, [books, filters.source])

  return (
    <div
      className="flex gap-2 overflow-x-auto pb-1 -mb-1 scrollbar-none"
      role="tablist"
      aria-label="Filter by format"
    >
      {FORMAT_TABS.map(tab => {
        const isActive = activeTab === tab.value
        const count = counts[tab.value]
        const Icon = tab.icon
        return (
          <button
            key={tab.value}
            role="tab"
            aria-selected={isActive}
            onClick={() => setFilter('format', tab.filterValue)}
            className={cn(
              'whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition-colors min-h-[36px] flex-shrink-0 inline-flex items-center gap-1.5',
              isActive
                ? 'bg-brand text-brand-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            )}
            data-testid={`format-tab-${tab.value}`}
          >
            {Icon && <Icon className="size-3.5" aria-hidden="true" />}
            {tab.label}
            <span className="ml-0.5 text-xs opacity-80">({count})</span>
          </button>
        )
      })}
    </div>
  )
}
