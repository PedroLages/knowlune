/**
 * TutorMemoryIndicator (E72-S02)
 *
 * Collapsible panel showing the learner model state in the tutor chat.
 * Displays strengths, misconceptions, vocabulary level, and session summary.
 * Hidden entirely when no learner model exists.
 */

import { useState } from 'react'
import { Brain, Check, X, ChevronDown, Trash2, Pencil } from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/app/components/ui/collapsible'
import { Card } from '@/app/components/ui/card'
import { Button } from '@/app/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/app/components/ui/alert-dialog'
import { cn } from '@/app/components/ui/utils'
import type { LearnerModel } from '@/data/types'
import { TutorMemoryEditDialog } from './TutorMemoryEditDialog'

interface TutorMemoryIndicatorProps {
  learnerModel: LearnerModel | null
  courseId: string
  onClearMemory: (courseId: string) => Promise<void>
  onUpdateMemory: (courseId: string, updates: Partial<LearnerModel>) => Promise<void>
}

export function TutorMemoryIndicator({
  learnerModel,
  courseId,
  onClearMemory,
  onUpdateMemory,
}: TutorMemoryIndicatorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)

  // AC: hide entirely when no learner model exists
  if (!learnerModel) return null

  const insightCount =
    learnerModel.strengths.length +
    learnerModel.misconceptions.length +
    (learnerModel.lastSessionSummary ? 1 : 0)

  const handleClear = async () => {
    await onClearMemory(courseId)
  }

  return (
    <div className="px-4 py-2" data-testid="tutor-memory-indicator">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <Card className="overflow-hidden">
          <CollapsibleTrigger
            className="flex w-full items-center gap-2 px-3 py-2 bg-brand-soft text-brand-soft-foreground min-h-[44px] hover:opacity-90 transition-opacity"
            aria-label="Toggle tutor memory panel"
          >
            <Brain className="size-4 flex-shrink-0" />
            <span className="text-sm font-medium flex-1 text-left">
              <span className="hidden sm:inline">Tutor Memory: {insightCount} insights about you</span>
              <span className="sm:hidden">{insightCount} insights</span>
            </span>
            <ChevronDown
              className={cn('size-4 flex-shrink-0 transition-transform', isOpen && 'rotate-180')}
            />
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div className="px-3 py-3 space-y-3 text-sm">
              {/* Strengths */}
              {learnerModel.strengths.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground mb-1">Strengths</h4>
                  <ul role="list" className="space-y-1">
                    {learnerModel.strengths.map(s => (
                      <li key={s.concept} role="listitem" className="flex items-center gap-1.5 text-success">
                        <Check className="size-3 flex-shrink-0" />
                        <span className="text-foreground">{s.concept}</span>
                        <span className="text-muted-foreground text-xs ml-auto">
                          {Math.round(s.confidence * 100)}%
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Misconceptions */}
              {learnerModel.misconceptions.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground mb-1">Misconceptions</h4>
                  <ul role="list" className="space-y-1">
                    {learnerModel.misconceptions.map(m => (
                      <li key={m.concept} role="listitem" className="flex items-center gap-1.5 text-destructive">
                        <X className="size-3 flex-shrink-0" />
                        <span className="text-foreground">{m.concept}</span>
                        <span className="text-muted-foreground text-xs ml-auto">
                          {Math.round(m.confidence * 100)}%
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Vocabulary Level */}
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground mb-1">Vocabulary Level</h4>
                <span className="capitalize">{learnerModel.vocabularyLevel}</span>
              </div>

              {/* Last Session Summary */}
              {learnerModel.lastSessionSummary && (
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground mb-1">Last Session</h4>
                  <p className="text-muted-foreground">{learnerModel.lastSessionSummary}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2 pt-1 border-t border-border">
                <Button
                  variant="ghost"
                  size="sm"
                  className="min-h-[44px] gap-1.5 text-muted-foreground"
                  onClick={() => setEditOpen(true)}
                >
                  <Pencil className="size-3" />
                  Edit memory
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="min-h-[44px] gap-1.5 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-3" />
                      Clear memory
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Clear tutor memory?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete all stored insights about your learning for this course.
                        The tutor will start fresh with no memory of your strengths or misconceptions.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleClear}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Clear memory
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <TutorMemoryEditDialog
        learnerModel={learnerModel}
        open={editOpen}
        onOpenChange={setEditOpen}
        onUpdate={(updates) => onUpdateMemory(courseId, updates)}
      />
    </div>
  )
}
