/**
 * DeleteServerDialog — confirmation alert dialog for removing an Audiobookshelf server.
 *
 * Follows the exact pattern from DeleteCatalogDialog.tsx.
 * Explicitly notes that cached book metadata is NOT deleted (preserving offline reference).
 *
 * @module DeleteServerDialog
 * @since E101-S02
 */

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
import type { AudiobookshelfServer } from '@/data/types'

interface DeleteServerDialogProps {
  target: AudiobookshelfServer | null
  onConfirm: () => void
  onCancel: () => void
}

export function DeleteServerDialog({ target, onConfirm, onCancel }: DeleteServerDialogProps) {
  return (
    <AlertDialog open={target !== null} onOpenChange={open => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove &ldquo;{target?.name}&rdquo;?</AlertDialogTitle>
          <AlertDialogDescription>
            This will remove the server connection. Cached audiobook metadata will not be deleted.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 min-h-[44px]"
            data-testid="abs-confirm-delete-btn"
          >
            Remove
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
