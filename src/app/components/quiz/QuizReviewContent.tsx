import { useState, useCallback } from 'react'
import { useNavigate, Link } from 'react-router'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import type { Quiz, QuizAttempt } from '@/types/quiz'
import type { QuestionDisplayMode } from '@/app/components/quiz/QuestionDisplay'
import { QuestionDisplay } from '@/app/components/quiz/QuestionDisplay'
import { AnswerFeedback } from '@/app/components/quiz/AnswerFeedback'
import { QuestionFeedback, type FeedbackValue } from '@/app/components/quiz/QuestionFeedback'
import { ReviewQuestionGrid } from '@/app/components/quiz/ReviewQuestionGrid'
import { Button } from '@/app/components/ui/button'
import { Progress } from '@/app/components/ui/progress'
import { db } from '@/db'
import { syncableWrite, type SyncableRecord } from '@/lib/sync/syncableWrite'

interface QuizReviewContentProps {
  quiz: Quiz
  attempt: QuizAttempt
  courseId: string
  lessonId: string
}

const noop = () => {}

/** Feedback record stored as extra metadata on the quiz in Dexie */
export interface QuestionFeedbackRecord {
  questionId: string
  feedback: 'up' | 'down'
  timestamp: string
}

export function QuizReviewContent({ quiz, attempt, courseId, lessonId }: QuizReviewContentProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const navigate = useNavigate()
  // Track feedback per question (stored locally in quiz metadata)
  const [feedbackMap, setFeedbackMap] = useState<Record<string, FeedbackValue>>(() => {
    // Load existing feedback from quiz extra metadata
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existing = (quiz as any).questionFeedback as QuestionFeedbackRecord[] | undefined
    if (!existing) return {}
    const map: Record<string, FeedbackValue> = {}
    for (const f of existing) {
      map[f.questionId] = f.feedback
    }
    return map
  })

  // Sort by canonical order
  const questions = [...quiz.questions].sort((a, b) => a.order - b.order)

  const currentQuestion = questions[currentIndex]
  const answerRecord = attempt.answers.find(a => a.questionId === currentQuestion.id)

  const mode: QuestionDisplayMode = answerRecord
    ? answerRecord.isCorrect
      ? 'review-correct'
      : 'review-incorrect'
    : 'review-disabled'

  const userAnswer = answerRecord?.userAnswer

  const isFirst = currentIndex === 0
  const isLast = currentIndex === questions.length - 1

  const progressPct = Math.round(((currentIndex + 1) / questions.length) * 100)

  const handleFeedback = useCallback(
    async (questionId: string, value: 'up' | 'down') => {
      setFeedbackMap(prev => ({ ...prev, [questionId]: value }))

      // Persist to Dexie (add to quiz's questionFeedback array)
      try {
        const currentQuiz = await db.quizzes.get(quiz.id)
        if (!currentQuiz) return

        const existing: QuestionFeedbackRecord[] = currentQuiz.questionFeedback ?? []
        const updated = [
          ...existing.filter((f: QuestionFeedbackRecord) => f.questionId !== questionId),
          { questionId, feedback: value, timestamp: new Date().toISOString() },
        ]

        // E96-S02: syncableWrite requires a full record — merge the
        // questionFeedback patch into the existing row and route through it
        // so the feedback change enqueues for Supabase upload.
        await syncableWrite(
          'quizzes',
          'put',
          { ...currentQuiz, questionFeedback: updated } as unknown as SyncableRecord,
        )
      } catch (err) {
        console.warn('[QuizReview] Failed to save feedback:', (err as Error).message)
        toast.error('Failed to save feedback. Please try again.')
      }
    },
    [quiz.id]
  )

  const handleBack = useCallback(() => {
    navigate(`/courses/${courseId}/lessons/${lessonId}/quiz/results`)
  }, [courseId, lessonId, navigate])

  return (
    <div className="py-6">
      <section
        aria-label="Quiz review"
        className="bg-card rounded-2xl p-4 sm:p-8 max-w-2xl mx-auto shadow-sm space-y-6"
      >
        {/* Header */}
        <section aria-label="Review progress">
          <h1 className="text-2xl font-bold text-foreground">{quiz.title} — Review</h1>
          <div className="flex items-center gap-3 mt-2">
            <Progress value={progressPct} className="flex-1 h-2" aria-hidden="true" />
            <p className="text-sm text-muted-foreground whitespace-nowrap">
              Question {currentIndex + 1} of {questions.length}
            </p>
          </div>
          {/* sr-only progressbar with question-count values for screen readers */}
          <div
            role="progressbar"
            aria-label="Question progress"
            aria-valuenow={currentIndex + 1}
            aria-valuemin={1}
            aria-valuemax={questions.length}
            aria-valuetext={`Question ${currentIndex + 1} of ${questions.length}`}
            className="sr-only"
          />
        </section>

        {/* Question (read-only) */}
        <section aria-label="Question review">
          <QuestionDisplay
            question={currentQuestion}
            value={userAnswer}
            onChange={noop}
            mode={mode}
          />

          {/* Explanation / feedback */}
          <AnswerFeedback question={currentQuestion} userAnswer={userAnswer} />

          {/* Question quality feedback (thumbs up/down) */}
          <QuestionFeedback
            feedback={feedbackMap[currentQuestion.id] ?? null}
            onFeedback={value => handleFeedback(currentQuestion.id, value)}
          />
        </section>

        {/* Navigation */}
        <nav aria-label="Review navigation" className="flex gap-3">
          <Button
            variant="outline"
            disabled={isFirst}
            onClick={() => setCurrentIndex(i => i - 1)}
            className="rounded-xl min-h-[44px]"
            aria-label="Previous question"
          >
            Previous
          </Button>
          {!isLast ? (
            <Button
              variant="outline"
              onClick={() => setCurrentIndex(i => i + 1)}
              className="rounded-xl min-h-[44px]"
              aria-label="Next question"
            >
              Next
            </Button>
          ) : (
            <Button variant="brand" onClick={handleBack} className="rounded-xl min-h-[44px]">
              Back to Results
            </Button>
          )}
        </nav>

        {/* Question jump grid */}
        <ReviewQuestionGrid
          questions={questions}
          answers={attempt.answers}
          currentIndex={currentIndex}
          onQuestionClick={setCurrentIndex}
        />

        {/* Always-visible back link */}
        <Link
          to={`/courses/${courseId}/lessons/${lessonId}/quiz/results`}
          className="text-brand hover:underline text-sm font-medium inline-flex items-center gap-1 min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:rounded-sm"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to Results
        </Link>
      </section>
    </div>
  )
}
