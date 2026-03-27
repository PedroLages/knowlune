import { useEffect, useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { MotionConfig, motion } from 'motion/react'
import { BookOpen, Clock, ChevronLeft, Check, Lock, Play, ArrowRight } from 'lucide-react'
import { Badge } from '@/app/components/ui/badge'
import { Button } from '@/app/components/ui/button'
import { Skeleton } from '@/app/components/ui/skeleton'
import { DelayedFallback } from '@/app/components/DelayedFallback'
import { cn } from '@/app/components/ui/utils'
import { useCareerPathStore } from '@/stores/useCareerPathStore'
import { staggerContainer, fadeUp } from '@/lib/motion'
// CareerPath type used implicitly via useCareerPathStore

/** Gradient pairs using CSS variable references for course thumbnails. */
const GRADIENT_PAIRS = [
  { from: '--brand-soft', to: '--accent-violet-muted' },
  { from: '--gold-muted', to: '--brand-soft' },
  { from: '--success-soft', to: '--brand-muted' },
  { from: '--accent-violet-muted', to: '--gold-muted' },
]

function getGradientPair(courseId: string) {
  let hash = 0
  for (const ch of courseId) hash = (hash * 31 + ch.charCodeAt(0)) | 0
  return GRADIENT_PAIRS[Math.abs(hash) % GRADIENT_PAIRS.length]
}

/** Format a courseId into a human-readable display name. */
function formatCourseName(courseId: string) {
  return courseId.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

// ─────────────────────────────────────────────
// Skeleton loader
// ─────────────────────────────────────────────

function DetailSkeleton() {
  return (
    <DelayedFallback>
      <div className="space-y-8 max-w-5xl">
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-full" />
          <Skeleton className="h-5 w-28" />
        </div>
        <div className="flex flex-col sm:flex-row gap-8">
          <div className="flex-1 space-y-4">
            <Skeleton className="h-10 w-3/4" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-2/3" />
          </div>
          <Skeleton className="h-32 w-40 shrink-0" />
        </div>
        <Skeleton className="h-px w-full" />
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="flex gap-6">
            <Skeleton className="w-40 h-28 rounded-xl shrink-0" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-4 w-full" />
            </div>
          </div>
        ))}
      </div>
    </DelayedFallback>
  )
}

// ─────────────────────────────────────────────
// Flattened module type
// ─────────────────────────────────────────────

interface FlatModule {
  courseId: string
  moduleNumber: number
  stageIndex: number
  isCompleted: boolean
  isLocked: boolean
  isCurrent: boolean
  estimatedHours: number
}

// ─────────────────────────────────────────────
// Module row component
// ─────────────────────────────────────────────

interface ModuleRowProps {
  module: FlatModule
}

