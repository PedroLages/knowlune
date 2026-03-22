import { useEffect, useRef, useState } from 'react'
import { Clock } from 'lucide-react'
import type { Quiz, QuizProgress, TimerAccommodation } from '@/types/quiz'
import { Button } from '@/app/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/app/components/ui/alert-dialog'
import { TimerAccommodationsModal } from '@/app/components/quiz/TimerAccommodationsModal'

interface QuizStartScreenProps {
  quiz: Quiz
  /** Saved in-progress state from localStorage, or null if not started */
  savedProgress: QuizProgress | null
  /** Whether the user has completed this quiz at least once before */
  hasCompletedBefore?: boolean
  /** Currently selected timer accommodation */
  accommodation: TimerAccommodation
  onStart: () => void
  onResume: () => void
  onAccommodationChange: (accommodation: TimerAccommodation) => void
}

/** Format the adjusted time for the time limit badge */
function formatTimeBadge(baseMinutes: number, accommodation: TimerAccommodation): string {
  if (accommodation === 'untimed') return 'Untimed'
  const multiplier = accommodation === '150%' ? 1.5 : accommodation === '200%' ? 2 : 1
  const adjusted = baseMinutes * multiplier
  const whole = Math.floor(adjusted)
  const seconds = Math.round((adjusted - whole) * 60)
  if (seconds === 0) return `${whole} min`
  return `${whole} min ${seconds} sec`
}

export function QuizStartScreen({
  quiz,
  savedProgress,
  hasCompletedBefore,
  accommodation,
  onStart,
  onResume,
  onAccommodationChange,
}: QuizStartScreenProps) {
  const answeredCount = savedProgress ? Object.keys(savedProgress.answers).length : 0
  const hasResume = answeredCount > 0
  const questionCount = quiz.questions.length
  const questionLabel = questionCount === 1 ? 'question' : 'questions'
  const resumeBtnRef = useRef<HTMLButtonElement>(null)
  const [modalOpen, setModalOpen] = useState(false)

  const hasTimed = quiz.timeLimit != null
  const isAdjusted = accommodation !== 'standard'

  // Deferred focus — gives assistive technology time to announce the page
  // before moving focus to the resume button
  useEffect(() => {
    if (hasResume) {
      const id = requestAnimationFrame(() => resumeBtnRef.current?.focus())
      return () => cancelAnimationFrame(id)
    }
  }, [hasResume])

  return (
    <div className="bg-card rounded-[24px] p-4 sm:p-8 max-w-2xl mx-auto shadow-sm">
      <h1 className="text-2xl font-semibold">{quiz.title}</h1>
      {quiz.description && (
        <p className="text-base text-muted-foreground mt-2">{quiz.description}</p>
      )}

      {/* Metadata badges */}
      <div className="flex flex-wrap gap-2 mt-6" aria-label="Quiz details" role="group">
        <span className="bg-brand-soft text-brand rounded-full px-3 py-1 text-sm">
          {questionCount} {questionLabel}
        </span>
        <span
          className={
            isAdjusted
              ? 'bg-brand-soft text-brand-soft-foreground rounded-full px-3 py-1 text-sm'
              : 'bg-muted text-muted-foreground rounded-full px-3 py-1 text-sm'
          }
        >
          {hasTimed ? formatTimeBadge(quiz.timeLimit!, accommodation) : 'Untimed'}
        </span>
        <span className="bg-muted text-muted-foreground rounded-full px-3 py-1 text-sm">
          {quiz.passingScore}% to pass
        </span>
      </div>

      {/* Accessibility accommodations link — only for timed quizzes */}
      {hasTimed && (
        <Button
          type="button"
          variant="link"
          size="sm"
          className="mt-3 text-brand-soft-foreground p-0 h-auto"
          onClick={() => setModalOpen(true)}
        >
          <Clock className="size-4 mr-1" aria-hidden="true" />
          Accessibility Accommodations
        </Button>
      )}

      {hasTimed && (
        <TimerAccommodationsModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          baseTimeMinutes={quiz.timeLimit!}
          value={accommodation}
          onSave={onAccommodationChange}
        />
      )}

      {/* Screen reader announcement for saved progress */}
      {hasResume && (
        <div className="sr-only" aria-live="polite">
          Saved progress found: {answeredCount} of {questionCount} answered. Resume button
          available.
        </div>
      )}

      {/* CTA area */}
      <div className="mt-8 flex flex-col sm:flex-row gap-3">
        {hasResume ? (
          <>
            <Button
              ref={resumeBtnRef}
              type="button"
              onClick={onResume}
              variant="brand"
              className="rounded-xl h-12 px-8 w-full sm:w-auto"
            >
              Resume Quiz ({answeredCount} of {questionCount} answered)
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl h-12 px-8 w-full sm:w-auto"
                >
                  Start Over
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Start over?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Your saved progress ({answeredCount} of {questionCount} answered) will be
                    discarded. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep progress</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={onStart}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Start over
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        ) : (
          <Button
            type="button"
            onClick={onStart}
            variant="brand"
            className="rounded-xl h-12 px-8 w-full sm:w-auto"
          >
            {hasCompletedBefore ? 'Retake Quiz' : 'Start Quiz'}
          </Button>
        )}
      </div>
    </div>
  )
}
