import { useEffect, useId, useRef, useState } from 'react'
import Markdown from 'react-markdown'
import { Input } from '@/app/components/ui/input'
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
  const counterId = useId()

  // Local state for debounced input
  const [inputValue, setInputValue] = useState(value ?? '')

  // Tracks whether the change was user-initiated (not a prop sync)
  const userEdited = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync external value when navigating back to this question
  useEffect(() => {
    setInputValue(value ?? '')
  }, [value])

  // Debounced save to store (300ms) — only fires for user edits
  useEffect(() => {
    if (!userEdited.current) return

    timerRef.current = setTimeout(() => {
      onChange(inputValue)
      userEdited.current = false
    }, DEBOUNCE_MS)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [inputValue, onChange])

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    userEdited.current = true
    setInputValue(e.target.value)
  }

  function handleBlur() {
    // Cancel pending debounce and save immediately
    if (timerRef.current) clearTimeout(timerRef.current)
    if (userEdited.current) {
      onChange(inputValue)
      userEdited.current = false
    }
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

      <div className="space-y-2">
        <Input
          type="text"
          value={inputValue}
          onChange={handleInput}
          onBlur={handleBlur}
          placeholder="Type your answer here"
          maxLength={MAX_LENGTH}
          disabled={!isActive}
          aria-labelledby={legendId}
          aria-describedby={counterId}
          className="w-full max-w-lg min-h-[44px]"
        />
        <span
          id={counterId}
          className="text-sm text-muted-foreground block"
          aria-live="polite"
          aria-atomic="true"
        >
          {inputValue.length} / {MAX_LENGTH}
        </span>
      </div>
    </fieldset>
  )
}
