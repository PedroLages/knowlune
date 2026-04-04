/**
 * QuizBadge — "AI-generated" badge for auto-generated quizzes.
 *
 * Uses brand-soft design tokens for accessible contrast in both light/dark mode.
 *
 * @see E52-S02 Quiz Generation UI (AC: 4)
 */

import { Sparkles } from 'lucide-react'
import { Badge } from '@/app/components/ui/badge'

interface QuizBadgeProps {
  /** Optional className override */
  className?: string
}

export function QuizBadge({ className }: QuizBadgeProps) {
  return (
    <Badge
      variant="secondary"
      className={`bg-brand-soft text-brand-soft-foreground gap-1 ${className ?? ''}`}
    >
      <Sparkles className="size-3" aria-hidden="true" />
      AI-generated
    </Badge>
  )
}
