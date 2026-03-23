import { useState, useEffect } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { cn } from '@/app/components/ui/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card'
import { Switch } from '@/app/components/ui/switch'
import { Label } from '@/app/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/app/components/ui/radio-group'
import { Separator } from '@/app/components/ui/separator'
import {
  getQuizPreferences,
  saveQuizPreferences,
  type QuizPreferences,
} from '@/lib/quizPreferences'
import { toastSuccess } from '@/lib/toastHelpers'

type TimerOption = {
  value: QuizPreferences['timerAccommodation']
  label: string
  description: string
}

const TIMER_OPTIONS: TimerOption[] = [
  { value: 'standard', label: '1x', description: 'Standard timing' },
  { value: '150%', label: '1.5x', description: 'Extended time' },
  { value: '200%', label: '2x', description: 'Maximum extension' },
]

export function QuizPreferencesForm() {
  const [prefs, setPrefs] = useState<QuizPreferences>(getQuizPreferences)

  // Sync cross-tab changes (native storage event fires only for other tabs)
  useEffect(() => {
    function handleUpdate() {
      setPrefs(getQuizPreferences())
    }
    window.addEventListener('quiz-preferences-updated', handleUpdate)
    window.addEventListener('storage', handleUpdate)
    return () => {
      window.removeEventListener('quiz-preferences-updated', handleUpdate)
      window.removeEventListener('storage', handleUpdate)
    }
  }, [])

  function update(patch: Partial<QuizPreferences>) {
    const next = saveQuizPreferences(patch)
    setPrefs(next)
    window.dispatchEvent(new CustomEvent('quiz-preferences-updated'))
    toastSuccess.saved('Quiz preferences saved')
  }

  return (
    <Card data-testid="quiz-preferences-section">
      <CardHeader className="border-b border-border/50 bg-surface-sunken/30">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-brand-soft p-2">
            <SlidersHorizontal className="size-5 text-brand" aria-hidden="true" />
          </div>
          <div>
            <CardTitle className="text-lg font-display">Quiz Preferences</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Set your default quiz behavior — overridable per quiz
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 pt-6">
        {/* Timer Accommodation Default */}
        <div className="space-y-3">
          <div>
            <Label className="text-sm font-medium">Timer accommodation default</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Default time multiplier for timed quizzes
            </p>
          </div>

          <RadioGroup
            data-testid="timer-accommodation-group"
            value={prefs.timerAccommodation}
            onValueChange={value =>
              update({ timerAccommodation: value as QuizPreferences['timerAccommodation'] })
            }
            className="grid grid-cols-1 sm:grid-cols-3 gap-3"
          >
            {TIMER_OPTIONS.map(option => (
              <label
                key={option.value}
                className={cn(
                  'relative flex flex-col gap-1.5 p-4 border-2 rounded-xl cursor-pointer',
                  'transition-all duration-200 hover:shadow-sm',
                  prefs.timerAccommodation === option.value
                    ? 'border-brand bg-brand-soft shadow-sm'
                    : 'border-border bg-background hover:border-brand/50'
                )}
                data-testid={`timer-option-${option.value}`}
              >
                <RadioGroupItem value={option.value} className="sr-only" />
                <span className="text-sm font-medium">{option.label}</span>
                <span className="text-xs text-muted-foreground">{option.description}</span>
              </label>
            ))}
          </RadioGroup>
        </div>

        <Separator />

        {/* Immediate Feedback Toggle */}
        <div className="space-y-1">
          <div className="flex items-center justify-between min-h-[44px]">
            <div>
              <Label
                htmlFor="show-immediate-feedback"
                className="cursor-pointer text-sm font-medium"
              >
                Show immediate feedback
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Show correct/incorrect after each question during active quiz
              </p>
            </div>
            <Switch
              id="show-immediate-feedback"
              data-testid="immediate-feedback-toggle"
              checked={prefs.showImmediateFeedback}
              onCheckedChange={checked => update({ showImmediateFeedback: checked })}
            />
          </div>
        </div>

        <Separator />

        {/* Shuffle Questions Toggle */}
        <div className="space-y-1">
          <div className="flex items-center justify-between min-h-[44px]">
            <div>
              <Label htmlFor="shuffle-questions" className="cursor-pointer text-sm font-medium">
                Shuffle questions
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Randomize the order of questions on each attempt
              </p>
            </div>
            <Switch
              id="shuffle-questions"
              data-testid="shuffle-questions-toggle"
              checked={prefs.shuffleQuestions}
              onCheckedChange={checked => update({ shuffleQuestions: checked })}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
