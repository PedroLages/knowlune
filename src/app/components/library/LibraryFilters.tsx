/**
 * Library search bar, status filter pills, and view toggle.
 *
 * Provides real-time search with 300ms debounce, status filter pills
 * with count badges, and grid/list view toggle.
 *
 * @since E83-S04
 */

import { useCallback, useRef, useState } from 'react'
import { LayoutGrid, List, Search } from 'lucide-react'
import { Input } from '@/app/components/ui/input'
import { useBookStore } from '@/stores/useBookStore'
import { cn } from '@/app/components/ui/utils'
import type { BookStatus } from '@/data/types'

const STATUS_PILLS: { value: 'all' | BookStatus; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Want to Read' },
  { value: 'reading', label: 'Reading' },
  { value: 'finished', label: 'Finished' },
  { value: 'abandoned', label: 'Abandoned' },
]

export function LibraryFilters() {
  const filters = useBookStore(s => s.filters)
  const setFilter = useBookStore(s => s.setFilter)
  const libraryView = useBookStore(s => s.libraryView)
  const setLibraryView = useBookStore(s => s.setLibraryView)
  const getBookCountByStatus = useBookStore(s => s.getBookCountByStatus)

  const counts = getBookCountByStatus()
  const activeStatus = filters.status || 'all'

  // Debounced search
  const [searchValue, setSearchValue] = useState(filters.search || '')
  const timerRef = useRef<ReturnType<typeof setTimeout>>()
  const handleSearch = useCallback(
    (value: string) => {
      setSearchValue(value)
      clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        setFilter('search', value || undefined)
      }, 300)
    },
    [setFilter]
  )

  return (
    <div className="flex flex-col gap-3">
      {/* Search + View Toggle row */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={searchValue}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Search books..."
            className="min-h-[44px] pl-9"
            aria-label="Search books"
            data-testid="library-search-input"
          />
        </div>

        {/* View toggle */}
        <div className="flex items-center rounded-lg border border-border/50 p-0.5 flex-shrink-0">
          <button
            onClick={() => setLibraryView('grid')}
            className={cn(
              'rounded-md p-1.5 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center',
              libraryView === 'grid'
                ? 'bg-brand text-brand-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
            aria-label="Grid view"
            aria-pressed={libraryView === 'grid'}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setLibraryView('list')}
            className={cn(
              'rounded-md p-1.5 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center',
              libraryView === 'list'
                ? 'bg-brand text-brand-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
            aria-label="List view"
            aria-pressed={libraryView === 'list'}
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Status filter pills */}
      <div
        className="flex gap-2 overflow-x-auto pb-1 -mb-1"
        role="tablist"
        aria-label="Filter by reading status"
      >
        {STATUS_PILLS.map(pill => {
          const isActive = activeStatus === pill.value
          const count = counts[pill.value] || 0
          return (
            <button
              key={pill.value}
              role="tab"
              aria-selected={isActive}
              onClick={() => setFilter('status', pill.value)}
              className={cn(
                'whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition-colors min-h-[36px] flex-shrink-0',
                isActive
                  ? 'bg-brand text-brand-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              )}
              data-testid={`filter-pill-${pill.value}`}
            >
              {pill.label}
              {pill.value === 'all' && (
                <span className="ml-1.5 text-xs opacity-80">({count})</span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
