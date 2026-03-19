import type { Quiz, QuizProgress } from '@/types/quiz'
import { QuizActions } from './QuizActions'
import { QuestionGrid } from './QuestionGrid'

interface QuizNavigationProps {
  quiz: Quiz
  progress: QuizProgress
  onPrevious: () => void
  onNext: () => void
  onSubmit: () => void
  onQuestionClick: (index: number) => void
  isSubmitting?: boolean
}

export function QuizNavigation({
  quiz,
  progress,
  onPrevious,
  onNext,
  onSubmit,
  onQuestionClick,
  isSubmitting,
}: QuizNavigationProps) {
  return (
    <nav aria-label="Quiz navigation" className="mt-6 flex flex-col sm:flex-row items-center gap-4">
      <QuizActions
        onPrevious={onPrevious}
        onNext={onNext}
        onSubmit={onSubmit}
        isFirst={progress.currentQuestionIndex === 0}
        isLast={progress.currentQuestionIndex === quiz.questions.length - 1}
        isSubmitting={isSubmitting}
      />
      <QuestionGrid
        total={progress.questionOrder.length || quiz.questions.length}
        answers={progress.answers}
        questionOrder={progress.questionOrder}
        currentIndex={progress.currentQuestionIndex}
        onQuestionClick={onQuestionClick}
      />
    </nav>
  )
}
