/**
 * Library primary filter bar.
 *
 * Row 1 (this component): status pills left, utility controls right
 * (view toggle + collapsible search + filter sidebar trigger).
 *
 * @since E83-S04
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { Input } from '@/app/components/ui/input'
import { Button } from '@/app/components/ui/button'
import { FilterSidebar } from '@/app/components/library/FilterSidebar'
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

interface LibraryFiltersProps {
  viewToggle?: React.ReactNode
}

export function LibraryFilters({ viewToggle }: LibraryFiltersProps = {}) {
  const filters = useBookStore(s => s.filters)
  const setFilter = useBookStore(s => s.setFilter)
  const books = useBookStore(s => s.books)
  const getBookCountByStatus = useBookStore(s => s.getBookCountByStatus)
  const activeSource = useBookStore(s => s.filters.source)

  const counts = useMemo(
    () => getBookCountByStatus(),
    [books, activeSource, getBookCountByStatus]
  )
  const activeStatus = filters.status || 'all'

  // Filter sidebar
  const [filterOpen, setFilterOpen] = useState(false)
  const activeFilterCount =
    ((filters.format?.length ?? 0) > 0 ? 1 : 0) +
    ((filters.authors?.length ?? 0) > 0 ? 1 : 0) +
    (filters.sort && filters.sort !== 'recent' ? 1 : 0) +
    (filters.genre ? 1 : 0)

  // Active filter chips
  const activeChips: { key: string; label: string }[] = []
  if (filters.sort && filters.sort !== 'recent')
    activeChips.push({ key: 'sort', label: `Sort: ${filters.sort}` })
  if (filters.format?.length)
    activeChips.push({ key: 'format', label: `Format: ${filters.format.join(', ')}` })
  if (filters.authors?.length)
    activeChips.push({
      key: 'authors',
      label: `${filters.authors.length} author${filters.authors.length > 1 ? 's' : ''}`,
    })
  if (filters.genre) activeChips.push({ key: 'genre', label: `Genre: ${filters.genre}` })

  const removeChip = (key: string) => {
    setFilter(key as 'sort' | 'format' | 'authors' | 'genre', undefined)
  }

  // Collapsible search
  const [searchOpen, setSearchOpen] = useState(!!(filters.search))
  const inputRef = useRef<HTMLInputElement>(null)
  const [searchValue, setSearchValue] = useState(filters.search || '')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleSearch = useCallback(
    (value: string) => {
      setSearchValue(value)
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        setFilter('search', value || undefined)
      }, 300)
    },
    [setFilter]
  )

  const openSearch = () => {
    setSearchOpen(true)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const closeSearch = () => {
    setSearchOpen(false)
    handleSearch('')
  }

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [])

  return (
    <div className="flex flex-col gap-2">
      {/* Primary row: status pills (left) + utility controls (right) */}
      <div className="flex items-center gap-2">
        {/* Status pills — scroll on mobile */}
        <div className="relative flex-1 min-w-0">
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-background to-transparent z-10 sm:hidden" />
          <div
            className="flex gap-1.5 overflow-x-auto scrollbar-none"
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
                  aria-label={`${pill.label} — ${count} book${count !== 1 ? 's' : ''}`}
                  onClick={() => setFilter('status', pill.value)}
                  className={cn(
                    'whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors min-h-[36px] flex-shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2',
                    isActive
                      ? 'bg-brand text-brand-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80',
                    !isActive && count === 0 && 'opacity-40'
                  )}
                  data-testid={`filter-pill-${pill.value}`}
                >
                  {pill.label}
                  <span className="ml-1 text-[11px]">({count})</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Utility controls — always right, never wrap */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* View toggle injected by parent */}
          {viewToggle}

          {/* Expanding search */}
          <div
            className={cn(
              'relative flex items-center transition-all duration-200 ease-in-out overflow-hidden',
              searchOpen ? 'w-44 sm:w-56' : 'w-0'
            )}
          >
            <Search className="absolute left-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none z-10" />
            <Input
              ref={inputRef}
              value={searchValue}
              onChange={e => handleSearch(e.target.value)}
              onKeyDown={e => e.key === 'Escape' && closeSearch()}
              placeholder="Search..."
              className="h-9 pl-8 pr-7 text-sm w-full"
              aria-label="Search books"
              data-testid="library-search-input"
            />
            {searchValue && (
              <button
                onClick={closeSearch}
                className="absolute right-2 text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Clear search"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          {/* Search icon — shown when collapsed */}
          <Button
            variant="ghost"
            size="icon"
            onClick={searchOpen ? closeSearch : openSearch}
            className={cn(
              'size-9 rounded-xl flex-shrink-0',
              searchOpen && 'text-brand'
            )}
            aria-label={searchOpen ? 'Close search' : 'Search books'}
            data-testid="library-search-toggle"
          >
            <Search className="size-4" />
          </Button>

          {/* Filter button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setFilterOpen(true)}
            className="size-9 rounded-xl relative flex-shrink-0"
            aria-label="Open filters"
            data-testid="filter-sidebar-trigger"
          >
            <SlidersHorizontal className="size-4" />
            {activeFilterCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 size-3.5 rounded-full bg-brand text-brand-foreground text-[9px] flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* Active filter chips */}
      {activeChips.length > 0 && (
        <div role="group" aria-label="Active filters" className="flex gap-2 flex-wrap">
          {activeChips.map(chip => (
            <button
              key={chip.key}
              onClick={() => removeChip(chip.key)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-brand-soft text-brand-soft-foreground text-xs font-medium transition-colors hover:bg-brand-soft/80"
              aria-label={`Remove ${chip.label} filter`}
            >
              {chip.label}
              <X className="size-3" />
            </button>
          ))}
        </div>
      )}

      <FilterSidebar open={filterOpen} onOpenChange={setFilterOpen} />
    </div>
  )
}
