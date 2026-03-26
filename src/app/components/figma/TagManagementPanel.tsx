import { useState, useRef, useEffect } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/app/components/ui/sheet'
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
import { Button } from '@/app/components/ui/button'
import { Input } from '@/app/components/ui/input'
import { Pencil, Trash2, Check, X, Tags } from 'lucide-react'
import { toast } from 'sonner'
import { useCourseImportStore } from '@/stores/useCourseImportStore'

interface TagManagementPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called after any tag mutation so parent can refresh filters */
  onTagsChanged?: () => void
}

export function TagManagementPanel({ open, onOpenChange, onTagsChanged }: TagManagementPanelProps) {
  const tagsWithCounts = useCourseImportStore(s => s.getTagsWithCounts())
  const renameTagGlobally = useCourseImportStore(s => s.renameTagGlobally)
  const deleteTagGlobally = useCourseImportStore(s => s.deleteTagGlobally)

  const [editingTag, setEditingTag] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [deletingTag, setDeletingTag] = useState<string | null>(null)
  const editInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingTag && editInputRef.current) {
      editInputRef.current.focus()
      editInputRef.current.select()
    }
  }, [editingTag])

  function handleStartRename(tag: string) {
    setEditingTag(tag)
    setEditValue(tag)
  }

  function handleCancelRename() {
    setEditingTag(null)
    setEditValue('')
  }

  async function handleConfirmRename() {
    if (!editingTag) return
    const trimmed = editValue.trim()
    if (!trimmed) {
      toast.error('Tag name cannot be empty')
      return
    }
    if (trimmed.toLowerCase() === editingTag.toLowerCase()) {
      handleCancelRename()
      return
    }

    const result = await renameTagGlobally(editingTag, trimmed)
    if (result === 'merged') {
      toast.success(`Merged into existing tag "${trimmed}"`)
    } else {
      toast.success(`Tag renamed to "${trimmed}"`)
    }
    setEditingTag(null)
    setEditValue('')
    onTagsChanged?.()
  }

  async function handleConfirmDelete() {
    if (!deletingTag) return
    await deleteTagGlobally(deletingTag)
    toast.success(`Tag "${deletingTag}" deleted from all courses`)
    setDeletingTag(null)
    onTagsChanged?.()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleConfirmRename()
    } else if (e.key === 'Escape') {
      handleCancelRename()
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-md"
          data-testid="tag-management-panel"
        >
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Tags className="size-5" aria-hidden="true" />
              Manage Tags
            </SheetTitle>
            <SheetDescription>Rename or delete tags across all your courses.</SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-1">
            {tagsWithCounts.length === 0 ? (
              <div
                data-testid="tag-management-empty"
                className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground"
              >
                <Tags className="size-8 mb-3 opacity-40" aria-hidden="true" />
                <p className="text-sm">No tags yet. Add tags to your courses to organize them.</p>
              </div>
            ) : (
              <ul className="space-y-1" role="list" aria-label="Tags list">
                {tagsWithCounts.map(({ tag, count }) => (
                  <li
                    key={tag}
                    data-testid="tag-management-row"
                    className="flex items-center gap-2 rounded-xl px-3 py-2 hover:bg-muted/50 transition-colors group"
                  >
                    {editingTag === tag ? (
                      <>
                        <Input
                          ref={editInputRef}
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          onKeyDown={handleKeyDown}
                          className="h-8 text-sm flex-1"
                          aria-label={`Rename tag "${tag}"`}
                          data-testid="tag-rename-input"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-success"
                          onClick={handleConfirmRename}
                          aria-label="Confirm rename"
                          data-testid="tag-rename-confirm"
                        >
                          <Check className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-muted-foreground"
                          onClick={handleCancelRename}
                          aria-label="Cancel rename"
                          data-testid="tag-rename-cancel"
                        >
                          <X className="size-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <span className="flex-1 text-sm font-medium truncate">{tag}</span>
                        <span
                          className="text-xs text-muted-foreground tabular-nums"
                          aria-label={`${count} ${count === 1 ? 'course' : 'courses'}`}
                        >
                          {count} {count === 1 ? 'course' : 'courses'}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                          onClick={() => handleStartRename(tag)}
                          aria-label={`Rename tag "${tag}"`}
                          data-testid="tag-rename-btn"
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity text-destructive hover:text-destructive"
                          onClick={() => setDeletingTag(tag)}
                          aria-label={`Delete tag "${tag}"`}
                          data-testid="tag-delete-btn"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={deletingTag !== null}
        onOpenChange={open => {
          if (!open) setDeletingTag(null)
        }}
      >
        <AlertDialogContent data-testid="tag-delete-confirm-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete tag &ldquo;{deletingTag}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the tag from all courses. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="tag-delete-confirm-btn"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
