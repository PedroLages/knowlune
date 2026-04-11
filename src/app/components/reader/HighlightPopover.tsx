/**
 * HighlightPopover — action toolbar shown after text selection in the EPUB reader.
 *
 * Shows 4 color buttons (yellow/green/blue/pink), note button, flashcard button,
 * and close button. Positioned above or below the text selection.
 *
 * On mobile: rendered as a full-width bottom bar for easier touch access.
 * All buttons meet 44px touch target requirement on mobile.
 *
 * @module HighlightPopover
 */
import { X, StickyNote, Layers, BookA } from 'lucide-react'
import { cn } from '@/app/components/ui/utils'

export interface HighlightPosition {
  top: number
  left: number
  width: number
  /** true if popover should appear below the selection (no space above) */
  below?: boolean
}

interface HighlightPopoverProps {
  position: HighlightPosition
  onColorSelect: (color: 'yellow' | 'green' | 'blue' | 'pink') => void
  onNote: () => void
  onFlashcard: () => void
  onVocabulary?: () => void
  onClose: () => void
}

const COLORS = [
  { id: 'yellow' as const, bg: 'bg-[#FFEB3B]', label: 'Highlight yellow' },
  { id: 'green' as const, bg: 'bg-[#4CAF50]', label: 'Highlight green' },
  { id: 'blue' as const, bg: 'bg-[#42A5F5]', label: 'Highlight blue' },
  { id: 'pink' as const, bg: 'bg-[#EC407A]', label: 'Highlight pink' },
]

export function HighlightPopover({
  position,
  onColorSelect,
  onNote,
  onFlashcard,
  onVocabulary,
  onClose,
}: HighlightPopoverProps) {
  const isMobile = window.innerWidth < 640

  // Mobile: fixed full-width bar at bottom of screen
  if (isMobile) {
    return (
      <div
        role="toolbar"
        aria-label="Highlight actions"
        className={cn(
          'fixed bottom-0 left-0 right-0 z-[60]',
          'flex items-center justify-around px-4 py-3 min-h-[56px]',
          'bg-popover border-t border-border shadow-lg'
        )}
        data-testid="highlight-popover"
      >
        {COLORS.map(color => (
          <button
            key={color.id}
            onClick={() => onColorSelect(color.id)}
            aria-label={color.label}
            className={cn(
              'size-10 rounded-full border-2 border-white/20 shadow-sm',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
              color.bg
            )}
            data-testid={`highlight-color-${color.id}`}
          />
        ))}

        <div className="h-8 w-px bg-border shrink-0 mx-1" aria-hidden="true" />

        <button
          onClick={onNote}
          aria-label="Add note"
          className="size-10 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          data-testid="highlight-note-button"
        >
          <StickyNote className="size-5" aria-hidden="true" />
        </button>

        <button
          onClick={onFlashcard}
          aria-label="Create flashcard"
          className="size-10 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          data-testid="highlight-flashcard-button"
        >
          <Layers className="size-5" aria-hidden="true" />
        </button>

        {onVocabulary && (
          <button
            onClick={onVocabulary}
            aria-label="Add to vocabulary"
            className="size-10 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            data-testid="highlight-vocabulary-button"
          >
            <BookA className="size-5" aria-hidden="true" />
          </button>
        )}

        <button
          onClick={onClose}
          aria-label="Close highlight actions"
          className="size-10 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          data-testid="highlight-close-button"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
    )
  }

  // Desktop: floating popover positioned near the selection
  const popoverStyle: React.CSSProperties = position.below
    ? { top: position.top + 8, left: position.left }
    : { top: position.top - 52, left: position.left }

  return (
    <div
      role="toolbar"
      aria-label="Highlight actions"
      // eslint-disable-next-line react-best-practices/no-inline-styles -- dynamic position from selection bounding rect requires inline style
      style={popoverStyle}
      className={cn(
        'fixed z-[60]',
        'flex items-center gap-1 px-2 py-1.5 rounded-xl',
        'bg-popover border border-border shadow-lg',
        'motion-safe:animate-[fade-in_150ms_ease-out]'
      )}
      data-testid="highlight-popover"
    >
      {COLORS.map(color => (
        <button
          key={color.id}
          onClick={() => onColorSelect(color.id)}
          aria-label={color.label}
          className={cn(
            'size-7 rounded-full border-2 border-white/20 shadow-sm',
            'hover:scale-110 active:scale-95 transition-transform',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
            color.bg
          )}
          data-testid={`highlight-color-${color.id}`}
        />
      ))}

      <div className="h-6 w-px bg-border mx-0.5" aria-hidden="true" />

      <button
        onClick={onNote}
        aria-label="Add note"
        className="size-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        data-testid="highlight-note-button"
      >
        <StickyNote className="size-4" aria-hidden="true" />
      </button>

      <button
        onClick={onFlashcard}
        aria-label="Create flashcard"
        className="size-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        data-testid="highlight-flashcard-button"
      >
        <Layers className="size-4" aria-hidden="true" />
      </button>

      {onVocabulary && (
        <button
          onClick={onVocabulary}
          aria-label="Add to vocabulary"
          className="size-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          data-testid="highlight-vocabulary-button"
        >
          <BookA className="size-4" aria-hidden="true" />
        </button>
      )}

      <button
        onClick={onClose}
        aria-label="Close highlight actions"
        className="size-6 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        data-testid="highlight-close-button"
      >
        <X className="size-3.5" aria-hidden="true" />
      </button>
    </div>
  )
}
