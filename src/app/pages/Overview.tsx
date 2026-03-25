import { useState, useEffect, useMemo, type ReactNode } from 'react'
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
import { DashboardCustomizer } from '@/app/components/DashboardCustomizer'
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
import { useDashboardOrder } from '@/hooks/useDashboardOrder'
import type { DashboardSectionId } from '@/lib/dashboardOrder'
import { useEngagementVisible } from '@/hooks/useEngagementVisible'

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

/** Shared animation props for viewport-triggered sections */
const viewportAnimation = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '0px' },
  transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
} as const

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

  // Engagement preference toggles
  const showAchievements = useEngagementVisible('achievements')
  const showStreaks = useEngagementVisible('streaks')
  const showAnimations = useEngagementVisible('animations')

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

  // Dashboard section ordering
  const {
    sectionOrder,
    pinnedSections,
    isManuallyOrdered,
    isCustomizing,
    setIsCustomizing,
    handlePin,
    handleUnpin,
    handleReorder,
    handleReset,
    createSectionRef,
  } = useDashboardOrder()

  // Map section IDs to their rendered content
  const sectionRenderers: Record<DashboardSectionId, () => ReactNode> = useMemo(
    () => ({
      'recommended-next': () => (
        <motion.section
          key="recommended-next"
          ref={createSectionRef('recommended-next')}
          variants={fadeUp}
          data-testid="section-recommended-next"
        >
          <RecommendedNext />
        </motion.section>
      ),
      'metrics-strip': () => (
        <motion.section
          key="metrics-strip"
          ref={createSectionRef('metrics-strip')}
          variants={fadeUp}
          data-testid="section-metrics-strip"
        >
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-6 items-start">
            <div
              data-testid="stats-grid"
              className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3"
            >
              {statsCards.map(stat => (
                <StatsCard key={stat.label} {...stat} />
              ))}
            </div>
            {showAchievements && <AchievementBanner completedLessons={completedLessons} />}
          </div>
        </motion.section>
      ),
      'quiz-performance': () => (
        <motion.section
          key="quiz-performance"
          ref={createSectionRef('quiz-performance')}
          variants={fadeUp}
          data-testid="section-quiz-performance"
        >
          <QuizPerformanceCard />
        </motion.section>
      ),
      'engagement-zone': () => (
        <motion.section
          key="engagement-zone"
          ref={createSectionRef('engagement-zone')}
          {...viewportAnimation}
          className={`grid grid-cols-1 ${showStreaks ? 'lg:grid-cols-[3fr_2fr]' : ''} gap-6`}
          data-testid="section-engagement-zone"
        >
          {showStreaks && (
            <div>
              <h2 className="text-xl mb-4">Study Streak</h2>
              <StudyStreakCalendar weeks={26} />
            </div>
          )}
          <div className="flex flex-col gap-6">
            <StudyGoalsWidget />
            <RecentActivity activities={recentActivity} />
          </div>
        </motion.section>
      ),
      'study-history': () => (
        <motion.section
          key="study-history"
          ref={createSectionRef('study-history')}
          {...viewportAnimation}
          className="rounded-[24px] border border-border/50 bg-card p-6"
          data-testid="section-study-history"
        >
          <h2 className="text-xl font-semibold mb-4">Study History</h2>
          <StudyHistoryCalendar />
        </motion.section>
      ),
      'study-schedule': () => (
        <motion.section
          key="study-schedule"
          ref={createSectionRef('study-schedule')}
          {...viewportAnimation}
          className="rounded-[24px] border border-border/50 bg-card p-6"
          data-testid="section-study-schedule"
        >
          <h2 className="text-xl font-semibold mb-4">Suggested Study Time</h2>
          <StudyScheduleWidget />
        </motion.section>
      ),
      'insight-action': () => (
        <motion.section
          key="insight-action"
          ref={createSectionRef('insight-action')}
          {...viewportAnimation}
          className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-6"
          data-testid="section-insight-action"
        >
          <ProgressChart data={chartData} />
          <QuickActions
            studyNotes={studyNotes}
            lastWatchedCourse={lastWatchedCourse}
            lastWatchedLesson={lastWatchedLesson}
          />
        </motion.section>
      ),
      'skill-proficiency': () =>
        skillProficiencyData.length > 0 ? (
          <motion.section
            key="skill-proficiency"
            ref={createSectionRef('skill-proficiency')}
            {...viewportAnimation}
            className="rounded-[24px] border border-border/50 bg-card p-6"
            data-testid="section-skill-proficiency"
          >
            <h2 className="text-xl font-semibold mb-4">Skill Proficiency</h2>
            <SkillProficiencyRadar data={skillProficiencyData} />
          </motion.section>
        ) : null,
      'course-gallery': () => (
        <motion.section
          key="course-gallery"
          ref={createSectionRef('course-gallery')}
          {...viewportAnimation}
          data-testid="section-course-gallery"
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
      ),
    }),
    [
      statsCards,
      completedLessons,
      recentActivity,
      chartData,
      studyNotes,
      lastWatchedCourse,
      lastWatchedLesson,
      allCourses,
      importedCourses,
      createSectionRef,
      showAchievements,
      showStreaks,
      skillProficiencyData,
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
    <MotionConfig reducedMotion={showAnimations ? 'user' : 'always'}>
      <motion.div
        initial="hidden"
        animate="visible"
        variants={staggerContainer}
        className="space-y-12 pb-12"
      >
        {/* ── Hero Zone (fixed, never reordered) ── */}
        <motion.section variants={fadeUp} className="space-y-6">
          <div>
            <p className="text-sm text-muted-foreground tracking-wide uppercase font-medium">
              {getGreeting()}
            </p>
            <h1 className="text-3xl lg:text-4xl mt-1">Your Learning Studio</h1>
          </div>
          <ContinueLearning />
        </motion.section>

        {/* ── Dashboard Customizer ── */}
        <DashboardCustomizer
          sectionOrder={sectionOrder}
          pinnedSections={pinnedSections}
          isManuallyOrdered={isManuallyOrdered}
          isOpen={isCustomizing}
          onToggle={setIsCustomizing}
          onPin={handlePin}
          onUnpin={handleUnpin}
          onReorder={handleReorder}
          onReset={handleReset}
        />

        {/* ── Reorderable Sections ── */}
        {sectionOrder.map(sectionId => sectionRenderers[sectionId]())}

        {/* ── Import Course Empty State (fixed, never reordered) ── */}
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
      </motion.div>
    </MotionConfig>
  )
}
