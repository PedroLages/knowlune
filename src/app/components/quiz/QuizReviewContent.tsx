import { useState, useCallback } from 'react'
import { useNavigate, Link } from 'react-router'
import { ArrowLeft } from 'lucide-react'
import type { Quiz, QuizAttempt } from '@/types/quiz'
import type { QuestionDisplayMode } from '@/app/components/quiz/QuestionDisplay'
import { QuestionDisplay } from '@/app/components/quiz/QuestionDisplay'
import { AnswerFeedback } from '@/app/components/quiz/AnswerFeedback'
import { ReviewQuestionGrid } from '@/app/components/quiz/ReviewQuestionGrid'
import { Button } from '@/app/components/ui/button'
import { Progress } from '@/app/components/ui/progress'

interface QuizReviewContentProps {
  quiz: Quiz
  attempt: QuizAttempt
  courseId: string
  lessonId: string
}

const noop = () => {}

export function QuizReviewContent({ quiz, attempt, courseId, lessonId }: QuizReviewContentProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const navigate = useNavigate()

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

  const handleBack = useCallback(() => {
    navigate(`/courses/${courseId}/lessons/${lessonId}/quiz/results`)
  }, [courseId, lessonId, navigate])

  return (
    <div className="py-6">
      <div className="bg-card rounded-[24px] p-4 sm:p-8 max-w-2xl mx-auto shadow-sm space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">{quiz.title} — Review</h1>
          <div className="flex items-center gap-3">
            <Progress value={progressPct} className="flex-1 h-2" aria-hidden="true" />
            <p className="text-sm text-muted-foreground whitespace-nowrap">
              Question {currentIndex + 1} of {questions.length}
            </p>
          </div>
        </div>

        {/* Question (read-only) */}
        <QuestionDisplay
          question={currentQuestion}
          value={userAnswer}
          onChange={noop}
          mode={mode}
        />

        {/* Explanation / feedback */}
        <AnswerFeedback question={currentQuestion} userAnswer={userAnswer} />

        {/* Navigation */}
        <nav aria-label="Review navigation" className="flex gap-3">
          <Button
            variant="outline"
            disabled={isFirst}
            onClick={() => setCurrentIndex(i => i - 1)}
            className="rounded-xl min-h-[44px]"
          >
            Previous
          </Button>
          {!isLast ? (
            <Button
              variant="outline"
              onClick={() => setCurrentIndex(i => i + 1)}
              className="rounded-xl min-h-[44px]"
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
          className="text-brand hover:underline text-sm font-medium inline-flex items-center gap-1 min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:rounded-sm"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to Results
        </Link>
      </div>
    </div>
  )
}
