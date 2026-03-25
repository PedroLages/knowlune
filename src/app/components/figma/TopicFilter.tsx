import { ToggleGroup, ToggleGroupItem } from '@/app/components/ui/toggle-group'

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
  if (availableTags.length === 0) return null

  return (
    <div data-testid="topic-filter-bar" className="flex flex-wrap gap-2 items-center mb-6">
      <ToggleGroup
        type="multiple"
        value={selectedTags}
        onValueChange={onSelectedTagsChange}
        aria-label="Filter by topic"
        className="flex flex-wrap gap-2"
      >
        {availableTags.map(tag => (
          <ToggleGroupItem
            key={tag}
            value={tag}
            data-testid="topic-filter-button"
            className="h-auto rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors first:rounded-full last:rounded-full data-[state=on]:bg-brand data-[state=on]:text-brand-foreground data-[state=on]:hover:bg-brand-hover data-[state=on]:border-transparent data-[state=off]:bg-transparent data-[state=off]:hover:bg-accent data-[state=off]:border-input cursor-pointer shadow-none"
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
