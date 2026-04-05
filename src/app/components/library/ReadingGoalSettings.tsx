/**
 * ReadingGoalSettings — dialog for setting daily and yearly reading goals.
 *
 * Daily goal: radio group (minutes vs pages) + preset buttons + custom input.
 * Yearly goal: number input with +/- stepper.
 *
 * @module ReadingGoalSettings
 */
import { useState } from 'react'
import { Target, Minus, Plus } from 'lucide-react'
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
import { Separator } from '@/app/components/ui/separator'
import { useReadingGoalStore } from '@/stores/useReadingGoalStore'
import { toastSuccess } from '@/lib/toastHelpers'

const MINUTE_PRESETS = [15, 30, 45, 60]
const PAGE_PRESETS = [10, 20, 30, 50]

interface ReadingGoalSettingsProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ReadingGoalSettings({ open, onOpenChange }: ReadingGoalSettingsProps) {
  const goal = useReadingGoalStore(s => s.goal)
  const saveGoal = useReadingGoalStore(s => s.saveGoal)
  const clearGoal = useReadingGoalStore(s => s.clearGoal)

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
      <DialogContent className="rounded-2xl max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Target className="size-5 text-brand" aria-hidden="true" />
            <DialogTitle>Reading Goals</DialogTitle>
          </div>
          <DialogDescription>
            Set daily reading targets and a yearly book goal to build consistent habits.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Daily Goal Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium">Daily Reading Goal</h3>

            {/* Type toggle */}
            <div className="flex gap-2" role="radiogroup" aria-label="Daily goal type">
              {(['minutes', 'pages'] as const).map(type => (
                <button
                  key={type}
                  role="radio"
                  aria-checked={dailyType === type}
                  onClick={() => handleDailyTypeChange(type)}
                  className={`flex-1 rounded-xl border py-2.5 text-sm font-medium transition-colors min-h-[44px] ${
                    dailyType === type
                      ? 'border-brand bg-brand-soft text-brand-soft-foreground'
                      : 'border-border bg-surface-elevated text-muted-foreground hover:bg-surface-elevated/80'
                  }`}
                >
                  {type === 'minutes' ? 'Minutes / day' : 'Pages / day'}
                </button>
              ))}
            </div>

            {/* Preset buttons */}
            <div className="flex flex-wrap gap-2" role="group" aria-label="Daily goal presets">
              {presets.map(value => (
                <button
                  key={value}
                  onClick={() => handlePresetSelect(value)}
                  className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors min-h-[44px] ${
                    dailyTarget === value && !isCustomActive
                      ? 'border-brand bg-brand text-brand-foreground'
                      : 'border-border bg-surface-elevated text-muted-foreground hover:bg-surface-elevated/80'
                  }`}
                  aria-pressed={dailyTarget === value && !isCustomActive}
                >
                  {value}
                </button>
              ))}

              {/* Custom input inline */}
              <div className="flex items-center gap-1.5">
                <Input
                  type="number"
                  min={1}
                  max={480}
                  placeholder="Custom"
                  value={customDaily}
                  onChange={e => handleCustomDailyChange(e.target.value)}
                  className={`w-20 h-11 text-center text-sm ${
                    isCustomActive ? 'border-brand ring-1 ring-brand' : ''
                  }`}
                  aria-label={`Custom daily goal in ${dailyType}`}
                />
                <span className="text-xs text-muted-foreground">{dailyType}</span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Yearly Book Goal */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium">Yearly Book Goal</h3>
            <p className="text-xs text-muted-foreground">
              Books marked as "Finished" this year count toward your goal.
            </p>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="icon"
                onClick={() => adjustYearly(-1)}
                disabled={yearlyTarget <= 1}
                className="size-11 rounded-xl"
                aria-label="Decrease yearly goal"
              >
                <Minus className="size-4" />
              </Button>
              <div className="flex-1 text-center">
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
                  className="text-center text-lg font-semibold h-11"
                  aria-label="Yearly book goal"
                />
                <p className="text-xs text-muted-foreground mt-1">books this year</p>
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => adjustYearly(1)}
                disabled={yearlyTarget >= 365}
                className="size-11 rounded-xl"
                aria-label="Increase yearly goal"
              >
                <Plus className="size-4" />
              </Button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-between pt-2">
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
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button variant="brand" size="sm" onClick={handleSave}>
                Save Goals
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
