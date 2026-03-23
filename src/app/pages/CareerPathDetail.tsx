import { useEffect, useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { MotionConfig, motion } from 'motion/react'
import {
  Brain,
  Shield,
  Crosshair,
  Trophy,
  BookOpen,
  Clock,
  ChevronLeft,
  Check,
  Lock,
  type LucideIcon,
} from 'lucide-react'
import { Card, CardContent } from '@/app/components/ui/card'
import { Badge } from '@/app/components/ui/badge'
import { Button } from '@/app/components/ui/button'
import { Progress } from '@/app/components/ui/progress'
import { Skeleton } from '@/app/components/ui/skeleton'
import { DelayedFallback } from '@/app/components/DelayedFallback'
import { cn } from '@/app/components/ui/utils'
import { useCareerPathStore } from '@/stores/useCareerPathStore'
import { staggerContainer, fadeUp } from '@/lib/motion'
import type { CareerPath, CareerPathStage } from '@/data/types'

const ICON_MAP: Record<string, LucideIcon> = {
  Brain,
  Shield,
  Crosshair,
  Trophy,
}

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────

function DetailSkeleton() {
  return (
    <DelayedFallback>
      <div className="space-y-6">
        <Skeleton className="h-6 w-24" />
        <div className="space-y-3">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
        <Skeleton className="h-10 w-36" />
        {Array.from({ length: 2 }, (_, i) => (
          <Skeleton key={i} className="h-40 w-full rounded-[24px]" />
        ))}
      </div>
    </DelayedFallback>
  )
}

interface PathHeaderProps {
  path: CareerPath
  isEnrolled: boolean
  progressPercentage: number
  completedCourses: number
  totalCourses: number
  onEnroll: () => void
  onDrop: () => void
}

function PathHeader({
  path,
  isEnrolled,
  progressPercentage,
  completedCourses,
  totalCourses,
  onEnroll,
  onDrop,
}: PathHeaderProps) {
  const Icon = ICON_MAP[path.icon] ?? BookOpen

  return (
    <motion.div variants={fadeUp} className="space-y-4">
      {/* Icon + Title */}
      <div className="flex items-start gap-4">
        <div className="size-12 rounded-xl bg-brand-soft flex items-center justify-center shrink-0">
          <Icon className="size-6 text-brand-soft-foreground" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">{path.title}</h1>
          <p className="text-muted-foreground mt-1">{path.description}</p>
        </div>
      </div>

      {/* Meta row */}
      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <BookOpen className="size-4" aria-hidden="true" />
          {totalCourses} courses
        </span>
        <span className="flex items-center gap-1.5">
          <Clock className="size-4" aria-hidden="true" />
          {path.totalEstimatedHours}h estimated
        </span>
        <span>{path.stages.length} stages</span>
      </div>

      {/* Progress (when enrolled) */}
      {isEnrolled && (
        <div
          className="space-y-1.5"
          role="status"
          aria-label={`${progressPercentage}% of path complete`}
        >
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {completedCourses} / {totalCourses} courses complete
            </span>
            <span className="font-medium">{progressPercentage}%</span>
          </div>
          <Progress value={progressPercentage} className="h-2" />
        </div>
      )}

      {/* Enroll / Drop CTA */}
      <div className="flex gap-3">
        {isEnrolled ? (
          <Button variant="outline" size="sm" onClick={onDrop}>
            Leave path
          </Button>
        ) : (
          <Button variant="brand" onClick={onEnroll} data-testid="enroll-button">
            Start Path
          </Button>
        )}
      </div>
    </motion.div>
  )
}

interface CourseTileProps {
  courseId: string
  isCompleted: boolean
  isLocked: boolean
}

function CourseTile({ courseId, isCompleted, isLocked }: CourseTileProps) {
  const displayId = courseId.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

  const content = (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-3 rounded-xl border text-sm transition-colors',
        isCompleted && 'bg-success/10 border-success/20',
        !isCompleted && !isLocked && 'hover:bg-accent',
        isLocked && 'opacity-50 cursor-default'
      )}
      aria-disabled={isLocked}
    >
      {/* Status icon */}
      <div
        className={cn(
          'size-6 rounded-full flex items-center justify-center shrink-0',
          isCompleted ? 'bg-success text-success-foreground' : 'bg-muted text-muted-foreground'
        )}
        aria-hidden="true"
      >
        {isCompleted ? (
          <Check className="size-3.5 stroke-[2.5px]" />
        ) : isLocked ? (
          <Lock className="size-3" />
        ) : (
          <BookOpen className="size-3" />
        )}
      </div>

      <span
        className={cn(
          'flex-1 font-medium',
          isCompleted && 'text-success',
          isLocked && 'text-muted-foreground'
        )}
      >
        {displayId}
      </span>

      {isCompleted && (
        <Badge variant="outline" className="text-success border-success/30 text-[10px] py-0 px-1.5">
          Done
        </Badge>
      )}
    </div>
  )

  if (isLocked || isCompleted) return content

  // Link to the course page for enrolled, unlocked, incomplete courses
  return (
    <Link
      to={`/courses/${courseId}`}
      className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded-xl"
      aria-label={`Open course: ${displayId}`}
    >
      {content}
    </Link>
  )
}

