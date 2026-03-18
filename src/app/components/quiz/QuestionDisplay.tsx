import type { Question } from '@/types/quiz'
import { MultipleChoiceQuestion } from './questions/MultipleChoiceQuestion'

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
  switch (question.type) {
    case 'multiple-choice': {
      const mcValue = typeof value === 'string' ? value : undefined
      const mcOnChange = (answer: string) => onChange(answer)
      return (
        <MultipleChoiceQuestion
          question={question}
          value={mcValue}
          onChange={mcOnChange}
          mode={mode}
        />
      )
    }
    default:
      return (
        <div
          role="status"
          className="mt-6 rounded-xl border border-border p-6 text-center text-muted-foreground text-sm"
        >
          Unsupported question type: {question.type}
        </div>
      )
  }
}
