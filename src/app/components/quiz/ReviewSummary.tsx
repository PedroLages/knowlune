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
    <div className="mt-3" aria-label="Questions marked for review">
      <p className="text-sm font-medium mb-1.5">
        {markedForReview.length} {markedForReview.length === 1 ? 'question' : 'questions'} marked
        for review:
      </p>
      <ul className="flex flex-wrap gap-2" role="list">
        {markedIndices.map(i => (
          <li key={i}>
            <button
              onClick={() => onJumpToQuestion(i)}
              className="text-sm text-brand hover:underline underline-offset-2 min-h-[44px] px-2"
            >
              Q{i + 1}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
