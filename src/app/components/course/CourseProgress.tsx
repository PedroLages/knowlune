/**
 * CourseProgress — Overall progress card for YouTube courses.
 * Shows completion count, progress bar, and percentage.
 *
 * @see E89-S04
 */

import { Progress } from '@/app/components/ui/progress'

export interface CourseProgressProps {
  completedCount: number
  totalCount: number
}

export function CourseProgress({ completedCount, totalCount }: CourseProgressProps) {
  if (totalCount === 0) return null

  const overallPercent = Math.round((completedCount / totalCount) * 100)

  return (
    <div className="rounded-xl border bg-card p-4 mb-6" data-testid="course-progress-card">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">Overall Progress</span>
        <span className="text-sm text-muted-foreground">
          {completedCount}/{totalCount} completed
        </span>
      </div>
      <Progress value={overallPercent} className="h-2" aria-label="Course completion progress" />
      <p className="text-xs text-muted-foreground mt-1">{overallPercent}% complete</p>
    </div>
  )
}
