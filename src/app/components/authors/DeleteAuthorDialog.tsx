import { useState } from 'react'
import { toast } from 'sonner'
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
import type { Author, ImportedAuthor } from '@/data/types'

interface DeleteAuthorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  author: Author | ImportedAuthor
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
      toast.success('Author deleted')
      onOpenChange(false)
      onDeleted?.()
    } catch (error) {
      // Store already shows toast.error
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
            This will permanently remove the author profile. This action cannot be undone.
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