interface StageCardProps {
  path: CareerPath
  stage: CareerPathStage
  stageIndex: number
  isUnlocked: boolean
}

function StageCard({ path, stage, stageIndex, isUnlocked }: StageCardProps) {
  const { getStageProgress, isCourseCompleted } = useCareerPathStore()
  const progress = getStageProgress(path.id, stage.id)

  return (
    <motion.div variants={fadeUp}>
      <Card
        className={cn('rounded-[24px]', !isUnlocked && 'opacity-60')}
        aria-label={`Stage ${stageIndex + 1}: ${stage.title}${isUnlocked ? '' : ' (locked)'}`}
      >
        <CardContent className="p-6 space-y-4">
          {/* Stage header */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Stage {stageIndex + 1}
                </span>
                {!isUnlocked && (
                  <Lock className="size-3.5 text-muted-foreground" aria-hidden="true" />
                )}
              </div>
              <h2 className="font-semibold text-base">{stage.title}</h2>
              <p className="text-sm text-muted-foreground mt-0.5">{stage.description}</p>
            </div>
            <div className="text-right text-xs text-muted-foreground shrink-0">
              <div>{progress.completedCourses}/{progress.totalCourses}</div>
              <div>{stage.estimatedHours}h</div>
            </div>
          </div>

          {/* Progress bar */}
          {progress.totalCourses > 0 && (
            <Progress
              value={progress.percentage}
              className="h-1.5"
              aria-label={`Stage ${stageIndex + 1} progress: ${progress.percentage}%`}
            />
          )}

          {/* Skills */}
          {stage.skills.length > 0 && (
            <div className="flex flex-wrap gap-1.5" aria-label="Skills covered">
              {stage.skills.map(skill => (
                <Badge key={skill} variant="secondary" className="text-xs">
                  {skill}
                </Badge>
              ))}
            </div>
          )}

          {/* Course list */}
          <div className="space-y-2" role="list" aria-label={`Courses in Stage ${stageIndex + 1}`}>
            {stage.courseIds.map(courseId => (
              <div key={courseId} role="listitem">
                <CourseTile
                  courseId={courseId}
                  isCompleted={isCourseCompleted(courseId)}
                  isLocked={!isUnlocked}
                />
              </div>
            ))}
          </div>

          {/* Locked message */}
          {!isUnlocked && stageIndex > 0 && (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Lock className="size-3.5" aria-hidden="true" />
              Complete Stage {stageIndex} to unlock
            </p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ─────────────────────────────────────────────
// Page component
// ─────────────────────────────────────────────

export function CareerPathDetail() {
  const { pathId } = useParams<{ pathId: string }>()
  const navigate = useNavigate()
  const { paths, isLoaded, loadPaths, enrollInPath, dropPath, getEnrollmentForPath, getPathProgress, isStageUnlocked } =
    useCareerPathStore()

  useEffect(() => {
    let ignore = false
    loadPaths().catch(err => {
      if (!ignore) console.error('[CareerPathDetail] Failed to load paths:', err)
    })
    return () => {
      ignore = true
    }
  }, [loadPaths])

  const path = useMemo(() => paths.find(p => p.id === pathId), [paths, pathId])

  // Redirect to list if path not found after data loads
  useEffect(() => {
    if (isLoaded && !path) {
      navigate('/career-paths', { replace: true })
    }
  }, [isLoaded, path, navigate])

  if (!isLoaded || !path) {
    return <DetailSkeleton />
  }

  const enrollment = getEnrollmentForPath(path.id)
  const isEnrolled = !!enrollment
  const progress = getPathProgress(path.id)

  const handleEnroll = async () => {
    try {
      await enrollInPath(path.id)
    } catch {
      // Toast already shown by store
    }
  }

  const handleDrop = async () => {
    try {
      await dropPath(path.id)
    } catch {
      // Toast already shown by store
    }
  }

  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="space-y-6 max-w-3xl"
      >
        {/* Back link */}
        <motion.div variants={fadeUp}>
          <Link
            to="/career-paths"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
            Career Paths
          </Link>
        </motion.div>

        {/* Path header */}
        <PathHeader
          path={path}
          isEnrolled={isEnrolled}
          progressPercentage={progress.percentage}
          completedCourses={progress.completedCourses}
          totalCourses={progress.totalCourses}
          onEnroll={handleEnroll}
          onDrop={handleDrop}
        />

        {/* Stage timeline */}
        <div className="space-y-4" role="list" aria-label="Learning stages">
          {path.stages.map((stage, index) => (
            <div key={stage.id} role="listitem">
              <StageCard
                path={path}
                stage={stage}
                stageIndex={index}
                isUnlocked={isStageUnlocked(path.id, index)}
              />
            </div>
          ))}
        </div>
      </motion.div>
    </MotionConfig>
  )
}
