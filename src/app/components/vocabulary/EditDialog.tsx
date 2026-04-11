import { useState } from 'react'
import { Button } from '@/app/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card'
import { Input } from '@/app/components/ui/input'
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="dialog"
      aria-label={`Edit vocabulary: ${item.word}`}
      data-testid="vocab-edit-dialog"
    >
      <Card className="w-full max-w-md mx-4">
        <CardHeader>
          <CardTitle className="text-lg">Edit: {item.word}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label htmlFor="vocab-definition" className="text-sm font-medium text-foreground mb-1 block">
              Definition
            </label>
            <Input
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
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button variant="brand" onClick={() => onSave(definition, note)}>
              Save
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
