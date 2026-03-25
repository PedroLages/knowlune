import { useEffect, useRef, useState } from 'react'
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
  // Roving tabindex: track which button is the tab stop (entry point)
  const [focusedIndex, setFocusedIndex] = useState(currentIndex)
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([])

  // Keep entry point in sync when user navigates via other means (grid click, Next button)
  useEffect(() => {
    setFocusedIndex(currentIndex)
  }, [currentIndex])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (total === 0) return
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
        nextIndex = Math.max(0, total - 1)
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
            tabIndex={i === focusedIndex ? 0 : -1}
            onClick={() => onQuestionClick(i)}
            onFocus={() => setFocusedIndex(i)}
            aria-label={`Question ${i + 1}${isMarked ? ', marked for review' : ''}`}
            aria-current={isCurrent ? 'step' : undefined}
            className={cn(
              'relative flex items-center justify-center size-11 rounded-full text-sm font-medium',
              'hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              isCurrent
                ? 'bg-brand text-brand-foreground dark:focus-visible:ring-white'
                : isAnswered
                  ? 'bg-brand-soft text-brand-soft-foreground border border-brand dark:focus-visible:ring-white'
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
