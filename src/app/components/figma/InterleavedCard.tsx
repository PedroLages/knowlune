import { motion } from 'motion/react'
import { RotateCcw, FileText } from 'lucide-react'
import { Card, CardContent } from '@/app/components/ui/card'
import { Badge } from '@/app/components/ui/badge'
import { cn } from '@/app/components/ui/utils'
import { RatingButtons } from './RatingButtons'
import { predictRetention } from '@/lib/spacedRepetition'
import type { ReviewRating, ReviewRecord, Note } from '@/data/types'

interface InterleavedCardProps {
  record: ReviewRecord
  note: Note
  courseName: string
  now: Date
  isFlipped: boolean
  onFlip: () => void
  onRate: (rating: ReviewRating) => void
}

function getRetentionBadgeClasses(retention: number): string {
  if (retention < 50) return 'bg-destructive/10 text-destructive border-destructive/20'
  if (retention < 80) return 'bg-warning/10 text-warning border-warning/20'
  return 'bg-success-soft text-success border-success/20'
}

function getRetentionLabel(retention: number): string {
  if (retention < 50) return 'Low'
  if (retention < 80) return 'Med'
  return 'High'
}

/** Strip markdown formatting to plain text */
function stripMarkdown(content: string): string {
  return content
    .replace(/^#{1,6}\s+.*$/gm, '')
    .replace(/\*\*|__/g, '')
    .replace(/\*|_/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\n+/g, ' ')
    .trim()
}

function getPromptExcerpt(content: string, maxLength = 80): string {
  const plain = stripMarkdown(content)
  // Take the first sentence as the "prompt"
  const firstSentence = plain.match(/^[^.!?]+[.!?]?/)?.[0]?.trim() ?? plain
  if (firstSentence.length <= maxLength) return firstSentence
  return firstSentence.slice(0, maxLength).trimEnd() + '...'
}

function getFullExcerpt(content: string, maxLength = 200): string {
  const plain = stripMarkdown(content)
  if (plain.length <= maxLength) return plain
  return plain.slice(0, maxLength).trimEnd() + '...'
}

export function InterleavedCard({
  record,
  note,
  courseName,
  now,
  isFlipped,
  onFlip,
  onRate,
}: InterleavedCardProps) {
  const retention = predictRetention(record, now)
  const topicTag = note.tags[0] ?? 'General'

  function handleKeyDown(e: React.KeyboardEvent) {
    if ((e.key === ' ' || e.key === 'Enter') && !isFlipped) {
      e.preventDefault()
      onFlip()
    }
  }

  return (
    <>
      {/* Perspective container for 3D card-flip — no Tailwind equivalents for
          perspective, transformStyle, or backfaceVisibility (CSS 3D transform properties) */}
      {/* eslint-disable react-best-practices/no-inline-styles */}
      <div style={{ perspective: 1000 }} className="mx-auto w-full max-w-lg">
        <motion.div
          animate={{ rotateY: isFlipped ? 180 : 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          style={{ transformStyle: 'preserve-3d' }}
          className="relative min-h-[280px]"
        >
          {/* ── Front face ── */}
          <div
            data-testid="interleaved-card-front"
            role="button"
            tabIndex={isFlipped ? -1 : 0}
            aria-label="Flip card to reveal answer"
            aria-hidden={isFlipped}
            onClick={!isFlipped ? onFlip : undefined}
            onKeyDown={handleKeyDown}
            className="absolute inset-0 cursor-pointer"
            style={{ backfaceVisibility: 'hidden', visibility: isFlipped ? 'hidden' : 'visible' }}
          >
            <Card className="h-full rounded-[24px] transition-shadow duration-200 hover:shadow-lg">
              <CardContent className="flex h-full flex-col justify-between gap-4 p-6">
                {/* Header: course + topic */}
                <div className="flex items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
                    <FileText className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <p
                      data-testid="interleaved-course-name"
                      className="text-xs font-medium text-muted-foreground truncate"
                    >
                      {courseName}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{topicTag}</p>
                  </div>
                </div>

                {/* Prompt text */}
                <p className="text-center text-lg font-medium leading-relaxed text-foreground">
                  {getPromptExcerpt(note.content)}
                </p>

                {/* Flip hint */}
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <RotateCcw className="size-4" />
                  <span>Tap to reveal</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── Back face ── */}
          <div
            data-testid="interleaved-card-back"
            aria-hidden={!isFlipped}
            className="absolute inset-0"
            style={{
              backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
              visibility: isFlipped ? 'visible' : 'hidden',
            }}
          >
            <Card className="h-full rounded-[24px] shadow-lg">
              <CardContent className="flex h-full flex-col gap-4 p-6">
                {/* Header: course + retention */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
                      <FileText className="size-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-muted-foreground truncate">
                        {courseName}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{topicTag}</p>
                    </div>
                  </div>

                  <Badge
                    variant="outline"
                    aria-label={`Predicted retention: ${retention}%`}
                    className={cn(
                      'shrink-0 border font-semibold tabular-nums',
                      getRetentionBadgeClasses(retention)
                    )}
                  >
                    {getRetentionLabel(retention)} {retention}%
                  </Badge>
                </div>

                {/* Full note content */}
                <div className="flex-1">
                  <p className="text-sm leading-relaxed text-foreground">
                    {getFullExcerpt(note.content)}
                  </p>
                </div>

                {/* Rating buttons */}
                <RatingButtons onRate={onRate} />
              </CardContent>
            </Card>
          </div>
        </motion.div>
        {/* Screen reader announcement — outside card faces so content change triggers aria-live */}
        {isFlipped && (
          <span className="sr-only" aria-live="polite">
            Answer revealed. Rate your recall.
          </span>
        )}
      </div>
      {/* eslint-enable react-best-practices/no-inline-styles */}
    </>
  )
}
