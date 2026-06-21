import { useState, useCallback, useEffect } from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog'
import { Button } from '@/app/components/ui/button'
import { Input } from '@/app/components/ui/input'
import { Textarea } from '@/app/components/ui/textarea'
import { Label } from '@/app/components/ui/label'
import { useLearningPathStore } from '@/stores/useLearningPathStore'
import type { LearningPath } from '@/data/types'

interface EditPathDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  path: LearningPath
}

export function EditPathDialog({ open, onOpenChange, path }: EditPathDialogProps) {
  const renamePath = useLearningPathStore(s => s.renamePath)
  const updateDescription = useLearningPathStore(s => s.updateDescription)

  const [title, setTitle] = useState(path.name)
  const [description, setDescription] = useState(path.description || '')

  // Reset form when dialog opens with a new path
  useEffect(() => {
    if (open) {
      setTitle(path.name)
      setDescription(path.description || '')
    }
  }, [open, path.name, path.description])

  const handleSave = useCallback(async () => {
    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
      toast.error('Title is required')
      return
    }

    try {
      await renamePath(path.id, trimmedTitle)
      if (description !== (path.description || '')) {
        await updateDescription(path.id, description)
      }
      toast.success('Path updated')
      onOpenChange(false)
    } catch {
      toast.error('Failed to update path')
    }
  }, [title, description, path.id, path.description, renamePath, updateDescription, onOpenChange])

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        setTitle(path.name)
        setDescription(path.description || '')
      }
      onOpenChange(open)
    },
    [onOpenChange, path.name, path.description]
  )

  const canSave = title.trim().length > 0

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Path</DialogTitle>
          <DialogDescription>
            Update the name and description of your learning path.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="edit-path-title">Title</Label>
            <Input
              id="edit-path-title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Path name"
              maxLength={100}
              aria-label="Path title"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-path-description">Description</Label>
            <Textarea
              id="edit-path-description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Add a description..."
              maxLength={500}
              rows={3}
              aria-label="Path description"
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" variant="brand" onClick={handleSave} disabled={!canSave}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
