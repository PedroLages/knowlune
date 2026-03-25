import { useState } from 'react'
import { Clock, CheckCircle, PlayCircle } from 'lucide-react'
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

  const inProgress = getCoursesInProgress(allCourses)
  const completed = getCompletedCourses(allCourses)
  const notStarted = getNotStartedCourses(allCourses)

  const hasAnyCourses = inProgress.length > 0 || completed.length > 0 || notStarted.length > 0

  // Get all courses with their status
  const allCoursesWithStatus = allCourses.map(course => {
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
  })

  // Sort function
  const sortCourses = (courses: typeof allCoursesWithStatus) => {
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
  }

  // Group courses by category
  const coursesByCategory = (() => {
    const groups: Record<string, typeof allCoursesWithStatus> = {}
    allCoursesWithStatus.forEach(course => {
      if (!groups[course.category]) {
        groups[course.category] = []
      }
      groups[course.category].push(course)
    })
    return groups
  })()

  // Group courses by difficulty
  const coursesByDifficulty = (() => {
    const groups: Record<string, typeof allCoursesWithStatus> = {}
    allCoursesWithStatus.forEach(course => {
      if (!groups[course.difficulty]) {
        groups[course.difficulty] = []
      }
      groups[course.difficulty].push(course)
    })
    return groups
  })()

  // Filter courses by status from allCoursesWithStatus
  const inProgressWithStatus = allCoursesWithStatus.filter(c => c.status === 'in-progress')
  const completedWithStatus = allCoursesWithStatus.filter(c => c.status === 'completed')
  const notStartedWithStatus = allCoursesWithStatus.filter(c => c.status === 'not-started')

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

              <Select value={sortBy} onValueChange={value => setSortBy(value as SortOption)}>
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
                      <Clock className="w-6 h-6 text-brand" />
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
                      <CheckCircle className="w-6 h-6 text-success" />
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
                      <PlayCircle className="w-6 h-6 text-muted-foreground" />
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
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {sortCourses(allCoursesWithStatus).map(course => (
                  <CourseCard
                    key={course.id}
                    course={course}
                    variant="progress"
                    status={course.status}
                    completionPercent={'completionPercent' in course ? course.completionPercent : 0}
                    lastAccessedAt={'lastAccessedAt' in course ? course.lastAccessedAt : undefined}
                  />
                ))}
              </div>
            </TabsContent>

            {/* By Category View */}
            <TabsContent value="by-category">
              {Object.entries(coursesByCategory).map(([category, courses]) => (
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
              ))}
            </TabsContent>

            {/* By Difficulty View */}
            <TabsContent value="by-difficulty">
              {['Beginner', 'Intermediate', 'Advanced'].map(difficulty => {
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
              })}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
