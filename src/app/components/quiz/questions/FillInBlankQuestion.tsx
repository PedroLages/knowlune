import { useEffect, useId, useRef, useState } from 'react'
import { Input } from '@/app/components/ui/input'
import type { Question } from '@/types/quiz'
import type { QuestionDisplayMode } from '../QuestionDisplay'
import { MarkdownRenderer } from '../MarkdownRenderer'

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
  const labelId = useId()
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
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [inputValue, onChange])

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    userEdited.current = true
    setInputValue(e.target.value)
  }

  function handleBlur() {
    // Cancel pending debounce and save immediately
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (userEdited.current) {
      onChange(inputValue)
      userEdited.current = false
    }
  }

  return (
    <fieldset className="mt-6 min-w-0" aria-labelledby={labelId}>
      <div
        id={labelId}
        data-testid="question-text"
        className="text-lg lg:text-xl text-foreground leading-relaxed pb-4"
      >
        <MarkdownRenderer content={question.text} />
      </div>

      <div className="space-y-2">
        <Input
          type="text"
          name="quiz-answer"
          value={inputValue}
          onChange={handleInput}
          onBlur={handleBlur}
          placeholder="Type your answer here..."
          maxLength={MAX_LENGTH}
          disabled={!isActive}
          autoComplete="off"
          spellCheck={false}
          aria-labelledby={labelId}
          aria-describedby={isActive ? counterId : undefined}
          className="w-full max-w-lg min-h-[44px]"
        />
        {isActive && (
          <span
            id={counterId}
            className="text-sm text-muted-foreground block"
            aria-live="polite"
            aria-atomic="true"
          >
            {inputValue.length} / {MAX_LENGTH}
          </span>
        )}
        {!isActive &&
          mode !== 'review-disabled' &&
          (() => {
            const correctAnswer =
              typeof question.correctAnswer === 'string' ? question.correctAnswer : ''
            const userTrimmed = inputValue.trim()
            const exactMatch = userTrimmed === correctAnswer
            const caseInsensitiveMatch =
              !exactMatch && userTrimmed.toLowerCase() === correctAnswer.toLowerCase()
            const isCorrect = exactMatch || caseInsensitiveMatch
            return (
              <div
                className={`mt-2 rounded-lg p-3 text-sm ${isCorrect ? 'bg-success-soft text-foreground' : 'bg-warning/10 text-foreground'}`}
              >
                {isCorrect ? (
                  <p>
                    Your answer is correct
                    {caseInsensitiveMatch ? ' (case-insensitive match)' : ''}.
                  </p>
                ) : (
                  <>
                    <p>
                      <strong>Your answer:</strong> {userTrimmed || '(no answer)'}
                    </p>
                    <p className="mt-1">
                      <strong>Correct answer:</strong> {correctAnswer}
                    </p>
                  </>
                )}
              </div>
            )
          })()}
      </div>
    </fieldset>
  )
}
