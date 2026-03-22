import { useEffect, useId } from 'react'
import { RadioGroup, RadioGroupItem } from '@/app/components/ui/radio-group'
import { cn } from '@/app/components/ui/utils'
import type { Question } from '@/types/quiz'
import type { QuestionDisplayMode } from '../QuestionDisplay'
import { MarkdownRenderer } from '../MarkdownRenderer'

interface TrueFalseQuestionProps {
  question: Question
  value: string | undefined
  onChange: (answer: string) => void
  mode: QuestionDisplayMode
}

export function TrueFalseQuestion({ question, value, onChange, mode }: TrueFalseQuestionProps) {
  const options = question.options ?? []
  const isActive = mode === 'active'
  const labelId = useId()

  if (process.env.NODE_ENV !== 'production' && options.length !== 2) {
    console.warn(
      `[TrueFalseQuestion] Question "${question.id}" has ${options.length} options (expected 2)`
    )
  }

  // Document-level keyboard listener so number keys work regardless of focus
  useEffect(() => {
    if (!isActive) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.isComposing || e.metaKey || e.ctrlKey || e.altKey) return
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      const num = parseInt(e.key, 10)
      if (num >= 1 && num <= options.length) {
        e.preventDefault()
        onChange(options[num - 1])
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isActive, options, onChange])

  return (
    <fieldset className="mt-6 min-w-0" aria-labelledby={labelId}>
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
        className="grid grid-cols-1 lg:grid-cols-2 gap-3"
      >
        {options.map((option, index) => {
          const isSelected = value === option
          const shortcutNum = index + 1

          return (
            <label
              key={`${index}-${option}`}
              className={cn(
                'flex items-center gap-3 rounded-xl p-4 min-h-12 cursor-pointer transition-colors duration-150 motion-reduce:transition-none border-2',
                isSelected
                  ? 'border-brand bg-brand-soft'
                  : cn('border-border bg-card', isActive && 'hover:bg-accent'),
                !isActive && 'cursor-default opacity-60',
                'focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2'
              )}
            >
              {isActive && (
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
