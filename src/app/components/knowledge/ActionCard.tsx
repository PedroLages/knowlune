import { Link } from 'react-router'
import { Layers, Brain, RotateCcw, TrendingDown, TrendingUp, Minus, Clock } from 'lucide-react'
import type { ActionSuggestion, ActionType, ScoreTrend } from '@/lib/actionSuggestions'
import { Card } from '@/app/components/ui/card'
import { Badge } from '@/app/components/ui/badge'
import { Button } from '@/app/components/ui/button'
import { cn } from '@/app/components/ui/utils'

// ── Mappings ────────────────────────────────────────────────────

const ACTION_TYPE_ICONS: Record<ActionType, React.ComponentType<{ className?: string }>> = {
  'flashcard-review': Layers,
  'quiz-refresh': Brain,
  'lesson-rewatch': RotateCcw,
}

const CTA_LABELS: Record<ActionType, string> = {
  'flashcard-review': 'Start Review',
  'quiz-refresh': 'Take Quiz',
  'lesson-rewatch': 'Watch Lesson',
}

const TIME_BADGE_LABELS: Record<ActionType, string> = {
  'flashcard-review': 'min review',
  'quiz-refresh': 'min quiz',
  'lesson-rewatch': 'min lesson',
}

const TREND_ICONS: Record<ScoreTrend, React.ComponentType<{ className?: string }>> = {
  declining: TrendingDown,
  stable: Minus,
  improving: TrendingUp,
}

function getTierConfig(score: number) {
  if (score < 40) {
    return {
      badgeClass: 'bg-destructive/10 text-destructive border-transparent',
      borderClass: 'border-l-destructive',
      trendClass: 'text-destructive',
    }
  }
  if (score < 70) {
    return {
      badgeClass: 'bg-warning/10 text-warning border-transparent',
      borderClass: 'border-l-warning',
      trendClass: 'text-warning',
    }
  }
  return {
    badgeClass: 'bg-success/10 text-success border-transparent',
    borderClass: 'border-l-success',
    trendClass: 'text-success',
  }
}

// ── Component ───────────────────────────────────────────────────

export interface ActionCardProps {
  suggestion: ActionSuggestion
  className?: string
}

export function ActionCard({ suggestion, className }: ActionCardProps) {
  const { score, trend, actionType, topicName, actionLabel, actionRoute, estimatedMinutes } =
    suggestion

  const tier = getTierConfig(score)
  const TypeIcon = ACTION_TYPE_ICONS[actionType]
  const TrendIcon = TREND_ICONS[trend]
  const ctaLabel = CTA_LABELS[actionType]

  return (
    <article
      role="listitem"
      data-testid="action-card"
      aria-label={`${actionLabel} for ${topicName} - Score ${score}, ${trend}`}
      className={cn(className)}
    >
      <Card
        className={cn(
          'flex flex-col gap-3 rounded-xl border-l-[3px] p-4',
          'motion-safe:hover:shadow-md motion-safe:hover:-translate-y-px transition-[box-shadow,transform] duration-200',
          'focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2',
          tier.borderClass
        )}
      >
        <div className="flex flex-col gap-3">
          {/* Header row */}
          <div className="flex items-center gap-2">
            <TypeIcon className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate text-sm font-medium" title={topicName}>
              {topicName}
            </span>
            <Badge className={cn('shrink-0', tier.badgeClass)}>{score}</Badge>
            <TrendIcon className={cn('size-4 shrink-0', tier.trendClass)} />
          </div>

          {/* Description */}
          <p className="text-sm text-muted-foreground">{actionLabel}</p>

          {/* Footer: time estimate + CTA */}
          <div className="flex items-center justify-between gap-2">
            <Badge variant="outline" className="gap-1">
              <Clock className="size-3" />
              {estimatedMinutes} {TIME_BADGE_LABELS[actionType]}
            </Badge>
            <Button variant="brand" size="default" asChild>
              <Link to={actionRoute}>{ctaLabel}</Link>
            </Button>
          </div>
        </div>
      </Card>
    </article>
  )
}
