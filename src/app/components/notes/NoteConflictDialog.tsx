/**
 * NoteConflictDialog — E93-S03
 *
 * Modal dialog for resolving sync conflicts on a note. Shows both versions
 * (current and the losing remote snapshot) with timestamps, and presents
 * three actions: Keep Current, Use Other Version, Merge (disabled / coming soon).
 */
import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/app/components/ui/dialog'
import { Button } from '@/app/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/app/components/ui/tooltip'
import { useNoteStore } from '@/stores/useNoteStore'
import { toast } from 'sonner'
import type { Note } from '@/data/types'

interface NoteConflictDialogProps {
  note: Note
  open: boolean
  onOpenChange: (open: boolean) => void
  onResolved: () => void
}

/** Format an ISO 8601 timestamp to a human-readable string without external libs. */
function formatConflictDate(iso: string): string {
  const d = new Date(iso)
  const datePart = d.toLocaleDateString('sv-SE') // YYYY-MM-DD
  const timePart = d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
  return `${datePart} ${timePart}`
}

export function NoteConflictDialog({ note, open, onOpenChange, onResolved }: NoteConflictDialogProps) {
  const saveNote = useNoteStore(s => s.saveNote)
  const [isKeepingCurrent, setIsKeepingCurrent] = useState(false)
  const [isUsingOther, setIsUsingOther] = useState(false)

  const handleKeepCurrent = async () => {
    setIsKeepingCurrent(true)
    try {
      await saveNote({
        ...note,
        conflictCopy: null,
        conflictSourceId: null,
        updatedAt: new Date().toISOString(),
      })
      onResolved()
      onOpenChange(false)
    } catch {
      toast.error('Failed to resolve conflict')
    } finally {
      setIsKeepingCurrent(false)
    }
  }

  const handleUseOtherVersion = async () => {
    if (note.conflictCopy == null) {
      // Conflict was already cleared by a concurrent sync — nothing to do.
      toast.error('Conflict was already resolved on another device')
      onOpenChange(false)
      return
    }

    setIsUsingOther(true)
    try {
      await saveNote({
        ...note,
        content: note.conflictCopy.content,
        tags: note.conflictCopy.tags,
        conflictCopy: null,
        conflictSourceId: null,
        updatedAt: new Date().toISOString(),
      })
      onResolved()
      onOpenChange(false)
    } catch {
      toast.error('Failed to resolve conflict')
    } finally {
      setIsUsingOther(false)
    }
  }

  const isLoading = isKeepingCurrent || isUsingOther
  const conflictCopy = note.conflictCopy

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-warning-foreground" aria-hidden="true" />
            Sync Conflict
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground -mt-1">
          This note was edited on two devices at the same time. Choose which version to keep.
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mt-2">
          {/* Current version (remote winner) */}
          <div className="rounded-xl border bg-card p-4 space-y-2">
            <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Current version</p>
            <p className="text-xs text-muted-foreground">{formatConflictDate(note.updatedAt)}</p>
            <p className="text-sm text-foreground line-clamp-8 whitespace-pre-wrap break-words">
              {note.content.replace(/<[^>]*>/g, '')}
            </p>
          </div>

          {/* Other version (local snapshot) */}
          <div className="rounded-xl border bg-muted/40 p-4 space-y-2">
            <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Other version</p>
            <p className="text-xs text-muted-foreground">
              {conflictCopy ? formatConflictDate(conflictCopy.savedAt) : '—'}
            </p>
            <p className="text-sm text-foreground line-clamp-8 whitespace-pre-wrap break-words">
              {conflictCopy?.content.replace(/<[^>]*>/g, '') ?? ''}
            </p>
          </div>
        </div>

        <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end mt-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={0}>
                <Button
                  variant="outline"
                  disabled
                  aria-label="Manual merge coming soon"
                >
                  Merge
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>Manual merge coming soon</TooltipContent>
          </Tooltip>

          <Button
            variant="outline"
            onClick={handleUseOtherVersion}
            disabled={isLoading || conflictCopy == null}
          >
            {isUsingOther ? 'Applying…' : 'Use Other Version'}
          </Button>

          <Button
            variant="brand"
            onClick={handleKeepCurrent}
            disabled={isLoading}
          >
            {isKeepingCurrent ? 'Saving…' : 'Keep Current'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
