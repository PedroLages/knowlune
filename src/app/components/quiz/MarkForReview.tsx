import { Bookmark } from 'lucide-react'
import { Checkbox } from '@/app/components/ui/checkbox'
import { Label } from '@/app/components/ui/label'

interface MarkForReviewProps {
  questionId: string
  isMarked: boolean
  onToggle: () => void
}

export function MarkForReview({ questionId, isMarked, onToggle }: MarkForReviewProps) {
  const id = `mark-review-${questionId}`
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
        className="text-sm text-muted-foreground cursor-pointer flex items-center gap-1.5 select-none"
      >
        <Bookmark className="size-3.5" aria-hidden="true" />
        Mark for Review
      </Label>
    </div>
  )
}
