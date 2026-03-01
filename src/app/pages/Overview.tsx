import { useState, useEffect } from 'react'
import { Link } from 'react-router'
import { BookOpen, CheckCircle, FileText } from 'lucide-react'
import { Card, CardContent } from '@/app/components/ui/card'
import { Progress } from '@/app/components/ui/progress'
import { Skeleton } from '@/app/components/ui/skeleton'
import { EmptyState } from '@/app/components/EmptyState'
import { AchievementBanner } from '@/app/components/AchievementBanner'
import { RecentActivity } from '@/app/components/RecentActivity'
import { StatsCard } from '@/app/components/StatsCard'
import { QuickActions } from '@/app/components/QuickActions'
import { StudyStreakCalendar } from '@/app/components/StudyStreakCalendar'
import { CourseCard } from '@/app/components/figma/CourseCard'
import { ProgressChart } from '@/app/components/charts/ProgressChart'
import { allCourses } from '@/data/courses'
import {
  getCoursesInProgress,
  getCompletedCourses,
  getTotalCompletedLessons,
  getTotalStudyNotes,
  getRecentActivity,
  getLast7DaysLessonCompletions,
  getWeeklyChange,
  getAllProgress,
  getCourseCompletionPercent,
} from '@/lib/progress'
import { getActionsPerDay } from '@/lib/studyLog'

function formatCategory(slug: string): string {
  return slug
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export function Overview() {
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Simulate data loading
    const timer = setTimeout(() => setIsLoading(false), 500)
    return () => clearTimeout(timer)
  }, [])

  const inProgress = getCoursesInProgress(allCourses)
  const completed = getCompletedCourses(allCourses)
  const completedLessons = getTotalCompletedLessons()
  const [studyNotes, setStudyNotes] = useState(0)

  useEffect(() => {
    getTotalStudyNotes().then(setStudyNotes)
  }, [])
  const recentActivity = getRecentActivity(allCourses, 5)
  const lessonSparkline = getLast7DaysLessonCompletions()
  const lessonsChange = getWeeklyChange('lessons')
  const chartData = getActionsPerDay(14) // Last 14 days

  // Get last watched course/lesson for Quick Actions
  const allProgress = getAllProgress()
  const lastWatchedEntry = Object.entries(allProgress)
    .filter(([_, p]) => p.lastWatchedLesson)
    .sort(
      (a, b) => new Date(b[1].lastAccessedAt).getTime() - new Date(a[1].lastAccessedAt).getTime()
    )[0]
  const lastWatchedCourse = lastWatchedEntry?.[0]
  const lastWatchedLesson = lastWatchedEntry?.[1].lastWatchedLesson

  const statsCards = [
    {
      label: 'Courses Started',
      value: inProgress.length + completed.length,
      icon: BookOpen,
    },
    {
      label: 'Lessons Completed',
      value: completedLessons,
      icon: CheckCircle,
      trend: lessonsChange >= 0 ? ('up' as const) : ('down' as const),
      trendValue: `${Math.abs(lessonsChange)} this week`,
      sparkline: lessonSparkline,
    },
    {
      label: 'Study Notes',
      value: studyNotes,
      icon: FileText,
    },
    {
      label: 'Courses Completed',
      value: completed.length,
      icon: CheckCircle,
    },
  ]

  if (isLoading) {
    return (
      <div>
        <Skeleton className="h-8 w-32 mb-6" />

        {/* Stats Row Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="rounded-2xl border p-6">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-8 w-16" />
            </div>
          ))}
        </div>

        {/* Continue Studying Skeleton */}
        <Skeleton className="h-6 w-40 mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {[1, 2].map(i => (
            <div key={i} className="rounded-2xl border p-4">
              <div className="flex items-center gap-4">
                <Skeleton className="w-16 h-16 rounded-lg" />
                <div className="flex-1">
                  <Skeleton className="h-5 w-32 mb-2" />
                  <Skeleton className="h-4 w-24 mb-2" />
                  <Skeleton className="h-2 w-full" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* All Courses Skeleton */}
        <Skeleton className="h-6 w-32 mb-4" />
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
            <div key={i} className="rounded-2xl border overflow-hidden">
              <Skeleton className="w-full h-32" />
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

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Overview</h1>

      {/* Stats Row */}
      <div
        data-testid="stats-grid"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
      >
        {statsCards.map(stat => (
          <StatsCard key={stat.label} {...stat} />
        ))}
      </div>

      {/* Achievement Banner */}
      <div className="mb-8">
        <AchievementBanner completedLessons={completedLessons} />
      </div>

      {/* Study Streak Calendar */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4">Study Streak</h2>
        <StudyStreakCalendar days={30} />
      </div>

      {/* Recent Activity */}
      <RecentActivity activities={recentActivity} />

      {/* Quick Actions */}
      <QuickActions
        studyNotes={studyNotes}
        lastWatchedCourse={lastWatchedCourse}
        lastWatchedLesson={lastWatchedLesson}
      />

      {/* Progress Chart */}
      <ProgressChart data={chartData} />

      {/* Continue Studying */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-4">Continue Studying</h2>
        {inProgress.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {inProgress.map(course => {
              const firstLesson = course.modules[0]?.lessons[0]?.id
              const resumeLesson = course.progress.lastWatchedLesson ?? firstLesson
              const lessonLink = resumeLesson
                ? `/courses/${course.id}/${resumeLesson}`
                : `/courses/${course.id}`
              return (
                <Link key={course.id} to={lessonLink}>
                  <Card className="group hover:shadow-xl hover:scale-[1.01] transition-all duration-200 cursor-pointer rounded-2xl">
                    <CardContent className="p-4 flex items-center gap-4">
                      {course.coverImage ? (
                        <img
                          src={`${course.coverImage}-320w.webp`}
                          alt={course.title}
                          className="w-16 h-16 rounded-lg object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                          <BookOpen className="w-8 h-8 text-brand" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium truncate">{course.title}</h3>
                        <p className="text-sm text-muted-foreground">
                          {formatCategory(course.category)}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <Progress value={course.completionPercent} className="h-2 flex-1" />
                          <span className="text-sm font-medium">{course.completionPercent}%</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        ) : (
          <EmptyState
            icon={BookOpen}
            title="No courses in progress"
            description="Start your learning journey today by exploring our course catalog!"
            actionLabel="Browse Courses"
            actionHref="/courses"
          />
        )}
      </section>

      {/* All Courses */}
      <section>
        <h2 className="text-lg font-semibold mb-4">All Courses</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {allCourses.map(course => (
            <CourseCard
              key={course.id}
              course={course}
              variant="overview"
              completionPercent={getCourseCompletionPercent(course.id, course.totalLessons)}
            />
          ))}
        </div>
      </section>
    </div>
  )
}
