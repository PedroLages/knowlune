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
import type { SuggestedAction } from '@/lib/knowledgeScore'
import { tierBadgeClass, tierLabel } from '@/lib/knowledgeTierUtils'

interface FocusAreasPanelProps {
  focusAreas: ScoredTopic[]
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

    switch (action) {
      case 'Review Flashcards':
        void navigate(courseId ? `/courses/${courseId}/flashcards` : '/flashcards')
        break
      case 'Retake Quiz':
        if (!courseId) return
        void navigate(`/courses/${courseId}/quiz`)
        break
      case 'Rewatch Lesson':
        if (!courseId) return
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
                  className="text-xs min-h-[44px] min-w-[44px] px-2"
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
