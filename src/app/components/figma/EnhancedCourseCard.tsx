import { Card, CardContent } from '@/app/components/ui/card'
import { Badge } from '@/app/components/ui/badge'
import { Progress } from '@/app/components/ui/progress'
import { Link } from 'react-router'
import { BookOpen, Play, CheckCircle, Clock } from 'lucide-react'
import { getProgress } from '@/lib/progress'
import type { Course } from '@/data/types'

interface EnhancedCourseCardProps {
  course: Course & { completionPercent?: number }
}

function formatCategory(slug: string): string {
  return slug
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export function EnhancedCourseCard({ course }: EnhancedCourseCardProps) {
  const totalLessons = course.modules.reduce((sum, m) => sum + m.lessons.length, 0)
  const isInProgress = course.completionPercent && course.completionPercent > 0
  const isCompleted = course.completionPercent === 100
  const firstLesson = course.modules[0]?.lessons[0]?.id
  const resumeLesson = getProgress(course.id).lastWatchedLesson ?? firstLesson
  const lessonLink = resumeLesson
    ? `/courses/${course.id}/${resumeLesson}`
    : `/courses/${course.id}`

  return (
    <Link to={lessonLink} className="block h-full">
      <Card className="group hover:shadow-xl hover:scale-[1.02] transition-all duration-300 cursor-pointer overflow-hidden border-2 border-transparent hover:border-blue-200 h-full flex flex-col">
        <CardContent className="p-0 flex flex-col flex-1">
          {/* Cover Image */}
          <div className="relative">
            {course.coverImage ? (
              <img
                src={`${course.coverImage}-640w.webp`}
                alt={course.title}
                className="w-full h-32 object-cover"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-32 bg-gradient-to-br from-blue-100 via-indigo-100 to-purple-100 dark:from-blue-900/30 dark:via-indigo-900/30 dark:to-purple-900/30 flex items-center justify-center">
                <BookOpen className="w-12 h-12 text-brand" />
              </div>
            )}

            {/* Progress Badge Overlay */}
            {isInProgress && !isCompleted && (
              <div className="absolute top-2 right-2 bg-card/95 backdrop-blur-sm rounded-full px-3 py-1 text-xs font-bold text-brand shadow-lg">
                {course.completionPercent}%
              </div>
            )}

            {/* Completed Badge */}
            {isCompleted && (
              <div className="absolute top-2 right-2 bg-success text-success-foreground rounded-full px-3 py-1 text-xs font-bold shadow-lg flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                Completed
              </div>
            )}

            {/* Hover play overlay */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/35 transition-colors duration-300 flex items-center justify-center pointer-events-none">
              <div className="relative opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100 transition-all duration-300 ease-out">
                <div className="absolute -inset-3 rounded-full bg-brand/50 blur-lg" />
                <span className="play-pulse-ring absolute inset-0 rounded-full bg-white/60" />
                <div className="relative rounded-full bg-white p-4 shadow-2xl">
                  <Play className="h-7 w-7 text-brand fill-brand translate-x-0.5" aria-hidden="true" />
                </div>
              </div>
            </div>
          </div>

          {/* Card Content */}
          <div className="p-5 flex-1 flex flex-col">
            {/* Category Badge */}
            <Badge
              variant="secondary"
              className="mb-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200"
            >
              {formatCategory(course.category)}
            </Badge>

            {/* Title */}
            <h3 className="font-semibold text-base line-clamp-2 mb-2 group-hover:text-brand transition-colors">
              {course.title}
            </h3>

            {/* Metadata */}
            <div className="flex items-center justify-between text-xs text-muted-foreground mt-auto">
              <span className="flex items-center gap-1">
                <Play className="h-3.5 w-3.5" aria-hidden="true" />
                {totalLessons} {totalLessons === 1 ? 'lesson' : 'lessons'}
              </span>

              {isInProgress && !isCompleted && (
                <span className="flex items-center gap-1 text-brand font-medium">
                  <Clock className="w-3 h-3" />
                  In Progress
                </span>
              )}

              {!isInProgress && !isCompleted && (
                <span className="text-muted-foreground">Not Started</span>
              )}
            </div>

            {/* Progress Bar for In Progress */}
            {isInProgress && !isCompleted && (
              <div className="mt-3">
                <Progress value={course.completionPercent} className="h-1.5" />
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
