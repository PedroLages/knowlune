import { X, CheckCircle2 } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { cn } from '@/app/components/ui/utils'
import type { VocabularyItem } from '@/data/types'

export function ReviewCard({
  item,
  flipped,
  onFlip,
  onCorrect,
  onIncorrect,
}: {
  item: VocabularyItem
  flipped: boolean
  onFlip: () => void
  onCorrect: () => void
  onIncorrect: () => void
}) {
  return (
    <div className="flex flex-col items-center gap-6" data-testid="review-card">
      <button
        type="button"
        className={cn(
          'w-full max-w-md min-h-[200px] rounded-2xl border-2 border-border',
          'bg-card p-8 text-center transition-all duration-300 cursor-pointer',
          'hover:border-brand/50 hover:shadow-md',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring'
        )}
        onClick={onFlip}
        aria-label={
          flipped
            ? 'Showing definition — click to show word'
            : 'Showing word — click to reveal definition'
        }
        data-testid="review-flip-card"
      >
        {!flipped ? (
          <div className="flex flex-col items-center gap-3">
            <span className="text-2xl font-bold text-foreground break-words [overflow-wrap:anywhere]">
              {item.word}
            </span>
            {item.context && (
              <p className="text-sm text-muted-foreground italic max-w-xs break-words [overflow-wrap:anywhere] line-clamp-4">
                &ldquo;...{item.context}...&rdquo;
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-2">Tap to reveal</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <span className="text-lg font-semibold text-foreground break-words [overflow-wrap:anywhere] line-clamp-2">
              {item.word}
            </span>
            <div className="h-px w-16 bg-border" />
            <p className="text-base text-muted-foreground break-words [overflow-wrap:anywhere]">
              {item.definition || 'No definition added yet'}
            </p>
            {item.note && (
              <p className="text-sm text-muted-foreground/70 italic mt-1 break-words [overflow-wrap:anywhere] line-clamp-6">
                {item.note}
              </p>
            )}
          </div>
        )}
      </button>

      {flipped && (
        <div className="flex gap-3" data-testid="review-actions">
          <Button
            variant="outline"
            className="text-destructive border-destructive/30 hover:bg-destructive/10"
            onClick={onIncorrect}
            aria-label="Mark as incorrect"
          >
            <X className="size-4 mr-1.5" />
            Again
          </Button>
          <Button variant="brand" onClick={onCorrect} aria-label="Mark as correct">
            <CheckCircle2 className="size-4 mr-1.5" />
            Got it
          </Button>
        </div>
      )}
    </div>
  )
}
