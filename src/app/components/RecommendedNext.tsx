import { useEffect, useMemo } from 'react'
import { Link } from 'react-router'
import { BookOpen, ArrowRight } from 'lucide-react'
import { Skeleton } from '@/app/components/ui/skeleton'
import { Button } from '@/app/components/ui/button'
import { CourseCard } from '@/app/components/figma/CourseCard'
import { useSessionStore } from '@/stores/useSessionStore'
import { getAllProgress } from '@/lib/progress'
import { getRecommendedCourses } from '@/lib/recommendations'
import { allCourses } from '@/data/courses'

function RecommendedNextSkeleton() {
  return (
    <div aria-hidden="true">
      <Skeleton className="h-6 w-44 mb-1" />
      <Skeleton className="h-4 w-64 mb-4" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="rounded-2xl border overflow-hidden">
            <Skeleton className="w-full h-36" />
            <div className="p-4">
              <Skeleton className="h-4 w-20 mb-2" />
              <Skeleton className="h-5 w-full mb-2" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div
      className="flex flex-col items-center justify-center py-10 text-center"
      data-testid="recommended-next-empty"
    >
      <div className="size-14 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-4">
        <BookOpen aria-hidden="true" className="size-7 text-brand" />
      </div>
      <p className="text-sm font-medium mb-1">No courses in progress</p>
      <p className="text-sm text-muted-foreground mb-4 max-w-xs">
        Start a course to see personalised recommendations here.
      </p>
      <Button asChild variant="outline" size="sm" className="rounded-xl">
        <Link to="/courses">
          Explore courses
          <ArrowRight aria-hidden="true" className="size-3.5 ml-1.5" />
        </Link>
      </Button>
    </div>
  )
}

export function RecommendedNext() {
  const { loadSessionStats, sessions, isLoading } = useSessionStore()

  useEffect(() => {
    loadSessionStats()
  }, [loadSessionStats])

  const recommendations = useMemo(() => {
    const allProgress = getAllProgress()

    // Build session counts per course for the last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000)
    const sessionCountsPerCourse: Record<string, number> = {}
    for (const session of sessions) {
      if (new Date(session.startTime) > thirtyDaysAgo) {
        sessionCountsPerCourse[session.courseId] =
          (sessionCountsPerCourse[session.courseId] ?? 0) + 1
      }
    }

    return getRecommendedCourses(allCourses, allProgress, sessionCountsPerCourse, 3)
  }, [sessions])

  if (isLoading) {
    return (
      <section aria-labelledby="recommended-next-heading">
        <h2 id="recommended-next-heading" className="text-xl mb-1">
          Recommended Next
        </h2>
        <p className="text-sm text-muted-foreground mb-4">Based on your learning activity</p>
        <RecommendedNextSkeleton />
      </section>
    )
  }

  return (
    <section
      aria-labelledby="recommended-next-heading"
      data-testid="recommended-next-section"
    >
      <h2 id="recommended-next-heading" className="text-xl mb-1">
        Recommended Next
      </h2>
      <p className="text-sm text-muted-foreground mb-4">Based on your learning activity</p>

      {recommendations.length === 0 ? (
        <EmptyState />
      ) : (
        <div
          className="grid grid-cols-1 sm:grid-cols-3 gap-4"
          data-testid="recommended-next-cards"
        >
          {recommendations.map(({ course, completionPercent }) => (
            <CourseCard
              key={course.id}
              course={course}
              variant="overview"
              completionPercent={completionPercent}
            />
          ))}
        </div>
      )}
    </section>
  )
}
