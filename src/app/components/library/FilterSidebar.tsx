/**
 * Filter & Sort sidebar for the library — Stitch design.
 *
 * Uses Sheet component for slide-in panel. Provides sort options,
 * format filters, and searchable author filter list.
 * Active filter chips shown at top for quick removal.
 *
 * @since Library Redesign
 */

import { useState, useMemo } from 'react'
import { Search, X } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/app/components/ui/sheet'
import { Checkbox } from '@/app/components/ui/checkbox'
import { useBookStore, type SortOption } from '@/stores/useBookStore'
import { useShelfStore } from '@/stores/useShelfStore'
import { ALL_GENRES } from '@/services/GenreDetectionService'
import { cn } from '@/app/components/ui/utils'

interface FilterSidebarProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'recent', label: 'Recently Added' },
  { value: 'title-asc', label: 'Title A-Z' },
  { value: 'author-asc', label: 'Author A-Z' },
  { value: 'progress', label: 'Progress' },
  { value: 'duration', label: 'Duration' },
]

const FORMAT_OPTIONS = [
  { value: 'audiobook', label: 'Audiobook' },
  { value: 'epub', label: 'EPUB' },
]

/** Sentinel value for books with no genre assigned. Used in filter UI and store. */
export const UNSET_GENRE = 'Unset'

