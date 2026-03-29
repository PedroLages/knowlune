import { useMemo, useRef, useCallback, useState } from 'react'
import { Link } from 'react-router'
import { BookOpen, Play, ArrowRight, AlertCircle, Layers, X } from 'lucide-react'
import { motion, useMotionValue, useTransform, useSpring } from 'motion/react'
import { Card, CardContent } from '@/app/components/ui/card'
import { Progress } from '@/app/components/ui/progress'
import { Button } from '@/app/components/ui/button'
import { useCourseStore } from '@/stores/useCourseStore'
import { getAllProgress, getNotStartedCourses } from '@/lib/progress'
import type { Course } from '@/data/types'
import type { CourseProgress } from '@/lib/progress'

function findLessonTitle(course: Course, lessonId: string): string | undefined {
  for (const mod of course.modules) {
    for (const lesson of mod.lessons) {
      if (lesson.id === lessonId) return lesson.title
    }
  }
  return undefined
}

interface ResolvedSession {
  course: Course
  progress: CourseProgress
  lessonTitle: string
  completionPercent: number
  resumeLink: string
}

interface DeletedSession {
  courseId: string
  progress: CourseProgress
}

interface SessionResult {
  resolved: ResolvedSession[]
  deleted: DeletedSession[]
}

function resolveSessionData(
  allProgress: Record<string, CourseProgress>,
  allCourses: Course[]
): SessionResult {
  const resolved: ResolvedSession[] = []
  const deleted: DeletedSession[] = []

  const sorted = Object.values(allProgress)
    .filter(p => p.lastWatchedLesson)
    .sort((a, b) => new Date(b.lastAccessedAt).getTime() - new Date(a.lastAccessedAt).getTime())

  for (const progress of sorted) {
    const course = allCourses.find(c => c.id === progress.courseId)
    if (!course) {
      deleted.push({ courseId: progress.courseId, progress })
      continue
    }

    const lessonTitle = findLessonTitle(course, progress.lastWatchedLesson!) ?? 'Unknown Lesson'
    const completionPercent =
      course.totalLessons > 0
        ? Math.round((progress.completedLessons.length / course.totalLessons) * 100)
        : 0
    const resumeLink = `/courses/${course.id}/${progress.lastWatchedLesson}?t=${progress.lastVideoPosition ?? 0}`

    resolved.push({
      course,
      progress,
      lessonTitle,
      completionPercent,
      resumeLink,
    })
  }

  return { resolved, deleted }
}

const springConfig = { stiffness: 300, damping: 30 }

