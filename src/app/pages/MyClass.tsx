import { useState, useMemo } from 'react'
import { Link } from 'react-router'
import { Clock, CheckCircle, PlayCircle, ArrowRight } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/app/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select'
import { ProgressStats } from '@/app/components/ProgressStats'
import { ProgressCourseCard } from '@/app/components/ProgressCourseCard'
import { allCourses } from '@/data/courses'
import { getCoursesInProgress, getCompletedCourses, getNotStartedCourses } from '@/lib/progress'

type SortOption = 'recent' | 'progress-high' | 'progress-low' | 'alpha' | 'time'

export default function MyClass() {
  const [sortBy, setSortBy] = useState<SortOption>('recent')

  const inProgress = getCoursesInProgress(allCourses)
  const completed = getCompletedCourses(allCourses)
  const notStarted = getNotStartedCourses(allCourses)

  const hasAnyCourses = inProgress.length > 0 || completed.length > 0 || notStarted.length > 0

  // Get all courses with their status
  const allCoursesWithStatus = useMemo(() => {
    return allCourses.map(course => {
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
  }, [inProgress, completed])

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

  if (!hasAnyCourses) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">My Progress</h1>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <PlayCircle className="w-12 h-12 text-muted-foreground mb-4" aria-hidden="true" />
          <h2 className="text-xl font-semibold mb-2">Ready to start learning?</h2>
          <p className="text-muted-foreground mb-6 max-w-md">
            Browse our course catalog to find the perfect course to kickstart your learning journey.
          </p>
          <Button asChild className="bg-blue-600 hover:bg-blue-700">
            <Link to="/courses">
              Browse All Courses
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">My Progress</h1>

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
                <SelectTrigger className="w-full sm:w-[200px]">
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
                  <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl mb-4">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <Clock className="w-6 h-6 text-blue-600" />
                      In Progress
                    </h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
                    {sortCourses(inProgressWithStatus).map(course => {
                      // Type guard: course is guaranteed to be in-progress status
                      if (course.status !== 'in-progress') return null
                      return (
                        <ProgressCourseCard
                          key={course.id}
                          course={course}
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
                  <div className="bg-green-50 dark:bg-green-900/10 p-4 rounded-xl mb-4">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <CheckCircle className="w-6 h-6 text-green-600" />
                      Completed
                    </h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
                    {sortCourses(completedWithStatus).map(course => (
                      <ProgressCourseCard key={course.id} course={course} status="completed" />
                    ))}
                  </div>
                </section>
              )}

              {notStarted.length > 0 && (
                <section>
                  <div className="bg-gray-50 dark:bg-gray-900/10 p-4 rounded-xl mb-4">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <PlayCircle className="w-6 h-6 text-muted-foreground" />
                      Not Started
                    </h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
                    {sortCourses(notStartedWithStatus).map(course => (
                      <ProgressCourseCard key={course.id} course={course} status="not-started" />
                    ))}
                  </div>
                </section>
              )}

              {inProgress.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Clock className="w-12 h-12 text-muted-foreground mb-4" aria-hidden="true" />
                  <h2 className="text-xl font-semibold mb-2">No courses in progress</h2>
                  <p className="text-muted-foreground mb-6 max-w-md">
                    Start a new course from your library to begin learning!
                  </p>
                  <Button asChild className="bg-blue-600 hover:bg-blue-700">
                    <Link to="/library">
                      Go to Library
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Link>
                  </Button>
                </div>
              )}
            </TabsContent>

            {/* All Courses View */}
            <TabsContent value="all">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sortCourses(allCoursesWithStatus).map(course => (
                  <ProgressCourseCard
                    key={course.id}
                    course={course}
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
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {sortCourses(courses).map(course => (
                      <ProgressCourseCard
                        key={course.id}
                        course={course}
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
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {sortCourses(courses).map(course => (
                        <ProgressCourseCard
                          key={course.id}
                          course={course}
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
