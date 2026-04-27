import { BookOpen, Trash2, Pencil } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { Card, CardContent } from '@/app/components/ui/card'
import { cn } from '@/app/components/ui/utils'
import { MasteryBadge } from './MasteryBadge'
import type { VocabularyItem } from '@/data/types'

export type VocabularyCardProps = {
  item: VocabularyItem
  bookTitle?: string
  onEdit: (item: VocabularyItem) => void
  onDelete: (id: string) => void
  onSelect?: (id: string) => void
  selected?: boolean
}

export function VocabularyCard({
  item,
  bookTitle,
  onEdit,
  onDelete,
  onSelect,
  selected,
}: VocabularyCardProps) {
  return (
    <Card
      className={cn(
        'group transition-[border-color,box-shadow] hover:border-brand/40',
        selected && 'border-brand/50 shadow-[0_0_0_1px_var(--brand)]'
      )}
      data-testid="vocabulary-card"
      data-selected={selected ? 'true' : 'false'}
      data-vocab-id={item.id}
    >
      <CardContent className="flex items-start gap-3 p-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2 mb-1 min-w-0">
            <button
              type="button"
              className={cn(
                'min-w-0 flex-1 text-left font-semibold text-foreground break-words [overflow-wrap:anywhere] line-clamp-2 rounded-sm',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring'
              )}
              data-testid={`vocab-word-${item.id}`}
              onClick={() => onSelect?.(item.id)}
              aria-current={selected ? 'true' : undefined}
            >
              {item.word}
            </button>
            <div className="shrink-0 pt-0.5">
              <MasteryBadge level={item.masteryLevel} />
            </div>
          </div>
          {item.definition && (
            <p
              className="text-sm text-muted-foreground mb-1 break-words [overflow-wrap:anywhere] line-clamp-2"
              data-testid="vocab-definition"
            >
              {item.definition}
            </p>
          )}
          {item.context && (
            <p className="text-xs text-muted-foreground/70 italic break-words [overflow-wrap:anywhere] line-clamp-2">
              &ldquo;...{item.context}...&rdquo;
            </p>
          )}
          {bookTitle && (
            <p className="text-xs text-muted-foreground mt-1 flex items-start gap-1 min-w-0">
              <BookOpen className="size-3" aria-hidden="true" />
              <span className="min-w-0 break-words [overflow-wrap:anywhere] line-clamp-2">
                {bookTitle}
              </span>
            </p>
          )}
        </div>
        <div className="flex shrink-0 gap-1 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            className="size-8 focus-visible:opacity-100"
            onClick={() => onEdit(item)}
            aria-label={`Edit ${item.word}`}
          >
            <Pencil className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-destructive hover:text-destructive focus-visible:opacity-100"
            onClick={() => onDelete(item.id)}
            aria-label={`Delete ${item.word}`}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
