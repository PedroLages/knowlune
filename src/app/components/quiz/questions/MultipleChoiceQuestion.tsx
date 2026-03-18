import { useEffect } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { RadioGroup, RadioGroupItem } from '@/app/components/ui/radio-group'
import { cn } from '@/app/components/ui/utils'
import type { Question } from '@/types/quiz'
import type { QuestionDisplayMode } from '../QuestionDisplay'

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

  // Warn on unusual option counts for data quality monitoring
  useEffect(() => {
    if (options.length < 2 || options.length > 6) {
      console.warn(
        `[MultipleChoiceQuestion] Question "${question.id}" has ${options.length} options (expected 2-6)`
      )
    }
  }, [options.length, question.id])

  return (
    <fieldset className="mt-6 space-y-4">
      <legend className="text-lg lg:text-xl text-foreground leading-relaxed mb-4">
        <Markdown remarkPlugins={[remarkGfm]}>{question.text}</Markdown>
      </legend>

      <RadioGroup
        value={value ?? ''}
        onValueChange={isActive ? onChange : undefined}
        disabled={!isActive}
        className="space-y-3"
      >
        {options.map(option => {
          const isSelected = value === option

          return (
            <label
              key={option}
              className={cn(
                'flex items-start gap-3 rounded-xl p-4 min-h-12 cursor-pointer transition-colors duration-150',
                isSelected
                  ? 'border-2 border-brand bg-brand-soft'
                  : 'border border-border bg-card hover:bg-accent',
                !isActive && 'cursor-default opacity-60'
              )}
            >
              <RadioGroupItem value={option} className="mt-0.5 shrink-0" />
              <span className="text-base text-foreground leading-relaxed">{option}</span>
            </label>
          )
        })}
      </RadioGroup>
    </fieldset>
  )
}
