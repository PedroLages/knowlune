import { useEffect, useId, useRef, useState } from 'react'
import Markdown from 'react-markdown'
import { Input } from '@/app/components/ui/input'
import { cn } from '@/app/components/ui/utils'
import type { Question } from '@/types/quiz'
import type { QuestionDisplayMode } from '../QuestionDisplay'
import { REMARK_PLUGINS, MARKDOWN_COMPONENTS } from './markdown-config'

const MAX_LENGTH = 500
const DEBOUNCE_MS = 300

interface FillInBlankQuestionProps {
  question: Question
  value: string | undefined
  onChange: (answer: string) => void
  mode: QuestionDisplayMode
}

export function FillInBlankQuestion({ question, value, onChange, mode }: FillInBlankQuestionProps) {
  const isActive = mode === 'active'
  const legendId = useId()
  const inputId = useId()

  // Local state for debounced input
  const [inputValue, setInputValue] = useState(value ?? '')

  // Track whether this is the initial mount to avoid triggering onChange
  const isInitialMount = useRef(true)

  // Sync external value when navigating back to this question
  useEffect(() => {
    setInputValue(value ?? '')
  }, [value])

  // Debounced save to store (300ms)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }

    const timer = setTimeout(() => {
      onChange(inputValue)
    }, DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [inputValue, onChange])

  function handleBlur() {
    // Save immediately on blur (no debounce wait)
    onChange(inputValue)
  }

  return (
    <fieldset className="mt-6">
      <legend
        id={legendId}
        data-testid="question-text"
        className="text-lg lg:text-xl text-foreground leading-relaxed pb-4"
      >
        <Markdown remarkPlugins={REMARK_PLUGINS} components={MARKDOWN_COMPONENTS}>
          {question.text}
        </Markdown>
      </legend>

      <div className={cn('space-y-2', !isActive && 'opacity-60')}>
        <Input
          id={inputId}
          type="text"
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onBlur={handleBlur}
          placeholder="Type your answer here"
          maxLength={MAX_LENGTH}
          disabled={!isActive}
          aria-labelledby={legendId}
          className="w-full max-w-md"
        />
        <span className="text-sm text-muted-foreground block">
          {inputValue.length} / {MAX_LENGTH}
        </span>
      </div>
    </fieldset>
  )
}
