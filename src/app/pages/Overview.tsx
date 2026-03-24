import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router'
import { BookOpen, CheckCircle, FileText, Clock, ArrowRight } from 'lucide-react'
import { motion, MotionConfig } from 'motion/react'
import { useSessionStore } from '@/stores/useSessionStore'
import { useCourseImportStore } from '@/stores/useCourseImportStore'
import { importCourseFromFolder } from '@/lib/courseImport'
import { Skeleton } from '@/app/components/ui/skeleton'
import { EmptyState } from '@/app/components/EmptyState'
import { AchievementBanner } from '@/app/components/AchievementBanner'
import { ContinueLearning } from '@/app/components/ContinueLearning'
import { RecentActivity } from '@/app/components/RecentActivity'
import { StatsCard } from '@/app/components/StatsCard'
import { QuickActions } from '@/app/components/QuickActions'
import { StudyStreakCalendar } from '@/app/components/StudyStreakCalendar'
import { StudyGoalsWidget } from '@/app/components/StudyGoalsWidget'
import { StudyHistoryCalendar } from '@/app/components/StudyHistoryCalendar'
import { StudyScheduleWidget } from '@/app/components/StudyScheduleWidget'
import { RecommendedNext, RecommendedNextSkeleton } from '@/app/components/RecommendedNext'
import { QuizPerformanceCard } from '@/app/components/dashboard/QuizPerformanceCard'
import { CourseCard } from '@/app/components/figma/CourseCard'
import { ProgressChart } from '@/app/components/charts/ProgressChart'
import { SkillProficiencyRadar } from '@/app/components/overview/SkillProficiencyRadar'
import { useCourseStore } from '@/stores/useCourseStore'
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
import { getSkillProficiencyForOverview } from '@/lib/reportStats'
import { staggerContainer, fadeUp } from '@/lib/motion'

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export function Overview() {
  const allCourses = useCourseStore(s => s.courses)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 500)
    return () => clearTimeout(timer)
  }, [])

  // Memoize progress calculations to prevent recalculation on every render
  const allProgress = useMemo(() => getAllProgress(), [])
  const inProgress = useMemo(
    () => getCoursesInProgress(allCourses, allProgress),
    [allCourses, allProgress]
  )
  const completed = useMemo(
    () => getCompletedCourses(allCourses, allProgress),
    [allCourses, allProgress]
  )
  const completedLessons = useMemo(() => getTotalCompletedLessons(allProgress), [allProgress])
  const [studyNotes, setStudyNotes] = useState(0)

  useEffect(() => {
    let ignore = false

    getTotalStudyNotes()
      .then(notes => {
        if (!ignore) setStudyNotes(notes)
      })
      .catch(err => {
        // silent-catch-ok — non-critical stat; dashboard still renders with default value
        console.error('[Overview] Failed to load study notes count:', err)
      })

    return () => {
      ignore = true
    }
  }, [])

  const { loadSessionStats, getTotalStudyTime } = useSessionStore()
  const importedCourses = useCourseImportStore(s => s.importedCourses)
  const loadImportedCourses = useCourseImportStore(s => s.loadImportedCourses)

  useEffect(() => {
    loadSessionStats()
  }, [loadSessionStats])

  useEffect(() => {
    loadImportedCourses()
  }, [loadImportedCourses])

  const totalStudyTimeSeconds = getTotalStudyTime()
  const totalStudyTimeHours = Math.round((totalStudyTimeSeconds / 3600) * 10) / 10

  // Memoize activity metrics to prevent recalculation on every render
  const recentActivity = useMemo(() => getRecentActivity(allCourses, 5), [allCourses])
  const lessonSparkline = useMemo(() => getLast7DaysLessonCompletions(), [])
  const lessonsChange = useMemo(() => getWeeklyChange('lessons'), [])
  const chartData = useMemo(() => getActionsPerDay(14), [])
  const skillProficiencyData = useMemo(() => getSkillProficiencyForOverview(), [allCourses])

  // Memoize last watched calculation to prevent sorting on every render
  const lastWatchedEntry = useMemo(
    () =>
      Object.entries(allProgress)
        .filter(([_, p]) => p.lastWatchedLesson)
        .sort(
          (a, b) =>
            new Date(b[1].lastAccessedAt).getTime() - new Date(a[1].lastAccessedAt).getTime()
        )[0],
    [allProgress]
  )
  const lastWatchedCourse = lastWatchedEntry?.[0]
  const lastWatchedLesson = lastWatchedEntry?.[1].lastWatchedLesson

  // Memoize stats cards array to prevent recreation on every render
  const statsCards = useMemo(
    () => [
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
        label: 'Total Study Time',
        value: `${totalStudyTimeHours}h`,
        icon: Clock,
        testId: 'total-study-time',
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
    ],
    [
      inProgress.length,
      completed.length,
      completedLessons,
      lessonsChange,
      lessonSparkline,
      totalStudyTimeHours,
      studyNotes,
    ]
  )

  if (isLoading) {
    return (
      <div className="space-y-12" aria-busy="true" aria-label="Loading dashboard">
        {/* Hero skeleton */}
        <div>
          <Skeleton className="h-5 w-28 mb-2" />
          <Skeleton className="h-10 w-64 mb-6" />
          <Skeleton className="h-[260px] w-full rounded-[28px]" />
        </div>

        {/* Recommended Next skeleton */}
        <RecommendedNextSkeleton />

        {/* Metrics skeleton */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="rounded-2xl border border-border/50 p-4">
              <Skeleton className="h-3 w-20 mb-2" />
              <Skeleton className="h-7 w-12" />
            </div>
          ))}
        </div>

        {/* Engagement skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-6">
          <Skeleton className="h-[280px] rounded-2xl" />
          <Skeleton className="h-[280px] rounded-2xl" />
        </div>

        {/* Skill Proficiency skeleton */}
        <Skeleton className="h-[340px] rounded-[24px]" />

        {/* Gallery skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {[1, 2, 3, 4].map(i => (
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

  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        initial="hidden"
        animate="visible"
        variants={staggerContainer}
        className="space-y-12 pb-12"
      >
        {/* ── Hero Zone ── */}
        <motion.section variants={fadeUp} className="space-y-6">
          <div>
            <p className="text-sm text-muted-foreground tracking-wide uppercase font-medium">
              {getGreeting()}
            </p>
            <h1 className="text-3xl lg:text-4xl mt-1">Your Learning Studio</h1>
          </div>
          <ContinueLearning />
        </motion.section>

        {/* ── Recommended Next ── */}
        <motion.section variants={fadeUp}>
          <RecommendedNext />
        </motion.section>

        {/* ── Metrics Strip ── */}
        <motion.section variants={fadeUp}>
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-6 items-start">
            <div
              data-testid="stats-grid"
              className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3"
            >
              {statsCards.map(stat => (
                <StatsCard key={stat.label} {...stat} />
              ))}
            </div>
            <AchievementBanner completedLessons={completedLessons} />
          </div>
        </motion.section>

        {/* ── Quiz Performance ── */}
        <motion.section variants={fadeUp}>
          <QuizPerformanceCard />
        </motion.section>

        {/* ── Engagement Zone ── */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-6"
        >
          <div>
            <h2 className="text-xl mb-4">Study Streak</h2>
            <StudyStreakCalendar weeks={26} />
          </div>
          <div className="flex flex-col gap-6">
            <StudyGoalsWidget />
            <RecentActivity activities={recentActivity} />
          </div>
        </motion.section>

        {/* ── Study History Calendar ── */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="rounded-[24px] border border-border/50 bg-card p-6"
        >
          <h2 className="text-xl font-semibold mb-4">Study History</h2>
          <StudyHistoryCalendar />
        </motion.section>

        {/* ── Study Schedule Widget ── */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="rounded-[24px] border border-border/50 bg-card p-6"
        >
          <h2 className="text-xl font-semibold mb-4">Suggested Study Time</h2>
          <StudyScheduleWidget />
        </motion.section>

        {/* ── Skill Proficiency Radar ── */}
        {skillProficiencyData.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-[24px] border border-border/50 bg-card p-6"
          >
            <h2 className="text-xl font-semibold mb-4">Skill Proficiency</h2>
            <SkillProficiencyRadar data={skillProficiencyData} />
          </motion.section>
        )}

        {/* ── Insight + Action Zone ── */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-6"
        >
          <ProgressChart data={chartData} />
          <QuickActions
            studyNotes={studyNotes}
            lastWatchedCourse={lastWatchedCourse}
            lastWatchedLesson={lastWatchedLesson}
          />
        </motion.section>

        {/* ── Import Course Empty State ── */}
        {importedCourses.length === 0 && (
          <motion.section variants={fadeUp}>
            <EmptyState
              data-testid="empty-state-courses"
              icon={BookOpen}
              title="Import your first course to get started"
              description="Add a folder with videos, PDFs, or documents to begin learning"
              actionLabel="Import Course"
              onAction={() => {
                importCourseFromFolder().catch(() => {
                  // silent-catch-ok — user cancelled file picker or permission denied
                })
              }}
            />
          </motion.section>
        )}

        {/* ── Course Gallery ── */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="flex items-baseline justify-between mb-6">
            <h2 className="text-xl">Your Library</h2>
            <Link
              to="/courses"
              className="text-sm text-brand hover:text-brand-hover flex items-center gap-1 motion-safe:transition-colors"
            >
              View all
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          </div>
          {importedCourses.length > 0 && (
            <p className="text-xs text-muted-foreground mb-3">
              Sample courses ·{' '}
              <Link to="/courses" className="hover:text-foreground transition-colors">
                View all
              </Link>
            </p>
          )}
          <div
            data-testid="library-section"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"
          >
            {allCourses.map(course => (
              <div
                key={course.id}
                data-testid={
                  importedCourses.length > 0 ? 'sample-course-card' : `course-card-${course.id}`
                }
                className={`transition-opacity duration-200 motion-reduce:transition-none ${
                  importedCourses.length > 0 ? 'opacity-60 hover:opacity-100' : ''
                }`}
              >
                <CourseCard
                  course={course}
                  variant="overview"
                  completionPercent={getCourseCompletionPercent(course.id, course.totalLessons)}
                />
              </div>
            ))}
          </div>
        </motion.section>
      </motion.div>
    </MotionConfig>
  )
}
