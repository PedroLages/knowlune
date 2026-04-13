/**
 * FocusAreasPanel (E56-S03)
 *
 * Shows the top 3 most urgent topics with score, tier badge,
 * days since engagement, and action buttons.
 */

import { useNavigate } from 'react-router'
import { Badge } from '@/app/components/ui/badge'
import { Button } from '@/app/components/ui/button'
import type { ScoredTopic } from '@/stores/useKnowledgeMapStore'
import type { KnowledgeTier, SuggestedAction } from '@/lib/knowledgeScore'

interface FocusAreasPanelProps {
  focusAreas: ScoredTopic[]
}

function tierBadgeClass(tier: KnowledgeTier): string {
  switch (tier) {
    case 'strong':
      return 'bg-success/15 text-success border-success/30'
    case 'fading':
      return 'bg-warning/15 text-warning border-warning/30'
    case 'weak':
      return 'bg-destructive/15 text-destructive border-destructive/30'
  }
}

function tierLabel(tier: KnowledgeTier): string {
  switch (tier) {
    case 'strong':
      return 'Strong'
    case 'fading':
      return 'Fading'
    case 'weak':
      return 'Weak'
  }
}

function formatDaysAgo(days: number): string {
  if (days === 0) return 'Today'
  if (days === 1) return '1 day ago'
  if (days >= 365) return `${Math.round(days / 365)}y ago`
  if (days >= 30) return `${Math.round(days / 30)}mo ago`
  return `${days}d ago`
}

export function FocusAreasPanel({ focusAreas }: FocusAreasPanelProps) {
  const navigate = useNavigate()

  if (focusAreas.length === 0) return null

  function handleAction(topic: ScoredTopic, action: SuggestedAction) {
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
  }

  return (
    <div className="mt-4">
      <h3 className="text-sm font-semibold text-muted-foreground mb-3">Focus Areas</h3>
      <ol className="space-y-3" aria-label="Focus areas requiring attention">
        {focusAreas.map((topic, index) => (
          <li
            key={topic.canonicalName}
            className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs text-muted-foreground w-4 shrink-0">{index + 1}.</span>
              <span className="text-sm font-medium truncate">{topic.name}</span>
              <Badge className={tierBadgeClass(topic.scoreResult.tier)}>
                {topic.scoreResult.score}% {tierLabel(topic.scoreResult.tier)}
              </Badge>
              <span className="text-xs text-muted-foreground shrink-0">
                {formatDaysAgo(topic.daysSinceLastEngagement)}
              </span>
            </div>
            <div className="flex gap-1.5 ml-6 sm:ml-0">
              {topic.suggestedActions.slice(0, 2).map(action => (
                <Button
                  key={action}
                  variant="outline"
                  size="sm"
                  className="text-xs h-7 px-2"
                  aria-label={`${action} for ${topic.name}`}
                  onClick={() => handleAction(topic, action)}
                >
                  {action}
                </Button>
              ))}
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
