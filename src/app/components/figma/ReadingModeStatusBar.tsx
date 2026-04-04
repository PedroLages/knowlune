/**
 * ReadingModeStatusBar — Minimal top bar shown during reading mode.
 *
 * Displays a back button, truncated lesson title, and close (X) button.
 * Fixed to top, 48px height, uses design tokens for colors.
 *
 * @see E65-S01
 */

import { ChevronLeft, X } from 'lucide-react'
import { Button } from '@/app/components/ui/button'

interface ReadingModeStatusBarProps {
  lessonTitle: string
  onBack: () => void
  onClose: () => void
}

export function ReadingModeStatusBar({ lessonTitle, onBack, onClose }: ReadingModeStatusBarProps) {
  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 flex items-center gap-3 h-12 px-4 bg-card border-b border-border"
      role="banner"
      aria-label="Reading mode toolbar"
    >
      <Button
        variant="ghost"
        size="icon"
        onClick={onBack}
        aria-label="Go back"
        className="shrink-0"
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
      </Button>

      <span className="flex-1 text-sm font-medium text-foreground truncate">
        {lessonTitle}
      </span>

      <Button
        variant="ghost"
        size="icon"
        onClick={onClose}
        aria-label="Exit reading mode"
        className="shrink-0"
        data-testid="reading-mode-close"
      >
        <X className="size-4" aria-hidden="true" />
      </Button>
    </div>
  )
}
