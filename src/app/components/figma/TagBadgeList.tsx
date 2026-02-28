import { X } from 'lucide-react'
import { Badge } from '@/app/components/ui/badge'
import { cn } from '@/app/components/ui/utils'

interface TagBadgeListProps {
  tags: string[]
  onRemove?: (tag: string) => void
  maxVisible?: number
  className?: string
}

export function TagBadgeList({ tags, onRemove, maxVisible, className }: TagBadgeListProps) {
  if (tags.length === 0) return null

  const visible = maxVisible ? tags.slice(0, maxVisible) : tags
  const overflow = maxVisible ? tags.length - maxVisible : 0

  return (
    <div data-testid="course-card-tags" className={cn('flex flex-wrap gap-1.5', className)}>
      {visible.map(tag => (
        <Badge
          key={tag}
          variant="secondary"
          data-testid="tag-badge"
          className="text-xs py-0 px-2 h-5"
        >
          {tag}
          {onRemove && (
            <button
              type="button"
              aria-label={`Remove tag: ${tag}`}
              onClick={e => {
                e.stopPropagation()
                onRemove(tag)
              }}
              className="ml-1 rounded-full hover:bg-muted-foreground/20 p-0.5 -mr-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
            >
              <X className="size-3" />
            </button>
          )}
        </Badge>
      ))}
      {overflow > 0 && (
        <Badge variant="outline" data-testid="tag-overflow-badge" className="text-xs py-0 px-2 h-5">
          +{overflow} more
        </Badge>
      )}
    </div>
  )
}
