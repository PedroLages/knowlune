import { Button } from '@/app/components/ui/button'
import { cn } from '@/app/components/ui/utils'
import type { ReviewRating } from '@/data/types'

interface RatingButtonsProps {
  onRate: (rating: ReviewRating) => void
  disabled?: boolean
}

const RATINGS: {
  rating: ReviewRating
  label: string
  shortcut: string
  ariaLabel: string
  classes: string
}[] = [
  {
    rating: 'again',
    label: 'Again',
    shortcut: '1',
    ariaLabel: 'Rate as Again — reset review interval',
    classes: 'bg-warning/10 text-warning hover:bg-warning/20 border-warning/20',
  },
  {
    rating: 'hard',
    label: 'Hard',
    shortcut: '2',
    ariaLabel: 'Rate as Hard — shorter review interval',
    classes: 'bg-destructive/10 text-destructive hover:bg-destructive/20 border-destructive/20',
  },
  {
    rating: 'good',
    label: 'Good',
    shortcut: '3',
    ariaLabel: 'Rate as Good — moderate review interval',
    classes: 'bg-brand-soft text-brand hover:bg-brand-muted border-brand/20',
  },
  {
    rating: 'easy',
    label: 'Easy',
    shortcut: '4',
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
      {RATINGS.map(({ rating, label, shortcut, ariaLabel, classes }) => (
        <Button
          key={rating}
          variant="outline"
          size="default"
          aria-label={`${ariaLabel} (${shortcut})`}
          disabled={disabled}
          className={cn(
            'flex-1 border font-medium transition-all duration-150 motion-safe:hover:scale-[1.02]',
            classes
          )}
          onClick={() => onRate(rating)}
        >
          <span className="flex items-center gap-1.5">
            {label}
            <kbd className="hidden rounded border border-current/20 px-1 py-0.5 text-[10px] font-normal opacity-60 sm:inline-block">
              {shortcut}
            </kbd>
          </span>
        </Button>
      ))}
    </div>
  )
}
