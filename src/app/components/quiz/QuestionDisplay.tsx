import { useCallback } from 'react'
import type { Question } from '@/types/quiz'
import { MultipleChoiceQuestion } from './questions/MultipleChoiceQuestion'
import { MultipleSelectQuestion } from './questions/MultipleSelectQuestion'
import { FillInBlankQuestion } from './questions/FillInBlankQuestion'
import { TrueFalseQuestion } from './questions/TrueFalseQuestion'

/**
 * Visual mode for question rendering.
 * - active: interactive, user can select answers (Epic 12)
 * - review-*: read-only with correct/incorrect styling (Epic 16)
 */
export type QuestionDisplayMode =
  | 'active'
  | 'review-correct'
  | 'review-incorrect'
  | 'review-disabled'

interface QuestionDisplayProps {
  question: Question
  value: string | string[] | undefined
  onChange: (answer: string | string[]) => void
  mode?: QuestionDisplayMode
}

/**
 * Polymorphic question renderer — dispatches to type-specific components.
 * Only multiple-choice is implemented in Epic 12; additional types added in Epic 14.
 */
export function QuestionDisplay({
  question,
  value,
  onChange,
  mode = 'active',
}: QuestionDisplayProps) {
  const stringOnChange = useCallback((answer: string) => onChange(answer), [onChange])
  const arrayOnChange = useCallback((answer: string[]) => onChange(answer), [onChange])
  const stringValue = typeof value === 'string' ? value : undefined
  const arrayValue = Array.isArray(value) ? value : undefined

  switch (question.type) {
    case 'multiple-choice':
      return (
        <MultipleChoiceQuestion
          question={question}
          value={stringValue}
          onChange={stringOnChange}
          mode={mode}
        />
      )
    case 'true-false':
      return (
        <TrueFalseQuestion
          question={question}
          value={stringValue}
          onChange={stringOnChange}
          mode={mode}
        />
      )
    case 'multiple-select':
      return (
        <MultipleSelectQuestion
          question={question}
          value={arrayValue}
          onChange={arrayOnChange}
          mode={mode}
        />
      )
    case 'fill-in-blank':
      return (
        <FillInBlankQuestion
          question={question}
          value={stringValue}
          onChange={stringOnChange}
          mode={mode}
        />
      )
    default:
      return (
        <div
          role="alert"
          className="mt-6 rounded-xl border border-border p-6 text-center text-muted-foreground text-sm"
        >
          Unsupported question type: {question.type}
        </div>
      )
  }
}
