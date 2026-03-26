import { useEffect, useRef } from 'react'
import { Progress } from '@/app/components/ui/progress'
import type { Quiz, QuizProgress } from '@/types/quiz'
import { QuizTimer } from '@/app/components/quiz/QuizTimer'
import { useAriaLiveAnnouncer } from '@/hooks/useAriaLiveAnnouncer'

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

  // Announce question navigation changes to screen readers (AC8)
  const [navAnnouncement, announceNav] = useAriaLiveAnnouncer()
  const prevQuestionRef = useRef(currentQuestion)

  useEffect(() => {
    if (prevQuestionRef.current !== currentQuestion) {
      prevQuestionRef.current = currentQuestion
      announceNav(`Question ${currentQuestion} of ${totalQuestions}`)
    }
  }, [currentQuestion, totalQuestions, announceNav])

  return (
    <div className="mb-6">
      <div className="flex items-center">
        <h1 className="text-lg font-semibold">{quiz.title}</h1>
        {timeRemaining !== null && totalTimeSeconds !== null && (
          <QuizTimer
            timeRemaining={timeRemaining}
            totalTime={totalTimeSeconds}
            annotation={
              progress.timerAccommodation === '150%' || progress.timerAccommodation === '200%'
                ? 'Extended Time'
                : undefined
            }
          />
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
      {/* sr-only progressbar with question-count values per AC5; visual Progress uses percentage */}
      <div
        role="progressbar"
        aria-label="Question progress"
        aria-valuenow={currentQuestion}
        aria-valuemin={1}
        aria-valuemax={totalQuestions}
        className="sr-only"
      />
      <p className="text-sm text-muted-foreground mt-1">
        Question {currentQuestion} of {totalQuestions}
      </p>
      {/* Screen-reader-only: announces question navigation changes */}
      <div aria-live="polite" aria-atomic="true" className="sr-only" data-testid="nav-announcement">
        {navAnnouncement}
      </div>
    </div>
  )
}
