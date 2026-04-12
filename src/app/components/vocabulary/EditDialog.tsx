import { useState } from 'react'
import { Button } from '@/app/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/app/components/ui/dialog'
import { Input } from '@/app/components/ui/input'
import { Textarea } from '@/app/components/ui/textarea'
import type { VocabularyItem } from '@/data/types'

export function EditDialog({
  item,
  onSave,
  onCancel,
}: {
  item: VocabularyItem
  onSave: (definition: string, note: string) => void
  onCancel: () => void
}) {
  const [definition, setDefinition] = useState(item.definition ?? '')
  const [note, setNote] = useState(item.note ?? '')

  return (
    <Dialog
      open
      onOpenChange={open => {
        if (!open) onCancel()
      }}
    >
      <DialogContent data-testid="vocab-edit-dialog" className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg">Edit: {item.word}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label
              htmlFor="vocab-definition"
              className="text-sm font-medium text-foreground mb-1 block"
            >
              Definition
            </label>
            <Textarea
              id="vocab-definition"
              value={definition}
              onChange={e => setDefinition(e.target.value)}
              placeholder="Enter definition..."
              data-testid="vocab-definition-input"
            />
          </div>
          <div>
            <label htmlFor="vocab-note" className="text-sm font-medium text-foreground mb-1 block">
              Note
            </label>
            <Input
              id="vocab-note"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Optional note..."
              data-testid="vocab-note-input"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="brand" onClick={() => onSave(definition, note)}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
