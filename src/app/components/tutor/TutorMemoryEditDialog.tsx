/**
 * TutorMemoryEditDialog (E72-S02)
 *
 * Dialog for editing individual strength/misconception entries in the learner model.
 * Allows removing individual entries from strengths and misconceptions lists.
 */

import { useState } from 'react'
import { X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog'
import { Button } from '@/app/components/ui/button'
import type { LearnerModel, ConceptAssessment } from '@/data/types'

interface TutorMemoryEditDialogProps {
  learnerModel: LearnerModel
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdate: (updates: Partial<LearnerModel>) => Promise<void>
}

export function TutorMemoryEditDialog({
  learnerModel,
  open,
  onOpenChange,
  onUpdate,
}: TutorMemoryEditDialogProps) {
  const [isRemoving, setIsRemoving] = useState(false)

  const handleRemoveStrength = async (concept: string) => {
    setIsRemoving(true)
    try {
      await onUpdate({
        strengths: learnerModel.strengths.filter((s: ConceptAssessment) => s.concept !== concept),
      })
    } finally {
      setIsRemoving(false)
    }
  }

  const handleRemoveMisconception = async (concept: string) => {
    setIsRemoving(true)
    try {
      await onUpdate({
        misconceptions: learnerModel.misconceptions.filter((m: ConceptAssessment) => m.concept !== concept),
      })
    } finally {
      setIsRemoving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Tutor Memory</DialogTitle>
          <DialogDescription>
            Remove individual insights the tutor has recorded about your learning.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Strengths */}
          {learnerModel.strengths.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-success mb-2">Strengths</h4>
              <ul role="list" className="space-y-1">
                {learnerModel.strengths.map(s => (
                  <li
                    key={s.concept}
                    role="listitem"
                    className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-muted"
                  >
                    <span className="text-sm">{s.concept}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 min-h-[44px] min-w-[44px] text-muted-foreground hover:text-destructive"
                      onClick={() => handleRemoveStrength(s.concept)}
                      disabled={isRemoving}
                      aria-label={`Remove strength: ${s.concept}`}
                    >
                      <X className="size-3" />
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Misconceptions */}
          {learnerModel.misconceptions.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-destructive mb-2">Misconceptions</h4>
              <ul role="list" className="space-y-1">
                {learnerModel.misconceptions.map(m => (
                  <li
                    key={m.concept}
                    role="listitem"
                    className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-muted"
                  >
                    <span className="text-sm">{m.concept}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 min-h-[44px] min-w-[44px] text-muted-foreground hover:text-destructive"
                      onClick={() => handleRemoveMisconception(m.concept)}
                      disabled={isRemoving}
                      aria-label={`Remove misconception: ${m.concept}`}
                    >
                      <X className="size-3" />
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {learnerModel.strengths.length === 0 && learnerModel.misconceptions.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No individual entries to edit. The tutor hasn&apos;t recorded any specific strengths or misconceptions yet.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
