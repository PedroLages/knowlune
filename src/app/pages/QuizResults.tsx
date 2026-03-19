import { useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import {
  useQuizStore,
  selectCurrentQuiz,
  selectAttempts,
  selectIsLoading,
} from '@/stores/useQuizStore'
import { ScoreSummary } from '@/app/components/quiz/ScoreSummary'
import { Button } from '@/app/components/ui/button'
import { Skeleton } from '@/app/components/ui/skeleton'

export function QuizResults() {
  const { courseId = '', lessonId = '' } = useParams<{ courseId: string; lessonId: string }>()
  const navigate = useNavigate()

  const currentQuiz = useQuizStore(selectCurrentQuiz)
  const attempts = useQuizStore(selectAttempts)
  const isLoading = useQuizStore(selectIsLoading)
  const loadAttempts = useQuizStore(s => s.loadAttempts)
  const retakeQuiz = useQuizStore(s => s.retakeQuiz)

  // Load attempts from Dexie on mount
  useEffect(() => {
    if (currentQuiz?.id) {
      loadAttempts(currentQuiz.id)
    }
  }, [currentQuiz?.id, loadAttempts])

  const lastAttempt = attempts.length > 0 ? attempts[attempts.length - 1] : null

  const handleRetake = useCallback(async () => {
    await retakeQuiz(lessonId)
    navigate(`/courses/${courseId}/lessons/${lessonId}/quiz`)
  }, [retakeQuiz, lessonId, navigate, courseId])

  const handleReviewAnswers = useCallback(() => {
    toast.info('Answer review is coming in a future update.')
  }, [])

  // No quiz data — redirect back
  if (!currentQuiz && !isLoading) {
    navigate(`/courses/${courseId}/lessons/${lessonId}/quiz`, { replace: true })
    return null
  }

  // Loading state
  if (isLoading || !lastAttempt) {
    return (
      <div className="py-6">
        <div
          role="status"
          aria-busy="true"
          aria-label="Loading quiz results"
          className="bg-card rounded-[24px] p-4 sm:p-8 max-w-2xl mx-auto shadow-sm space-y-4 text-center"
        >
          <Skeleton className="h-32 w-32 rounded-full mx-auto" />
          <Skeleton className="h-6 w-48 mx-auto" />
          <Skeleton className="h-8 w-64 mx-auto" />
          <Skeleton className="h-4 w-40 mx-auto" />
        </div>
      </div>
    )
  }

  return (
    <div className="py-6">
      <div className="bg-card rounded-[24px] p-4 sm:p-8 max-w-2xl mx-auto shadow-sm text-center space-y-6">
        <h1 className="text-2xl font-bold text-foreground">
          {currentQuiz.title} — Results
        </h1>

        <ScoreSummary
          percentage={lastAttempt.percentage}
          score={lastAttempt.score}
          maxScore={lastAttempt.answers.reduce((sum, a) => sum + a.pointsPossible, 0)}
          passed={lastAttempt.passed}
          passingScore={currentQuiz.passingScore}
          timeSpent={lastAttempt.timeSpent}
        />

        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Button
            variant="outline"
            className="rounded-xl min-h-[44px]"
            onClick={handleRetake}
          >
            Retake Quiz
          </Button>
          <Button
            className="bg-brand text-brand-foreground rounded-xl min-h-[44px]"
            onClick={handleReviewAnswers}
          >
            Review Answers
          </Button>
        </div>

        <Link
          to={`/courses/${courseId}/${lessonId}`}
          className="text-brand hover:underline text-sm inline-flex items-center gap-1 min-h-[44px]"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to Lesson
        </Link>
      </div>
    </div>
  )
}
