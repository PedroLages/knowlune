import { useState, useEffect, useMemo } from 'react'
import { Sparkles, Check, X } from 'lucide-react'
import { cn } from '@/app/components/ui/utils'
import { Badge } from '@/app/components/ui/badge'
import { Button } from '@/app/components/ui/button'
import { Checkbox } from '@/app/components/ui/checkbox'
import { ScrollArea } from '@/app/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog'
import { useNoteStore } from '@/stores/useNoteStore'
import { toast } from 'sonner'
import { stripHtml } from '@/lib/textUtils'
import type { NoteOrganizationProposal } from '@/ai/noteOrganizer'
import type { Note } from '@/data/types'

interface OrganizePreviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  proposals: NoteOrganizationProposal[]
  notes: Note[]
}

export function OrganizePreviewDialog({
  open,
  onOpenChange,
  proposals,
  notes,
}: OrganizePreviewDialogProps) {
  const saveNote = useNoteStore(s => s.saveNote)

  // Track which proposals are accepted (all checked by default)
  const [accepted, setAccepted] = useState<Set<string>>(() => new Set(proposals.map(p => p.noteId)))

  // Reset accepted state when proposals change
  useEffect(() => {
    setAccepted(new Set(proposals.map(p => p.noteId)))
  }, [proposals])

  const noteMap = useMemo(() => {
    const map = new Map<string, Note>()
    for (const note of notes) map.set(note.id, note)
    return map
  }, [notes])

  function toggleProposal(noteId: string) {
    setAccepted(prev => {
      const next = new Set(prev)
      if (next.has(noteId)) next.delete(noteId)
      else next.add(noteId)
      return next
    })
  }

  function selectAll() {
    setAccepted(new Set(proposals.map(p => p.noteId)))
  }

  function deselectAll() {
    setAccepted(new Set())
  }

  async function applyChanges() {
    const acceptedProposals = proposals.filter(p => accepted.has(p.noteId))
    let appliedCount = 0
    let failedCount = 0

    for (const proposal of acceptedProposals) {
      const note = noteMap.get(proposal.noteId)
      if (!note) continue

      // Merge new tags (avoid duplicates)
      const existingTags = new Set(note.tags)
      const newTags = [...proposal.suggestedTags, ...proposal.suggestedCategories].filter(
        t => !existingTags.has(t)
      )

      if (newTags.length === 0) continue

      const updatedNote: Note = {
        ...note,
        tags: [...note.tags, ...newTags],
        updatedAt: new Date().toISOString(),
      }

      try {
        await saveNote(updatedNote)
        appliedCount++
      } catch (err) {
        // silent-catch-ok: error logged to console
        failedCount++
        console.error(`[OrganizePreview] Failed to update note ${note.id}:`, err)
      }
    }

    if (failedCount > 0 && appliedCount === 0) {
      toast.error(`Failed to apply changes to ${failedCount} notes`)
    } else if (failedCount > 0) {
      toast.warning(`Applied ${appliedCount} changes, ${failedCount} failed`)
    } else if (appliedCount === 0) {
      toast.info('No changes needed — notes already have these tags')
    } else {
      toast.success(`Applied changes to ${appliedCount} notes`)
    }
    onOpenChange(false)
  }

  function getNotePreview(noteId: string): string {
    const note = noteMap.get(noteId)
    if (!note) return noteId
    const plain = stripHtml(note.content)
    const firstLine = plain.split('\n')[0].trim()
    return firstLine.length > 60 ? firstLine.slice(0, 60) + '\u2026' : firstLine
  }

  const acceptedCount = accepted.size

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-brand" aria-hidden="true" />
            AI Organization Proposals
          </DialogTitle>
          <DialogDescription>
            {proposals.length} notes analyzed. Review and select changes to apply.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0 -mx-6 px-6">
          <div className="space-y-4 py-2">
            {proposals.map(proposal => {
              const isAccepted = accepted.has(proposal.noteId)
              const hasChanges =
                proposal.suggestedTags.length > 0 ||
                proposal.suggestedCategories.length > 0 ||
                proposal.crossCourseLinks.length > 0

              return (
                <div
                  key={proposal.noteId}
                  className={cn(
                    'border rounded-lg p-4 transition-colors',
                    isAccepted ? 'border-border' : 'border-border/50 opacity-60'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={isAccepted}
                      onCheckedChange={() => toggleProposal(proposal.noteId)}
                      aria-label={`Accept changes for: ${getNotePreview(proposal.noteId)}`}
                    />
                    <div className="flex-1 min-w-0 space-y-2">
                      {/* Note title */}
                      <p className="text-sm font-medium truncate">
                        {getNotePreview(proposal.noteId)}
                      </p>

                      {/* Proposed tags */}
                      {proposal.suggestedTags.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1">
                          <span className="text-xs text-muted-foreground mr-1">+ Tags:</span>
                          {proposal.suggestedTags.map(tag => (
                            <Badge
                              key={tag}
                              className="text-xs bg-success-soft text-success border-0"
                            >
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {/* Proposed categories */}
                      {proposal.suggestedCategories.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1">
                          <span className="text-xs text-muted-foreground mr-1">+ Category:</span>
                          {proposal.suggestedCategories.map(cat => (
                            <Badge
                              key={cat}
                              className="text-xs bg-accent-violet-muted text-accent-violet border-0"
                            >
                              {cat.replace('category:', '')}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {/* Cross-course links */}
                      {proposal.crossCourseLinks.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1">
                          <span className="text-xs text-muted-foreground mr-1">+ Links:</span>
                          {proposal.crossCourseLinks.map(linkedId => (
                            <span key={linkedId} className="text-xs text-brand">
                              {getNotePreview(linkedId)}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* AI rationale */}
                      <p className="text-sm text-muted-foreground italic">{proposal.rationale}</p>

                      {!hasChanges && (
                        <p className="text-xs text-muted-foreground">No changes proposed</p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </ScrollArea>

        <DialogFooter className="flex-col sm:flex-row justify-between sm:justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={selectAll} className="text-xs">
              <Check className="size-3 mr-1" aria-hidden="true" />
              Select All
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={deselectAll}
              className="text-xs"
            >
              <X className="size-3 mr-1" aria-hidden="true" />
              Deselect All
            </Button>
          </div>
          <Button type="button" onClick={applyChanges} disabled={acceptedCount === 0}>
            Apply Selected Changes ({acceptedCount})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
