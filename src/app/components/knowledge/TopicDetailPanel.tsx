/**
 * TopicDetailPanel
 *
 * Slide-in detail panel for the Knowledge Map treemap (desktop).
 * Replaces the popover with a more immersive right-side panel that shows
 * topic name, tier badge, score breakdown, memory decay, confidence,
 * and suggested action buttons.
 */

import { useId } from 'react'
import { useNavigate } from 'react-router'
import { X } from 'lucide-react'
import { Badge } from '@/app/components/ui/badge'
import { Button } from '@/app/components/ui/button'
import { Progress } from '@/app/components/ui/progress'
import { formatDecayLabel } from '@/lib/decayFormatting'
import type { ScoredTopic } from '@/stores/useKnowledgeMapStore'
import type { SuggestedAction, ConfidenceLevel } from '@/lib/knowledgeScore'
import type { ActionType } from '@/lib/actionSuggestions'

interface TopicDetailPanelProps {
  topic: ScoredTopic
  onClose: () => void
  embedded?: boolean
}

const ACTION_TYPE_BY_LABEL: Record<SuggestedAction, ActionType> = {
  'Review Flashcards': 'flashcard-review',
  'Retake Quiz': 'quiz-refresh',
  'Rewatch Lesson': 'lesson-rewatch',
}

function formatDaysAgo(days: number): string {
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  if (days === 0) return 'Today'
  if (days < 30) return rtf.format(-days, 'day')
  if (days < 365) return rtf.format(-Math.round(days / 30), 'month')
  return rtf.format(-Math.round(days / 365), 'year')
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

function colorClassToBadgeVariant(
  colorClass: 'text-destructive' | 'text-warning' | 'text-success'
): 'destructive' | 'default' | 'outline' {
  if (colorClass === 'text-destructive') return 'destructive'
  if (colorClass === 'text-warning') return 'default'
  return 'outline'
}

export function TopicDetailPanel({ topic, onClose, embedded = false }: TopicDetailPanelProps) {
  const navigate = useNavigate()
  const titleId = useId()
  const { scoreResult, daysSinceLastEngagement } = topic
  const { score, tier, factors, effectiveWeights, confidence } = scoreResult

  const decayInfo =
    topic.aggregateRetention !== null ? formatDecayLabel(topic.predictedDecayDate) : null

  function handleAction(action: SuggestedAction) {
    const target = topic.actionTargets?.[ACTION_TYPE_BY_LABEL[action]]
    if (!target) return
    void navigate(target.route)
    onClose()
  }

  const actionTargets = topic.suggestedActions.filter(
    action => topic.actionTargets?.[ACTION_TYPE_BY_LABEL[action]]
  )

  return (
    <div
      className={
        embedded
          ? 'flex min-h-0 w-full flex-1 flex-col bg-background'
          : 'absolute inset-y-0 right-0 z-10 flex w-full flex-col border-l border-border bg-background shadow-2xl motion-safe:animate-in motion-safe:slide-in-from-right motion-safe:duration-300 sm:w-96'
      }
      data-testid="topic-detail-panel"
      role="region"
      aria-labelledby={titleId}
    >
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between shrink-0">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
          Topic Detail
        </span>
        <button
          onClick={onClose}
          className="p-2 -mr-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-full transition-colors"
          aria-label="Close topic detail"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="p-5 flex-1 overflow-y-auto">
        {/* Topic name + tier badge */}
        <h2 id={titleId} className="mb-3 text-xl font-bold">
          {topic.name}
        </h2>

        <div className="mb-6">
          {tier === 'weak' && (
            <Badge variant="destructive" className="text-xs font-semibold uppercase tracking-wider">
              Urgent Attention
            </Badge>
          )}
          {tier === 'fading' && (
            <Badge variant="default" className="text-xs font-semibold uppercase tracking-wider">
              Needs Review
            </Badge>
          )}
          {tier === 'strong' && (
            <Badge
              variant="outline"
              className="text-xs font-semibold uppercase tracking-wider border-success text-success"
            >
              Solid Mastery
            </Badge>
          )}
        </div>

        {/* Score breakdown */}
        <div className="space-y-3 mb-6">
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-xl border border-border">
            <span className="text-sm font-medium">Knowledge Score</span>
            <span className="text-lg font-bold">{score}%</span>
          </div>

          <div className="space-y-1.5">
            <ScoreRow label="Quiz score" weight={effectiveWeights.quiz} value={factors.quizScore} />
            <ScoreRow
              label="Flashcard retention"
              weight={effectiveWeights.flashcard}
              value={factors.flashcardRetention}
            />
            <ScoreRow
              label="Completion"
              weight={effectiveWeights.completion}
              value={factors.completionScore}
            />
            <ScoreRow
              label="Recency"
              weight={effectiveWeights.recency}
              value={factors.recencyScore}
            />
          </div>
        </div>

        {/* Memory Decay section */}
        {topic.aggregateRetention !== null && (
          <div className="mb-6 pt-4 border-t border-border space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Memory Decay</span>
              {decayInfo && (
                <Badge
                  variant={colorClassToBadgeVariant(decayInfo.colorClass)}
                  className="text-[10px] px-1.5 py-0"
                >
                  {decayInfo.label}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Progress
                value={topic.aggregateRetention}
                className="h-2 flex-1"
                aria-label={`Retention: ${topic.aggregateRetention}%`}
              />
              <span className="text-xs font-medium tabular-nums w-8 text-right">
                {topic.aggregateRetention}%
              </span>
            </div>
          </div>
        )}

        {/* Confidence + last engagement */}
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-6 pt-4 border-t border-border">
          <span>
            {confidenceIcon(confidence)} {confidenceLabel(confidence)}
          </span>
          <span>{formatDaysAgo(daysSinceLastEngagement)}</span>
        </div>

        {/* Action buttons */}
        {actionTargets.length > 0 && (
          <div>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3 block">
              Recommended Actions
            </span>
            <div className="flex flex-col gap-2">
              {actionTargets.map((action, i) => (
                <Button
                  key={action}
                  variant={i === 0 ? 'brand' : 'outline'}
                  size="sm"
                  className="justify-start min-h-[44px]"
                  aria-label={`${action} for ${topic.name}`}
                  onClick={() => handleAction(action)}
                >
                  {action}
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/** Single score breakdown row showing label, weight, and value */
function ScoreRow({
  label,
  weight,
  value,
}: {
  label: string
  weight: number
  value: number | null
}) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-muted-foreground">
        {label} <span className="opacity-60">({formatWeight(weight)})</span>
      </span>
      <span className="font-medium">{formatPercent(value)}</span>
    </div>
  )
}
