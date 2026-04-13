/**
 * TopicDetailPopover (E56-S04)
 *
 * Shows detailed score breakdown for a single topic.
 * Displays tier badge, score factors with effective weights,
 * confidence level, last engagement, and action buttons.
 */

import { useNavigate } from 'react-router'
import { format, formatDistanceToNow } from 'date-fns'
import { Popover, PopoverContent, PopoverTrigger } from '@/app/components/ui/popover'
import { Badge } from '@/app/components/ui/badge'
import { Button } from '@/app/components/ui/button'
import { Progress } from '@/app/components/ui/progress'
import { tierBadgeClass, tierLabel } from '@/lib/knowledgeTierUtils'
import type { ScoredTopic } from '@/stores/useKnowledgeMapStore'
import type { SuggestedAction, ConfidenceLevel } from '@/lib/knowledgeScore'

interface TopicDetailPopoverProps {
  topic: ScoredTopic
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}

function formatDaysAgo(days: number): string {
  const date = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  return formatDistanceToNow(date, { addSuffix: true })
}

function confidenceLabel(level: ConfidenceLevel): string {
  switch (level) {
    case 'high':
      return 'High confidence'
    case 'medium':
      return 'Medium confidence'
    case 'low':
      return 'Low confidence'
    case 'none':
      return 'No data'
  }
}

function confidenceIcon(level: ConfidenceLevel): string {
  switch (level) {
    case 'high':
      return '●●●'
    case 'medium':
      return '●●○'
    case 'low':
      return '●○○'
    case 'none':
      return '○○○'
  }
}

function formatPercent(value: number | null): string {
  return value !== null ? `${Math.round(value)}%` : '—'
}

function formatWeight(value: number): string {
  return `${Math.round(value * 100)}%`
}

/**
 * Memory Decay section for TopicDetailPopover (E62-S02).
 * Shows retention percentage, decay prediction, and urgency badge.
 */
function MemoryDecaySection({
  aggregateRetention,
  predictedDecayDate,
}: {
  aggregateRetention: number
  predictedDecayDate: string | null
}) {
  const decayInfo = getDecayInfo(predictedDecayDate)

  return (
    <div className="mb-3 pt-2 border-t border-border space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Memory Decay</span>
        {decayInfo && (
          <Badge variant={decayInfo.badgeVariant} className="text-[10px] px-1.5 py-0">
            {decayInfo.label}
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Progress
          value={aggregateRetention}
          className="h-2 flex-1"
          aria-label={`Retention: ${aggregateRetention}%`}
        />
        <span className="text-xs font-medium tabular-nums w-8 text-right">
          {aggregateRetention}%
        </span>
      </div>
    </div>
  )
}

function getDecayInfo(
  predictedDecayDate: string | null
): { label: string; badgeVariant: 'destructive' | 'default' | 'outline' } | null {
  if (!predictedDecayDate) return null

  const now = new Date()
  const decayDate = new Date(predictedDecayDate)
  const daysUntil = Math.ceil((decayDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  if (daysUntil < 0) {
    return { label: 'Already fading', badgeVariant: 'destructive' }
  }
  if (daysUntil < 7) {
    return {
      label: `Fading in ${daysUntil} day${daysUntil !== 1 ? 's' : ''}`,
      badgeVariant: 'destructive',
    }
  }
  if (daysUntil <= 30) {
    return {
      label: `Fading by ${format(decayDate, 'MMM d')}`,
      badgeVariant: 'default',
    }
  }
  return {
    label: `Stable until ${format(decayDate, 'MMM d')}`,
    badgeVariant: 'outline',
  }
}

export function TopicDetailPopover({
  topic,
  open,
  onOpenChange,
  children,
}: TopicDetailPopoverProps) {
  const navigate = useNavigate()
  const { scoreResult, daysSinceLastEngagement, suggestedActions } = topic
  const { factors, effectiveWeights, confidence } = scoreResult

  function handleAction(action: SuggestedAction) {
    const courseId = topic.courseIds[0]
    if (!courseId) return

    switch (action) {
      case 'Review Flashcards':
        void navigate(`/courses/${courseId}/flashcards`)
        break
      case 'Retake Quiz':
        void navigate(`/courses/${courseId}/quiz`)
        break
      case 'Rewatch Lesson':
        void navigate(`/courses/${courseId}`)
        break
    }
    onOpenChange(false)
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-80 p-4" align="center" sideOffset={8}>
        {/* Header: topic name + tier badge */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <h4 className="text-sm font-semibold truncate">{topic.name}</h4>
          <Badge className={tierBadgeClass(scoreResult.tier)}>
            {scoreResult.score}% {tierLabel(scoreResult.tier)}
          </Badge>
        </div>

        {/* Score breakdown */}
        <div className="space-y-1.5 mb-3">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">
              Quiz score <span className="opacity-60">({formatWeight(effectiveWeights.quiz)})</span>
            </span>
            <span className="font-medium">{formatPercent(factors.quizScore)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">
              Flashcard retention{' '}
              <span className="opacity-60">({formatWeight(effectiveWeights.flashcard)})</span>
            </span>
            <span className="font-medium">{formatPercent(factors.flashcardRetention)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">
              Completion{' '}
              <span className="opacity-60">({formatWeight(effectiveWeights.completion)})</span>
            </span>
            <span className="font-medium">{Math.round(factors.completionScore)}%</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">
              Recency <span className="opacity-60">({formatWeight(effectiveWeights.recency)})</span>
            </span>
            <span className="font-medium">{Math.round(factors.recencyScore)}%</span>
          </div>
        </div>

        {/* Memory Decay section (E62-S02) — only shown when FSRS retention data exists */}
        {topic.aggregateRetention !== null && (
          <MemoryDecaySection
            aggregateRetention={topic.aggregateRetention}
            predictedDecayDate={topic.predictedDecayDate}
          />
        )}

        {/* Confidence + last engagement */}
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-4 pt-2 border-t border-border">
          <span>
            {confidenceIcon(confidence)} {confidenceLabel(confidence)}
          </span>
          <span>{formatDaysAgo(daysSinceLastEngagement)}</span>
        </div>

        {/* Action buttons */}
        {suggestedActions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {suggestedActions.map((action, i) => (
              <Button
                key={action}
                variant={i === 0 ? 'brand-outline' : 'outline'}
                size="sm"
                className="text-xs min-h-[44px]"
                aria-label={`${action} for ${topic.name}`}
                onClick={() => handleAction(action)}
              >
                {action}
              </Button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
