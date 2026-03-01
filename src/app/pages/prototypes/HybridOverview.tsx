import { useState, useEffect } from 'react'
import { Link } from 'react-router'
import { BookOpen, CheckCircle, FileText, ArrowRight } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { HybridLayout } from './layouts/HybridLayout'
import { HybridStatsCard } from './components/HybridStatsCard'
import { HybridStreakCalendar } from './components/HybridStreakCalendar'
import { HybridProgressChart } from './components/HybridProgressChart'
import { HybridCourseCard } from './components/HybridCourseCard'
import { ComparisonToggle } from './components/ComparisonToggle'
import { allCourses } from '@/data/courses'
import {
  getCoursesInProgress,
  getCompletedCourses,
  getTotalCompletedLessons,
  getTotalStudyNotes,
  getRecentActivity,
  getLast7DaysLessonCompletions,
  getWeeklyChange,
  getCourseCompletionPercent,
} from '@/lib/progress'
import { getActionsPerDay } from '@/lib/studyLog'

function formatCategory(slug: string): string {
  return slug
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export function HybridOverview() {
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
  const chartData = getActionsPerDay(14)

  const trend = lessonsChange >= 0 ? ('up' as const) : ('down' as const)
  const trendValue = `${Math.abs(lessonsChange)} this week`
  const sparkline = lessonSparkline

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
      trend,
      trendValue,
      sparkline,
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

  return (
    <HybridLayout>
      {/* Page title */}
      <h1 className="text-2xl font-bold mb-8">Overview</h1>

      {/* Stats grid */}
      <div className="grid grid-cols-4 gap-4 mb-12">
        {statsCards.map(stat => (
          <HybridStatsCard key={stat.label} {...stat} />
        ))}
      </div>

      {/* Section divider */}
      <div className="border-b border-neutral-200/60 mb-12" />

      {/* Study Streak */}
      <h2 className="text-lg font-semibold mb-6">Study Streak</h2>
      <HybridStreakCalendar />

      {/* Section divider */}
      <div className="border-b border-neutral-200/60 my-12" />

      {/* Recent Activity */}
      <h2 className="text-lg font-semibold mb-6">Recent Activity</h2>
      <div className="bg-white rounded-xl border border-neutral-100 p-5">
        {recentActivity.map(activity => {
          const lastLesson = activity.progress.lastWatchedLesson
          const lessonObj = lastLesson
            ? activity.modules.flatMap(m => m.lessons).find(l => l.id === lastLesson)
            : null

          return (
            <div
              key={activity.id}
              className="flex items-start gap-3 py-3 border-b border-neutral-100 last:border-0"
            >
              {/* Blue dot indicator */}
              <div className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-2 flex-shrink-0" />

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{activity.title}</p>
                {lessonObj && <p className="text-sm text-neutral-500">{lessonObj.title}</p>}
                <p className="text-xs text-neutral-400">
                  {formatDistanceToNow(new Date(activity.progress.lastAccessedAt), {
                    addSuffix: true,
                  })}
                </p>
              </div>

              {/* Arrow */}
              <ArrowRight className="w-4 h-4 text-neutral-300 mt-1 flex-shrink-0" />
            </div>
          )
        })}
      </div>

      {/* Section divider */}
      <div className="border-b border-neutral-200/60 my-12" />

      {/* Progress Chart */}
      <HybridProgressChart data={chartData} />

      {/* Section divider */}
      <div className="border-b border-neutral-200/60 my-12" />

      {/* Continue Studying */}
      <h2 className="text-lg font-semibold mb-6">Continue Studying</h2>
      <div className="grid grid-cols-2 gap-4">
        {inProgress.map(course => {
          const firstLesson = course.modules[0]?.lessons[0]?.id
          const resumeLesson = course.progress.lastWatchedLesson ?? firstLesson
          const lessonLink = resumeLesson
            ? `/courses/${course.id}/${resumeLesson}`
            : `/courses/${course.id}`

          return (
            <Link
              key={course.id}
              to={lessonLink}
              className="bg-white rounded-xl border border-neutral-100 p-4 flex items-center gap-4 hover:shadow-md transition-shadow"
            >
              {/* Thumbnail */}
              {course.coverImage ? (
                <img
                  src={`${course.coverImage}-320w.webp`}
                  alt={course.title}
                  className="w-14 h-14 rounded-lg object-cover"
                />
              ) : (
                <div className="w-14 h-14 rounded-lg bg-blue-50 flex items-center justify-center">
                  <BookOpen className="w-6 h-6 text-blue-400" />
                </div>
              )}

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{course.title}</p>
                <p className="text-xs text-neutral-400">{formatCategory(course.category)}</p>
              </div>

              {/* Progress bar */}
              <div className="flex items-center gap-2 flex-1">
                <div className="h-1.5 bg-neutral-100 rounded-full flex-1">
                  <div
                    className="h-full bg-blue-600 rounded-full transition-all"
                    style={{ width: `${course.completionPercent}%` }}
                  />
                </div>
                <span className="text-sm font-medium">{course.completionPercent}%</span>
              </div>
            </Link>
          )
        })}
      </div>

      {/* Section divider */}
      <div className="border-b border-neutral-200/60 my-12" />

      {/* All Courses */}
      <h2 className="text-lg font-semibold mb-6">All Courses</h2>
      <div className="grid grid-cols-4 gap-5">
        {allCourses.map(course => (
          <HybridCourseCard
            key={course.id}
            course={course}
            completionPercent={getCourseCompletionPercent(course.id, course.totalLessons)}
          />
        ))}
      </div>

      {/* Comparison Toggle */}
      <ComparisonToggle />
    </HybridLayout>
  )
}
