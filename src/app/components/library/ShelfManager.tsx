/**
 * Shelf management dialog — create, rename, and delete custom shelves (E110-S01).
 *
 * Default shelves (Favorites, Currently Reading, Want to Read) cannot be
 * renamed or deleted. Custom shelves support all operations.
 *
 * @since E110-S01
 */

import { useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/app/components/ui/dialog'
import { Button } from '@/app/components/ui/button'
import { Input } from '@/app/components/ui/input'
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
import { useShelfStore } from '@/stores/useShelfStore'
import { cn } from '@/app/components/ui/utils'

interface ShelfManagerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ShelfManager({ open, onOpenChange }: ShelfManagerProps) {
  const getSortedShelves = useShelfStore(s => s.getSortedShelves)
  const shelves = getSortedShelves()
  const createShelf = useShelfStore(s => s.createShelf)
  const renameShelf = useShelfStore(s => s.renameShelf)
  const deleteShelf = useShelfStore(s => s.deleteShelf)

  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  const handleCreate = async () => {
    const result = await createShelf(newName)
    if (result) setNewName('')
  }

  const handleRename = async () => {
    if (editingId) {
      await renameShelf(editingId, editingName)
      setEditingId(null)
      setEditingName('')
    }
  }

  const handleConfirmDelete = async () => {
    if (deleteConfirmId) {
      await deleteShelf(deleteConfirmId)
      setDeleteConfirmId(null)
    }
  }

  const sorted = shelves
  const shelfToDelete = shelves.find(s => s.id === deleteConfirmId)

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md" data-testid="shelf-manager-dialog">
          <DialogHeader>
            <DialogTitle>Manage Shelves</DialogTitle>
          </DialogHeader>

          {/* Create new shelf */}
          <form
            onSubmit={e => {
              e.preventDefault()
              handleCreate()
            }}
            className="flex gap-2"
          >
            <Input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="New shelf name..."
              className="flex-1"
              data-testid="new-shelf-input"
              aria-label="New shelf name"
            />
            <Button
              type="submit"
              variant="brand"
              size="icon"
              disabled={!newName.trim()}
              className="min-h-[44px] min-w-[44px]"
              aria-label="Create shelf"
              data-testid="create-shelf-btn"
            >
              <Plus className="size-4" />
            </Button>
          </form>

          {/* Shelf list */}
          <div className="flex flex-col gap-1 max-h-[320px] overflow-y-auto">
            {sorted.map(shelf => (
              <div
                key={shelf.id}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-3 py-2.5 transition-colors',
                  'hover:bg-muted/50'
                )}
                data-testid={`shelf-item-${shelf.name.toLowerCase().replace(/\s+/g, '-')}`}
              >
                {editingId === shelf.id ? (
                  <form
                    onSubmit={e => {
                      e.preventDefault()
                      handleRename()
                    }}
                    className="flex flex-1 gap-2"
                  >
                    <Input
                      value={editingName}
                      onChange={e => setEditingName(e.target.value)}
                      className="flex-1 h-8"
                      autoFocus
                      data-testid="rename-shelf-input"
                      aria-label="Rename shelf"
                    />
                    <Button type="submit" size="sm" variant="brand" data-testid="save-rename-btn">
                      Save
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingId(null)}
                    >
                      Cancel
                    </Button>
                  </form>
                ) : (
                  <>
                    <span className="flex-1 text-sm font-medium text-foreground truncate">
                      {shelf.name}
                    </span>
                    {shelf.isDefault && (
                      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                        Default
                      </span>
                    )}
                    {!shelf.isDefault && (
                      <>
                        <button
                          onClick={() => {
                            setEditingId(shelf.id)
                            setEditingName(shelf.name)
                          }}
                          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors min-h-[32px] min-w-[32px] flex items-center justify-center"
                          aria-label={`Rename ${shelf.name}`}
                          data-testid={`rename-shelf-${shelf.name.toLowerCase().replace(/\s+/g, '-')}`}
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(shelf.id)}
                          className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors min-h-[32px] min-w-[32px] flex items-center justify-center"
                          aria-label={`Delete ${shelf.name}`}
                          data-testid={`delete-shelf-${shelf.name.toLowerCase().replace(/\s+/g, '-')}`}
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog
        open={deleteConfirmId !== null}
        onOpenChange={open => {
          if (!open) setDeleteConfirmId(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &ldquo;{shelfToDelete?.name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              Books on this shelf will not be deleted. They will simply be removed from this shelf.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 min-h-[44px]"
              data-testid="confirm-delete-shelf"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
