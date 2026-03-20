import type { Quiz, QuizProgress } from '@/types/quiz'
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

interface QuizStartScreenProps {
  quiz: Quiz
  /** Saved in-progress state from localStorage, or null if not started */
  savedProgress: QuizProgress | null
  onStart: () => void
  onResume: () => void
}

export function QuizStartScreen({ quiz, savedProgress, onStart, onResume }: QuizStartScreenProps) {
  const answeredCount = savedProgress ? Object.keys(savedProgress.answers).length : 0
  const hasResume = answeredCount > 0
  const questionCount = quiz.questions.length
  const questionLabel = questionCount === 1 ? 'question' : 'questions'

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
        <span className="bg-muted text-muted-foreground rounded-full px-3 py-1 text-sm">
          {quiz.timeLimit != null ? `${quiz.timeLimit} min` : 'Untimed'}
        </span>
        <span className="bg-muted text-muted-foreground rounded-full px-3 py-1 text-sm">
          {quiz.passingScore}% to pass
        </span>
      </div>

      {/* CTA area */}
      <div className="mt-8 flex flex-col sm:flex-row gap-3">
        {hasResume ? (
          <>
            <Button
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
            Start Quiz
          </Button>
        )}
      </div>
    </div>
  )
}
