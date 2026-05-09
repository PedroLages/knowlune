import { Clock, BookOpen } from 'lucide-react'
import { Card, CardContent } from '@/app/components/ui/card'
import { PathProgressRing } from '@/app/components/figma/PathProgressRing'
import { cn } from '@/app/components/ui/utils'
import type { PathProgressSummary } from '@/app/hooks/usePathProgress'

interface PathProgressSidebarProps {
  progress: PathProgressSummary
  skillTags?: string[]
  className?: string
}

export function PathProgressSidebar({
  progress,
  skillTags,
  className,
}: PathProgressSidebarProps) {
  const { completionPct, completedCourses, totalCourses, estimatedRemainingHours } = progress

  // Format hours for display
  const formattedTime =
    estimatedRemainingHours > 0 ? `~${estimatedRemainingHours}h` : '0h'

  return (
    <aside className={cn('sticky top-24 space-y-6', className)}>
      {/* Progress card */}
      <Card className="rounded-2xl shadow-lg border border-border">
        <CardContent className="p-6">
          {/* Your Progress heading */}
          <h3 className="font-display text-lg font-bold mb-6">Your Progress</h3>

          {/* Progress ring */}
          <div className="flex justify-center mb-6">
            <PathProgressRing percentage={completionPct} size="xl" strokeWidth={6}>
              <div className="text-center" aria-live="polite" aria-atomic="true">
                <span className="block text-2xl font-extrabold text-foreground">
                  {Math.round(completionPct)}%
                </span>
                <span className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Complete
                </span>
              </div>
            </PathProgressRing>
          </div>

          {/* Stats */}
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <BookOpen className="size-4 text-brand flex-shrink-0" aria-hidden="true" />
              <span className="text-muted-foreground">Modules Completed</span>
              <span className="ml-auto font-bold text-foreground tabular-nums">
                {completedCourses}/{totalCourses}
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Clock className="size-4 text-brand flex-shrink-0" aria-hidden="true" />
              <span className="text-muted-foreground">Estimated Time Left</span>
              <span className="ml-auto font-bold text-foreground tabular-nums">
                {formattedTime}
              </span>
            </div>
          </div>

          {/* Divider */}
          {skillTags && skillTags.length > 0 && (
            <hr className="my-6 border-border" />
          )}

          {/* Skills tags */}
          {skillTags && skillTags.length > 0 && (
            <div>
              <h3 className="text-sm font-bold mb-3">Skills you&apos;ll gain</h3>
              <div className="flex flex-wrap gap-2">
                {skillTags.map(tag => (
                  <span
                    key={tag}
                    className="px-2 py-1 bg-muted border border-border rounded-md text-xs font-bold text-muted-foreground"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Certificate card removed — see R9 */}
    </aside>
  )
}
