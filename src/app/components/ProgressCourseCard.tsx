import { Link } from 'react-router'
import { CheckCircle, Clock } from 'lucide-react'
import { Card, CardContent } from '@/app/components/ui/card'
import { Progress } from '@/app/components/ui/progress'
import { Badge } from '@/app/components/ui/badge'
import { Button } from '@/app/components/ui/button'
import { Course } from '@/data/types'
import { getTimeRemaining } from '@/lib/progress'

interface ProgressCourseCardProps {
  course: Course
  status: 'in-progress' | 'completed' | 'not-started'
  completionPercent?: number
  lastAccessedAt?: string
}

function formatRelativeTime(isoDate: string): string {
  const now = new Date()
  const date = new Date(isoDate)
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diffInSeconds < 60) return 'just now'
  if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60)
    return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`
  }
  if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600)
    return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`
  }
  if (diffInSeconds < 604800) {
    const days = Math.floor(diffInSeconds / 86400)
    return `${days} ${days === 1 ? 'day' : 'days'} ago`
  }
  if (diffInSeconds < 2592000) {
    const weeks = Math.floor(diffInSeconds / 604800)
    return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`
  }
  const months = Math.floor(diffInSeconds / 2592000)
  return `${months} ${months === 1 ? 'month' : 'months'} ago`
}

function getDifficultyBadgeVariant(
  difficulty: string
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (difficulty.toLowerCase()) {
    case 'beginner':
      return 'secondary' // Will style with green
    case 'intermediate':
      return 'default' // Will style with amber
    case 'advanced':
      return 'destructive' // Uses red by default
    default:
      return 'outline'
  }
}

export function ProgressCourseCard({
  course,
  status,
  completionPercent = 0,
  lastAccessedAt,
}: ProgressCourseCardProps) {
  const timeRemaining = status === 'in-progress' ? getTimeRemaining(course.id, course) : 0
  const totalLessons = course.modules.reduce((sum, m) => sum + m.lessons.length, 0)

  return (
    <Card
      className={`card-hover-lift h-full ${
        status === 'completed'
          ? 'border-green-200 dark:border-green-800'
          : status === 'not-started'
            ? 'opacity-80 hover:opacity-100'
            : ''
      }`}
    >
      <CardContent className="p-0">
        <div className="relative">
          <img
            src={`${course.coverImage}-640w.webp`}
            alt={course.title}
            className="w-full h-36 object-cover rounded-t-[24px]"
            loading="lazy"
          />
          {status === 'completed' && (
            <div
              className="absolute top-2 right-2 bg-success text-success-foreground rounded-full p-1"
              role="status"
              aria-label="Course completed"
            >
              <CheckCircle className="w-4 h-4" aria-hidden="true" />
            </div>
          )}
        </div>
        <div className="p-5 flex flex-col gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="badge-entrance">
              {course.category}
            </Badge>
            <Badge
              variant={getDifficultyBadgeVariant(course.difficulty)}
              className={`badge-entrance ${
                course.difficulty.toLowerCase() === 'beginner'
                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100 hover:bg-green-100 dark:hover:bg-green-900'
                  : course.difficulty.toLowerCase() === 'intermediate'
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100 hover:bg-amber-100 dark:hover:bg-amber-900'
                    : ''
              }`}
            >
              {course.difficulty}
            </Badge>
          </div>

          <h3 className="font-semibold line-clamp-2" title={course.title}>
            {course.title}
          </h3>

          {status === 'in-progress' && (
            <>
              <div className="flex items-center gap-2">
                <Progress
                  value={completionPercent}
                  className="h-2 flex-1"
                  aria-label={`${course.title}: ${completionPercent}% complete`}
                />
                <span className="text-sm font-medium">{completionPercent}%</span>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                {lastAccessedAt && <span>{formatRelativeTime(lastAccessedAt)}</span>}
                {timeRemaining > 0 && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />~{timeRemaining}h remaining
                  </span>
                )}
              </div>
              <Button asChild className="button-press w-full bg-brand hover:bg-brand-hover mt-auto">
                <Link to={`/courses/${course.id}`}>
                  Resume Learning
                </Link>
              </Button>
            </>
          )}

          {status === 'completed' && (
            <>
              <p className="text-sm text-green-600 dark:text-green-400 font-medium">
                Completed • {totalLessons} lessons
              </p>
              <Button asChild variant="outline" className="button-press w-full mt-auto">
                <Link to={`/courses/${course.id}`}>
                  Review Course
                </Link>
              </Button>
            </>
          )}

          {status === 'not-started' && (
            <>
              <p className="text-xs text-muted-foreground">{totalLessons} lessons</p>
              <Button asChild className="button-press w-full bg-brand hover:bg-brand-hover mt-auto">
                <Link to={`/courses/${course.id}`}>
                  Start Course
                </Link>
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
