import { Card, CardContent } from '@/app/components/ui/card'
import { Badge } from '@/app/components/ui/badge'
import { Progress } from '@/app/components/ui/progress'
import { Link } from 'react-router'
import { BookOpen, PlayCircle, CheckCircle, Clock } from 'lucide-react'
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

  return (
    <Link to={`/courses/${course.id}`}>
      <Card className="group hover:shadow-xl hover:scale-[1.02] transition-all duration-300 cursor-pointer overflow-hidden border-2 border-transparent hover:border-blue-200">
        <CardContent className="p-0">
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
          </div>

          {/* Card Content */}
          <div className="p-5">
            {/* Category Badge */}
            <Badge
              variant="secondary"
              className="mb-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200"
            >
              {formatCategory(course.category)}
            </Badge>

            {/* Title */}
            <h3 className="font-semibold text-sm line-clamp-2 mb-2 group-hover:text-brand transition-colors">
              {course.title}
            </h3>

            {/* Metadata */}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <PlayCircle className="w-3 h-3" />
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
