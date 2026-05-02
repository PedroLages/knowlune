import { BookOpen } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/app/components/ui/dialog'
import type { VocabularyItem } from '@/data/types'

export function VocabularyDetailsDialog({
  open,
  item,
  bookTitle,
  onOpenChange,
  onEdit,
  onDelete,
}: {
  open: boolean
  item: VocabularyItem | null
  bookTitle?: string
  onOpenChange: (open: boolean) => void
  onEdit: (item: VocabularyItem) => void
  onDelete: (id: string) => void
}) {
  if (!item) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="vocabulary-details-dialog" className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg break-words [overflow-wrap:anywhere]">
            {item.word}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {item.definition ? (
            <div className="text-sm text-muted-foreground break-words [overflow-wrap:anywhere] whitespace-pre-wrap">
              {item.definition}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">No definition yet.</div>
          )}

          {item.context && (
            <div className="text-xs text-muted-foreground/80 italic break-words [overflow-wrap:anywhere]">
              &ldquo;...{item.context}...&rdquo;
            </div>
          )}

          {bookTitle && (
            <div className="text-xs text-muted-foreground flex items-start gap-2 min-w-0">
              <BookOpen className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
              <span className="min-w-0 break-words [overflow-wrap:anywhere]">{bookTitle}</span>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button variant="outline" onClick={() => onEdit(item)} data-testid="vocabulary-details-edit">
            Edit
          </Button>
          <Button
            variant="outline"
            className="text-destructive border-destructive/30 hover:bg-destructive/10"
            onClick={() => onDelete(item.id)}
            data-testid="vocabulary-details-delete"
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

