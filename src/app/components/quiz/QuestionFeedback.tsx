/**
 * QuestionFeedback — Thumbs up/down feedback buttons for quiz questions.
 *
 * Allows learners to rate individual question quality. Feedback is stored
 * locally in Dexie via the quiz data.
 *
 * @see E52-S03 Quiz Quality & Feedback (AC: 5)
 */

import { useState, useCallback } from 'react'
import { ThumbsUp, ThumbsDown } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { cn } from '@/app/components/ui/utils'

export type FeedbackValue = 'up' | 'down' | null

interface QuestionFeedbackProps {
  /** Current feedback value (null = no feedback given) */
  feedback: FeedbackValue
  /** Callback when user clicks a feedback button */
  onFeedback: (value: 'up' | 'down') => void
  /** Whether buttons are disabled (e.g. during submission) */
  disabled?: boolean
}

export function QuestionFeedback({
  feedback,
  onFeedback,
  disabled = false,
}: QuestionFeedbackProps) {
  const [optimistic, setOptimistic] = useState<FeedbackValue>(feedback)

  // Sync prop changes (e.g. navigating between questions)
  const currentFeedback = feedback ?? optimistic

  const handleClick = useCallback(
    (value: 'up' | 'down') => {
      if (disabled || currentFeedback !== null) return
      setOptimistic(value)
      onFeedback(value)
    },
    [disabled, currentFeedback, onFeedback]
  )

  return (
    <div
      className="flex items-center gap-2 mt-3"
      data-testid="question-feedback"
      role="group"
      aria-label="Rate this question"
    >
      <span className="text-xs text-muted-foreground">Rate this question:</span>
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          'h-8 w-8 p-0 rounded-lg',
          currentFeedback === 'up' && 'text-success bg-success/10'
        )}
        disabled={disabled || (currentFeedback !== null && currentFeedback !== 'up')}
        aria-label="Thumbs up"
        aria-pressed={currentFeedback === 'up'}
        onClick={() => handleClick('up')}
        data-testid="feedback-thumbs-up"
      >
        <ThumbsUp
          className={cn('size-4', currentFeedback === 'up' && 'fill-current')}
          aria-hidden="true"
        />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          'h-8 w-8 p-0 rounded-lg',
          currentFeedback === 'down' && 'text-destructive bg-destructive/10'
        )}
        disabled={disabled || (currentFeedback !== null && currentFeedback !== 'down')}
        aria-label="Thumbs down"
        aria-pressed={currentFeedback === 'down'}
        onClick={() => handleClick('down')}
        data-testid="feedback-thumbs-down"
      >
        <ThumbsDown
          className={cn('size-4', currentFeedback === 'down' && 'fill-current')}
          aria-hidden="true"
        />
      </Button>
      {currentFeedback && (
        <span className="text-xs text-muted-foreground" aria-live="polite">
          Thanks for your feedback!
        </span>
      )}
    </div>
  )
}
