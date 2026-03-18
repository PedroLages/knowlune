import { useId } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { RadioGroup, RadioGroupItem } from '@/app/components/ui/radio-group'
import { cn } from '@/app/components/ui/utils'
import type { Question } from '@/types/quiz'
import type { QuestionDisplayMode } from '../QuestionDisplay'

const REMARK_PLUGINS = [remarkGfm]

// Render inline <span> instead of block <p> inside <legend> (phrasing content only)
const MARKDOWN_COMPONENTS = {
  p: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
}

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
  const legendId = useId()

  // Warn on unusual option counts for data quality monitoring
  if (options.length < 2 || options.length > 6) {
    console.warn(
      `[MultipleChoiceQuestion] Question "${question.id}" has ${options.length} options (expected 2-6)`
    )
  }

  return (
    <fieldset className="mt-6">
      <legend id={legendId} className="text-lg lg:text-xl text-foreground leading-relaxed pb-4">
        <Markdown remarkPlugins={REMARK_PLUGINS} components={MARKDOWN_COMPONENTS}>
          {question.text}
        </Markdown>
      </legend>

      <RadioGroup
        value={value}
        onValueChange={isActive ? onChange : undefined}
        disabled={!isActive}
        aria-labelledby={legendId}
      >
        {options.map((option, index) => {
          const isSelected = value === option

          return (
            <label
              key={`${index}-${option}`}
              className={cn(
                'flex items-start gap-3 rounded-xl p-4 min-h-12 cursor-pointer transition-colors duration-150 border-2',
                isSelected ? 'border-brand bg-brand-soft' : 'border-border bg-card hover:bg-accent',
                !isActive && 'cursor-default opacity-60',
                'focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2'
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
