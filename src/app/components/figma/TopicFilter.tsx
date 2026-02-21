import { Badge } from '@/app/components/ui/badge'

interface TopicFilterProps {
  availableTags: string[]
  selectedTags: string[]
  onSelectedTagsChange: (tags: string[]) => void
}

export function TopicFilter({
  availableTags,
  selectedTags,
  onSelectedTagsChange,
}: TopicFilterProps) {
  if (availableTags.length === 0) return null

  function toggleTag(tag: string) {
    if (selectedTags.includes(tag)) {
      onSelectedTagsChange(selectedTags.filter(t => t !== tag))
    } else {
      onSelectedTagsChange([...selectedTags, tag])
    }
  }

  return (
    <div
      data-testid="topic-filter-bar"
      role="group"
      aria-label="Filter by topic"
      className="flex flex-wrap gap-2 items-center mb-6"
    >
      {availableTags.map(tag => {
        const isSelected = selectedTags.includes(tag)
        return (
          <button
            key={tag}
            type="button"
            data-testid="topic-filter-button"
            aria-pressed={isSelected}
            onClick={() => toggleTag(tag)}
          >
            <Badge
              variant={isSelected ? 'default' : 'outline'}
              className={
                isSelected
                  ? 'bg-brand text-brand-foreground hover:bg-brand-hover cursor-pointer'
                  : 'cursor-pointer hover:bg-accent'
              }
            >
              {tag}
            </Badge>
          </button>
        )
      })}
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
