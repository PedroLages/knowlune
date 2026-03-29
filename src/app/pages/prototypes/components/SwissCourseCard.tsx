import { Link } from 'react-router'
import type { Course } from '@/data/types'
import { getProgress } from '@/lib/progress'

interface SwissCourseCardProps {
  course: Course
  completionPercent: number
}

/** Convert category slug to title case: 'behavioral-analysis' -> 'Behavioral Analysis' */
function formatCategory(slug: string): string {
  return slug
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export function SwissCourseCard({ course, completionPercent }: SwissCourseCardProps) {
  const progress = getProgress(course.id)
  const firstLesson = course.modules[0]?.lessons[0]?.id
  const resumeLesson = progress.lastWatchedLesson ?? firstLesson
  const lessonLink = resumeLesson
    ? `/courses/${course.id}/lessons/${resumeLesson}`
    : `/courses/${course.id}`

  const imageSrc = course.coverImage ? `${course.coverImage}-640w.webp` : undefined

  return (
    <Link
      to={lessonLink}
      className="group block border border-neutral-200 bg-white transition-colors hover:border-neutral-900"
    >
      {/* Cover image */}
      {imageSrc && (
        <div className="relative h-44 overflow-hidden">
          <img src={imageSrc} alt={course.title} className="w-full h-full object-cover" />
          {/* Red bottom border on hover */}
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#DC2626] opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      )}

      {/* Content */}
      <div className="p-5">
        {/* Category */}
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-neutral-400 mb-1">
          {formatCategory(course.category)}
        </p>

        {/* Title */}
        <h3 className="text-base font-bold text-black mb-1">{course.title}</h3>

        {/* Description */}
        <p className="text-sm text-neutral-500 line-clamp-2 mb-3">{course.description}</p>

        {/* Metadata row */}
        <p className="text-xs text-neutral-400 mb-4">
          {course.totalVideos} videos | {course.totalPDFs} docs | {course.estimatedHours}h
        </p>

        {/* Progress bar */}
        <div className="h-[2px] w-full bg-neutral-100">
          <div
            className="h-full bg-[#DC2626] transition-all"
            style={{ width: `${completionPercent}%` }}
          />
        </div>
      </div>
    </Link>
  )
}
