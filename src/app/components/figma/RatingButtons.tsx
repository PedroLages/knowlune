import { Button } from '@/app/components/ui/button'
import type { ReviewRating } from '@/data/types'

interface RatingButtonsProps {
  onRate: (rating: ReviewRating) => void
  disabled?: boolean
}

const RATINGS: { rating: ReviewRating; label: string; ariaLabel: string; classes: string }[] = [
  {
    rating: 'hard',
    label: 'Hard',
    ariaLabel: 'Rate as Hard — shorter review interval',
    classes: 'bg-destructive/10 text-destructive hover:bg-destructive/20 border-destructive/20',
  },
  {
    rating: 'good',
    label: 'Good',
    ariaLabel: 'Rate as Good — moderate review interval',
    classes: 'bg-brand-soft text-brand hover:bg-brand-muted border-brand/20',
  },
  {
    rating: 'easy',
    label: 'Easy',
    ariaLabel: 'Rate as Easy — longer review interval',
    classes: 'bg-success-soft text-success hover:bg-success/20 border-success/20',
  },
]

export function RatingButtons({ onRate, disabled }: RatingButtonsProps) {
  return (
    <div
      data-testid="rating-buttons"
      role="group"
      aria-label="Rate your recall"
      className="flex gap-2"
    >
      {RATINGS.map(({ rating, label, ariaLabel, classes }) => (
        <Button
          key={rating}
          variant="outline"
          size="sm"
          aria-label={ariaLabel}
          disabled={disabled}
          className={`flex-1 border font-medium transition-all duration-150 hover:scale-[1.02] ${classes}`}
          onClick={() => onRate(rating)}
        >
          {label}
        </Button>
      ))}
    </div>
  )
}
