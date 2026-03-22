import { Progress } from '@/app/components/ui/progress'
import type { Quiz, QuizProgress } from '@/types/quiz'
import { QuizTimer } from '@/app/components/quiz/QuizTimer'

interface QuizHeaderProps {
  quiz: Quiz
  progress: QuizProgress
  /** Current remaining time in seconds, or null for untimed quizzes */
  timeRemaining: number | null
  /** Total quiz time in seconds (used for color threshold calculations) */
  totalTimeSeconds: number | null
}

export function QuizHeader({ quiz, progress, timeRemaining, totalTimeSeconds }: QuizHeaderProps) {
  const totalQuestions = progress.questionOrder.length || quiz.questions.length
  const currentQuestion = progress.currentQuestionIndex + 1
  const progressValue =
    totalQuestions > 0 ? Math.round((currentQuestion / totalQuestions) * 100) : 0

  return (
    <div className="mb-6">
      <div className="flex items-center">
        <h1 className="text-lg font-semibold">{quiz.title}</h1>
        {timeRemaining !== null && totalTimeSeconds !== null && (
          <QuizTimer timeRemaining={timeRemaining} totalTime={totalTimeSeconds} />
        )}
      </div>
      <Progress
        value={progressValue}
        className="mt-2"
        aria-label="Quiz progress"
        aria-valuenow={progressValue}
        aria-valuemin={0}
        aria-valuemax={100}
      />
      <p className="text-sm text-muted-foreground mt-1">
        Question {currentQuestion} of {totalQuestions}
      </p>
    </div>
  )
}
