import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { db } from '@/db'
import type { Quiz as QuizType, QuizProgress, TimerAccommodation } from '@/types/quiz'
import { QuizProgressSchema, TimerAccommodationEnum } from '@/types/quiz'
import {
  useQuizStore,
  selectCurrentQuiz,
  selectCurrentProgress,
  selectIsLoading,
  selectError,
} from '@/stores/useQuizStore'
import { useQuizTimer, type WarningLevel } from '@/hooks/useQuizTimer'
import { TimerWarnings } from '@/app/components/quiz/TimerWarnings'
import { isQuotaExceeded } from '@/lib/quotaResilientStorage'
import { QuizStartScreen } from '@/app/components/quiz/QuizStartScreen'
import { QuizHeader } from '@/app/components/quiz/QuizHeader'
import { QuestionDisplay } from '@/app/components/quiz/QuestionDisplay'
import { QuestionHint } from '@/app/components/quiz/QuestionHint'
import { QuizNavigation } from '@/app/components/quiz/QuizNavigation'
import { MarkForReview } from '@/app/components/quiz/MarkForReview'
import { ReviewSummary } from '@/app/components/quiz/ReviewSummary'
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
    const key = `quiz-progress-${quizId}`
    // Prefer sessionStorage — if present, it means we're in fallback mode
    // and the adapter cleared the stale localStorage entry. Check localStorage
    // only as a fallback for the normal (non-quota-exceeded) path.
    const raw = sessionStorage.getItem(key) ?? localStorage.getItem(key)
    if (!raw) return null
    const result = QuizProgressSchema.safeParse(JSON.parse(raw))
    if (!result.success) {
      console.warn('[Quiz] Corrupted progress in storage, ignoring:', result.error.format())
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

/** Load persisted timer accommodation preference, validated via Zod */
export function loadSavedAccommodation(lessonId: string): TimerAccommodation {
  try {
    const raw = localStorage.getItem(`quiz-accommodation-${lessonId}`)
    if (!raw) return 'standard'
    const result = TimerAccommodationEnum.safeParse(raw)
    return result.success ? result.data : 'standard'
  } catch (e) {
    console.warn('[Quiz] Failed to load accommodation:', e)
    return 'standard'
  }
}

/** Count questions with no answer recorded */
function countUnanswered(
  questions: QuizType['questions'],
  answers: Record<string, string | string[]>
): number {
  return questions.filter(q => {
    const a = answers[q.id]
    return a === undefined || a === '' || (Array.isArray(a) && a.length === 0)
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
  const [hasCompletedBefore, setHasCompletedBefore] = useState(false)
  const [accommodation, setAccommodation] = useState<TimerAccommodation>(() =>
    loadSavedAccommodation(lessonId)
  )

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
  const navigateToQuestion = useQuizStore(s => s.navigateToQuestion)
  const toggleReviewMark = useQuizStore(s => s.toggleReviewMark)
  const navigate = useNavigate()
  const [showSubmitDialog, setShowSubmitDialog] = useState(false)
  const nextBtnRef = useRef<HTMLButtonElement>(null)
  const rafRef = useRef<number>(0)

  // Fetch quiz from Dexie on mount
  useEffect(() => {
    if (!lessonId) {
      setFetchState('error')
      return
    }

    let ignore = false
    setHasCompletedBefore(false)
    ;(async () => {
      try {
        const found = await db.quizzes.where('lessonId').equals(lessonId).first()
        if (ignore) return
        if (!found) {
          setFetchState('error')
          return
        }
        setQuiz(found)
        setSavedProgress(loadSavedProgress(found.id))

        // Check attempt history before showing start screen to avoid label flicker
        try {
          const attemptCount = await db.quizAttempts.where('quizId').equals(found.id).count()
          if (!ignore) setHasCompletedBefore(attemptCount > 0)
        } catch (err) {
          console.warn('[Quiz] Failed to check attempt history:', err)
        }

        if (!ignore) setFetchState('found')
      } catch (err: unknown) {
        console.error('[Quiz] Failed to load quiz:', err)
        if (!ignore) setFetchState('error')
      }
    })()

    return () => {
      ignore = true
      clearError()
      cancelAnimationFrame(rafRef.current)
    }
  }, [lessonId, clearError])

  const handleAccommodationChange = useCallback(
    (value: TimerAccommodation) => {
      setAccommodation(value)
      try {
        localStorage.setItem(`quiz-accommodation-${lessonId}`, value)
      } catch (e) {
        console.warn('[Quiz] Failed to persist accommodation:', e)
      }
    },
    [lessonId]
  )

  const handleStart = useCallback(() => {
    // startQuiz handles errors internally (try/catch + store error state)
    startQuiz(lessonId, accommodation)
  }, [startQuiz, lessonId, accommodation])

  const handleResume = useCallback(() => {
    if (!quiz || !savedProgress) return
    // Validate that saved questionOrder still matches current quiz questions
    const currentQuestionIds = new Set(quiz.questions.map(q => q.id))
    const orderIsValid = savedProgress.questionOrder.every(id => currentQuestionIds.has(id))
    if (!orderIsValid) {
      console.warn('[Quiz] Saved questionOrder references removed questions, discarding progress')
      setSavedProgress(null)
      localStorage.removeItem(`quiz-progress-${quiz.id}`)
      sessionStorage.removeItem(`quiz-progress-${quiz.id}`)
      return
    }
    // Restore saved progress directly into the store.
    // The subscribe listener will keep the per-quiz localStorage key in sync
    // as the active quiz progresses — no need to remove it here.
    useQuizStore.setState({
      currentQuiz: quiz,
      currentProgress: savedProgress,
      isLoading: false,
      error: null,
    })
  }, [quiz, savedProgress])

  // Guard against concurrent submit calls (manual submit + timer expiry race)
  const isSubmittingRef = useRef(false)

  const handleSubmitConfirm = useCallback(async () => {
    if (isSubmittingRef.current) return
    isSubmittingRef.current = true
    setShowSubmitDialog(false)
    try {
      await submitQuiz(courseId)
      navigate(`/courses/${courseId}/lessons/${lessonId}/quiz/results`)
    } catch {
      // Store already shows error toast; stay on quiz page with answers preserved
      isSubmittingRef.current = false
    }
  }, [submitQuiz, courseId, lessonId, navigate])

  const handleSubmitClick = useCallback(() => {
    const state = useQuizStore.getState()
    const progress = state.currentProgress
    const q = state.currentQuiz
    if (!progress || !q) return

    if (countUnanswered(q.questions, progress.answers) > 0 || progress.markedForReview.length > 0) {
      setShowSubmitDialog(true)
    } else {
      handleSubmitConfirm()
    }
  }, [handleSubmitConfirm])

  // ---------------------------------------------------------------------------
  // Timer — Date.now()-anchored countdown with auto-submit on expiry
  // ---------------------------------------------------------------------------
  const handleTimerExpiry = useCallback(async () => {
    if (isSubmittingRef.current) return
    isSubmittingRef.current = true
    try {
      await submitQuiz(courseId)
      toast.error("Time's up! Your quiz has been submitted.")
      navigate(`/courses/${courseId}/lessons/${lessonId}/quiz/results`)
    } catch {
      // Store already shows error toast; stay on quiz page with answers preserved
      isSubmittingRef.current = false
    }
  }, [submitQuiz, courseId, lessonId, navigate])

  // Compute initial seconds from quiz time limit or resumed progress.
  // Frozen in a ref to prevent store sync → re-render → effect restart cycle:
  // the hook writes timeRemaining back to the store every 60s, which would
  // change this value and re-trigger the hook's effect, resetting the timer.
  const timerInitialSecondsRef = useRef(0)
  if (
    timerInitialSecondsRef.current === 0 &&
    currentProgress &&
    currentQuiz?.timeLimit != null &&
    currentProgress.timerAccommodation !== 'untimed'
  ) {
    timerInitialSecondsRef.current = Math.round(
      (currentProgress.timeRemaining ?? currentQuiz.timeLimit) * 60
    )
  }

  const totalTimeSeconds = currentQuiz?.timeLimit != null ? currentQuiz.timeLimit * 60 : 0

  // Warning state — updated by useQuizTimer's onWarning callback
  const [warningState, setWarningState] = useState<{
    level: WarningLevel
    remaining: number
  } | null>(null)

  const handleTimerWarning = useCallback((level: WarningLevel, remaining: number) => {
    setWarningState({ level, remaining })
  }, [])

  const timerRemaining = useQuizTimer(
    timerInitialSecondsRef.current,
    handleTimerExpiry,
    handleTimerWarning
  )

  // Safety net: sync progress to per-quiz localStorage on tab close/crash.
  // The subscribe listener in useQuizStore fires synchronously on every state change,
  // so the per-quiz key is always up-to-date. This beforeunload handler provides
  // defense-in-depth for edge cases where the browser terminates before Zustand
  // flushes (e.g., process kill, OOM).
  const isQuizActive =
    currentProgress !== null && quiz !== null && currentProgress.quizId === quiz.id
  useEffect(() => {
    if (!isQuizActive) return
    const handleBeforeUnload = () => {
      try {
        const progress = useQuizStore.getState().currentProgress
        const currentQuizState = useQuizStore.getState().currentQuiz
        if (progress && currentQuizState) {
          const key = `quiz-progress-${currentQuizState.id}`
          const value = JSON.stringify(progress)
          try {
            localStorage.setItem(key, value)
          } catch (storageErr) {
            if (isQuotaExceeded(storageErr)) {
              // QuotaExceededError — fall back to sessionStorage
              sessionStorage.setItem(key, value)
            }
            // Non-quota errors (SecurityError, etc.) — skip silently during unload
          }
        }
      } catch (e) {
        // Storage completely inaccessible during unload — best effort
        console.warn('[Quiz] beforeunload storage save failed:', e)
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isQuizActive])

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
          className="text-brand hover:underline mt-4 inline-flex items-center gap-1 text-sm min-h-[44px] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:rounded-lg"
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
  if (isQuizActive && currentQuiz) {
    // Resolve current question via questionOrder (supports shuffled order)
    const orderedId = currentProgress.questionOrder[currentProgress.currentQuestionIndex]
    const questionId = orderedId ?? currentQuiz.questions[currentProgress.currentQuestionIndex]?.id
    if (!orderedId) {
      console.warn(
        '[Quiz] questionOrder missing index',
        currentProgress.currentQuestionIndex,
        '— falling back to questions array'
      )
    }
    const foundQuestion = currentQuiz.questions.find(q => q.id === questionId)
    if (questionId && !foundQuestion) {
      console.warn('[Quiz] Question ID not found in quiz:', questionId)
    }
    const currentQuestion =
      foundQuestion ?? currentQuiz.questions[currentProgress.currentQuestionIndex]

    const currentQuestionId = currentQuestion?.id
    const currentAnswer = currentQuestionId
      ? (currentProgress.answers[currentQuestionId] as string | undefined)
      : undefined

    const unansweredCount = countUnanswered(currentQuiz.questions, currentProgress.answers)

    return (
      <div className="bg-card rounded-[24px] p-4 sm:p-8 max-w-2xl mx-auto shadow-sm">
        <QuizHeader
          quiz={currentQuiz}
          progress={currentProgress}
          timeRemaining={timerInitialSecondsRef.current > 0 ? timerRemaining : null}
          totalTimeSeconds={totalTimeSeconds > 0 ? totalTimeSeconds : null}
        />
        <TimerWarnings
          warningLevel={warningState?.level ?? null}
          remainingSeconds={warningState?.remaining ?? 0}
        />
        {currentQuestion && currentQuestionId ? (
          <>
            <QuestionDisplay
              question={currentQuestion}
              value={currentAnswer}
              onChange={answer => {
                submitAnswer(currentQuestionId, answer)
                // Auto-focus Next/Submit button for single-answer types (MC, TF, FIB)
                // Skip for multiple-select — user needs to toggle multiple checkboxes
                if (currentQuestion.type !== 'multiple-select') {
                  cancelAnimationFrame(rafRef.current)
                  rafRef.current = requestAnimationFrame(() => nextBtnRef.current?.focus())
                }
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

        {currentQuestionId && (
          <MarkForReview
            questionId={currentQuestionId}
            isMarked={currentProgress.markedForReview.includes(currentQuestionId)}
            onToggle={() => toggleReviewMark(currentQuestionId)}
          />
        )}

        <QuizNavigation
          ref={nextBtnRef}
          quiz={currentQuiz}
          progress={currentProgress}
          onPrevious={goToPrevQuestion}
          onNext={goToNextQuestion}
          onSubmit={handleSubmitClick}
          onQuestionClick={navigateToQuestion}
          isSubmitting={isStoreLoading}
        />

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
              <ReviewSummary
                markedForReview={currentProgress.markedForReview}
                questionOrder={currentProgress.questionOrder}
                onJumpToQuestion={idx => {
                  navigateToQuestion(idx)
                  setShowSubmitDialog(false)
                }}
              />
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
        hasCompletedBefore={hasCompletedBefore}
        accommodation={accommodation}
        onStart={handleStart}
        onResume={handleResume}
        onAccommodationChange={handleAccommodationChange}
      />
    </div>
  )
}
