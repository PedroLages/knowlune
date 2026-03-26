import { useEffect, useRef } from 'react'
import { Bookmark } from 'lucide-react'
import { Checkbox } from '@/app/components/ui/checkbox'
import { Label } from '@/app/components/ui/label'
import { useAriaLiveAnnouncer } from '@/hooks/useAriaLiveAnnouncer'

interface MarkForReviewProps {
  questionId: string
  isMarked: boolean
  onToggle: () => void
}

export function MarkForReview({ questionId, isMarked, onToggle }: MarkForReviewProps) {
  const id = `mark-review-${questionId}`
  const [reviewAnnouncement, announceReview] = useAriaLiveAnnouncer()
  const isFirstRender = useRef(true)

  // Announce mark-for-review state changes to screen readers (AC3)
  useEffect(() => {
    // Skip the initial render — only announce user-initiated changes
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    announceReview(isMarked ? 'Marked for review' : 'Removed from review')
  }, [isMarked, announceReview])

  return (
    <div className="flex items-center gap-2 mt-4 min-h-[44px]">
      <Checkbox
        id={id}
        checked={isMarked}
        onCheckedChange={() => onToggle()}
        aria-labelledby={`${id}-label`}
      />
      <Label
        id={`${id}-label`}
        htmlFor={id}
        className="text-sm text-muted-foreground cursor-pointer flex items-center gap-1.5 select-none min-h-[44px] min-w-[44px]"
      >
        <Bookmark className="size-3.5" aria-hidden="true" />
        Mark for Review
      </Label>
      {/* Screen-reader-only: announces review toggle state changes */}
      <span aria-live="polite" aria-atomic="true" className="sr-only" data-testid="review-announcement">
        {reviewAnnouncement}
      </span>
    </div>
  )
}