function ModuleRow({ module }: ModuleRowProps) {
  const { courseId, moduleNumber, isCompleted, isLocked, isCurrent } = module
  const displayName = formatCourseName(courseId)
  const gradient = getGradientPair(courseId)
  const paddedNumber = String(moduleNumber).padStart(2, '0')

  const thumbnailStyle = isLocked
    ? {
        background: 'var(--muted)',
        filter: 'grayscale(1)',
        opacity: 0.5,
      }
    : {
        background: `linear-gradient(135deg, var(${gradient.from}), var(${gradient.to}))`,
      }

  const rowContent = (
    <motion.div
      variants={fadeUp}
      className={cn(
        'group/row relative flex items-center gap-6 sm:gap-8 py-6 transition-all duration-200',
        isCurrent &&
          'ring-1 ring-brand/20 rounded-2xl px-4 sm:px-6 -mx-4 sm:-mx-6 bg-card shadow-sm',
        isLocked && 'opacity-50',
        !isLocked && !isCurrent && 'hover:bg-card/50 rounded-2xl px-4 sm:px-6 -mx-4 sm:-mx-6'
      )}
    >
      {/* Large decorative number */}
      <div
        className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 select-none pointer-events-none"
        aria-hidden="true"
      >
        <span className="text-[80px] leading-none font-display font-bold text-muted-foreground opacity-[0.07]">
          {paddedNumber}
        </span>
      </div>

      {/* Gradient thumbnail */}
      <div className="relative shrink-0 z-10">
        <div
          className="w-28 h-20 sm:w-40 sm:h-28 rounded-xl overflow-hidden"
          // eslint-disable-next-line react-best-practices/no-inline-styles -- dynamic value requires inline style
          style={thumbnailStyle}
        >
          {/* Overlay for completed */}
          {isCompleted && (
            <div className="absolute inset-0 flex items-center justify-center bg-success/20 rounded-xl">
              <div className="size-10 rounded-full bg-success flex items-center justify-center">
                <Check className="size-5 text-success-foreground stroke-[2.5px]" />
              </div>
            </div>
          )}

          {/* Overlay for locked */}
          {isLocked && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Lock className="size-6 text-muted-foreground" />
            </div>
          )}
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 min-w-0 z-10 space-y-1.5">
        <span className="text-[10px] uppercase tracking-[0.2em] font-semibold text-muted-foreground">
          Module {moduleNumber}
        </span>
        <h3
          className={cn(
            'text-base sm:text-lg font-semibold tracking-tight truncate',
            isCurrent && 'text-brand',
            isCompleted && 'text-foreground',
            isLocked && 'text-muted-foreground'
          )}
        >
          {displayName}
        </h3>
        <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
          {isCurrent
            ? 'Continue where you left off in this module.'
            : isCompleted
              ? 'You have completed this module.'
              : isLocked
                ? 'Complete previous modules to unlock.'
                : 'Ready to begin this module.'}
        </p>
        <div className="flex items-center gap-4 pt-1">
          <span className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground flex items-center gap-1.5">
            <Clock className="size-3.5" aria-hidden="true" />
            {module.estimatedHours}h
          </span>
          <span className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground flex items-center gap-1.5">
            <BookOpen className="size-3.5" aria-hidden="true" />
            Course
          </span>
        </div>
      </div>

      {/* Right side action */}
      <div className="shrink-0 z-10">
        {isCurrent && (
          <div className="flex flex-col items-center gap-2">
            <div className="size-12 rounded-full bg-brand flex items-center justify-center shadow-md hover:bg-brand-hover transition-colors">
              <Play className="size-5 text-brand-foreground ml-0.5" aria-hidden="true" />
            </div>
            <Badge className="bg-brand-soft text-brand-soft-foreground text-[9px] uppercase tracking-[0.15em] border-0 px-2 py-0.5">
              Up Next
            </Badge>
          </div>
        )}
        {isCompleted && (
          <div className="size-8 rounded-full bg-success/10 flex items-center justify-center">
            <Check className="size-4 text-success stroke-[2.5px]" />
          </div>
        )}
      </div>
    </motion.div>
  )

  // Wrap in a link for accessible/current modules
  if (!isLocked && !isCompleted) {
    return (
      <Link
        to={`/courses/${courseId}`}
        className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded-2xl"
        aria-label={`Open course: ${displayName}`}
      >
        {rowContent}
      </Link>
    )
  }

  return rowContent
}

// ─────────────────────────────────────────────
// Page component
// ─────────────────────────────────────────────

