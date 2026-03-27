import { useState, useEffect, useMemo, useCallback } from 'react'
import { Clock, CheckCircle, PlayCircle } from 'lucide-react'
import { Skeleton } from '@/app/components/ui/skeleton'
import { EmptyState } from '@/app/components/EmptyState'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/app/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select'
import { ProgressStats } from '@/app/components/ProgressStats'
import { CourseCard } from '@/app/components/figma/CourseCard'
import { useCourseStore } from '@/stores/useCourseStore'
import { getCoursesInProgress, getCompletedCourses, getNotStartedCourses } from '@/lib/progress'

type SortOption = 'recent' | 'progress-high' | 'progress-low' | 'alpha' | 'time'

export default function MyClass() {
  const allCourses = useCourseStore(s => s.courses)
  const [sortBy, setSortBy] = useState<SortOption>('recent')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 500)
    return () => clearTimeout(timer)
  }, [])

  const inProgress = useMemo(() => getCoursesInProgress(allCourses), [allCourses])
  const completed = useMemo(() => getCompletedCourses(allCourses), [allCourses])
  const notStarted = useMemo(() => getNotStartedCourses(allCourses), [allCourses])

  const hasAnyCourses = inProgress.length > 0 || completed.length > 0 || notStarted.length > 0

  // Get all courses with their status
  const allCoursesWithStatus = useMemo(
    () =>
      allCourses.map(course => {
        const inProgressCourse = inProgress.find(c => c.id === course.id)
        const completedCourse = completed.find(c => c.id === course.id)

        if (inProgressCourse) {
          return {
            ...course,
            status: 'in-progress' as const,
            completionPercent: inProgressCourse.completionPercent,
            lastAccessedAt: inProgressCourse.progress.lastAccessedAt,
          }
        }
        if (completedCourse) {
          return { ...course, status: 'completed' as const }
        }
        return { ...course, status: 'not-started' as const }
      }),
    [allCourses, inProgress, completed]
  )

  // Sort function
  const sortCourses = useCallback(
    (courses: typeof allCoursesWithStatus) => {
      switch (sortBy) {
        case 'recent':
          return [...courses].sort((a, b) => {
            const aTime = 'lastAccessedAt' in a ? new Date(a.lastAccessedAt).getTime() : 0
            const bTime = 'lastAccessedAt' in b ? new Date(b.lastAccessedAt).getTime() : 0
            return bTime - aTime
          })
        case 'progress-high':
          return [...courses].sort((a, b) => {
            const aProgress = 'completionPercent' in a ? a.completionPercent : 0
            const bProgress = 'completionPercent' in b ? b.completionPercent : 0
            return bProgress - aProgress
          })
        case 'progress-low':
          return [...courses].sort((a, b) => {
            const aProgress = 'completionPercent' in a ? a.completionPercent : 0
            const bProgress = 'completionPercent' in b ? b.completionPercent : 0
            return aProgress - bProgress
          })
        case 'alpha':
          return [...courses].sort((a, b) => a.title.localeCompare(b.title))
        case 'time':
          // Sort by total lessons (estimated time)
          return [...courses].sort((a, b) => {
            const aLessons = a.modules.reduce((sum, m) => sum + m.lessons.length, 0)
            const bLessons = b.modules.reduce((sum, m) => sum + m.lessons.length, 0)
            return aLessons - bLessons
          })
        default:
          return courses
      }
    },
    [sortBy]
  )

  // Group courses by category
  const coursesByCategory = useMemo(() => {
    const groups: Record<string, typeof allCoursesWithStatus> = {}
    allCoursesWithStatus.forEach(course => {
      if (!groups[course.category]) {
        groups[course.category] = []
      }
      groups[course.category].push(course)
    })
    return groups
  }, [allCoursesWithStatus])

  // Group courses by difficulty
  const coursesByDifficulty = useMemo(() => {
    const groups: Record<string, typeof allCoursesWithStatus> = {}
    allCoursesWithStatus.forEach(course => {
      if (!groups[course.difficulty]) {
        groups[course.difficulty] = []
      }
      groups[course.difficulty].push(course)
    })
    return groups
  }, [allCoursesWithStatus])

  // Filter courses by status from allCoursesWithStatus
  const inProgressWithStatus = useMemo(
    () => allCoursesWithStatus.filter(c => c.status === 'in-progress'),
    [allCoursesWithStatus]
  )
  const completedWithStatus = useMemo(
    () => allCoursesWithStatus.filter(c => c.status === 'completed'),
    [allCoursesWithStatus]
  )
  const notStartedWithStatus = useMemo(
    () => allCoursesWithStatus.filter(c => c.status === 'not-started'),
    [allCoursesWithStatus]
  )

  const handleSortChange = useCallback((value: string) => {
    setSortBy(value as SortOption)
  }, [])

  if (isLoading) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Loading my courses">
        {/* Title skeleton */}
        <Skeleton className="h-8 w-40" />

        {/* ProgressStats skeleton */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="rounded-2xl border border-border/50 p-4">
              <Skeleton className="h-3 w-20 mb-2" />
              <Skeleton className="h-7 w-12" />
            </div>
          ))}
        </div>

        {/* Tabs + Sort skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <Skeleton className="h-10 w-80 rounded-lg" />
          <Skeleton className="h-10 w-[200px] rounded-lg" />
        </div>

        {/* Course cards grid skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="rounded-2xl border border-border/50 overflow-hidden">
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

  if (!hasAnyCourses) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">My Courses</h1>
        <EmptyState
          data-testid="empty-state-my-courses"
          icon={PlayCircle}
          title="Ready to start learning?"
          description="Browse our course catalog to find the perfect course to kickstart your learning journey."
          actionLabel="Browse All Courses"
          actionHref="/courses"
        />
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">My Courses</h1>

      {/* Stats Dashboard */}
      <ProgressStats courses={allCourses} />

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1">
          <Tabs defaultValue="by-status" className="w-full">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <TabsList className="overflow-x-auto">
                <TabsTrigger value="by-status">By Status</TabsTrigger>
                <TabsTrigger value="all">All Courses</TabsTrigger>
                <TabsTrigger value="by-category">By Category</TabsTrigger>
                <TabsTrigger value="by-difficulty">By Difficulty</TabsTrigger>
              </TabsList>

              <Select value={sortBy} onValueChange={handleSortChange}>
                <SelectTrigger className="w-full sm:w-[200px]" aria-label="Sort courses">
                  <SelectValue placeholder="Sort by..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent">Recent Activity</SelectItem>
                  <SelectItem value="progress-high">Progress (High to Low)</SelectItem>
                  <SelectItem value="progress-low">Progress (Low to High)</SelectItem>
                  <SelectItem value="alpha">A-Z</SelectItem>
                  <SelectItem value="time">Estimated Time</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* By Status View */}
            <TabsContent value="by-status">
              {inProgress.length > 0 && (
                <section className="mb-8">
                  <div className="bg-brand-soft p-4 rounded-xl mb-4">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <Clock className="size-6 text-brand" />
                      In Progress
                    </h2>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 stagger-children">
                    {sortCourses(inProgressWithStatus).map(course => {
                      // Type guard: course is guaranteed to be in-progress status
                      if (course.status !== 'in-progress') return null
                      return (
                        <CourseCard
                          key={course.id}
                          course={course}
                          variant="progress"
                          status="in-progress"
                          completionPercent={course.completionPercent}
                          lastAccessedAt={course.lastAccessedAt}
                        />
                      )
                    })}
                  </div>
                </section>
              )}

              {completed.length > 0 && (
                <section className="mb-8">
                  <div className="bg-success-soft p-4 rounded-xl mb-4">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <CheckCircle className="size-6 text-success" />
                      Completed
                    </h2>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 stagger-children">
                    {sortCourses(completedWithStatus).map(course => (
                      <CourseCard
                        key={course.id}
                        course={course}
                        variant="progress"
                        status="completed"
                      />
                    ))}
                  </div>
                </section>
              )}

              {notStarted.length > 0 && (
                <section>
                  <div className="bg-muted p-4 rounded-xl mb-4">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <PlayCircle className="size-6 text-muted-foreground" />
                      Not Started
                    </h2>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 stagger-children">
                    {sortCourses(notStartedWithStatus).map(course => (
                      <CourseCard
                        key={course.id}
                        course={course}
                        variant="progress"
                        status="not-started"
                      />
                    ))}
                  </div>
                </section>
              )}

              {inProgress.length === 0 && (
                <EmptyState
                  data-testid="empty-state-no-in-progress"
                  icon={Clock}
                  headingLevel={3}
                  title="No courses in progress"
                  description="Start a new course to begin learning!"
                  actionLabel="Browse Courses"
                  actionHref="/courses"
                />
              )}
            </TabsContent>

            {/* All Courses View */}
            <TabsContent value="all">
              {allCoursesWithStatus.length === 0 ? (
                <EmptyState
                  icon={PlayCircle}
                  headingLevel={3}
                  title="No courses found"
                  description="Browse the course catalog to add courses to your library."
                  actionLabel="Browse Courses"
                  actionHref="/courses"
                />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {sortCourses(allCoursesWithStatus).map(course => (
                    <CourseCard
                      key={course.id}
                      course={course}
                      variant="progress"
                      status={course.status}
                      completionPercent={
                        'completionPercent' in course ? course.completionPercent : 0
                      }
                      lastAccessedAt={
                        'lastAccessedAt' in course ? course.lastAccessedAt : undefined
                      }
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            {/* By Category View */}
            <TabsContent value="by-category">
              {Object.keys(coursesByCategory).length === 0 ? (
                <EmptyState
                  icon={PlayCircle}
                  headingLevel={3}
                  title="No courses in any category"
                  description="Start a course to see it organized by category."
                  actionLabel="Browse Courses"
                  actionHref="/courses"
                />
              ) : (
                Object.entries(coursesByCategory).map(([category, courses]) => (
                  <section key={category} className="mb-8">
                    <h2 className="text-lg font-semibold mb-4">{category}</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                      {sortCourses(courses).map(course => (
                        <CourseCard
                          key={course.id}
                          course={course}
                          variant="progress"
                          status={course.status}
                          completionPercent={
                            'completionPercent' in course ? course.completionPercent : 0
                          }
                          lastAccessedAt={
                            'lastAccessedAt' in course ? course.lastAccessedAt : undefined
                          }
                        />
                      ))}
                    </div>
                  </section>
                ))
              )}
            </TabsContent>

            {/* By Difficulty View */}
            <TabsContent value="by-difficulty">
              {['Beginner', 'Intermediate', 'Advanced'].every(
                d => !coursesByDifficulty[d] || coursesByDifficulty[d].length === 0
              ) ? (
                <EmptyState
                  icon={PlayCircle}
                  headingLevel={3}
                  title="No courses at any difficulty level"
                  description="Start a course to see it organized by difficulty."
                  actionLabel="Browse Courses"
                  actionHref="/courses"
                />
              ) : (
                ['Beginner', 'Intermediate', 'Advanced'].map(difficulty => {
                  const courses = coursesByDifficulty[difficulty]
                  if (!courses || courses.length === 0) return null

                  return (
                    <section key={difficulty} className="mb-8">
                      <h2 className="text-lg font-semibold mb-4">{difficulty}</h2>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                        {sortCourses(courses).map(course => (
                          <CourseCard
                            key={course.id}
                            course={course}
                            variant="progress"
                            status={course.status}
                            completionPercent={
                              'completionPercent' in course ? course.completionPercent : 0
                            }
                            lastAccessedAt={
                              'lastAccessedAt' in course ? course.lastAccessedAt : undefined
                            }
                          />
                        ))}
                      </div>
                    </section>
                  )
                })
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
