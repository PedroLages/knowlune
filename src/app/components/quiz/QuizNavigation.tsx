import { type Ref } from 'react'
import type { Quiz, QuizProgress } from '@/types/quiz'
import { QuizActions } from './QuizActions'
import { QuestionGrid } from './QuestionGrid'

interface QuizNavigationProps {
  ref?: Ref<HTMLButtonElement>
  quiz: Quiz
  progress: QuizProgress
  onPrevious: () => void
  onNext: () => void
  onSubmit: () => void
  onQuestionClick: (index: number) => void
  isSubmitting?: boolean
}

export function QuizNavigation({
  ref,
  quiz,
  progress,
  onPrevious,
  onNext,
  onSubmit,
  onQuestionClick,
  isSubmitting,
}: QuizNavigationProps) {
  return (
    <nav
      aria-label="Quiz navigation"
      className="mt-6 flex flex-col sm:flex-row items-start sm:items-center gap-4"
    >
      <QuizActions
        ref={ref}
        onPrevious={onPrevious}
        onNext={onNext}
        onSubmit={onSubmit}
        isFirst={progress.currentQuestionIndex === 0}
        isLast={progress.currentQuestionIndex === quiz.questions.length - 1}
        isSubmitting={isSubmitting}
      />
      <QuestionGrid
        total={
          progress.questionOrder.length > 0
            ? progress.questionOrder.length
            : quiz.questions.length
        }
        answers={progress.answers}
        questionOrder={progress.questionOrder}
        currentIndex={progress.currentQuestionIndex}
        markedForReview={progress.markedForReview}
        onQuestionClick={onQuestionClick}
      />
    </nav>
  )
}
