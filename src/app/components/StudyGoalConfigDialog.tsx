import { useState } from 'react'
import { Clock, Hash, CalendarDays, CalendarRange } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/app/components/ui/dialog'
import { Button } from '@/app/components/ui/button'
import { cn } from '@/app/components/ui/utils'
import { saveStudyGoal } from '@/lib/studyGoals'
import type { StudyGoal } from '@/lib/studyGoals'

interface StudyGoalConfigDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type Step = 'frequency' | 'metric' | 'target'

export function StudyGoalConfigDialog({ open, onOpenChange }: StudyGoalConfigDialogProps) {
  const [step, setStep] = useState<Step>('frequency')
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | null>(null)
  const [metric, setMetric] = useState<'time' | 'sessions' | null>(null)
  const [target, setTarget] = useState('')

  function reset() {
    setStep('frequency')
    setFrequency(null)
    setMetric(null)
    setTarget('')
  }

  function handleFrequencySelect(f: 'daily' | 'weekly') {
    setFrequency(f)
    setStep('metric')
  }

  function handleMetricSelect(m: 'time' | 'sessions') {
    setMetric(m)
    setStep('target')
  }

  function handleSave() {
    if (!frequency || !metric || !target) return
    const goal: StudyGoal = {
      frequency,
      metric,
      target: Number(target),
      createdAt: new Date().toISOString(),
    }
    saveStudyGoal(goal)
    reset()
    onOpenChange(false)
  }

  const presets = metric === 'time' ? [30, 60, 90] : [1, 2, 3]
  const unit = metric === 'time' ? 'min' : metric === 'sessions' ? 'sessions' : ''

  return (
    <Dialog
      open={open}
      onOpenChange={o => {
        onOpenChange(o)
        if (!o) reset()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Set a Study Goal</DialogTitle>
          <DialogDescription>
            {step === 'frequency' && 'How often do you want to study?'}
            {step === 'metric' && 'What should we track?'}
            {step === 'target' && `Set your ${frequency} target`}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {/* Step 1: Frequency */}
          {step === 'frequency' && (
            <div className="grid grid-cols-2 gap-3">
              <OptionCard
                testId="goal-frequency-daily"
                icon={<CalendarDays className="size-5" />}
                label="Daily"
                description="Study every day"
                selected={frequency === 'daily'}
                onClick={() => handleFrequencySelect('daily')}
              />
              <OptionCard
                testId="goal-frequency-weekly"
                icon={<CalendarRange className="size-5" />}
                label="Weekly"
                description="Study per week"
                selected={frequency === 'weekly'}
                onClick={() => handleFrequencySelect('weekly')}
              />
            </div>
          )}

          {/* Step 2: Metric */}
          {step === 'metric' && (
            <div className="grid grid-cols-2 gap-3">
              <OptionCard
                testId="goal-metric-time"
                icon={<Clock className="size-5" />}
                label="Time"
                description="Minutes studied"
                selected={metric === 'time'}
                onClick={() => handleMetricSelect('time')}
              />
              <OptionCard
                testId="goal-metric-sessions"
                icon={<Hash className="size-5" />}
                label="Sessions"
                description="Lessons completed"
                selected={metric === 'sessions'}
                onClick={() => handleMetricSelect('sessions')}
              />
            </div>
          )}

          {/* Step 3: Target */}
          {step === 'target' && (
            <>
              <div className="flex gap-2">
                {presets.map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setTarget(String(p))}
                    className={cn(
                      'px-3 py-2.5 min-h-[44px] rounded-lg border text-sm font-medium transition-colors',
                      'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring',
                      String(p) === target
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-card text-foreground border-border hover:bg-muted'
                    )}
                  >
                    {p} {unit}
                  </button>
                ))}
              </div>
              <div>
                <label htmlFor="goal-target" className="text-sm text-muted-foreground mb-1 block">
                  Or enter a custom target ({unit})
                </label>
                <input
                  id="goal-target"
                  data-testid="goal-target-input"
                  type="number"
                  min="1"
                  value={target}
                  onChange={e => setTarget(e.target.value)}
                  placeholder={`e.g. ${presets[1]}`}
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-ring"
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          {step !== 'frequency' && (
            <Button
              variant="outline"
              onClick={() => {
                if (step === 'metric') setStep('frequency')
                if (step === 'target') setStep('metric')
              }}
            >
              Back
            </Button>
          )}
          {step === 'target' && (
            <Button data-testid="goal-save-button" onClick={handleSave} disabled={!target}>
              Save Goal
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function OptionCard({
  testId,
  icon,
  label,
  description,
  selected,
  onClick,
}: {
  testId: string
  icon: React.ReactNode
  label: string
  description: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      className={cn(
        'flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring',
        'min-h-[44px]',
        selected
          ? 'bg-primary text-primary-foreground border-primary'
          : 'bg-card text-foreground border-border hover:bg-muted'
      )}
    >
      {icon}
      <span className="text-sm font-semibold">{label}</span>
      <span className="text-xs opacity-75">{description}</span>
    </button>
  )
}
