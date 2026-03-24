import { useState, useEffect } from 'react'
import { Link } from 'react-router'
import { BookOpen, CheckCircle, FileText } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { SwissLayout } from './layouts/SwissLayout'
import { SwissStatsCard } from './components/SwissStatsCard'
import { SwissStreakCalendar } from './components/SwissStreakCalendar'
import { SwissProgressChart } from './components/SwissProgressChart'
import { SwissCourseCard } from './components/SwissCourseCard'
import { ComparisonToggle } from './components/ComparisonToggle'
import { useCourseStore } from '@/stores/useCourseStore'
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

export function SwissOverview() {
  const allCourses = useCourseStore(s => s.courses)
  const inProgress = getCoursesInProgress(allCourses)
  const completed = getCompletedCourses(allCourses)
  const completedLessons = getTotalCompletedLessons()
  const [studyNotes, setStudyNotes] = useState(0)

  useEffect(() => {
    let ignore = false

    getTotalStudyNotes().then(notes => {
      if (!ignore) setStudyNotes(notes)
    })

    return () => {
      ignore = true
    }
  }, [])

  const recentActivity = getRecentActivity(allCourses, 5)
  const lessonSparkline = getLast7DaysLessonCompletions()
  const lessonsChange = getWeeklyChange('lessons')
  const chartData = getActionsPerDay(14)

  const trend = lessonsChange >= 0 ? ('up' as const) : ('down' as const)
  const trendValue = `${Math.abs(lessonsChange)} this week`

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

  return (
    <SwissLayout>
      {/* Page title */}
      <h1 className="text-[48px] font-bold tracking-tight leading-none mb-2">Overview</h1>
      <hr className="border-t border-black/10 mb-8" />

      {/* Stats grid */}
      <div className="grid grid-cols-4 gap-[1px] bg-neutral-200 border border-neutral-200 mb-0">
        {statsCards.map(stat => (
          <SwissStatsCard key={stat.label} {...stat} />
        ))}
      </div>

      {/* Horizontal rule */}
      <hr className="border-t border-black/10 my-10" />

      {/* Study Streak */}
      <h2 className="text-2xl font-bold mb-6">Study Streak</h2>
      <SwissStreakCalendar />

      {/* Horizontal rule */}
      <hr className="border-t border-black/10 my-10" />

      {/* Recent Activity */}
      <h2 className="text-2xl font-bold mb-6">Recent Activity</h2>
      <div>
        {recentActivity.map(activity => {
          const lastLesson = activity.progress.lastWatchedLesson
          const lessonObj = lastLesson
            ? activity.modules.flatMap(m => m.lessons).find(l => l.id === lastLesson)
            : null

          return (
            <div key={activity.id} className="flex gap-3 py-3 border-b border-neutral-100">
              {/* Red square indicator */}
              <div className="w-2 h-2 bg-[#DC2626] mt-2 flex-shrink-0" />

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-black">{activity.title}</p>
                {lessonObj && <p className="text-sm text-neutral-500">{lessonObj.title}</p>}
                <p className="text-xs text-neutral-400">
                  {formatDistanceToNow(new Date(activity.progress.lastAccessedAt), {
                    addSuffix: true,
                  })}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Horizontal rule */}
      <hr className="border-t border-black/10 my-10" />

      {/* Progress Chart */}
      <SwissProgressChart data={chartData} />

      {/* Horizontal rule */}
      <hr className="border-t border-black/10 my-10" />

      {/* Continue Studying */}
      <h2 className="text-2xl font-bold mb-6">Continue Studying</h2>
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
              className="border border-neutral-200 hover:border-neutral-900 p-4 flex items-center gap-4 transition-colors bg-white"
            >
              {/* Thumbnail */}
              {course.coverImage ? (
                <img
                  src={`${course.coverImage}-320w.webp`}
                  alt={course.title}
                  className="size-14 object-cover"
                />
              ) : (
                <div className="size-14 bg-neutral-100 flex items-center justify-center">
                  <BookOpen className="size-6 text-neutral-400" />
                </div>
              )}

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-black truncate">{course.title}</p>
                <p className="text-xs text-neutral-400 uppercase tracking-wide mb-2">
                  {course.category
                    .split('-')
                    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
                    .join(' ')}
                </p>

                {/* Progress bar */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-[2px] bg-neutral-100">
                    <div
                      className="h-full bg-[#DC2626] transition-all"
                      style={{
                        width: `${course.completionPercent}%`,
                      }}
                    />
                  </div>
                  <span className="text-xs font-bold text-black">{course.completionPercent}%</span>
                </div>
              </div>
            </Link>
          )
        })}
      </div>

      {/* Horizontal rule */}
      <hr className="border-t border-black/10 my-10" />

      {/* All Courses */}
      <h2 className="text-2xl font-bold mb-6">All Courses</h2>
      <div className="grid grid-cols-4 gap-6">
        {allCourses.map(course => (
          <SwissCourseCard
            key={course.id}
            course={course}
            completionPercent={getCourseCompletionPercent(course.id, course.totalLessons)}
          />
        ))}
      </div>

      {/* Comparison Toggle */}
      <ComparisonToggle />
    </SwissLayout>
  )
}