function HeroCard({ session }: { session: ResolvedSession }) {
  const { course, lessonTitle, completionPercent, resumeLink } = session
  const cardRef = useRef<HTMLDivElement>(null)

  // Mouse tracking — single source for 3D tilt
  const mouseX = useMotionValue(0.5)
  const mouseY = useMotionValue(0.5)

  // 3D card tilt (rotate) — subtle, Apple TV-style
  const rawRotateX = useTransform(mouseY, [0, 1], [2, -2])
  const rawRotateY = useTransform(mouseX, [0, 1], [-3, 3])
  const rotateX = useSpring(rawRotateX, springConfig)
  const rotateY = useSpring(rawRotateY, springConfig)

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = cardRef.current?.getBoundingClientRect()
      if (!rect) return
      mouseX.set((e.clientX - rect.left) / rect.width)
      mouseY.set((e.clientY - rect.top) / rect.height)
    },
    [mouseX, mouseY]
  )

  const handleMouseLeave = useCallback(() => {
    mouseX.set(0.5)
    mouseY.set(0.5)
  }, [mouseX, mouseY])

  const completedLessons =
    course.totalLessons > 0 ? Math.round((completionPercent / 100) * course.totalLessons) : 0

  return (
    <Link
      to={resumeLink}
      data-testid="continue-learning-card"
      className="block group [perspective:800px]"
    >
      <motion.div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{ rotateX, rotateY }}
        className="relative rounded-[28px] overflow-hidden min-h-[220px] sm:min-h-[240px] lg:min-h-[280px] motion-safe:hover:shadow-studio-hover motion-safe:transition-shadow motion-safe:duration-300 cursor-pointer [transform-style:preserve-3d]"
      >
        {/* Gradient mesh background — organic multi-point color blend */}
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse at 15% 20%, rgba(59,130,246,0.85) 0%, transparent 55%),
              radial-gradient(ellipse at 85% 80%, rgba(124,58,237,0.7) 0%, transparent 50%),
              radial-gradient(ellipse at 50% 50%, rgba(37,99,235,0.95) 0%, transparent 70%),
              linear-gradient(135deg, #1e3a5f 0%, #1e293b 100%)
            `,
          }}
        />

        {/* Gradient overlay for text legibility */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/50 to-black/20" />

        {/* Shimmer sweep on hover — hidden on touch devices */}
        <div className="absolute inset-0 hidden sm:block opacity-0 group-hover:opacity-100 motion-safe:transition-opacity motion-safe:duration-500 pointer-events-none overflow-hidden">
          <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full motion-safe:transition-transform motion-safe:duration-1000 motion-safe:ease-out bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-[-20deg]" />
        </div>

        {/* Module/lesson badge — glassmorphism */}
        <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-10 flex items-center gap-1.5 bg-white/10 backdrop-blur-md border border-white/20 shadow-lg text-white/90 text-xs font-medium px-3 py-1.5 rounded-full">
          <Layers className="size-3" aria-hidden="true" />
          <span className="tabular-nums">
            {completedLessons}/{course.totalLessons}
          </span>
          <span className="hidden sm:inline">lessons</span>
        </div>

        {/* Content overlay */}
        <div className="relative z-10 p-6 sm:p-8 lg:p-10 flex flex-col justify-end h-full min-h-[inherit] text-white">
          {/* Eyebrow — hover-reveal on desktop, always visible on mobile */}
          <p className="text-xs uppercase tracking-wider opacity-80 sm:opacity-0 sm:translate-y-2 sm:group-hover:opacity-80 sm:group-hover:translate-y-0 motion-safe:transition-[opacity,transform] motion-safe:duration-200 mb-2 font-medium">
            Continue where you left off
          </p>

          {/* Title with text shadow for contrast */}
          <h3 className="text-xl sm:text-2xl lg:text-3xl mb-1 leading-tight font-bold [text-shadow:_0_2px_12px_rgba(0,0,0,0.4)]">
            {course.title}
          </h3>

          {/* Lesson name — hover-reveal on desktop */}
          <p className="text-sm flex items-center gap-1.5 mb-4 opacity-80 sm:opacity-0 sm:-translate-y-1 sm:group-hover:opacity-80 sm:group-hover:translate-y-0 motion-safe:transition-[opacity,transform] motion-safe:duration-200 motion-safe:delay-75">
            <Play aria-hidden="true" className="size-3.5 fill-current" />
            {lessonTitle}
          </p>

          {/* Progress bar with glow + animated pulse tip */}
          <div className="flex items-center gap-3 max-w-md mb-4">
            <div className="relative flex-1 h-1.5 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full shadow-[0_0_8px_rgba(255,255,255,0.4)] motion-safe:transition-[width] motion-safe:duration-500"
                style={{ width: `${completionPercent}%` }}
                role="progressbar"
                aria-valuenow={completionPercent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${course.title}: ${completionPercent}% complete`}
              />
              {/* Pulsing dot at progress tip */}
              {completionPercent > 0 && completionPercent < 100 && (
                <div
                  className="absolute top-1/2 -translate-y-1/2 size-2.5 bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.6)] motion-safe:animate-pulse"
                  style={{ left: `calc(${completionPercent}% - 5px)` }}
                />
              )}
            </div>
            <span className="text-sm font-medium tabular-nums">{completionPercent}%</span>
          </div>

          {/* CTA with micro-interactions */}
          <div
            className="inline-flex items-center gap-2 bg-white text-slate-900 px-5 py-2.5 rounded-full font-medium text-sm shadow-lg w-fit motion-safe:group-hover:scale-[1.03] motion-safe:group-hover:shadow-xl motion-safe:transition-[transform,box-shadow] motion-safe:duration-200"
            tabIndex={-1}
            aria-hidden="true"
          >
            Resume Learning
            <ArrowRight
              aria-hidden="true"
              className="size-4 motion-safe:group-hover:translate-x-1 motion-safe:transition-transform motion-safe:duration-200"
            />
          </div>
        </div>
      </motion.div>
    </Link>
  )
}

