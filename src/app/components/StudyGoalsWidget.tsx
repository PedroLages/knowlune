import { useState, useEffect, useCallback } from 'react'
import { Target, CheckCircle2, Settings2 } from 'lucide-react'
import { ProgressRing } from '@/app/components/figma/ProgressRing'
import { StudyGoalConfigDialog } from '@/app/components/StudyGoalConfigDialog'
import { Button } from '@/app/components/ui/button'
import { getStudyGoal, computeGoalProgress, computeWeeklyAdherence } from '@/lib/studyGoals'
import type { StudyGoal, GoalProgress, WeeklyAdherence } from '@/lib/studyGoals'

function getStudyLog(): Array<{ type: string; timestamp: string; durationMs?: number }> {
  try {
    const raw = localStorage.getItem('study-log')
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function StudyGoalsWidget() {
  const [goal, setGoal] = useState<StudyGoal | null>(null)
  const [progress, setProgress] = useState<GoalProgress | null>(null)
  const [adherence, setAdherence] = useState<WeeklyAdherence | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const refresh = useCallback(() => {
    const currentGoal = getStudyGoal()
    setGoal(currentGoal)

    if (currentGoal) {
      const log = getStudyLog()
      setProgress(computeGoalProgress(currentGoal, log))
      setAdherence(computeWeeklyAdherence(log))
    } else {
      setProgress(null)
      setAdherence(null)
    }
  }, [])

  useEffect(() => {
    refresh()

    window.addEventListener('study-log-updated', refresh)
    window.addEventListener('study-goals-updated', refresh)
    return () => {
      window.removeEventListener('study-log-updated', refresh)
      window.removeEventListener('study-goals-updated', refresh)
    }
  }, [refresh])

  const unit = goal?.metric === 'time' ? 'min' : 'sessions'

  return (
    <div data-testid="study-goals-widget">
      {!goal ? (
        <EmptyState onSetup={() => setDialogOpen(true)} />
      ) : progress && adherence ? (
        <ActiveState
          progress={progress}
          adherence={adherence}
          unit={unit}
          onEdit={() => setDialogOpen(true)}
        />
      ) : null}

      <StudyGoalConfigDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  )
}

function EmptyState({ onSetup }: { onSetup: () => void }) {
  return (
    <div
      data-testid="goals-empty-state"
      className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card p-8 text-center"
    >
      <Target className="size-10 text-muted-foreground mb-3" />
      <h3 className="text-sm font-semibold text-foreground mb-1">No study goal set</h3>
      <p className="text-xs text-muted-foreground mb-4">
        Set a daily or weekly goal to stay on track
      </p>
      <Button data-testid="goals-setup-cta" size="sm" onClick={onSetup}>
        Set a Study Goal
      </Button>
    </div>
  )
}

function ActiveState({
  progress,
  adherence,
  unit,
  onEdit,
}: {
  progress: GoalProgress
  adherence: WeeklyAdherence
  unit: string
  onEdit: () => void
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground">Study Goal</h3>
        <button
          type="button"
          onClick={onEdit}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring rounded-md"
          aria-label="Edit goal"
        >
          <Settings2 className="size-4" />
        </button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative" data-testid="goal-progress-indicator">
          <ProgressRing percent={progress.percent} size={64} strokeWidth={5} />
          {progress.completed && (
            <div
              data-testid="goal-completed-indicator"
              className="absolute inset-0 flex items-center justify-center"
            >
              <CheckCircle2 className="size-5 text-success" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p data-testid="goal-progress-text" className="text-sm font-medium text-foreground">
            {progress.current} / {progress.target} {unit}
          </p>
          <p
            data-testid="goal-adherence-percentage"
            className="text-xs text-muted-foreground mt-0.5"
          >
            {adherence.percent}% weekly adherence
          </p>
        </div>
      </div>
    </div>
  )
}
