import { useState } from 'react'
import { CalendarPlus, CheckCircle2 } from 'lucide-react'
import { PlanMyWeekPreview } from './PlanMyWeekPreview'
import type { PathProgressSummary } from '@/app/hooks/usePathProgress'
import type { LearningPathEntry } from '@/data/types'

interface PlanMyWeekButtonProps {
  pathId: string
  pathName: string
  entries: LearningPathEntry[]
  progress: PathProgressSummary
}

/**
 * "Plan My Week" button shown on the path detail page.
 * Disabled when there are no remaining hours (path complete).
 * Opens a PlanMyWeekPreview dialog on click.
 */
export function PlanMyWeekButton({ pathId, pathName, entries, progress }: PlanMyWeekButtonProps) {
  const [previewOpen, setPreviewOpen] = useState(false)
  const isComplete = progress.estimatedRemainingHours <= 0

  return (
    <>
      {isComplete ? (
        <div className="w-full bg-brand-soft/50 p-6 rounded-2xl border border-brand/10 flex items-center gap-3 opacity-50">
          <div className="size-10 rounded-full bg-muted flex items-center justify-center shrink-0">
            <CheckCircle2 className="size-5 text-success" aria-hidden="true" />
          </div>
          <span className="font-bold text-foreground text-sm">Path Complete</span>
        </div>
      ) : (
        <button
          className="w-full bg-brand-soft p-6 rounded-2xl border border-brand/20 flex items-center justify-between group hover:bg-brand-muted transition-all text-left"
          onClick={() => setPreviewOpen(true)}
          data-testid="plan-my-week-button"
        >
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-full bg-card flex items-center justify-center text-brand shadow-sm">
              <CalendarPlus className="size-5" aria-hidden="true" />
            </div>
            <span className="font-bold text-foreground">Plan My Week</span>
          </div>
          <span className="text-xs text-muted-foreground">
            ~{progress.estimatedRemainingHours}h remaining
          </span>
        </button>
      )}

      <PlanMyWeekPreview
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        pathId={pathId}
        pathName={pathName}
        entries={entries}
        progress={progress}
      />
    </>
  )
}
