import { Link } from 'react-router'
import { Clock, Video, FileText, BookOpen, Play } from 'lucide-react'
import { Card } from '@/app/components/ui/card'
import { Badge } from '@/app/components/ui/badge'
import { ProgressRing } from './ProgressRing'
import { getProgress } from '@/lib/progress'
import type { Course, CourseCategory } from '@/data/types'

const categoryLabels: Record<CourseCategory, string> = {
  'behavioral-analysis': 'Behavioral Analysis',
  'influence-authority': 'Influence & Authority',
  'confidence-mastery': 'Confidence Mastery',
  'operative-training': 'Operative Training',
  'research-library': 'Research Library',
}

const categoryColors: Record<CourseCategory, string> = {
  'behavioral-analysis':
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  'influence-authority': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  'confidence-mastery': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  'operative-training': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  'research-library': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
}

interface CourseCardProps {
  course: Course
  completionPercent: number
}

export function CourseCard({ course, completionPercent }: CourseCardProps) {
  const firstLesson = course.modules[0]?.lessons[0]?.id
  const resumeLesson = getProgress(course.id).lastWatchedLesson ?? firstLesson
  const lessonLink = resumeLesson
    ? `/courses/${course.id}/${resumeLesson}`
    : `/courses/${course.id}`

  return (
    <Link
      to={lessonLink}
      className="rounded-[24px] focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 outline-none block h-full"
    >
      <Card className="group bg-card border-0 shadow-sm overflow-hidden hover:shadow-xl hover:scale-[1.02] transition-all duration-300 motion-reduce:hover:scale-100 cursor-pointer h-full flex flex-col">
        <div className="relative h-44 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-950/50 dark:to-indigo-950/50 flex items-center justify-center overflow-hidden">
          {course.coverImage ? (
            <picture className="absolute inset-0">
              <source
                type="image/webp"
                srcSet={`
                  ${course.coverImage}-320w.webp 320w,
                  ${course.coverImage}-640w.webp 640w,
                  ${course.coverImage}-768w.webp 768w,
                  ${course.coverImage}-1024w.webp 1024w
                `}
                sizes="(max-width: 640px) 320px, (max-width: 1024px) 640px, 768px"
              />
              <img
                src={`${course.coverImage}-768w.png`}
                srcSet={`
                  ${course.coverImage}-320w.png 320w,
                  ${course.coverImage}-640w.png 640w,
                  ${course.coverImage}-768w.png 768w,
                  ${course.coverImage}-1024w.png 1024w
                `}
                sizes="(max-width: 640px) 320px, (max-width: 1024px) 640px, 768px"
                alt={course.title}
                className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
              />
            </picture>
          ) : (
            <BookOpen className="h-16 w-16 text-blue-300 dark:text-blue-600" />
          )}
          {/* Hover play overlay */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/35 transition-colors duration-300 flex items-center justify-center pointer-events-none">
            <div className="relative opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100 transition-all duration-300 ease-out">
              {/* Blue glow depth layer */}
              <div className="absolute -inset-3 rounded-full bg-brand/50 blur-lg" />
              {/* Expanding pulse ring */}
              <span className="play-pulse-ring absolute inset-0 rounded-full bg-white/60" />
              {/* White play button */}
              <div className="relative rounded-full bg-white p-4 shadow-2xl">
                <Play className="h-7 w-7 text-brand fill-brand translate-x-0.5" aria-hidden="true" />
              </div>
            </div>
          </div>

          {completionPercent > 0 && (
            <div className="absolute top-3 right-3">
              <ProgressRing percent={completionPercent} size={40} strokeWidth={3} />
            </div>
          )}
          <Badge
            className={`absolute top-3 left-3 border-0 text-xs ${categoryColors[course.category]}`}
          >
            {categoryLabels[course.category]}
          </Badge>
        </div>

        <div className="p-5 flex flex-col flex-1">
          <h3 className="font-semibold text-base mb-1 group-hover:text-brand transition-colors line-clamp-2">
            {course.title}
          </h3>
          <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{course.description}</p>

          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-auto">
            <span className="flex items-center gap-1">
              <Video className="h-3.5 w-3.5" aria-hidden="true" />
              {course.totalVideos} videos
            </span>
            <span className="flex items-center gap-1">
              <FileText className="h-3.5 w-3.5" aria-hidden="true" />
              {course.totalPDFs} docs
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              {course.estimatedHours}h
            </span>
          </div>
        </div>
      </Card>
    </Link>
  )
}

export { categoryLabels, categoryColors }
