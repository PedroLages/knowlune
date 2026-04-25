/**
 * Source filter tabs for the Library page: All | Local | Audiobookshelf.
 *
 * Hidden when no ABS servers are configured (local-only users see no tabs).
 * Uses the same pill styling as LibraryFilters status pills for visual consistency.
 *
 * @since E101-S03
 */

import { useMemo } from 'react'
import { Cloud } from 'lucide-react'
import { useBookStore } from '@/stores/useBookStore'
import { useAudiobookshelfStore } from '@/stores/useAudiobookshelfStore'
import { cn } from '@/app/components/ui/utils'

type SourceValue = 'all' | 'local' | 'audiobookshelf'

const SOURCE_TABS: { value: SourceValue; label: string; icon?: true }[] = [
  { value: 'all', label: 'All' },
  { value: 'local', label: 'Local' },
  { value: 'audiobookshelf', label: 'Audiobookshelf', icon: true },
]

export function LibrarySourceTabs() {
  const servers = useAudiobookshelfStore(s => s.servers)
  const filters = useBookStore(s => s.filters)
  const setFilter = useBookStore(s => s.setFilter)

  const activeSource: SourceValue = (filters.source as SourceValue) || 'all'

  // Hide entirely when no ABS servers are configured
  const hasServers = useMemo(() => servers.length > 0, [servers])
  if (!hasServers) return null

  return (
    <div
      className="flex gap-2 overflow-x-auto pb-1 -mb-1 scrollbar-none"
      role="tablist"
      aria-label="Filter by source"
    >
      {SOURCE_TABS.map(tab => {
        const isActive = activeSource === tab.value
        return (
          <button
            key={tab.value}
            role="tab"
            aria-selected={isActive}
            onClick={() => setFilter('source', tab.value === 'all' ? 'all' : tab.value)}
            className={cn(
              'whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-colors min-h-[28px] flex-shrink-0 inline-flex items-center gap-1 outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1',
              isActive
                ? 'bg-brand text-brand-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            )}
            data-testid={`source-tab-${tab.value}`}
          >
            {tab.icon && <Cloud className="size-3.5" aria-hidden="true" />}
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
