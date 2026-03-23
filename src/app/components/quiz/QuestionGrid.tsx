import { useState, useEffect, useRef } from 'react'
import { cn } from '@/app/components/ui/utils'

interface QuestionGridProps {
  total: number
  answers: Record<string, string | string[]>
  questionOrder: string[]
  currentIndex: number
  markedForReview: string[]
  onQuestionClick: (index: number) => void
}

export function QuestionGrid({
  total,
  answers,
  questionOrder,
  currentIndex,
  markedForReview,
  onQuestionClick,
}: QuestionGridProps) {
  // Roving tabindex: only the focused button is in Tab order (tabIndex=0).
  // Arrow Left/Right move focus within the grid without Tab.
  const [focusedIndex, setFocusedIndex] = useState(currentIndex)
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([])

  // Sync focused index when the current question changes via external navigation
  // (Next button, question answer auto-advance, etc.)
  useEffect(() => {
    setFocusedIndex(currentIndex)
  }, [currentIndex])

  function handleKeyDown(e: React.KeyboardEvent) {
    let nextIndex = focusedIndex
    switch (e.key) {
      case 'ArrowRight':
        nextIndex = (focusedIndex + 1) % total
        break
      case 'ArrowLeft':
        nextIndex = (focusedIndex - 1 + total) % total
        break
      case 'Home':
        nextIndex = 0
        break
      case 'End':
        nextIndex = total - 1
        break
      case 'Enter':
        onQuestionClick(focusedIndex)
        return
      default:
        return
    }
    e.preventDefault()
    setFocusedIndex(nextIndex)
    buttonRefs.current[nextIndex]?.focus()
  }

  return (
    <div
      role="toolbar"
      aria-label="Question grid"
      className="flex flex-wrap gap-2"
      onKeyDown={handleKeyDown}
    >
      {Array.from({ length: total }, (_, i) => {
        const questionId = questionOrder[i]
        const answer = questionId ? answers[questionId] : undefined
        const isAnswered = Array.isArray(answer)
          ? answer.length > 0
          : answer !== undefined && answer !== ''
        const isCurrent = i === currentIndex
        const isMarked = questionId ? markedForReview.includes(questionId) : false

        return (
          <button
            key={i}
            ref={el => {
              buttonRefs.current[i] = el
            }}
            onClick={() => onQuestionClick(i)}
            // Roving tabindex: only the focused item is in the Tab sequence
            tabIndex={i === focusedIndex ? 0 : -1}
            onFocus={() => setFocusedIndex(i)}
            aria-label={`Question ${i + 1}${isMarked ? ', marked for review' : ''}`}
            aria-current={isCurrent ? 'step' : undefined}
            className={cn(
              'relative flex items-center justify-center size-11 rounded-full text-sm font-medium',
              'hover:opacity-80 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring',
              isCurrent
                ? 'bg-brand text-brand-foreground'
                : isAnswered
                  ? 'bg-brand-soft text-brand border border-brand'
                  : 'bg-card text-muted-foreground border border-border'
            )}
          >
            {i + 1}
            {isMarked && (
              <span className="absolute -top-1 -right-1" aria-hidden="true">
                <span className="size-3 rounded-full bg-warning" />
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
