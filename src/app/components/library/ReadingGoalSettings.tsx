/**
 * ReadingGoalSettings — dialog for setting daily and yearly reading goals.
 *
 * Daily goal: radio group (minutes vs pages) + preset buttons + custom input.
 * Yearly goal: number input with +/- stepper.
 *
 * @module ReadingGoalSettings
 */
import { useState, useMemo } from 'react'
import { Target, Minus, Plus, Clock, Flame } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/app/components/ui/dialog'
import { Button } from '@/app/components/ui/button'
import { Input } from '@/app/components/ui/input'
import { Label } from '@/app/components/ui/label'
import { useReadingGoalStore } from '@/stores/useReadingGoalStore'
import { useBookStore } from '@/stores/useBookStore'
import { toastSuccess } from '@/lib/toastHelpers'
import { CalendarHeatMap } from './CalendarHeatMap'
import { ProgressRing } from './ProgressRing'
import { useRecentStudyActivity } from '@/app/hooks/useRecentStudyActivity'
import { cn } from '@/app/components/ui/utils'

const MINUTE_PRESETS = [15, 30, 45, 60]
const PAGE_PRESETS = [10, 20, 30, 50]

interface ReadingGoalSettingsProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ReadingGoalSettings({ open, onOpenChange }: ReadingGoalSettingsProps) {
  const goal = useReadingGoalStore(s => s.goal)
  const streak = useReadingGoalStore(s => s.streak)
  const saveGoal = useReadingGoalStore(s => s.saveGoal)
  const clearGoal = useReadingGoalStore(s => s.clearGoal)
  const books = useBookStore(s => s.books)
  const { dayMap, today } = useRecentStudyActivity(91)

  const currentYear = new Date().getFullYear().toString()
  const finishedThisYear = useMemo(
    () =>
      books.filter(b => b.status === 'finished' && b.finishedAt?.startsWith(currentYear)).length,
    [books, currentYear]
  )

  const [dailyType, setDailyType] = useState<'minutes' | 'pages'>(goal?.dailyType ?? 'minutes')
  const [dailyTarget, setDailyTarget] = useState(goal?.dailyTarget ?? 30)
  const [customDaily, setCustomDaily] = useState('')
  const [yearlyTarget, setYearlyTarget] = useState(goal?.yearlyBookTarget ?? 12)

  const presets = dailyType === 'minutes' ? MINUTE_PRESETS : PAGE_PRESETS

  function handleDailyTypeChange(type: 'minutes' | 'pages') {
    setDailyType(type)
    // Reset to first preset for the new type
    const newPresets = type === 'minutes' ? MINUTE_PRESETS : PAGE_PRESETS
    setDailyTarget(newPresets[1]) // 30 min or 20 pages default
    setCustomDaily('')
  }

  function handlePresetSelect(value: number) {
    setDailyTarget(value)
    setCustomDaily('')
  }

  function handleCustomDailyChange(raw: string) {
    setCustomDaily(raw)
    const num = parseInt(raw, 10)
    if (!isNaN(num) && num > 0) {
      setDailyTarget(num)
    }
  }

  function adjustYearly(delta: number) {
    setYearlyTarget(prev => Math.max(1, prev + delta))
  }

  function handleSave() {
    saveGoal({ dailyType, dailyTarget, yearlyBookTarget: yearlyTarget })
    toastSuccess.saved('Reading goals')
    onOpenChange(false)
  }

  function handleClear() {
    clearGoal()
    toastSuccess.saved('Reading goals cleared')
    onOpenChange(false)
  }

  const isCustomActive = !presets.includes(dailyTarget)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="reading-goals-dialog"
        className="flex max-h-[min(90dvh,960px)] min-h-0 flex-col gap-4 overflow-hidden rounded-2xl max-w-4xl"
      >
        <DialogHeader className="shrink-0 space-y-2 text-left">
          <div className="flex items-center gap-2">
            <Target className="size-5 text-brand" aria-hidden="true" />
            <DialogTitle>Reading Goals</DialogTitle>
          </div>
          <DialogDescription>
            Set daily reading targets and a yearly book goal to build consistent habits.
          </DialogDescription>
        </DialogHeader>

        {/* Motivational quote */}
        <p className="mb-1 shrink-0 text-center text-sm italic text-muted-foreground mt-1">
          &ldquo;A book is a dream you hold in your hand.&rdquo; &mdash; Neil Gaiman
        </p>

        <div className="min-h-0 flex-1 overflow-y-auto pr-0.5">
          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12 lg:gap-8">
            {/* Left column: Daily + Streak + Heatmap */}
            <div className="lg:col-span-7 space-y-6">
              {/* Daily Goal Section */}
              <div className="bg-card rounded-xl p-6 shadow-card-ambient space-y-4">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="text-sm font-bold text-foreground">Daily Reading Goal</h3>
                  <span className="shrink-0 text-xs font-medium text-brand tabular-nums">
                    {dailyTarget} {dailyType}
                  </span>
                </div>

