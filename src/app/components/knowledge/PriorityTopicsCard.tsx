import { ChevronRight } from 'lucide-react'
import { Badge } from '@/app/components/ui/badge'
import { Card } from '@/app/components/ui/card'
import { tierBadgeClass } from '@/lib/knowledgeTierUtils'
import type { ScoredTopic } from '@/stores/useKnowledgeMapStore'

interface PriorityTopicsCardProps {
  topics: ScoredTopic[]
  selectedTopicId: string | null
  onSelect: (canonicalName: string) => void
}

export function PriorityTopicsCard({ topics, selectedTopicId, onSelect }: PriorityTopicsCardProps) {
  if (topics.length === 0) return null

  return (
    <Card className="gap-4 p-4">
      <div>
        <h2 className="text-base font-semibold">Priority topics</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Ranked by score, recency, and memory decay.
        </p>
      </div>
      <ol className="space-y-2" aria-label="Priority topics">
        {topics.map((topic, index) => (
          <li key={topic.canonicalName}>
            <button
              type="button"
              onClick={() => onSelect(topic.canonicalName)}
              className={`flex min-h-[44px] w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors ${
                selectedTopicId === topic.canonicalName
                  ? 'border-brand bg-brand-soft text-brand-soft-foreground'
                  : 'border-border hover:bg-accent'
              }`}
              aria-pressed={selectedTopicId === topic.canonicalName}
            >
              <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                {index + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{topic.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {topic.daysSinceLastEngagement === 0
                    ? 'Reviewed today'
                    : `${topic.daysSinceLastEngagement}d since review`}
                </span>
              </span>
              <Badge className={tierBadgeClass(topic.scoreResult.tier)}>
                {topic.scoreResult.score}%
              </Badge>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ol>
    </Card>
  )
}
