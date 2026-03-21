import { useId } from 'react'
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
  const hintId = useId()

  if (process.env.NODE_ENV !== 'production' && options.length < 2) {
    console.warn(
      `[MultipleSelectQuestion] Question "${question.id}" has ${options.length} options (expected ≥2)`
    )
  }

  function handleToggle(option: string) {
    if (!isActive) return
    const newValue = value.includes(option) ? value.filter(v => v !== option) : [...value, option]
    onChange(newValue)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!isActive || e.isComposing || e.metaKey || e.ctrlKey || e.altKey) return
    const num = parseInt(e.key, 10)
    if (num >= 1 && num <= Math.min(options.length, 9)) {
      e.preventDefault()
      handleToggle(options[num - 1])
    }
  }

  return (
    <fieldset className="mt-6" aria-describedby={hintId} onKeyDown={handleKeyDown}>
      <legend
        id={legendId}
        data-testid="question-text"
        className="text-lg lg:text-xl text-foreground leading-relaxed pb-2"
      >
        <Markdown remarkPlugins={REMARK_PLUGINS} components={MARKDOWN_COMPONENTS}>
          {question.text}
        </Markdown>
      </legend>
      <span id={hintId} className="text-sm text-muted-foreground italic block mb-4">
        Select all that apply
      </span>

      <div className="space-y-3">
        {options.map((option, index) => {
          const isSelected = value.includes(option)
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
              {isActive && shortcutNum <= 9 && (
                <kbd
                  aria-hidden="true"
                  className="inline-flex items-center justify-center size-5 shrink-0 rounded border border-border bg-muted text-muted-foreground text-xs font-mono"
                >
                  {shortcutNum}
                </kbd>
              )}
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => handleToggle(option)}
                disabled={!isActive}
                className="shrink-0"
              />
              <span className="text-base text-foreground leading-relaxed">{option}</span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