export function CareerPathDetail() {
  const { pathId } = useParams<{ pathId: string }>()
  const navigate = useNavigate()
  const {
    paths,
    isLoaded,
    loadPaths,
    enrollInPath,
    dropPath,
    getPathProgress,
    getStageProgress,
    isStageUnlocked,
    isCourseCompleted,
  } = useCareerPathStore()

  const enrollments = useCareerPathStore(state => state.enrollments)

  useEffect(() => {
    let ignore = false
    // silent-catch-ok: error logged to console
    loadPaths().catch(err => {
      if (!ignore) console.error('[CareerPathDetail] Failed to load paths:', err)
    })
    return () => {
      ignore = true
    }
  }, [loadPaths])

  const path = useMemo(() => paths.find(p => p.id === pathId), [paths, pathId])

  useEffect(() => {
    if (isLoaded && !path) {
      navigate('/career-paths', { replace: true })
    }
  }, [isLoaded, path, navigate])

  // Flatten all stages into a single numbered module list
  const flatModules = useMemo<FlatModule[]>(() => {
    if (!path) return []

    // Find the current stage index (first unlocked + incomplete)
    const currentStageIndex = path.stages.findIndex((stage, index) => {
      if (!isStageUnlocked(path.id, index)) return false
      const stageProgress = getStageProgress(path.id, stage.id)
      return stageProgress.percentage < 100
    })

    let moduleNumber = 0
    const modules: FlatModule[] = []

    for (let stageIndex = 0; stageIndex < path.stages.length; stageIndex++) {
      const stage = path.stages[stageIndex]
      const unlocked = isStageUnlocked(path.id, stageIndex)

      for (let courseIdx = 0; courseIdx < stage.courseIds.length; courseIdx++) {
        moduleNumber++
        const courseId = stage.courseIds[courseIdx]
        const completed = isCourseCompleted(courseId)

        // Current module = first incomplete course in the current stage
        const isCurrentModule =
          stageIndex === currentStageIndex && !completed && !modules.some(m => m.isCurrent)

        modules.push({
          courseId,
          moduleNumber,
          stageIndex,
          isCompleted: completed,
          isLocked: !unlocked,
          isCurrent: isCurrentModule,
          estimatedHours: Math.round(stage.estimatedHours / stage.courseIds.length),
        })
      }
    }

    return modules
  }, [path, isStageUnlocked, getStageProgress, isCourseCompleted])

  if (!isLoaded || !path) {
    return <DetailSkeleton />
  }

  const enrollment = enrollments.find(e => e.pathId === path.id && e.status !== 'dropped')
  const isEnrolled = !!enrollment
  const progress = getPathProgress(path.id)

  const handleEnroll = async () => {
    try {
      await enrollInPath(path.id)
    } catch {
      // silent-catch-ok — toast already shown by store
    }
  }

  const handleDrop = async () => {
    try {
      await dropPath(path.id)
    } catch {
      // silent-catch-ok — toast already shown by store
    }
  }

  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="space-y-10 max-w-5xl pb-16"
      >
        {/* ── Top Section ── */}
        <motion.div variants={fadeUp} className="space-y-6">
          {/* Back arrow + badge row */}
          <div className="flex items-center gap-3">
            <Link
              to="/career-paths"
              data-testid="back-link"
              className="size-10 rounded-full border border-border bg-card flex items-center justify-center hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              aria-label="Back to career paths"
            >
              <ChevronLeft className="size-5 text-foreground" aria-hidden="true" />
            </Link>
            <Badge
              variant="secondary"
              className="text-[10px] uppercase tracking-[0.2em] font-semibold"
            >
              Career Path
            </Badge>
          </div>

          {/* Title area + progress display */}
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-8">
            {/* Left: title + description */}
            <div className="flex-1 min-w-0 space-y-3">
              <h1 className="text-3xl sm:text-4xl font-display font-bold tracking-tight leading-tight">
                {path.title}
              </h1>
              <p className="text-muted-foreground text-base sm:text-lg leading-relaxed max-w-2xl">
                {path.description}
              </p>

              {/* Drop path button for enrolled users */}
              {isEnrolled && (
                <Button variant="outline" size="sm" onClick={handleDrop} className="mt-2">
                  Leave path
                </Button>
              )}
            </div>

            {/* Right: progress display or enroll CTA */}
            <div className="shrink-0">
              {isEnrolled ? (
                <div className="text-right space-y-3">
                  <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">
                    Progress
                  </span>
                  <div
                    className="text-5xl sm:text-6xl font-display font-bold tracking-tight"
                    role="status"
                    aria-label={`${progress.percentage}% of path complete`}
                  >
                    {progress.percentage}%
                  </div>
                  <div className="h-px bg-border w-full" aria-hidden="true" />
                  <div className="flex gap-8 justify-end">
                    <div className="text-right">
                      <div className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
                        Courses
                      </div>
                      <div className="text-sm font-semibold">
                        {progress.completedCourses}/{progress.totalCourses}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
                        Duration
                      </div>
                      <div className="text-sm font-semibold">{path.totalEstimatedHours}h</div>
                    </div>
                  </div>
                </div>
              ) : (
                <Button
                  variant="brand"
                  size="lg"
                  onClick={handleEnroll}
                  data-testid="enroll-button"
                  className="gap-2"
                >
                  Start Path
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Button>
              )}
            </div>
          </div>
        </motion.div>

        {/* ── Syllabus Section ── */}
        <motion.div variants={fadeUp}>
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-display font-semibold tracking-tight whitespace-nowrap">
              Syllabus
            </h2>
            <div className="flex-1 h-px bg-border" aria-hidden="true" />
          </div>
        </motion.div>

        {/* ── Module List ── */}
        <div role="list" aria-label="Learning stages" className="space-y-2">
          {flatModules.map(mod => (
            <div key={mod.courseId} role="listitem">
              <ModuleRow module={mod} />
            </div>
          ))}
        </div>

        {/* ── Empty state (no modules) ── */}
        {flatModules.length === 0 && (
          <motion.div variants={fadeUp} className="text-center py-16 text-muted-foreground">
            <BookOpen className="size-12 mx-auto mb-4 opacity-30" aria-hidden="true" />
            <p className="text-lg font-medium">No modules in this path yet.</p>
          </motion.div>
        )}
      </motion.div>
    </MotionConfig>
  )
}
