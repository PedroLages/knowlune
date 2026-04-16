/**
 * CoverSearchGrid — search results grid for the multi-provider cover/metadata search.
 *
 * Displays results from all providers progressively. Supports loading skeletons,
 * progressive loading indicators, empty state, and selected result highlighting.
 *
 * @since E108-S09 (multi-provider metadata search — Unit 7)
 */

import { useState } from 'react'
import { AlignLeft, BookOpen, Loader2, Mic2 } from 'lucide-react'
import type { MetadataSearchResult } from '@/services/CoverSearchService'

interface CoverSearchGridProps {
  results: MetadataSearchResult[]
  isSearching: boolean
  onSelect: (result: MetadataSearchResult) => void
}

const PROVIDER_LABELS: Record<MetadataSearchResult['provider'], string> = {
  audnexus: 'Audnexus',
  'google-books': 'Google Books',
  itunes: 'iTunes',
  'open-library': 'Open Library',
}

export function CoverSearchGrid({ results, isSearching, onSelect }: CoverSearchGridProps) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null)

  const resultKey = (r: MetadataSearchResult, i: number) =>
    `${r.provider}-${r.metadata.isbn ?? r.metadata.asin ?? i}`

  const handleSelect = (result: MetadataSearchResult, index: number) => {
    setSelectedKey(resultKey(result, index))
    onSelect(result)
  }

  // Loading state: searching and no results yet → show 6 skeleton cards
  if (isSearching && results.length === 0) {
    return (
      <div data-testid="cover-search-grid" className="space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="animate-pulse rounded-xl border border-border/20 bg-card overflow-hidden min-h-[44px]"
            >
              <div className="h-36 bg-muted/60" />
              <div className="p-2 space-y-1.5">
                <div className="h-3 bg-muted/60 rounded w-2/3" />
                <div className="h-3 bg-muted/60 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Empty state: not searching and no results
  if (!isSearching && results.length === 0) {
    return (
      <div
        data-testid="cover-search-grid"
        className="flex items-center justify-center py-10 text-center text-sm text-muted-foreground"
      >
        No results found. Try adjusting the title or author.
      </div>
    )
  }

  return (
    <div data-testid="cover-search-grid" className="space-y-3">
      {/* Progressive loading indicator when results are streaming in */}
      {isSearching && results.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin text-brand" />
          <span>Searching more sources…</span>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {results.map((result, index) => {
          const isSelected = selectedKey === resultKey(result, index)
          const hasImage = Boolean(result.coverUrl ?? result.thumbnailUrl)

          return (
            <button
              key={`${result.provider}-${result.metadata.isbn ?? result.metadata.asin ?? index}`}
              type="button"
              data-testid={`cover-card-${index}`}
              onClick={() => handleSelect(result, index)}
              className={[
                'group relative rounded-xl border text-left overflow-hidden transition-all duration-150',
                'min-h-[44px] cursor-pointer bg-card hover:shadow-md',
                isSelected
                  ? 'border-brand ring-2 ring-brand/50 shadow-md'
                  : 'border-border/20 hover:border-border/50',
              ].join(' ')}
            >
              {/* Cover image or placeholder */}
              {hasImage ? (
                <img
                  src={result.thumbnailUrl ?? result.coverUrl}
                  alt={result.metadata.title ?? 'Book cover'}
                  className="w-full h-36 object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-36 flex flex-col items-center justify-center gap-1 bg-muted/40">
                  <BookOpen className="h-7 w-7 text-muted-foreground/50" />
                  <span className="text-[10px] text-muted-foreground/60 text-center px-2">
                    {PROVIDER_LABELS[result.provider]}
                  </span>
                </div>
              )}

              {/* Bottom metadata strip */}
              <div className="p-2 space-y-1">
                {/* Provider badge */}
                <span className="inline-block text-[10px] font-semibold uppercase tracking-wide rounded-full px-1.5 py-0.5 bg-brand/10 text-brand-soft-foreground">
                  {PROVIDER_LABELS[result.provider]}
                </span>

                {/* Metadata indicators */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {result.metadata.narrator && (
                    <span
                      title="Has narrator"
                      className="flex items-center gap-0.5 text-[10px] text-muted-foreground"
                    >
                      <Mic2 className="h-3 w-3" />
                    </span>
                  )}
                  {result.metadata.series && (
                    <span
                      title={`Series: ${result.metadata.series}`}
                      className="flex items-center gap-0.5 text-[10px] text-muted-foreground"
                    >
                      <BookOpen className="h-3 w-3" />
                    </span>
                  )}
                  {result.metadata.description && (
                    <span
                      title="Has description"
                      className="flex items-center gap-0.5 text-[10px] text-muted-foreground"
                    >
                      <AlignLeft className="h-3 w-3" />
                    </span>
                  )}
                </div>
              </div>

              {/* Selected checkmark overlay */}
              {isSelected && (
                <div className="absolute top-1.5 right-1.5 h-5 w-5 rounded-full bg-brand flex items-center justify-center shadow">
                  <svg
                    className="h-3 w-3 text-brand-foreground"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
