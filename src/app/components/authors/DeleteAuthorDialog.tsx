import { useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/app/components/ui/alert-dialog'
import { useAuthorStore } from '@/stores/useAuthorStore'
import type { ImportedAuthor } from '@/data/types'

interface DeleteAuthorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  author: ImportedAuthor
  onDeleted?: () => void
}

export function DeleteAuthorDialog({
  open,
  onOpenChange,
  author,
  onDeleted,
}: DeleteAuthorDialogProps) {
  const { deleteAuthor } = useAuthorStore()
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    if (deleting) return
    setDeleting(true)

    try {
      await deleteAuthor(author.id)
      // Store's deleteAuthor already shows an undo toast — no additional toast needed
      onOpenChange(false)
      onDeleted?.()
    } catch (error) {
      // silent-catch-ok: store already shows toast.error to user; log for debugging
      console.error('[DeleteAuthorDialog] Delete failed:', error)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent data-testid="delete-author-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete &ldquo;{author.name}&rdquo;?</AlertDialogTitle>
          <AlertDialogDescription>
            This will remove the author profile. You can undo this action briefly after deletion.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            data-testid="delete-author-confirm"
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={deleting}
            onClick={handleDelete}
          >
            {deleting ? 'Deleting\u2026' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