function RecentlyAccessedRow({ sessions }: { sessions: ResolvedSession[] }) {
  if (sessions.length === 0) return null

  return (
    <div className="mt-4" data-testid="recently-accessed-row">
      <h3 className="text-sm font-medium text-muted-foreground mb-3">Recently Accessed</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {sessions.map(({ course, completionPercent, resumeLink }) => (
          <Link key={course.id} to={resumeLink}>
            <Card className="group motion-safe:hover:shadow-lg motion-safe:hover:scale-[1.01] motion-safe:transition-[box-shadow,transform] motion-safe:duration-200 cursor-pointer rounded-2xl">
              <CardContent className="p-4 flex items-center gap-4">
                {course.coverImage ? (
                  <picture>
                    <source
                      type="image/webp"
                      srcSet={`
                        ${course.coverImage}-320w.webp 320w,
                        ${course.coverImage}-640w.webp 640w
                      `}
                      sizes="48px"
                    />
                    <img
                      src={`${course.coverImage}-320w.webp`}
                      alt={course.title}
                      className="size-12 rounded-lg object-cover"
                      width={48}
                      height={48}
                      loading="lazy"
                    />
                  </picture>
                ) : (
                  <div className="size-12 rounded-lg bg-brand-soft flex items-center justify-center">
                    <BookOpen aria-hidden="true" className="size-6 text-brand" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium truncate text-sm">{course.title}</h4>
                  <div className="flex items-center gap-2 mt-1.5">
                    <Progress
                      value={completionPercent}
                      className="h-1.5 flex-1"
                      aria-label={`${course.title}: ${completionPercent}% complete`}
                    />
                    <span className="text-xs font-medium tabular-nums">{completionPercent}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}

const BANNER_DISMISS_KEY = 'knowlune:deleted-content-banner-dismissed'

function DeletedContentBanner({ count }: { count: number }) {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(BANNER_DISMISS_KEY) === 'true'
    } catch {
      return false
    }
  })

  if (dismissed) return null

  function handleDismiss() {
    setDismissed(true)
    try {
      localStorage.setItem(BANNER_DISMISS_KEY, 'true')
    } catch {
      // silent-catch-ok: localStorage unavailable — dismiss still works for session
    }
  }

  return (
    <div
      data-testid="content-unavailable-message"
      className="flex items-center gap-3 rounded-2xl border border-border bg-muted p-4 mb-4"
    >
      <AlertCircle aria-hidden="true" className="size-5 text-muted-foreground flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">
          {count === 1
            ? 'A course you were studying is no longer available.'
            : `${count} courses you were studying are no longer available.`}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          <Link to="/courses" className="underline hover:no-underline">
            Explore other courses
          </Link>{' '}
          to continue your learning journey.
        </p>
      </div>
      <button
        onClick={handleDismiss}
        className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
        aria-label="Dismiss notification"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  )
}

function DiscoveryState() {
  const allCourses = useCourseStore(s => s.courses)
  const suggested = useMemo(() => getNotStartedCourses(allCourses).slice(0, 3), [allCourses])

  return (
    <div className="text-center py-8">
      <div className="size-16 rounded-full bg-brand-soft flex items-center justify-center mx-auto mb-4">
        <BookOpen aria-hidden="true" className="size-8 text-brand" />
      </div>
      <h3 className="text-lg font-semibold mb-2">Start Your Learning Journey</h3>
      <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
        Begin with one of these recommended courses
      </p>

      {suggested.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 max-w-2xl mx-auto">
          {suggested.map(course => (
            <Link
              key={course.id}
              to={`/courses/${course.id}`}
              data-testid={`suggested-course-${course.id}`}
            >
              <Card className="motion-safe:hover:shadow-lg motion-safe:hover:scale-[1.01] motion-safe:transition-[box-shadow,transform] motion-safe:duration-200 cursor-pointer rounded-2xl h-full">
                <CardContent className="p-4 flex flex-col items-center text-center">
                  {course.coverImage ? (
                    <picture>
                      <source
                        type="image/webp"
                        srcSet={`
                          ${course.coverImage}-320w.webp 320w,
                          ${course.coverImage}-640w.webp 640w
                        `}
                        sizes="64px"
                      />
                      <img
                        src={`${course.coverImage}-320w.webp`}
                        alt={course.title}
                        className="size-16 rounded-xl object-cover mb-3"
                        width={64}
                        height={64}
                        loading="lazy"
                      />
                    </picture>
                  ) : (
                    <div className="size-16 rounded-xl bg-brand-soft flex items-center justify-center mb-3">
                      <BookOpen aria-hidden="true" className="size-8 text-brand" />
                    </div>
                  )}
                  <h4 className="font-medium text-sm">{course.title}</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    {course.totalLessons} lessons
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Button asChild size="lg" className="rounded-xl min-h-11">
        <Link to="/courses">
          Explore All Courses
          <ArrowRight aria-hidden="true" className="size-4 ml-2" />
        </Link>
      </Button>
    </div>
  )
}

export function ContinueLearning() {
  const allCourses = useCourseStore(s => s.courses)
  const { resolved: sessions, deleted } = useMemo(
    () => resolveSessionData(getAllProgress(), allCourses),
    [allCourses]
  )
  const heroSession = sessions[0]
  const otherSessions = sessions.slice(1)

  return (
    <div data-testid="continue-learning-section" aria-labelledby="continue-learning-heading">
      <h2 id="continue-learning-heading" className="sr-only">
        Continue Learning
      </h2>
      {deleted.length > 0 && <DeletedContentBanner count={deleted.length} />}
      {heroSession ? (
        <>
          <HeroCard session={heroSession} />
          <RecentlyAccessedRow sessions={otherSessions} />
        </>
      ) : (
        <DiscoveryState />
      )}
    </div>
  )
}