export function FilterSidebar({ open, onOpenChange }: FilterSidebarProps) {
  const filters = useBookStore(s => s.filters)
  const setFilter = useBookStore(s => s.setFilter)
  const setFilters = useBookStore(s => s.setFilters)
  const getAllAuthors = useBookStore(s => s.getAllAuthors)
  const getSortedShelves = useShelfStore(s => s.getSortedShelves)
  const shelves = getSortedShelves()
  const [authorSearch, setAuthorSearch] = useState('')

  const allAuthors = useMemo(() => getAllAuthors(), [getAllAuthors])
  const filteredAuthors = useMemo(
    () =>
      authorSearch
        ? allAuthors.filter(a => a.toLowerCase().includes(authorSearch.toLowerCase()))
        : allAuthors,
    [allAuthors, authorSearch]
  )

  const activeSort = filters.sort || 'recent'
  const activeFormats = filters.format || []
  const activeAuthors = filters.authors || []

  const handleSortChange = (value: SortOption) => {
    setFilter('sort', value)
  }

  const handleFormatToggle = (format: string) => {
    const current = activeFormats
    const next = current.includes(format) ? current.filter(f => f !== format) : [...current, format]
    setFilter('format', next.length > 0 ? next : undefined)
  }

  const handleAuthorToggle = (author: string) => {
    const current = activeAuthors
    const next = current.includes(author) ? current.filter(a => a !== author) : [...current, author]
    setFilter('authors', next.length > 0 ? next : undefined)
  }

  const handleGenreSelect = (genreValue: string) => {
    // Toggle: if already selected, clear; otherwise set
    setFilter('genre', filters.genre === genreValue ? undefined : genreValue)
  }

  const handleClearAll = () => {
    setFilters({ status: filters.status, search: filters.search, source: filters.source })
  }

  // Build active chip list
  const activeChips: { label: string; onRemove: () => void }[] = []
  if (activeSort !== 'recent') {
    const sortLabel = SORT_OPTIONS.find(o => o.value === activeSort)?.label ?? activeSort
    activeChips.push({
      label: sortLabel,
      onRemove: () => setFilter('sort', 'recent'),
    })
  }
  for (const fmt of activeFormats) {
    const fmtLabel = FORMAT_OPTIONS.find(o => o.value === fmt)?.label ?? fmt
    activeChips.push({
      label: fmtLabel,
      onRemove: () => handleFormatToggle(fmt),
    })
  }
  for (const author of activeAuthors) {
    activeChips.push({
      label: author,
      onRemove: () => handleAuthorToggle(author),
    })
  }
  if (filters.genre) {
    activeChips.push({
      label: `Genre: ${filters.genre}`,
      onRemove: () => setFilter('genre', undefined),
    })
  }
  if (filters.shelfId) {
    const shelfName = shelves.find(s => s.id === filters.shelfId)?.name ?? 'Shelf'
    activeChips.push({
      label: `Shelf: ${shelfName}`,
      onRemove: () => setFilter('shelfId', undefined),
    })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[340px] sm:w-[380px] flex flex-col p-0"
        data-testid="filter-sidebar"
      >
        {/* Header */}
        <SheetHeader className="flex flex-row items-center justify-between px-6 pt-6 pb-4">
          <SheetTitle className="text-lg font-bold">Sort & Filter</SheetTitle>
          {activeChips.length > 0 && (
            <button
              onClick={handleClearAll}
              className="text-sm font-bold text-brand hover:text-brand-hover transition-colors"
              data-testid="clear-all-filters"
            >
              Clear All
            </button>
          )}
        </SheetHeader>

        {/* Active filter chips */}
        {activeChips.length > 0 && (
          <div className="px-6 pb-4 flex gap-2 flex-wrap">
            {activeChips.map((chip, i) => (
              <span
                key={`${chip.label}-${i}`}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-brand/10 text-brand rounded-full text-xs font-bold"
              >
                {chip.label}
                <button
                  onClick={chip.onRemove}
                  className="hover:text-destructive transition-colors"
                  aria-label={`Remove ${chip.label} filter`}
                >
                  <X className="size-3.5" />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 pb-20">
          {/* Sort By */}
          <div className="mb-8">
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-4">
              Sort By
            </h4>
            <div className="space-y-3">
              {SORT_OPTIONS.map(opt => (
                <label
                  key={opt.value}
                  className="flex items-center justify-between cursor-pointer group"
                >
                  <span
                    className={cn(
                      'text-sm font-medium transition-colors',
                      activeSort === opt.value
                        ? 'text-foreground'
                        : 'text-muted-foreground group-hover:text-foreground'
                    )}
                  >
                    {opt.label}
                  </span>
                  <div
                    className={cn(
                      'w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all',
                      activeSort === opt.value
                        ? 'border-brand bg-brand'
                        : 'border-muted-foreground/30 group-hover:border-muted-foreground/60'
                    )}
                  >
                    {activeSort === opt.value && (
                      <div className="w-1.5 h-1.5 rounded-full bg-white" />
                    )}
                  </div>
                  <input
                    type="radio"
                    name="sort"
                    value={opt.value}
                    checked={activeSort === opt.value}
                    onChange={() => handleSortChange(opt.value)}
                    className="hidden"
                  />
                </label>
              ))}
            </div>
          </div>

          {/* Format */}
          <div className="mb-8">
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-4">
              Format
            </h4>
            <div className="space-y-3">
              {FORMAT_OPTIONS.map(opt => (
                <label key={opt.value} className="flex items-center gap-3 cursor-pointer group">
                  <Checkbox
                    checked={activeFormats.includes(opt.value)}
                    onCheckedChange={() => handleFormatToggle(opt.value)}
                    className="border-muted-foreground/30 data-[state=checked]:border-brand data-[state=checked]:bg-brand"
                  />
                  <span className="text-sm font-medium text-foreground">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Shelf (E110-S01) */}
          {shelves.length > 0 && (
            <div className="mb-8">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-4">
                Shelf
              </h4>
              <div className="flex flex-wrap gap-2">
                {shelves.map(shelf => (
                  <button
                    key={shelf.id}
                    onClick={() =>
                      setFilter('shelfId', filters.shelfId === shelf.id ? undefined : shelf.id)
                    }
                    className={cn(
                      'rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                      filters.shelfId === shelf.id
                        ? 'bg-brand text-brand-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    )}
                    data-testid={`shelf-filter-${shelf.name.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    {shelf.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Genre (E108-S05) */}
          <div className="mb-8">
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-4">
              Genre
            </h4>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleGenreSelect(UNSET_GENRE)}
                className={cn(
                  'rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                  filters.genre === UNSET_GENRE
                    ? 'bg-brand text-brand-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                )}
                data-testid="genre-filter-unset"
              >
                Unset
              </button>
              {ALL_GENRES.filter(g => g !== 'Other').map(g => (
                <button
                  key={g}
                  onClick={() => handleGenreSelect(g)}
                  className={cn(
                    'rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                    filters.genre === g
                      ? 'bg-brand text-brand-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  )}
                  data-testid={`genre-filter-${g.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          {/* Author */}
          <div className="mb-8">
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-4">
              Author
            </h4>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
              <input
                value={authorSearch}
                onChange={e => setAuthorSearch(e.target.value)}
                placeholder="Search authors..."
                className="w-full pl-10 pr-4 py-2.5 bg-muted/50 border-none rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-brand/30 placeholder:text-muted-foreground transition-all"
                data-testid="author-search-input"
              />
            </div>
            <div className="overflow-y-auto pr-1 space-y-3">
              {filteredAuthors.map(author => (
                <label key={author} className="flex items-center gap-3 cursor-pointer group">
                  <Checkbox
                    checked={activeAuthors.includes(author)}
                    onCheckedChange={() => handleAuthorToggle(author)}
                    className="border-muted-foreground/30 data-[state=checked]:border-brand data-[state=checked]:bg-brand"
                  />
                  <span className="text-sm font-medium text-foreground truncate">{author}</span>
                </label>
              ))}
              {filteredAuthors.length === 0 && (
                <p className="text-xs text-muted-foreground py-2">No authors match your search.</p>
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
