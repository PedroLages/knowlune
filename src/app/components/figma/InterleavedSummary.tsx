import { motion } from 'motion/react'
import { CheckCircle2, ArrowUpRight, RotateCcw } from 'lucide-react'
import { Card, CardContent } from '@/app/components/ui/card'
import { Badge } from '@/app/components/ui/badge'
import { Button } from '@/app/components/ui/button'
import { cn } from '@/app/components/ui/utils'
import { scaleIn } from '@/lib/motion'
import type { InterleavedSessionSummary } from '@/stores/useReviewStore'

interface InterleavedSummaryProps {
  summary: InterleavedSessionSummary
  onStartNew: () => void
  onReturnToQueue: () => void
}

export function InterleavedSummary({
  summary,
  onStartNew,
  onReturnToQueue,
}: InterleavedSummaryProps) {
  const retentionDelta = summary.averageRetentionAfter - summary.averageRetentionBefore
  const totalRatings = summary.ratings.hard + summary.ratings.good + summary.ratings.easy

  return (
      <motion.div
        variants={scaleIn}
        initial="hidden"
        animate="visible"
        className="mx-auto w-full max-w-lg"
        data-testid="interleaved-summary"
      >
        <Card className="rounded-[24px]">
          <CardContent className="flex flex-col items-center gap-6 p-6">
            {/* Header */}
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-success-soft text-success">
                <CheckCircle2 className="size-6" />
              </div>
              <h2 className="font-display text-xl tracking-tight">Session Complete</h2>
              <p className="text-sm text-muted-foreground">Great work reviewing your notes!</p>
            </div>

            {/* Stats grid */}
            <div className="grid w-full grid-cols-2 gap-4">
              {/* Total reviewed */}
              <div className="rounded-xl bg-brand-soft p-4">
                <p className="text-xs font-medium text-muted-foreground">Notes Reviewed</p>
                <p
                  data-testid="summary-total-reviewed"
                  className="mt-1 text-2xl font-semibold tabular-nums text-foreground"
                >
                  {summary.totalReviewed}
                </p>
              </div>

              {/* Courses covered */}
              <div className="rounded-xl bg-brand-soft p-4">
                <p className="text-xs font-medium text-muted-foreground">Courses Covered</p>
                <p
                  data-testid="summary-courses-covered"
                  className="mt-1 text-2xl font-semibold tabular-nums text-foreground"
                >
                  {summary.coursesCount}
                </p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {summary.courseNames.map(name => (
                    <Badge key={name} variant="secondary" className="text-[10px] leading-tight">
                      {name}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Ratings distribution */}
              <div className="rounded-xl bg-muted/50 p-4">
                <p className="text-xs font-medium text-muted-foreground">Ratings</p>
                <div className="mt-2 space-y-1.5">
                  <RatingBar
                    label="Hard"
                    count={summary.ratings.hard}
                    total={totalRatings}
                    className="bg-destructive/60"
                    testId="rating-hard-count"
                  />
                  <RatingBar
                    label="Good"
                    count={summary.ratings.good}
                    total={totalRatings}
                    className="bg-brand"
                    testId="rating-good-count"
                  />
                  <RatingBar
                    label="Easy"
                    count={summary.ratings.easy}
                    total={totalRatings}
                    className="bg-success"
                    testId="rating-easy-count"
                  />
                </div>
              </div>

              {/* Retention improvement */}
              <div className="rounded-xl bg-muted/50 p-4">
                <p className="text-xs font-medium text-muted-foreground">Retention</p>
                <div className="mt-1 flex items-baseline gap-1">
                  <span
                    data-testid="summary-retention-after"
                    className="text-2xl font-semibold tabular-nums text-foreground"
                  >
                    {summary.averageRetentionAfter}%
                  </span>
                  {retentionDelta > 0 && (
                    <span className="flex items-center text-sm font-medium text-success">
                      <ArrowUpRight className="size-3.5" />+{retentionDelta}%
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  was {summary.averageRetentionBefore}% before
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex w-full gap-3">
              <Button variant="outline" className="flex-1" onClick={onReturnToQueue}>
                Back to Queue
              </Button>
              <Button variant="brand" className="flex-1" onClick={onStartNew}>
                <RotateCcw className="mr-2 size-4" />
                Review More
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
  )
}

function RatingBar({
  label,
  count,
  total,
  className,
  testId,
}: {
  label: string
  count: number
  total: number
  className: string
  testId?: string
}) {
  const pct = total > 0 ? (count / total) * 100 : 0

  return (
    <div className="flex items-center gap-2">
      <span className="w-8 text-[10px] font-medium text-muted-foreground">{label}</span>
      <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className={cn('absolute inset-y-0 left-0 rounded-full transition-all', className)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span
        data-testid={testId}
        className="w-4 text-right text-[10px] tabular-nums text-muted-foreground"
      >
        {count}
      </span>
    </div>
  )
}
