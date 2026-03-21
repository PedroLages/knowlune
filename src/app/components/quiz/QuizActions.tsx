import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/app/components/ui/button'

interface QuizActionsProps {
  onPrevious: () => void
  onNext: () => void
  onSubmit: () => void
  isFirst: boolean
  isLast: boolean
  isSubmitting?: boolean
}

export function QuizActions({
  onPrevious,
  onNext,
  onSubmit,
  isFirst,
  isLast,
  isSubmitting,
}: QuizActionsProps) {
  return (
    <div role="group" aria-label="Quiz controls" className="flex gap-3 items-center">
      <Button
        variant="outline"
        className="rounded-xl min-h-[44px]"
        disabled={isFirst}
        onClick={onPrevious}
      >
        <ChevronLeft className="size-4 mr-1" aria-hidden="true" />
        Previous
      </Button>

      {!isLast && (
        <Button variant="outline" className="rounded-xl min-h-[44px]" onClick={onNext}>
          Next
          <ChevronRight className="size-4 ml-1" aria-hidden="true" />
        </Button>
      )}

      {isLast && (
        <Button
          variant="brand"
          className="rounded-xl min-h-[44px]"
          aria-label={
            isSubmitting ? 'Submitting quiz…' : 'Submit Quiz — ends the quiz and shows your results'
          }
          onClick={onSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Submitting…' : 'Submit Quiz'}
        </Button>
      )}
    </div>
  )
}
