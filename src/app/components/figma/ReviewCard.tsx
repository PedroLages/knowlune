import { motion } from 'motion/react'
import { FileText } from 'lucide-react'
import { Card, CardContent } from '@/app/components/ui/card'
import { Badge } from '@/app/components/ui/badge'
import { cn } from '@/app/components/ui/utils'
import { RatingButtons } from './RatingButtons'
import { predictRetention } from '@/lib/spacedRepetition'
import type { ReviewRating, ReviewRecord, Note } from '@/data/types'
import { formatDistanceToNow } from 'date-fns'

interface ReviewCardProps {
  record: ReviewRecord
  note: Note
  courseName: string
  now: Date
  onRate: (noteId: string, rating: ReviewRating) => void
  disabled?: boolean
}

function getRetentionColor(retention: number): string {
  if (retention < 50) return 'text-destructive'
  if (retention < 80) return 'text-warning'
  return 'text-success'
}

function getRetentionBadgeClasses(retention: number): string {
  if (retention < 50) return 'bg-destructive/10 text-destructive border-destructive/20'
  if (retention < 80) return 'bg-warning/10 text-warning border-warning/20'
  return 'bg-success-soft text-success border-success/20'
}

function getNoteExcerpt(content: string, maxLength = 120): string {
  const plain = content
    .replace(/^#{1,6}\s+.*$/gm, '') // Strip full heading lines
    .replace(/\*\*|__/g, '')
    .replace(/\*|_/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\n+/g, ' ')
    .trim()

  if (plain.length <= maxLength) return plain
  return plain.slice(0, maxLength).trimEnd() + '...'
}

export function ReviewCard({ record, note, courseName, now, onRate, disabled }: ReviewCardProps) {
  const retention = predictRetention(record, now)
  const topicTag = note.tags[0] ?? 'General'
  const dueDate = new Date(record.nextReviewAt)
  const isDue = dueDate <= now
  const timeUntilDue = isDue
    ? 'Due now'
    : `Due ${formatDistanceToNow(dueDate, { addSuffix: true })}`

  return (
    <motion.article
      layout
      exit={{ opacity: 0, y: -16, transition: { duration: 0.2 } }}
      data-testid="review-card"
      aria-label={getNoteExcerpt(note.content, 60)}
    >
      <Card className="rounded-[24px] transition-shadow duration-200 hover:shadow-md">
        <CardContent className="flex flex-col gap-4 p-5">
          {/* Header: icon + metadata */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
                <FileText className="size-5" />
              </div>
              <div className="min-w-0">
                <p
                  data-testid="course-name"
                  className="text-xs font-medium text-muted-foreground truncate"
                >
                  {courseName}
                </p>
                <p data-testid="topic-name" className="text-xs text-muted-foreground truncate">
                  {topicTag}
                </p>
              </div>
            </div>

            <Badge
              variant="outline"
              data-testid="retention-percentage"
              aria-label={`Predicted retention: ${retention}%`}
              className={cn(
                'shrink-0 border font-semibold tabular-nums',
                getRetentionBadgeClasses(retention)
              )}
            >
              <span className={getRetentionColor(retention)}>{retention}%</span>
            </Badge>
          </div>

          {/* Note excerpt */}
          <p className="text-sm leading-relaxed text-foreground">{getNoteExcerpt(note.content)}</p>

          {/* Due time + Rating */}
          <div className="flex flex-col gap-3">
            <p data-testid="time-until-due" className="text-xs text-muted-foreground">
              {timeUntilDue}
            </p>
            <RatingButtons onRate={rating => onRate(note.id, rating)} disabled={disabled} />
          </div>
        </CardContent>
      </Card>
    </motion.article>
  )
}
