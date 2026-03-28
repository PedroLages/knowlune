import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { ToggleGroup, ToggleGroupItem } from '@/app/components/ui/toggle-group'

const DEFAULT_VISIBLE_COUNT = 12

interface TopicFilterProps {
  availableTags: string[]
  selectedTags: string[]
  onSelectedTagsChange: (tags: string[]) => void
  /** Optional map of tag → course count for display */
  tagCounts?: Map<string, number>
}

export function TopicFilter({
  availableTags,
  selectedTags,
  onSelectedTagsChange,
  tagCounts,
}: TopicFilterProps) {
  const [expanded, setExpanded] = useState(false)

  if (availableTags.length === 0) return null

  const needsCollapse = availableTags.length > DEFAULT_VISIBLE_COUNT

  const visibleTags = (() => {
    if (expanded || !needsCollapse) return availableTags
    const topTags = availableTags.slice(0, DEFAULT_VISIBLE_COUNT)
    const selectedOutside = selectedTags.filter(tag => !topTags.includes(tag))
    return [...topTags, ...selectedOutside]
  })()

  const hiddenCount = availableTags.length - visibleTags.length

  return (
    <div data-testid="topic-filter-bar" className="flex flex-wrap gap-2 items-center mb-6">
      <ToggleGroup
        type="multiple"
        value={selectedTags}
        onValueChange={onSelectedTagsChange}
        aria-label="Filter by topic"
        className="flex w-auto flex-wrap gap-2"
      >
        {visibleTags.map(tag => (
          <ToggleGroupItem
            key={tag}
            value={tag}
            data-testid="topic-filter-button"
            className="flex-none min-h-[44px] rounded-full border px-3 py-2 text-xs font-semibold transition-colors first:rounded-full last:rounded-full focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none data-[state=on]:bg-brand data-[state=on]:text-brand-foreground data-[state=on]:hover:bg-brand-hover data-[state=on]:border-transparent data-[state=on]:shadow-sm data-[state=off]:bg-transparent data-[state=off]:hover:bg-accent data-[state=off]:border-input cursor-pointer shadow-none"
          >
            {tag}
            {tagCounts && tagCounts.has(tag) && (
              <span
                className="ml-1 text-[10px] opacity-60"
                aria-label={`${tagCounts.get(tag)} courses`}
              >
                ({tagCounts.get(tag)})
              </span>
            )}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      {needsCollapse && (
        <button
          type="button"
          data-testid="topic-filter-toggle"
          onClick={() => setExpanded(prev => !prev)}
          aria-expanded={expanded}
          aria-label={expanded
            ? `Show fewer tags, currently showing all ${availableTags.length}`
            : `Show all ${availableTags.length} tags, currently showing ${visibleTags.length}`
          }
          className="flex items-center gap-1 min-h-[44px] px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors rounded-full cursor-pointer"
        >
          {expanded ? 'Show less' : `+${hiddenCount} more`}
          <ChevronDown
            className={`size-3 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          />
        </button>
      )}
      {selectedTags.length > 0 && (
        <button
          type="button"
          data-testid="clear-topic-filters"
          onClick={() => onSelectedTagsChange([])}
          className="text-xs text-muted-foreground hover:text-foreground underline ml-1"
        >
          Clear filters
        </button>
      )}
    </div>
  )
}
