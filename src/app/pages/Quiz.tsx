import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router'
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react'
import { db } from '@/db'
import type { Quiz as QuizType, QuizProgress } from '@/types/quiz'
import { QuizProgressSchema } from '@/types/quiz'
import {
  useQuizStore,
  selectCurrentQuiz,
  selectCurrentProgress,
  selectIsLoading,
  selectError,
} from '@/stores/useQuizStore'
import { QuizStartScreen } from '@/app/components/quiz/QuizStartScreen'
import { QuizHeader } from '@/app/components/quiz/QuizHeader'
import { QuestionDisplay } from '@/app/components/quiz/QuestionDisplay'
import { QuestionHint } from '@/app/components/quiz/QuestionHint'
import { Button } from '@/app/components/ui/button'
import { Skeleton } from '@/app/components/ui/skeleton'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/app/components/ui/alert-dialog'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadSavedProgress(quizId: string): QuizProgress | null {
  try {
    const raw = localStorage.getItem(`quiz-progress-${quizId}`)
    if (!raw) return null
    const result = QuizProgressSchema.safeParse(JSON.parse(raw))
    if (!result.success) {
      console.warn('[Quiz] Corrupted progress in localStorage, ignoring:', result.error.format())
      return null
    }
    // Only treat as valid resume state if there are recorded answers
    if (Object.keys(result.data.answers).length === 0) return null
    return result.data
  } catch (e) {
    console.warn('[Quiz] Failed to parse saved progress:', e)
    return null
  }
}

/** Count questions with no answer recorded */
function countUnanswered(
  questions: QuizType['questions'],
  answers: Record<string, string | string[]>
): number {
  return questions.filter(q => {
    const a = answers[q.id]
    return a === undefined || a === ''
  }).length
}

// ---------------------------------------------------------------------------
// Quiz page
// ---------------------------------------------------------------------------

