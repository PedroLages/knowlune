import { Award, Clock, BookOpen, Trophy } from 'lucide-react'
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

      {/* Certificate card */}
      <Card className="bg-gradient-to-br from-foreground to-foreground/80 border-0 overflow-hidden relative" data-testid="certificate-card">
        {/* Background trophy decoration */}
        <div className="absolute -right-4 -top-4 opacity-10 pointer-events-none" aria-hidden="true">
          <Trophy className="w-24 h-24 text-background" />
        </div>
        <CardContent className="p-5 relative z-10">
          <div className="size-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center mb-3">
            <Award className="size-5 text-gold" aria-hidden="true" />
          </div>
          <h3 className="text-sm font-bold text-background mb-1">Earn a Certificate</h3>
          <p className="text-xs text-background/70 leading-relaxed mb-3">
            Complete all modules to unlock your personalized certificate of completion.
          </p>
          <span className="text-xs font-bold text-gold inline-flex items-center gap-1 hover:text-gold-soft-foreground transition-colors">
            View details &rarr;
          </span>
        </CardContent>
      </Card>
    </aside>
  )
}
