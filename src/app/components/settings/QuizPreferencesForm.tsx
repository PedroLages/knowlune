import { useState, useEffect, useRef } from 'react'
import { SlidersHorizontal, Check } from 'lucide-react'
import { cn } from '@/app/components/ui/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card'
import { Switch } from '@/app/components/ui/switch'
import { Label } from '@/app/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/app/components/ui/radio-group'
import { Separator } from '@/app/components/ui/separator'
import {
  getQuizPreferences,
  saveQuizPreferences,
  QuizPreferencesSchema,
  STORAGE_KEY,
  type QuizPreferences,
} from '@/lib/quizPreferences'
import { toastSuccess, toastError } from '@/lib/toastHelpers'

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
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync cross-tab changes (native storage event fires only for other tabs)
  useEffect(() => {
    function handleUpdate() {
      setPrefs(getQuizPreferences())
    }
    function handleStorageEvent(e: StorageEvent) {
      if (e.key === STORAGE_KEY) handleUpdate()
    }
    window.addEventListener('quiz-preferences-updated', handleUpdate)
    window.addEventListener('storage', handleStorageEvent)
    return () => {
      window.removeEventListener('quiz-preferences-updated', handleUpdate)
      window.removeEventListener('storage', handleStorageEvent)
    }
  }, [])

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current)
    }
  }, [])

  function update(patch: Partial<QuizPreferences>) {
    const next = saveQuizPreferences(patch)
    if (next === null) {
      toastError.saveFailed('Quiz preferences — storage may be full')
      return
    }
    setPrefs(next)
    window.dispatchEvent(new CustomEvent('quiz-preferences-updated'))
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current)
    toastTimeoutRef.current = setTimeout(() => {
      toastSuccess.saved('Quiz preferences saved')
    }, 600)
  }

  function handleTimerChange(value: string) {
    const parsed = QuizPreferencesSchema.shape.timerAccommodation.safeParse(value)
    if (parsed.success) {
      update({ timerAccommodation: parsed.data })
    }
  }

  return (
    <Card data-testid="quiz-preferences-section">
      <CardHeader className="border-b border-border/50 bg-surface-sunken/30">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-brand-soft p-2">
            <SlidersHorizontal className="size-5 text-brand-soft-foreground" aria-hidden="true" />
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
            <Label id="timer-accommodation-label" className="text-sm font-medium">
              Timer accommodation default
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Default time multiplier for timed quizzes
            </p>
          </div>

          <RadioGroup
            data-testid="timer-accommodation-group"
            aria-labelledby="timer-accommodation-label"
            value={prefs.timerAccommodation}
            onValueChange={handleTimerChange}
            className="grid grid-cols-1 sm:grid-cols-3 gap-3"
          >
            {TIMER_OPTIONS.map(option => (
              <label
                key={option.value}
                className={cn(
                  'relative flex flex-col gap-1.5 p-4 border-2 rounded-xl cursor-pointer',
                  'transition-all duration-200 hover:shadow-sm',
                  'has-[[data-radix-collection-item]:focus-visible]:ring-2 has-[[data-radix-collection-item]:focus-visible]:ring-brand has-[[data-radix-collection-item]:focus-visible]:ring-offset-2',
                  prefs.timerAccommodation === option.value
                    ? 'border-brand bg-brand-soft shadow-sm'
                    : 'border-border bg-background hover:border-brand/50'
                )}
                data-testid={`timer-option-${option.value}`}
              >
                <RadioGroupItem
                  value={option.value}
                  className="sr-only"
                  aria-label={`${option.label} — ${option.description}`}
                />
                {prefs.timerAccommodation === option.value && (
                  <Check
                    className="absolute top-2 right-2 size-4 text-brand-soft-foreground"
                    aria-hidden="true"
                  />
                )}
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
              aria-label="Show immediate feedback"
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
              aria-label="Shuffle questions"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
