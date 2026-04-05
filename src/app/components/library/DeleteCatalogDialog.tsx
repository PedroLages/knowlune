/**
 * DeleteCatalogDialog — confirmation alert dialog for removing an OPDS catalog.
 *
 * @module DeleteCatalogDialog
 * @since E88-S01
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
import type { OpdsCatalog } from '@/data/types'

interface DeleteCatalogDialogProps {
  target: OpdsCatalog | null
  onConfirm: () => void
  onCancel: () => void
}

export function DeleteCatalogDialog({ target, onConfirm, onCancel }: DeleteCatalogDialogProps) {
  return (
    <AlertDialog open={target !== null} onOpenChange={open => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove &ldquo;{target?.name}&rdquo;?</AlertDialogTitle>
          <AlertDialogDescription>
            This will remove the catalog connection. Books already imported from this catalog will
            not be affected.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 min-h-[44px]"
            data-testid="opds-confirm-delete-btn"
          >
            Remove
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
