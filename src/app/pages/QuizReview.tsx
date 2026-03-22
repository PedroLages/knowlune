import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router'
import { AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import type { Quiz, QuizAttempt } from '@/types/quiz'
import { db } from '@/db'
import { Skeleton } from '@/app/components/ui/skeleton'
import { QuizReviewContent } from '@/app/components/quiz/QuizReviewContent'

function QuizReviewSkeleton() {
  return (
    <div className="py-6">
      <div
        role="status"
        aria-busy="true"
        aria-label="Loading quiz review"
        className="bg-card rounded-[24px] p-4 sm:p-8 max-w-2xl mx-auto shadow-sm space-y-4"
      >
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-2 w-full" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <div className="space-y-3">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  )
}

interface QuizReviewErrorProps {
  courseId: string | undefined
  lessonId: string | undefined
}

function QuizReviewError({ courseId, lessonId }: QuizReviewErrorProps) {
  const backUrl =
    courseId && lessonId
      ? `/courses/${courseId}/lessons/${lessonId}/quiz`
      : '/courses'

  return (
    <div className="py-6">
      <div className="bg-card rounded-[24px] p-8 max-w-2xl mx-auto shadow-sm text-center space-y-4">
        <AlertCircle className="size-12 text-warning mx-auto" aria-hidden="true" />
        <h1 className="text-2xl font-bold text-foreground">Quiz attempt not found</h1>
        <p className="text-muted-foreground">
          The quiz attempt you are looking for does not exist or may have been deleted.
        </p>
        <Link
          to={backUrl}
          className="text-brand hover:underline text-sm font-medium inline-flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:rounded-sm"
        >
          ← Back to Quiz
        </Link>
      </div>
    </div>
  )
}

export function QuizReview() {
  const { courseId, lessonId, attemptId } = useParams<{
    courseId: string
    lessonId: string
    attemptId: string
  }>()

  const [attempt, setAttempt] = useState<QuizAttempt | null>(null)
  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [status, setStatus] = useState<'loading' | 'error' | 'ready'>('loading')

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const a = await db.quizAttempts.get(attemptId!)
        if (!a) {
          if (!cancelled) setStatus('error')
          return
        }
        const q = await db.quizzes.get(a.quizId)
        if (!q) {
          if (!cancelled) setStatus('error')
          return
        }
        if (!cancelled) {
          setAttempt(a)
          setQuiz(q)
          setStatus('ready')
        }
      } catch (err: unknown) {
        console.error('[QuizReview] Failed to load attempt:', err)
        if (!cancelled) {
          toast.error('Could not load quiz review. Please try again.')
          setStatus('error')
        }
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [attemptId])

  if (status === 'loading') return <QuizReviewSkeleton />
  if (status === 'error') return <QuizReviewError courseId={courseId} lessonId={lessonId} />

  return (
    <QuizReviewContent
      quiz={quiz!}
      attempt={attempt!}
      courseId={courseId!}
      lessonId={lessonId!}
    />
  )
}
