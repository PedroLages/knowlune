interface ReviewSummaryProps {
  markedForReview: string[]
  questionOrder: string[]
  onJumpToQuestion: (index: number) => void
}

export function ReviewSummary({
  markedForReview,
  questionOrder,
  onJumpToQuestion,
}: ReviewSummaryProps) {
  if (markedForReview.length === 0) return null

  const markedIndices = markedForReview
    .map(id => questionOrder.indexOf(id))
    .filter(i => i !== -1)
    .sort((a, b) => a - b)

  return (
    <div className="mt-3" role="group" aria-label="Questions marked for review">
      <p className="text-sm font-medium mb-1.5">
        {markedIndices.length} {markedIndices.length === 1 ? 'question' : 'questions'} marked for
        review:
      </p>
      <ul className="flex flex-wrap gap-2" role="list">
        {markedIndices.map(i => (
          <li key={i}>
            <button
              onClick={() => onJumpToQuestion(i)}
              aria-label={`Jump to question ${i + 1}`}
              className="text-sm text-brand hover:underline hover:bg-brand-soft underline-offset-2 min-h-[44px] min-w-[44px] px-2 rounded-lg"
            >
              Q{i + 1}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
