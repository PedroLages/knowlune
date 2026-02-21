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
    <section className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Recent Activity</h2>
        <Link
          to="/my-progress"
          className="text-sm text-brand hover:text-brand-hover flex items-center gap-1"
        >
          View All
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      <Card>
        <CardContent className="p-0">
          {activities.map((activity, index) => (
            <div
              key={activity.id}
              className="flex items-center gap-4 p-4 border-b last:border-0 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition-colors"
            >
              {/* Timeline indicator */}
              <div className="flex flex-col items-center">
                <div className="w-3 h-3 rounded-full bg-brand" />
                {index < activities.length - 1 && (
                  <div className="w-0.5 h-full bg-blue-200 dark:bg-blue-800 mt-1" />
                )}
              </div>

              {/* Course thumbnail */}
              {activity.coverImage ? (
                <img
                  src={`${activity.coverImage}-320w.webp`}
                  alt={activity.title}
                  className="w-12 h-12 rounded-lg object-cover"
                />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <BookOpen className="w-6 h-6 text-brand" />
                </div>
              )}

              {/* Activity info */}
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{activity.title}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                  <Clock className="w-3 h-3" />
                  <span>
                    {formatDistanceToNow(new Date(activity.progress.lastAccessedAt), {
                      addSuffix: true,
                    })}
                  </span>
                </div>
              </div>

              {/* Resume button */}
              <Button size="sm" variant="ghost" asChild>
                <Link to={`/courses/${activity.id}`}>
                  Resume
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Link>
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </section>
  )
}
