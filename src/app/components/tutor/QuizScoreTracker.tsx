/**
 * QuizScoreTracker (E73-S03)
 *
 * Sticky badge showing running quiz score during Quiz Me sessions.
 * Appears after first Q&A exchange, disappears when mode switches away.
 */

import { useEffect, useRef, useState } from 'react'
import { Check, X } from 'lucide-react'

interface QuizScoreTrackerProps {
  /** Number of correct answers */
  correct: number
  /** Total questions answered */
  total: number
  /** Whether the last answer was correct (null if no answers yet) */
  lastAnswerCorrect: boolean | null
}

/**
 * Sticky score badge with pulse animation on score changes.
 * Uses role="status" and aria-live="polite" for screen reader announcements.
 */
export function QuizScoreTracker({
  correct,
  total,
  lastAnswerCorrect,
}: QuizScoreTrackerProps) {
  const [isPulsing, setIsPulsing] = useState(false)
  const prevTotalRef = useRef(total)

  // Trigger pulse animation on score change
  useEffect(() => {
    if (total !== prevTotalRef.current && total > 0) {
      setIsPulsing(true)
      const timer = setTimeout(() => setIsPulsing(false), 200)
      prevTotalRef.current = total
      return () => clearTimeout(timer)
    }
    prevTotalRef.current = total
  }, [total])

  if (total === 0) return null

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`Quiz score: ${correct} out of ${total} correct`}
      className={`ml-auto w-fit bg-card border border-border rounded-xl shadow-sm px-3 py-1.5 flex items-center gap-2 text-sm font-medium transition-transform duration-200 ${
        isPulsing ? 'motion-safe:scale-105' : ''
      }`}
      data-testid="quiz-score-tracker"
    >
      <span className="text-foreground">
        Score: {correct}/{total}
      </span>
      {lastAnswerCorrect !== null && (
        <span
          className={`flex items-center ${
            lastAnswerCorrect ? 'text-success' : 'text-destructive'
          }`}
          aria-hidden="true"
        >
          {lastAnswerCorrect ? (
            <Check className="size-4" />
          ) : (
            <X className="size-4" />
          )}
        </span>
      )}
    </div>
  )
}
