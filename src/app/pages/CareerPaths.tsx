import { useEffect, useMemo } from 'react'
import { Link } from 'react-router'
import { MotionConfig, motion } from 'motion/react'
import {
  Brain,
  Shield,
  Crosshair,
  Trophy,
  Clock,
  BookOpen,
  Route,
  type LucideIcon,
} from 'lucide-react'
import { Card, CardContent } from '@/app/components/ui/card'
import { Badge } from '@/app/components/ui/badge'
import { Progress } from '@/app/components/ui/progress'
import { Skeleton } from '@/app/components/ui/skeleton'
import { DelayedFallback } from '@/app/components/DelayedFallback'
import { EmptyState } from '@/app/components/EmptyState'
import { useCareerPathStore } from '@/stores/useCareerPathStore'
import { staggerContainer, fadeUp } from '@/lib/motion'
import type { CareerPath } from '@/data/types'

/** Map icon name strings from seed data to Lucide components. */
const ICON_MAP: Record<string, LucideIcon> = {
  Brain,
  Shield,
  Crosshair,
  Trophy,
}

function PathCardSkeleton() {
  return (
    <div className="space-y-3 p-6 rounded-[24px] border bg-card">
      <Skeleton className="h-10 w-10 rounded-xl" />
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
      <div className="flex gap-4 pt-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-20" />
      </div>
    </div>
  )
}

function PathCard({ path }: { path: CareerPath }) {
  const { getEnrollmentForPath, getPathProgress } = useCareerPathStore()
  const enrollment = getEnrollmentForPath(path.id)
  const progress = getPathProgress(path.id)
  const Icon = ICON_MAP[path.icon] ?? BookOpen

  const totalCourses = path.stages.reduce((acc, s) => acc + s.courseIds.length, 0)
  const isEnrolled = !!enrollment

  return (
    <motion.div variants={fadeUp}>
      <Link
        to={`/career-paths/${path.id}`}
        className="block h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded-[24px]"
        aria-label={`${path.title} — ${totalCourses} courses, ${path.totalEstimatedHours} hours`}
      >
        <Card className="h-full hover:shadow-md transition-shadow duration-200 rounded-[24px] group">
          <CardContent className="p-6 flex flex-col h-full gap-4">
            {/* Icon */}
            <div className="size-10 rounded-xl bg-brand-soft flex items-center justify-center shrink-0">
              <Icon className="size-5 text-brand-soft-foreground" aria-hidden="true" />
            </div>

            {/* Title + description */}
            <div className="flex-1 min-w-0">
              <h2 className="font-semibold text-base mb-1 group-hover:text-brand transition-colors">
                {path.title}
              </h2>
              <p className="text-sm text-muted-foreground line-clamp-2">{path.description}</p>
            </div>

            {/* Meta */}
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <BookOpen className="size-3.5" aria-hidden="true" />
                {totalCourses} courses
              </span>
              <span className="flex items-center gap-1">
                <Clock className="size-3.5" aria-hidden="true" />
                {path.totalEstimatedHours}h
              </span>
              <span>{path.stages.length} stages</span>
            </div>

            {/* Progress or enroll badge */}
            {isEnrolled ? (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Progress</span>
                  <span>{progress.percentage}%</span>
                </div>
                <Progress
                  value={progress.percentage}
                  className="h-1.5"
                  aria-label={`${progress.percentage}% complete`}
                />
              </div>
            ) : (
              <Badge variant="outline" className="self-start text-xs">
                Start learning
              </Badge>
            )}
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  )
}

export function CareerPaths() {
  const { paths, isLoaded, loadPaths } = useCareerPathStore()

  useEffect(() => {
    let ignore = false
    loadPaths().catch(err => {
      if (!ignore) console.error('[CareerPaths] Failed to load paths:', err)
    })
    return () => {
      ignore = true
    }
  }, [loadPaths])

  const sortedPaths = useMemo(() => [...paths], [paths])

  if (!isLoaded) {
    return (
      <DelayedFallback>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
            {Array.from({ length: 4 }, (_, i) => (
              <PathCardSkeleton key={i} />
            ))}
          </div>
        </div>
      </DelayedFallback>
    )
  }

  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="space-y-6"
      >
        {/* Header */}
        <motion.div variants={fadeUp}>
          <h1 className="text-2xl font-bold tracking-tight">Career Paths</h1>
          <p className="text-muted-foreground mt-1">
            Structured multi-course journeys with staged progression and prerequisite tracking.
          </p>
        </motion.div>

        {sortedPaths.length === 0 ? (
          <EmptyState
            icon={Route}
            title="No career paths available"
            description="Curated learning paths will appear here once they are available."
          />
        ) : (
          <div
            className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5"
            role="list"
            aria-label="Career paths"
          >
            {sortedPaths.map(path => (
              <div key={path.id} role="listitem">
                <PathCard path={path} />
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </MotionConfig>
  )
}
