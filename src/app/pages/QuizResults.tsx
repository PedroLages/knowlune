import { useEffect, useState, useCallback, useMemo } from 'react'
import { useParams, useNavigate, Navigate, Link } from 'react-router'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { loadSavedAccommodation } from '@/app/pages/Quiz'
import {
  useQuizStore,
  selectCurrentQuiz,
  selectAttempts,
  selectIsLoading,
} from '@/stores/useQuizStore'
import { calculateImprovement, calculateNormalizedGain } from '@/lib/analytics'
import { ScoreSummary } from '@/app/components/quiz/ScoreSummary'
import { ScoreTrajectoryChart } from '@/app/components/quiz/ScoreTrajectoryChart'
import { ImprovementChart } from '@/app/components/quiz/ImprovementChart'
import { QuestionBreakdown } from '@/app/components/quiz/QuestionBreakdown'
import { AreasForGrowth } from '@/app/components/quiz/AreasForGrowth'
import { PerformanceInsights } from '@/app/components/quiz/PerformanceInsights'
import { AttemptHistory } from '@/app/components/quiz/AttemptHistory'
import { ItemDifficultyAnalysis } from '@/app/components/quiz/ItemDifficultyAnalysis'
import { DiscriminationAnalysis } from '@/app/components/quiz/DiscriminationAnalysis'
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
      loadAttempts(currentQuiz.id)
        .then(() => setAttemptsLoaded(true))
        .catch((err: unknown) => {
          console.error('[QuizResults] Failed to load attempts:', err)
          toast.error('Could not load quiz results. Please try again.')
          setAttemptsLoaded(true)
        })
    }
  }, [currentQuiz?.id, loadAttempts])

  // attempts is sorted most-recent-first; index 0 is the just-completed attempt
  const lastAttempt = attempts.length > 0 ? attempts[0] : null

  const maxScore = useMemo(
    () => lastAttempt?.answers?.reduce((sum, a) => sum + a.pointsPossible, 0) ?? 0,
    [lastAttempt]
  )

  const improvementData = useMemo(() => calculateImprovement(attempts), [attempts])

  const normalizedGain = useMemo(() => calculateNormalizedGain(attempts), [attempts])

  const previousAttemptTimeSpent = useMemo(() => {
    if (attempts.length <= 1) return undefined
    const priorAttempt = attempts[1] // attempts[0] = current, attempts[1] = previous
    if (priorAttempt?.timeSpent != null && Number.isFinite(priorAttempt.timeSpent)) {
      return priorAttempt.timeSpent
    }
    return undefined
  }, [attempts])

  const trajectoryData = useMemo(
    () =>
      [...attempts]
        .reverse() // Chronological order (oldest first) for chart x-axis
        .map((attempt, index) => ({
          attemptNumber: index + 1,
          percentage: Math.round(Math.min(100, Math.max(0, attempt.percentage))),
        })),
    [attempts]
  )

  const incorrectItems = useMemo(() => {
    if (!lastAttempt || !currentQuiz) return []
    return (lastAttempt.answers ?? [])
      .filter(a => !a.isCorrect)
      .map(a => {
        const question = currentQuiz.questions.find(q => q.id === a.questionId)
        const correctAnswer = question?.correctAnswer
        return {
          questionId: a.questionId,
          questionText: question?.text ?? 'Unknown question',
          correctAnswer: Array.isArray(correctAnswer)
            ? `All of: ${correctAnswer.join(', ')}`
            : (correctAnswer ?? 'N/A'),
        }
      })
  }, [lastAttempt, currentQuiz])

  const handleRetake = useCallback(async () => {
    try {
      const accommodation = loadSavedAccommodation(lessonId)
      await retakeQuiz(lessonId, accommodation)
      navigate(`/courses/${courseId}/lessons/${lessonId}/quiz`)
    } catch (err: unknown) {
      console.error('[QuizResults] Failed to retake quiz:', err)
      toast.error('Could not start retake. Please try again.')
    }
  }, [retakeQuiz, lessonId, courseId, navigate])

  const handleReviewAnswers = useCallback(() => {
    if (!lastAttempt) return
    navigate(`/courses/${courseId}/lessons/${lessonId}/quiz/review/${lastAttempt.id}`)
  }, [lastAttempt, courseId, lessonId, navigate])

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
        <h1 className="text-2xl font-bold text-foreground">{currentQuiz.title} — Results</h1>

        <ScoreSummary
          percentage={lastAttempt.percentage}
          score={lastAttempt.score}
          maxScore={maxScore}
          passed={lastAttempt.passed}
          passingScore={currentQuiz.passingScore}
          timeSpent={lastAttempt.timeSpent}
          improvementData={improvementData}
          normalizedGain={normalizedGain}
          showTimeSpent={
            currentQuiz.timeLimit != null && lastAttempt.timerAccommodation !== 'untimed'
          }
          previousAttemptTimeSpent={previousAttemptTimeSpent}
        />

        {/* Score trajectory chart — only renders with 2+ attempts */}
        <ScoreTrajectoryChart attempts={trajectoryData} passingScore={currentQuiz.passingScore} />

        {/* Learning trajectory pattern detection — requires 3+ attempts */}
        <ImprovementChart attempts={attempts} />

        {/* Item difficulty analysis — shows when at least 1 attempt has been recorded */}
        <ItemDifficultyAnalysis quiz={currentQuiz} attempts={attempts} />

        {/* Discrimination analysis — requires 5+ attempts for meaningful results */}
        <DiscriminationAnalysis quiz={currentQuiz} attempts={attempts} />

        <QuestionBreakdown answers={lastAttempt.answers} questions={currentQuiz.questions} />

        <PerformanceInsights
          questions={currentQuiz.questions}
          answers={lastAttempt.answers ?? []}
        />

        <AreasForGrowth incorrectItems={incorrectItems} />

        <div
          role="group"
          aria-label="Quiz actions"
          className="flex flex-col sm:flex-row gap-3 justify-center pt-2"
        >
          <Button variant="brand" className="rounded-xl min-h-[44px]" onClick={handleRetake}>
            Retake Quiz
          </Button>
          <Button
            variant="brand-outline"
            className="rounded-xl min-h-[44px]"
            onClick={handleReviewAnswers}
          >
            Review Answers
          </Button>
        </div>

        <div className="flex flex-col items-center gap-2">
          <AttemptHistory
            attempts={attempts}
            currentAttemptId={lastAttempt.id}
            courseId={courseId}
            lessonId={lessonId}
          />
          <Link
            to={`/courses/${courseId}/lessons/${lessonId}`}
            className="text-brand hover:underline text-sm font-medium inline-flex items-center gap-1 min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:rounded-sm"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to Lesson
          </Link>
        </div>
      </div>
    </div>
  )
}
