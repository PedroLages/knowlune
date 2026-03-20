import { useEffect, useState, useCallback, useMemo } from 'react'
import { useParams, useNavigate, Navigate, Link } from 'react-router'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import {
  useQuizStore,
  selectCurrentQuiz,
  selectAttempts,
  selectIsLoading,
} from '@/stores/useQuizStore'
import { ScoreSummary } from '@/app/components/quiz/ScoreSummary'
import { QuestionBreakdown } from '@/app/components/quiz/QuestionBreakdown'
import { AreasForGrowth } from '@/app/components/quiz/AreasForGrowth'
import { Button } from '@/app/components/ui/button'
import { Skeleton } from '@/app/components/ui/skeleton'

export function QuizResults() {
  const { courseId = '', lessonId = '' } = useParams<{ courseId: string; lessonId: string }>()

  const currentQuiz = useQuizStore(selectCurrentQuiz)
  const attempts = useQuizStore(selectAttempts)
  const isLoading = useQuizStore(selectIsLoading)
  const loadAttempts = useQuizStore(s => s.loadAttempts)
  const retakeQuiz = useQuizStore(s => s.retakeQuiz)
  const navigate = useNavigate()

  const [attemptsLoaded, setAttemptsLoaded] = useState(false)

  // Load attempts from Dexie on mount
  useEffect(() => {
    if (currentQuiz?.id) {
      loadAttempts(currentQuiz.id).then(() => setAttemptsLoaded(true))
    }
  }, [currentQuiz?.id, loadAttempts])

  const lastAttempt = attempts.length > 0 ? attempts[attempts.length - 1] : null

  const maxScore = useMemo(
    () => lastAttempt?.answers.reduce((sum, a) => sum + a.pointsPossible, 0) ?? 0,
    [lastAttempt]
  )

  const incorrectItems = useMemo(() => {
    if (!lastAttempt || !currentQuiz) return []
    return lastAttempt.answers
      .filter(a => !a.isCorrect)
      .map(a => {
        const question = currentQuiz.questions.find(q => q.id === a.questionId)
        const correctAnswer = question?.correctAnswer
        return {
          questionId: a.questionId,
          questionText: question?.text ?? 'Unknown question',
          correctAnswer: Array.isArray(correctAnswer)
            ? `All of: ${correctAnswer.join(', ')}`
            : correctAnswer ?? 'N/A',
        }
      })
  }, [lastAttempt, currentQuiz])

  const handleRetake = useCallback(async () => {
    try {
      await retakeQuiz(lessonId)
      navigate(`/courses/${courseId}/lessons/${lessonId}/quiz`)
    } catch {
      // Store shows error toast internally
    }
  }, [retakeQuiz, lessonId, courseId, navigate])

  const handleReviewAnswers = useCallback(() => {
    toast.info('Answer review is coming in a future update.')
  }, [])

  // No quiz data — declarative redirect back (not imperative navigate during render)
  if (!currentQuiz && !isLoading) {
    return <Navigate to={`/courses/${courseId}/lessons/${lessonId}/quiz`} replace />
  }

  // Loaded but no attempts found — redirect back
  if (attemptsLoaded && !lastAttempt && !isLoading) {
    return <Navigate to={`/courses/${courseId}/lessons/${lessonId}/quiz`} replace />
  }

  // Loading state
  if (isLoading || !lastAttempt || !currentQuiz) {
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
          maxScore={maxScore}
          passed={lastAttempt.passed}
          passingScore={currentQuiz.passingScore}
          timeSpent={lastAttempt.timeSpent}
        />

        <QuestionBreakdown
          answers={lastAttempt.answers}
          questions={currentQuiz.questions}
        />

        <AreasForGrowth incorrectItems={incorrectItems} />

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
          to={`/courses/${courseId}/lessons/${lessonId}`}
          className="text-brand hover:underline text-sm font-medium inline-flex items-center gap-1 min-h-[44px]"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to Lesson
        </Link>
      </div>
    </div>
  )
}
