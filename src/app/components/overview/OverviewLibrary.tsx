import { Link } from 'react-router'
import { ArrowRight } from 'lucide-react'
import { ImportedCourseCard } from '@/app/components/figma/ImportedCourseCard'
import type { LibraryCourse } from '@/lib/overviewDashboard'

interface OverviewLibraryProps {
  courses: LibraryCourse[]
  allTags: string[]
}

export function OverviewLibrary({ courses, allTags }: OverviewLibraryProps) {
  if (courses.length === 0) return null

  return (
    <section aria-labelledby="overview-library-title" data-testid="section-library">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Library
          </p>
          <h2 id="overview-library-title" className="mt-1 text-xl font-semibold">
            Keep learning
          </h2>
        </div>
        <Link
          to="/courses"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-brand transition-colors hover:text-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        >
          View all
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
      <div
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
        data-testid="library-section"
      >
        {courses.map(({ course, completionPercent }) => (
          <ImportedCourseCard
            key={course.id}
            course={course}
            allTags={allTags}
            completionPercent={completionPercent}
            readOnly
          />
        ))}
      </div>
    </section>
  )
}
