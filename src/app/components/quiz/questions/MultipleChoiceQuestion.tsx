import { useCallback, useEffect, useId, useRef } from 'react'
import { RadioGroup, RadioGroupItem } from '@/app/components/ui/radio-group'
import { cn } from '@/app/components/ui/utils'
import type { Question } from '@/types/quiz'
import type { QuestionDisplayMode } from '../QuestionDisplay'
import { MarkdownRenderer } from '../MarkdownRenderer'

interface MultipleChoiceQuestionProps {
  question: Question
  value: string | undefined
  onChange: (answer: string) => void
  mode: QuestionDisplayMode
}

export function MultipleChoiceQuestion({
  question,
  value,
  onChange,
  mode,
}: MultipleChoiceQuestionProps) {
  const options = question.options ?? []
  const isActive = mode === 'active'
  const labelId = useId()

  if (process.env.NODE_ENV !== 'production' && (options.length < 2 || options.length > 6)) {
    console.warn(
      `[MultipleChoiceQuestion] Question "${question.id}" has ${options.length} options (expected 2-6)`
    )
  }

  // Document-level keyboard listener so number keys work regardless of focus
  useEffect(() => {
    if (!isActive) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.isComposing || e.metaKey || e.ctrlKey || e.altKey) return
      // Skip if user is typing in an input/textarea
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      const num = parseInt(e.key, 10)
      if (num >= 1 && num <= Math.min(options.length, 9)) {
        e.preventDefault()
        onChange(options[num - 1])
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isActive, options, onChange])

  // WAI-ARIA radio group spec: arrow keys should both focus AND select.
  // Radix moves focus via roving tabindex on ArrowDown/Up but does NOT fire
  // onValueChange. We read document.activeElement after Radix updates the DOM
  // (via rAF) and call onChange explicitly to enforce selection-follows-focus.
  const rafIdRef = useRef<number>(0)
  useEffect(() => () => cancelAnimationFrame(rafIdRef.current), [])

  const handleRadioGroupKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!isActive) return
      if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return
      rafIdRef.current = requestAnimationFrame(() => {
        const focused = document.activeElement as HTMLElement | null
        if (focused?.getAttribute('role') === 'radio') {
          const val = focused.getAttribute('value')
          if (val != null && val !== '') onChange(val)
        }
      })
    },
    [isActive, onChange]
  )

  return (
    <fieldset className="mt-6 min-w-0" aria-labelledby={labelId}>
      {/* sr-only legend for AT compatibility; aria-labelledby takes precedence per ARIA spec */}
      <legend className="sr-only">{question.text}</legend>
      <div
        id={labelId}
        data-testid="question-text"
        className="text-lg lg:text-xl text-foreground leading-relaxed pb-4"
      >
        <MarkdownRenderer content={question.text} />
      </div>

      <RadioGroup
        value={value ?? ''}
        onValueChange={isActive ? onChange : undefined}
        disabled={!isActive}
        onKeyDown={handleRadioGroupKeyDown}
      >
        {options.map((option, index) => {
          const isSelected = value === option
          const shortcutNum = index + 1

          const isCorrectAnswer = option === question.correctAnswer
          const reviewStyle = (() => {
            if (!isActive) {
              if (isSelected && isCorrectAnswer) return 'border-success bg-success-soft'
              if (isSelected && !isCorrectAnswer) return 'border-warning bg-warning/10'
              if (!isSelected && isCorrectAnswer && mode === 'review-incorrect')
                return 'border-success bg-success-soft opacity-80'
              return 'border-border bg-card opacity-60'
            }
            return isSelected
              ? 'border-brand bg-brand-soft'
              : cn('border-border bg-card', 'hover:bg-accent')
          })()

          return (
            <label
              key={`${index}-${option}`}
              className={cn(
                'flex items-center gap-3 rounded-xl p-4 min-h-12 transition-colors duration-150 motion-reduce:transition-none border-2',
                isActive ? 'cursor-pointer' : 'cursor-default',
                reviewStyle,
                'focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2'
              )}
            >
              {isActive && shortcutNum <= 9 && (
                <kbd
                  aria-hidden="true"
                  className="inline-flex items-center justify-center size-5 shrink-0 rounded border border-border bg-muted text-muted-foreground text-xs font-mono"
                >
                  {shortcutNum}
                </kbd>
              )}
              <RadioGroupItem value={option} className="shrink-0" />
              <span className="text-base text-foreground leading-relaxed">{option}</span>
            </label>
          )
        })}
      </RadioGroup>
    </fieldset>
  )
}
