import { useMemo } from 'react'
import type { ScoredTopic } from '@/stores/useKnowledgeMapStore'

interface KnowledgeMapSummaryProps {
  topics: ScoredTopic[]
}

export function KnowledgeMapSummary({ topics }: KnowledgeMapSummaryProps) {
  const summary = useMemo(() => {
    const strong = topics.filter(topic => topic.scoreResult.tier === 'strong').length
    const weak = topics.filter(topic => topic.scoreResult.tier === 'weak').length
    const needReview = topics.length - strong
    const average =
      topics.length > 0
        ? Math.round(
            topics.reduce((total, topic) => total + topic.scoreResult.score, 0) / topics.length
          )
        : 0

    return { strong, weak, needReview, average }
  }, [topics])

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Knowledge map summary">
      <SummaryMetric label="Topics" value={topics.length} />
      <SummaryMetric label="Average" value={`${summary.average}%`} />
      <SummaryMetric label="Strong" value={summary.strong} tone="success" />
      <SummaryMetric
        label="Need review"
        value={summary.needReview}
        tone={summary.weak > 0 ? 'destructive' : 'warning'}
      />
    </div>
  )
}

function SummaryMetric({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: number | string
  tone?: 'default' | 'success' | 'warning' | 'destructive'
}) {
  const valueClass = {
    default: 'text-foreground',
    success: 'text-success',
    warning: 'text-warning',
    destructive: 'text-destructive',
  }[tone]

  return (
    <div className="min-w-24 rounded-xl border border-border bg-card px-3 py-2">
      <div className={`text-lg font-bold tabular-nums ${valueClass}`}>{value}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  )
}
