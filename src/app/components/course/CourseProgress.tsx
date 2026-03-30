/**
 * CourseProgress — Overall progress card.
 * Shows completion count, progress bar, and percentage.
 *
 * Design ported from old CourseDetail.tsx progress sidebar
 * (bg-muted rounded-2xl p-5 with large percentage display).
 *
 * @see E89-S04, E89-S12c
 */

import { CheckCircle } from 'lucide-react'
import { Progress } from '@/app/components/ui/progress'

export interface CourseProgressProps {
  completedCount: number
  totalCount: number
}

export function CourseProgress({ completedCount, totalCount }: CourseProgressProps) {
  if (totalCount === 0) return null

  const overallPercent = Math.round((completedCount / totalCount) * 100)
  const isComplete = overallPercent >= 100

  return (
    <div
      className="rounded-[24px] bg-muted/50 p-5 mb-6 border border-border/50"
      data-testid="course-progress-card"
    >
      <h2 className="font-semibold text-sm mb-3">Your Progress</h2>
      {isComplete ? (
        <div className="flex items-center gap-2 mb-3">
          <CheckCircle
            className="size-6 text-success"
            data-testid="completion-badge"
            aria-hidden="true"
          />
          <div className="text-2xl font-bold text-success">Complete!</div>
        </div>
      ) : (
        <div className="text-3xl font-bold text-brand mb-1">{overallPercent}%</div>
      )}
      <Progress
        value={overallPercent}
        className="h-2 mb-3"
        aria-label="Course completion progress"
      />
      <p className="text-xs text-muted-foreground">
        {completedCount} of {totalCount} lessons completed
      </p>
    </div>
  )
}