                {/* Type toggle */}
                <div className="flex gap-2" role="radiogroup" aria-label="Daily goal type">
                  {(['minutes', 'pages'] as const).map(type => (
                    <button
                      key={type}
                      type="button"
                      role="radio"
                      aria-checked={dailyType === type}
                      onClick={() => handleDailyTypeChange(type)}
                      className={cn(
                        'flex-1 rounded-xl border py-2.5 text-sm font-medium transition-colors min-h-[44px]',
                        dailyType === type
                          ? 'border-brand bg-brand-soft text-brand-soft-foreground'
                          : 'border-border/15 bg-card text-muted-foreground hover:bg-muted/30'
                      )}
                    >
                      {type === 'minutes' ? 'Minutes / day' : 'Pages / day'}
                    </button>
                  ))}
                </div>

                <p className="text-[11px] text-muted-foreground">
                  Presets are {dailyType === 'minutes' ? 'minutes per day' : 'pages per day'}.
                </p>

                {/* Selectable preset cards */}
                <div
                  className="mt-1 grid grid-cols-2 items-start gap-3 sm:grid-cols-4"
                  role="group"
                  aria-label="Daily goal presets"
                >
                  {presets.map(value => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => handlePresetSelect(value)}
                      className={cn(
                        'flex h-auto w-full flex-col items-center gap-1.5 self-start rounded-xl border p-3 transition-all sm:p-4',
                        dailyTarget === value && !isCustomActive
                          ? 'border-brand bg-brand-soft shadow-sm'
                          : 'border-border/15 bg-card hover:bg-muted/30'
                      )}
                      aria-pressed={dailyTarget === value && !isCustomActive}
                    >
                      <Clock className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <span className="text-center text-lg font-bold leading-tight tabular-nums">
                        {value}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Custom input */}
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={480}
                    placeholder="Custom"
                    value={customDaily}
                    onChange={e => handleCustomDailyChange(e.target.value)}
                    className={cn(
                      'w-24 h-11 text-center text-sm',
                      isCustomActive ? 'border-brand ring-1 ring-brand' : ''
                    )}
                    aria-label={`Custom daily goal in ${dailyType}`}
                  />
                  <span className="text-xs text-muted-foreground">{dailyType}</span>
                </div>
              </div>

              {/* Streak display */}
              <div className="flex items-center gap-4 rounded-xl bg-card p-6 shadow-card-ambient">
                <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-brand/10">
                  <Flame className="size-7 text-brand" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{streak.currentStreak} Days</p>
                  <p className="text-sm text-muted-foreground">
                    {streak.currentStreak > 7
                      ? `You're on fire! ${streak.currentStreak} days straight`
                      : streak.currentStreak > 0
                        ? 'Keep it going!'
                        : 'Start your streak today'}
                  </p>
                </div>
              </div>

              {/* Calendar heat map */}
              <CalendarHeatMap dayMap={dayMap} today={today} weeks={13} />
            </div>

            {/* Right column: Yearly Progress */}
            <div className="lg:col-span-5">
              <div className="space-y-6 rounded-xl bg-card p-6 shadow-card-ambient">
                <h3 className="text-sm font-bold text-foreground">Yearly Reading Goal</h3>

                <div
                  className="flex w-full max-w-full justify-center"
                  data-testid="yearly-progress-ring"
                >
                  <ProgressRing
                    percent={yearlyTarget > 0 ? (finishedThisYear / yearlyTarget) * 100 : 0}
                    size={200}
                    strokeWidth={10}
                  >
                    <div className="text-center">
                      <span className="text-3xl font-bold text-foreground">{finishedThisYear}</span>
                      <span className="text-sm text-muted-foreground"> / {yearlyTarget}</span>
                      <p className="text-xs text-muted-foreground mt-1">books</p>
                    </div>
                  </ProgressRing>
                </div>

                {/* Yearly stepper */}
                <div className="flex min-w-0 items-center gap-3">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => adjustYearly(-1)}
                    disabled={yearlyTarget <= 1}
                    className="size-11 shrink-0 self-center rounded-xl"
                    aria-label="Decrease yearly goal"
                  >
                    <Minus className="size-4" />
                  </Button>
                  <div className="flex min-w-24 flex-1 flex-col items-center justify-center text-center">
                    <Label htmlFor="yearly-goal-input" className="sr-only">
                      Yearly book goal
                    </Label>
                    <Input
                      id="yearly-goal-input"
                      type="number"
                      min={1}
                      max={365}
                      value={yearlyTarget}
                      onChange={e => {
                        const num = parseInt(e.target.value, 10)
                        if (!isNaN(num) && num > 0) setYearlyTarget(Math.min(num, 365))
                      }}
                      className="h-11 text-center text-lg font-semibold"
                      aria-label="Yearly book goal"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">books this year</p>
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => adjustYearly(1)}
                    disabled={yearlyTarget >= 365}
                    className="size-11 shrink-0 self-center rounded-xl"
                    aria-label="Increase yearly goal"
                  >
                    <Plus className="size-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex shrink-0 justify-between gap-2 border-t border-border/10 pt-4">
          {goal && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="text-muted-foreground"
            >
              Clear goals
            </Button>
          )}
          <div className="flex gap-2 ml-auto">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button variant="brand" size="sm" className="rounded-full px-6" onClick={handleSave}>
              Save Goals
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
