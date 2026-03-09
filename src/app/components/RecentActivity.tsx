import { Card, CardContent } from '@/app/components/ui/card'
import { Button } from '@/app/components/ui/button'
import { Link } from 'react-router'
import { formatDistanceToNow } from 'date-fns'
import { Clock, ArrowRight, BookOpen } from 'lucide-react'
import type { Course } from '@/data/types'
import type { CourseProgress } from '@/lib/progress'

interface RecentActivityProps {
  activities: (Course & { progress: CourseProgress })[]
}

export function RecentActivity({ activities }: RecentActivityProps) {
  if (activities.length === 0) return null

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl">Recent Activity</h2>
        <Link
          to="/my-progress"
          className="text-sm text-brand hover:text-brand-hover flex items-center gap-1 motion-safe:transition-colors"
        >
          View All
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      </div>

      <Card className="border-border/50">
        <CardContent className="p-0">
          {activities.map((activity, index) => (
            <div
              key={activity.id}
              className="flex items-center gap-4 p-4 hover:bg-brand-soft/30 dark:hover:bg-brand-soft/10 motion-safe:transition-colors"
            >
              {/* Timeline indicator */}
              <div className="flex flex-col items-center self-stretch">
                <div className="size-2.5 rounded-full bg-brand flex-shrink-0 mt-1.5" />
                {index < activities.length - 1 && <div className="w-px flex-1 bg-border mt-1" />}
              </div>

              {/* Course thumbnail */}
              {activity.coverImage ? (
                <picture>
                  <source
                    type="image/webp"
                    srcSet={`
                      ${activity.coverImage}-320w.webp 320w,
                      ${activity.coverImage}-640w.webp 640w
                    `}
                    sizes="40px"
                  />
                  <img
                    src={`${activity.coverImage}-320w.webp`}
                    alt={activity.title}
                    className="size-10 rounded-lg object-cover flex-shrink-0"
                    width={40}
                    height={40}
                    loading="lazy"
                  />
                </picture>
              ) : (
                <div className="size-10 rounded-lg bg-brand-soft flex items-center justify-center flex-shrink-0">
                  <BookOpen className="size-5 text-brand" aria-hidden="true" />
                </div>
              )}

              {/* Activity info */}
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate text-sm">{activity.title}</p>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                  <Clock className="size-3" aria-hidden="true" />
                  <span>
                    {formatDistanceToNow(new Date(activity.progress.lastAccessedAt), {
                      addSuffix: true,
                    })}
                  </span>
                </div>
              </div>

              {/* Resume button */}
              <Button size="sm" variant="ghost" asChild className="flex-shrink-0">
                <Link to={`/courses/${activity.id}`}>
                  Resume
                  <ArrowRight className="size-3.5 ml-1" aria-hidden="true" />
                </Link>
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