export function Quiz() {
  const { courseId = '', lessonId = '' } = useParams<{ courseId: string; lessonId: string }>()

  // Local state for the quiz definition fetched from Dexie
  const [quiz, setQuiz] = useState<QuizType | null>(null)
  const [fetchState, setFetchState] = useState<'loading' | 'found' | 'error'>('loading')
  const [savedProgress, setSavedProgress] = useState<QuizProgress | null>(null)

  // Store selectors — drives the active quiz view after startQuiz()
  const currentQuiz = useQuizStore(selectCurrentQuiz)
  const currentProgress = useQuizStore(selectCurrentProgress)
  const isStoreLoading = useQuizStore(selectIsLoading)
  const storeError = useQuizStore(selectError)
  const clearError = useQuizStore(s => s.clearError)
  const startQuiz = useQuizStore(s => s.startQuiz)
  const submitAnswer = useQuizStore(s => s.submitAnswer)
  const submitQuiz = useQuizStore(s => s.submitQuiz)
  const goToNextQuestion = useQuizStore(s => s.goToNextQuestion)
  const goToPrevQuestion = useQuizStore(s => s.goToPrevQuestion)
  const navigate = useNavigate()
  const [showSubmitDialog, setShowSubmitDialog] = useState(false)
  const nextBtnRef = useRef<HTMLButtonElement>(null)

  // Fetch quiz from Dexie on mount
  useEffect(() => {
    if (!lessonId) {
      setFetchState('error')
      return
    }

    let ignore = false

    db.quizzes
      .where('lessonId')
      .equals(lessonId)
      .first()
      .then(found => {
        if (ignore) return
        if (!found) {
          setFetchState('error')
          return
        }
        setQuiz(found)
        setSavedProgress(loadSavedProgress(found.id))
        setFetchState('found')
      })
      .catch((err: unknown) => {
        console.error('[Quiz] Failed to load quiz:', err)
        if (!ignore) setFetchState('error')
      })

    return () => {
      ignore = true
      clearError()
    }
  }, [lessonId, clearError])

  const handleStart = useCallback(() => {
    // startQuiz handles errors internally (try/catch + store error state)
    startQuiz(lessonId)
  }, [startQuiz, lessonId])

  const handleResume = useCallback(() => {
    if (!quiz || !savedProgress) return
    // Validate that saved questionOrder still matches current quiz questions
    const currentQuestionIds = new Set(quiz.questions.map(q => q.id))
    const orderIsValid = savedProgress.questionOrder.every(id => currentQuestionIds.has(id))
    if (!orderIsValid) {
      console.warn('[Quiz] Saved questionOrder references removed questions, discarding progress')
      setSavedProgress(null)
      localStorage.removeItem(`quiz-progress-${quiz.id}`)
      return
    }
    // Restore saved progress directly into the store
    useQuizStore.setState({
      currentQuiz: quiz,
      currentProgress: savedProgress,
      isLoading: false,
      error: null,
    })
    // Clear per-quiz localStorage key — the Zustand persist middleware now owns the state
    localStorage.removeItem(`quiz-progress-${quiz.id}`)
  }, [quiz, savedProgress])

  const handleSubmitConfirm = useCallback(async () => {
    setShowSubmitDialog(false)
    try {
      await submitQuiz(courseId)
      navigate(`/courses/${courseId}/lessons/${lessonId}/quiz/results`)
    } catch {
      // Store already shows error toast; stay on quiz page with answers preserved
    }
  }, [submitQuiz, courseId, lessonId, navigate])

  const handleSubmitClick = useCallback(() => {
    const state = useQuizStore.getState()
    const progress = state.currentProgress
    const q = state.currentQuiz
    if (!progress || !q) return

    if (countUnanswered(q.questions, progress.answers) > 0) {
      setShowSubmitDialog(true)
    } else {
      handleSubmitConfirm()
    }
  }, [handleSubmitConfirm])

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------
  if (fetchState === 'loading' || isStoreLoading) {
    return (
      <div
        role="status"
        aria-busy="true"
        aria-label="Loading quiz"
        className="bg-card rounded-[24px] p-4 sm:p-8 max-w-2xl mx-auto shadow-sm space-y-4"
      >
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-full" />
        <div className="flex gap-2">
          <Skeleton className="h-7 w-24 rounded-full" />
          <Skeleton className="h-7 w-20 rounded-full" />
          <Skeleton className="h-7 w-24 rounded-full" />
        </div>
        <Skeleton className="h-12 w-36 rounded-xl" />
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Error / not-found state
  // ---------------------------------------------------------------------------
  if (fetchState === 'error' || storeError || !quiz) {
    return (
      <div
        role="alert"
        className="bg-card rounded-[24px] p-4 sm:p-8 max-w-2xl mx-auto shadow-sm text-center py-12"
      >
        <p className="text-muted-foreground">{storeError || 'No quiz found for this lesson.'}</p>
        <Link
          to={`/courses/${courseId}`}
          className="text-brand hover:underline mt-4 inline-flex items-center gap-1 text-sm min-h-[44px]"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to course
        </Link>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Active quiz state — show header + question display stub
  // ---------------------------------------------------------------------------
  const isQuizActive = currentProgress !== null && currentProgress.quizId === quiz.id

  if (isQuizActive && currentQuiz) {
    // Resolve current question via questionOrder (supports shuffled order)
    const questionId =
      currentProgress.questionOrder[currentProgress.currentQuestionIndex] ??
      currentQuiz.questions[currentProgress.currentQuestionIndex]?.id
    const currentQuestion =
      currentQuiz.questions.find(q => q.id === questionId) ??
      currentQuiz.questions[currentProgress.currentQuestionIndex]

    const currentQuestionId = currentQuestion?.id
    const currentAnswer = currentQuestionId
      ? (currentProgress.answers[currentQuestionId] as string | undefined)
      : undefined

    const isFirstQuestion = currentProgress.currentQuestionIndex === 0
    const isLastQuestion = currentProgress.currentQuestionIndex === currentQuiz.questions.length - 1
    const unansweredCount = countUnanswered(currentQuiz.questions, currentProgress.answers)

    return (
      <div className="bg-card rounded-[24px] p-4 sm:p-8 max-w-2xl mx-auto shadow-sm">
        <QuizHeader quiz={currentQuiz} progress={currentProgress} />
        {currentQuestion && currentQuestionId ? (
          <>
            <QuestionDisplay
              question={currentQuestion}
              value={currentAnswer}
              onChange={answer => {
                submitAnswer(currentQuestionId, answer)
                // Auto-focus Next/Submit button after answering for quick Enter key advancement
                requestAnimationFrame(() => nextBtnRef.current?.focus())
              }}
              mode="active"
            />
            <QuestionHint hint={currentQuestion.hint} />
          </>
        ) : (
          <div className="mt-6 rounded-xl border border-border p-6 text-center text-muted-foreground text-sm">
            No question found at index {currentProgress.currentQuestionIndex}
          </div>
        )}

        {/* Navigation footer */}
        <nav aria-label="Quiz navigation" className="mt-6 flex items-center justify-between gap-3">
          <Button
            variant="outline"
            className="rounded-xl min-h-[44px]"
            disabled={isFirstQuestion}
            onClick={goToPrevQuestion}
          >
            <ChevronLeft className="size-4 mr-1" aria-hidden="true" />
            Previous
          </Button>

          <div className="flex gap-3">
            {!isLastQuestion && (
              <Button
                ref={nextBtnRef}
                variant="outline"
                className="rounded-xl min-h-[44px]"
                onClick={goToNextQuestion}
              >
                Next
                <ChevronRight className="size-4 ml-1" aria-hidden="true" />
              </Button>
            )}
            {isLastQuestion && (
              <Button
                ref={nextBtnRef}
                className="bg-brand text-brand-foreground rounded-xl min-h-[44px]"
                onClick={handleSubmitClick}
                disabled={isStoreLoading}
              >
                {isStoreLoading ? 'Submitting…' : 'Submit Quiz'}
              </Button>
            )}
          </div>
        </nav>

        {/* Confirmation dialog for unanswered questions */}
        <AlertDialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Submit quiz?</AlertDialogTitle>
              <AlertDialogDescription>
                You have {unansweredCount} unanswered{' '}
                {unansweredCount === 1 ? 'question' : 'questions'}. Submit anyway? Unanswered
                questions will be scored as incorrect.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Continue Reviewing</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={handleSubmitConfirm}
                disabled={isStoreLoading}
              >
                {isStoreLoading ? 'Submitting…' : 'Submit Anyway'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Start screen
  // ---------------------------------------------------------------------------
  return (
    <div className="py-6">
      <QuizStartScreen
        quiz={quiz}
        savedProgress={savedProgress}
        onStart={handleStart}
        onResume={handleResume}
      />
    </div>
  )
}
