import { useState, useEffect } from 'react'
import { Layers } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog'
import { Button } from '@/app/components/ui/button'
import { Textarea } from '@/app/components/ui/textarea'
import { Label } from '@/app/components/ui/label'
import { useFlashcardStore } from '@/stores/useFlashcardStore'

interface CreateFlashcardDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultFront: string
  courseId: string
  noteId?: string
}

export function CreateFlashcardDialog({
  open,
  onOpenChange,
  defaultFront,
  courseId,
  noteId,
}: CreateFlashcardDialogProps) {
  const [front, setFront] = useState(defaultFront)
  const [back, setBack] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const createFlashcard = useFlashcardStore(s => s.createFlashcard)

  // Sync front field when defaultFront changes (new text selection)
  useEffect(() => {
    if (open) {
      setFront(defaultFront)
      setBack('')
    }
  }, [open, defaultFront])

  async function handleCreate() {
    if (!front.trim() || !back.trim()) return
    setIsSubmitting(true)
    try {
      await createFlashcard(front.trim(), back.trim(), courseId, noteId)
      onOpenChange(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      void handleCreate()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onKeyDown={handleKeyDown}>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-brand-soft text-brand-soft-foreground">
              <Layers className="size-4" />
            </div>
            <DialogTitle>Create Flashcard</DialogTitle>
          </div>
          <DialogDescription>
            Create a flashcard from your selected text. Press ⌘↵ to save.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="flashcard-front">Front (Question)</Label>
            <Textarea
              id="flashcard-front"
              value={front}
              onChange={e => setFront(e.target.value)}
              placeholder="The question or concept to memorize…"
              className="min-h-[80px] resize-none"
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="flashcard-back">Back (Answer)</Label>
            <Textarea
              id="flashcard-back"
              value={back}
              onChange={e => setBack(e.target.value)}
              placeholder="The answer or explanation…"
              className="min-h-[80px] resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            className="h-11"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            variant="brand"
            className="h-11"
            onClick={handleCreate}
            disabled={!front.trim() || !back.trim() || isSubmitting}
          >
            {isSubmitting ? 'Creating…' : 'Create Flashcard'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
