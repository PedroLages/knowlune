import { BookOpen, Clock } from 'lucide-react'
import { Card, CardContent } from '@/app/components/ui/card'
import { Badge } from '@/app/components/ui/badge'
import { cn } from '@/app/components/ui/utils'
import type { TopicRetention } from '@/lib/retentionMetrics'
import { formatTimeSinceReview } from '@/lib/retentionMetrics'

interface TopicRetentionCardProps {
  topic: TopicRetention
  now: Date
}

const LEVEL_BADGE_CLASSES: Record<TopicRetention['level'], string> = {
  strong: 'bg-success-soft text-success border-success/20',
  fading: 'bg-warning/20 text-warning border-warning/30',
  weak: 'bg-destructive/20 text-destructive border-destructive/30',
}

const LEVEL_LABELS: Record<TopicRetention['level'], string> = {
  strong: 'Strong',
  fading: 'Fading',
  weak: 'Weak',
}

export function TopicRetentionCard({ topic, now }: TopicRetentionCardProps) {
  const elapsed = formatTimeSinceReview(topic.lastReviewedAt, now)

  return (
    <Card
      className="rounded-[24px] transition-shadow duration-200 hover:shadow-md"
      data-testid="topic-retention-card"
    >
      <CardContent className="flex flex-col gap-3 p-5">
        {/* Header: topic name + retention badge */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
              <BookOpen className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{topic.topic}</p>
              <p className="text-xs text-foreground/60">
                {topic.noteCount} {topic.noteCount === 1 ? 'note' : 'notes'}
                {topic.dueCount > 0 && (
                  <span className="text-warning"> · {topic.dueCount} due</span>
                )}
              </p>
            </div>
          </div>

          <Badge
            variant="outline"
            data-testid="retention-indicator"
            data-level={topic.level}
            aria-label={`Retention: ${LEVEL_LABELS[topic.level]} (${topic.retention}%)`}
            className={cn('shrink-0 border font-semibold', LEVEL_BADGE_CLASSES[topic.level])}
          >
            {LEVEL_LABELS[topic.level]}
          </Badge>
        </div>

        {/* Retention bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-foreground/60">
            <span>Retention</span>
            <span className="tabular-nums font-medium">{topic.retention}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-500 motion-reduce:transition-none',
                topic.level === 'strong' && 'bg-success',
                topic.level === 'fading' && 'bg-warning',
                topic.level === 'weak' && 'bg-destructive'
              )}
              style={{ width: `${Math.max(2, topic.retention)}%` }}
              role="progressbar"
              aria-valuenow={topic.retention}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${topic.topic} retention: ${topic.retention}%`}
            />
          </div>
        </div>

        {/* Last reviewed */}
        <div className="flex items-center gap-1.5 text-xs text-foreground/60">
          <Clock className="size-3" aria-hidden="true" />
          <span>Last reviewed: {elapsed}</span>
        </div>
      </CardContent>
    </Card>
  )
}
