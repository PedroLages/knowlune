import { BookOpen, Trash2, Pencil } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { Card, CardContent } from '@/app/components/ui/card'
import { MasteryBadge } from './MasteryBadge'
import type { VocabularyItem } from '@/data/types'

export function VocabularyCard({
  item,
  bookTitle,
  onEdit,
  onDelete,
}: {
  item: VocabularyItem
  bookTitle?: string
  onEdit: (item: VocabularyItem) => void
  onDelete: (id: string) => void
}) {
  return (
    <Card className="group" data-testid="vocabulary-card">
      <CardContent className="flex items-start gap-3 p-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-foreground truncate" data-testid="vocab-word">
              {item.word}
            </span>
            <MasteryBadge level={item.masteryLevel} />
          </div>
          {item.definition && (
            <p className="text-sm text-muted-foreground mb-1" data-testid="vocab-definition">
              {item.definition}
            </p>
          )}
          {item.context && (
            <p className="text-xs text-muted-foreground/70 italic truncate">
              &ldquo;...{item.context}...&rdquo;
            </p>
          )}
          {bookTitle && (
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <BookOpen className="size-3" aria-hidden="true" />
              {bookTitle}
            </p>
          )}
        </div>
        <div className="flex gap-1 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100 transition-opacity">
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
