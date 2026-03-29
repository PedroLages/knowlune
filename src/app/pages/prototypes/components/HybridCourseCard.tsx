import { Link } from 'react-router'
import { Clock, Video, FileText, BookOpen } from 'lucide-react'
import { getProgress } from '@/lib/progress'
import type { Course, CourseCategory } from '@/data/types'

const categoryLabels: Record<CourseCategory, string> = {
  'behavioral-analysis': 'Behavioral Analysis',
  'influence-authority': 'Influence & Authority',
  'confidence-mastery': 'Confidence Mastery',
  'operative-training': 'Operative Training',
  'research-library': 'Research Library',
}

interface HybridCourseCardProps {
  course: Course
  completionPercent: number
}

export function HybridCourseCard({ course, completionPercent }: HybridCourseCardProps) {
  const firstLesson = course.modules[0]?.lessons[0]?.id
  const resumeLesson = getProgress(course.id).lastWatchedLesson ?? firstLesson
  const lessonLink = resumeLesson
    ? `/courses/${course.id}/lessons/${resumeLesson}`
    : `/courses/${course.id}`

  return (
    <Link
      to={lessonLink}
      className="rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 outline-none block h-full"
    >
      <div className="bg-white rounded-xl border border-neutral-100 shadow-xs hover:shadow-md transition-shadow duration-200 overflow-hidden h-full flex flex-col group">
        {/* Cover image */}
        <div className="relative h-44 bg-neutral-100 overflow-hidden">
          {course.coverImage ? (
            <img
              src={`${course.coverImage}-640w.webp`}
              alt={course.title}
              className="w-full h-full object-cover rounded-t-xl transition-opacity duration-200 group-hover:opacity-95"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <BookOpen className="size-12 text-neutral-300" aria-hidden="true" />
            </div>
          )}

          {/* Category badge */}
          <span className="absolute top-3 left-3 bg-neutral-100 text-neutral-600 text-xs font-medium px-2.5 py-1 rounded-md">
            {categoryLabels[course.category]}
          </span>
        </div>

        {/* Content */}
        <div className="p-5 flex flex-col flex-1">
          <h3 className="font-semibold text-base text-neutral-900 group-hover:text-brand transition-colors mb-1 line-clamp-2">
            {course.title}
          </h3>
          <p className="text-sm text-neutral-500 mb-3 line-clamp-2">{course.description}</p>

          {/* Metadata */}
          <div className="flex items-center gap-3 text-xs text-neutral-400 mt-auto">
            <span className="flex items-center gap-1">
              <Video className="w-3.5 h-3.5" aria-hidden="true" />
              {course.totalVideos} videos
            </span>
            <span className="flex items-center gap-1">
              <FileText className="w-3.5 h-3.5" aria-hidden="true" />
              {course.totalPDFs} docs
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" aria-hidden="true" />
              {course.estimatedHours}h
            </span>
          </div>

          {/* Progress bar */}
          {completionPercent > 0 && (
            <div className="mt-3">
              <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand rounded-full transition-all duration-300"
                  style={{ width: `${completionPercent}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}
