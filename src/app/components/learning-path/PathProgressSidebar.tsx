import { Award, Clock, BookOpen } from 'lucide-react'
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
      <Card>
        <CardContent className="p-6 space-y-6">
          {/* Progress ring */}
          <div className="flex justify-center">
            <PathProgressRing percentage={completionPct} size="lg" strokeWidth={4}>
              <div className="text-center">
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

          {/* Skills tags */}
          {skillTags && skillTags.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">
                Skills
              </h3>
              <div className="flex flex-wrap gap-2">
                {skillTags.map(tag => (
                  <span
                    key={tag}
                    className="px-2.5 py-1 bg-muted text-muted-foreground border border-border rounded-full text-xs font-medium"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Certificate card */}
      <Card className="bg-gradient-to-br from-foreground to-foreground/80 border-0 overflow-hidden">
        <CardContent className="p-6">
          <div className="size-12 rounded-full bg-gold/20 flex items-center justify-center mb-4">
            <Award className="size-6 text-gold" aria-hidden="true" />
          </div>
          <h3 className="text-lg font-bold text-background mb-2">Earn a Certificate</h3>
          <p className="text-sm text-background/70 leading-relaxed mb-4">
            Complete all modules to unlock your personalized certificate of completion.
          </p>
          <span className="text-sm font-bold text-gold inline-flex items-center gap-1">
            View details
          </span>
        </CardContent>
      </Card>
    </aside>
  )
}
