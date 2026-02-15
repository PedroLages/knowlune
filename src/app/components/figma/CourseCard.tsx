import { Link } from 'react-router'
import { Clock, Video, FileText, BookOpen } from 'lucide-react'
import { Card } from '@/app/components/ui/card'
import { Badge } from '@/app/components/ui/badge'
import { ProgressRing } from './ProgressRing'
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
  return (
    <Link
      to={`/courses/${course.id}`}
      className="rounded-[24px] focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 outline-none block"
    >
      <Card className="group bg-card rounded-[24px] border-0 shadow-sm overflow-hidden hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 motion-reduce:hover:scale-100 cursor-pointer">
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

        <div className="p-5">
          <h3 className="font-bold text-base mb-1 group-hover:text-blue-600 transition-colors line-clamp-2">
            {course.title}
          </h3>
          <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{course.description}</p>

          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
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
