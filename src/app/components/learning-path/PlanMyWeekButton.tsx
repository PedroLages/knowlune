import { useState } from 'react'
import { CalendarPlus, CheckCircle2 } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { PlanMyWeekPreview } from './PlanMyWeekPreview'
import type { PathProgressSummary } from '@/app/hooks/usePathProgress'
import type { LearningPathEntry } from '@/data/types'

interface PlanMyWeekButtonProps {
  pathId: string
  pathName: string
  entries: LearningPathEntry[]
  courseNames: Record<string, string>
  progress: PathProgressSummary
}

/**
 * "Plan My Week" button shown on the path detail page.
 * Disabled when there are no remaining hours (path complete).
 * Opens a PlanMyWeekPreview dialog on click.
 */
export function PlanMyWeekButton({ pathId, pathName, entries, courseNames, progress }: PlanMyWeekButtonProps) {
  const [previewOpen, setPreviewOpen] = useState(false)
  const isComplete = progress.estimatedRemainingHours <= 0

  return (
    <>
      {isComplete ? (
        <div className="w-full bg-muted p-6 rounded-2xl border border-border flex items-center gap-3">
          <div className="size-10 rounded-full bg-muted-foreground/20 flex items-center justify-center shrink-0">
            <CheckCircle2 className="size-5 text-muted-foreground" aria-hidden="true" />
          </div>
          <span className="font-bold text-muted-foreground text-sm">Path Complete</span>
        </div>
      ) : (
        <Button
          variant="brand"
          className="w-full p-6 rounded-2xl flex items-center justify-between group h-auto"
          onClick={() => setPreviewOpen(true)}
          data-testid="plan-my-week-button"
        >
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-full bg-brand-foreground/20 flex items-center justify-center">
              <CalendarPlus className="size-5" aria-hidden="true" />
            </div>
            <span className="font-bold">Plan My Week</span>
          </div>
          <span className="text-xs text-brand-foreground/70">
            ~{progress.estimatedRemainingHours}h remaining
          </span>
        </Button>
      )}

      <PlanMyWeekPreview
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        pathId={pathId}
        pathName={pathName}
        entries={entries}
        courseNames={courseNames}
        progress={progress}
      />
    </>
  )
}
