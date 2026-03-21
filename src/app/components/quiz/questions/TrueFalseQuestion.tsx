import { useId } from 'react'
import Markdown from 'react-markdown'
import { RadioGroup, RadioGroupItem } from '@/app/components/ui/radio-group'
import { cn } from '@/app/components/ui/utils'
import type { Question } from '@/types/quiz'
import type { QuestionDisplayMode } from '../QuestionDisplay'
import { REMARK_PLUGINS, MARKDOWN_COMPONENTS } from './markdown-config'

interface TrueFalseQuestionProps {
  question: Question
  value: string | undefined
  onChange: (answer: string) => void
  mode: QuestionDisplayMode
}

export function TrueFalseQuestion({ question, value, onChange, mode }: TrueFalseQuestionProps) {
  const options = question.options ?? []
  const isActive = mode === 'active'
  const legendId = useId()

  if (process.env.NODE_ENV !== 'production' && options.length !== 2) {
    console.warn(
      `[TrueFalseQuestion] Question "${question.id}" has ${options.length} options (expected 2)`
    )
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!isActive || e.isComposing || e.metaKey || e.ctrlKey || e.altKey) return
    const num = parseInt(e.key, 10)
    if (num >= 1 && num <= options.length) {
      e.preventDefault()
      onChange(options[num - 1])
    }
  }

  return (
    <fieldset className="mt-6" onKeyDown={handleKeyDown}>
      <legend
        id={legendId}
        data-testid="question-text"
        className="text-lg lg:text-xl text-foreground leading-relaxed pb-4"
      >
        <Markdown remarkPlugins={REMARK_PLUGINS} components={MARKDOWN_COMPONENTS}>
          {question.text}
        </Markdown>
      </legend>

      <RadioGroup
        value={value ?? ''}
        onValueChange={isActive ? onChange : undefined}
        disabled={!isActive}
        aria-labelledby={legendId}
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
                  className="inline-flex items-center justify-center w-5 h-5 shrink-0 rounded border border-border bg-muted text-muted-foreground text-xs font-mono"
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
