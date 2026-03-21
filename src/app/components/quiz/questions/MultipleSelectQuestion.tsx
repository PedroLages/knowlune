import { useId, useMemo } from 'react'
import Markdown from 'react-markdown'
import { Checkbox } from '@/app/components/ui/checkbox'
import { cn } from '@/app/components/ui/utils'
import type { Question } from '@/types/quiz'
import type { QuestionDisplayMode } from '../QuestionDisplay'
import { REMARK_PLUGINS, MARKDOWN_COMPONENTS } from './markdown-config'

interface MultipleSelectQuestionProps {
  question: Question
  value: string[] | undefined
  onChange: (answer: string[]) => void
  mode: QuestionDisplayMode
}

export function MultipleSelectQuestion({
  question,
  value = [],
  onChange,
  mode,
}: MultipleSelectQuestionProps) {
  const options = question.options ?? []
  const isActive = mode === 'active'
  const legendId = useId()

  useMemo(() => {
    if (options.length < 2) {
      console.warn(
        `[MultipleSelectQuestion] Question "${question.id}" has ${options.length} options (expected ≥2)`
      )
    }
  }, [question.id, options.length])

  function handleToggle(option: string) {
    if (!isActive) return
    const newValue = value.includes(option)
      ? value.filter((v) => v !== option)
      : [...value, option]
    onChange(newValue)
  }

  return (
    <fieldset className="mt-6">
      <legend
        id={legendId}
        data-testid="question-text"
        className="text-lg lg:text-xl text-foreground leading-relaxed pb-1"
      >
        <Markdown remarkPlugins={REMARK_PLUGINS} components={MARKDOWN_COMPONENTS}>
          {question.text}
        </Markdown>
      </legend>
      <span className="text-sm text-muted-foreground italic block mb-4">
        Select all that apply
      </span>

      <div className="space-y-3" role="group" aria-labelledby={legendId}>
        {options.map((option, index) => {
          const isSelected = value.includes(option)

          return (
            <label
              key={`${index}-${option}`}
              className={cn(
                'flex items-start gap-3 rounded-xl p-4 min-h-12 cursor-pointer transition-colors duration-150 motion-reduce:transition-none border-2',
                isSelected
                  ? 'border-brand bg-brand-soft'
                  : cn('border-border bg-card', isActive && 'hover:bg-accent'),
                !isActive && 'cursor-default opacity-60',
                'focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2'
              )}
            >
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => handleToggle(option)}
                disabled={!isActive}
                aria-label={option}
                className="mt-0.5 shrink-0"
              />
              <span className="text-base text-foreground leading-relaxed">{option}</span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
