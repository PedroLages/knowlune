import { useState, useEffect, useMemo, useCallback } from 'react'
import { Link } from 'react-router'
import { MotionConfig, motion } from 'motion/react'
import {
  Brain,
  Shield,
  Crosshair,
  Trophy,
  BookOpen,
  Search,
  ArrowRight,
  Route,
  WifiOff,
  type LucideIcon,
} from 'lucide-react'
import { Badge } from '@/app/components/ui/badge'
import { Button } from '@/app/components/ui/button'
import { Skeleton } from '@/app/components/ui/skeleton'
import { DelayedFallback } from '@/app/components/DelayedFallback'
import { EmptyState } from '@/app/components/EmptyState'
import { cn } from '@/app/components/ui/utils'
import { useCareerPathStore } from '@/stores/useCareerPathStore'
import { useOnlineStatus } from '@/app/hooks/useOnlineStatus'
import { staggerContainer, fadeUp } from '@/lib/motion'
import type { CareerPath } from '@/data/types'

/** Map icon name strings from seed data to Lucide components. */
const ICON_MAP: Record<string, LucideIcon> = {
  Brain,
  Shield,
  Crosshair,
  Trophy,
}

/** Per-path accent tokens for icon badges. */
const PATH_ACCENT: Record<string, { softBg: string; fg: string }> = {
  'behavioral-intelligence': {
    softBg: 'bg-brand-soft',
    fg: 'text-brand-soft-foreground',
  },
  'influence-authority': {
    softBg: 'bg-gold-muted',
    fg: 'text-gold-soft-foreground',
  },
  'operative-foundations': {
    softBg: 'bg-success-soft',
    fg: 'text-success',
  },
  'complete-mastery': {
    softBg: 'bg-accent-violet-muted',
    fg: 'text-accent-violet',
  },
}

const DEFAULT_ACCENT = {
  softBg: 'bg-brand-soft',
  fg: 'text-brand-soft-foreground',
}

/** Format number to zero-padded index string: 0 → "01" */
function padIndex(i: number): string {
  return String(i + 1).padStart(2, '0')
}

function PathRowSkeleton() {
  return (
    <div className="py-10 border-b border-border">
      <div className="flex items-center justify-between gap-8">
        <div className="flex items-center gap-6 flex-1 min-w-0">
          <Skeleton className="size-8 rounded-full shrink-0" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-6 w-64" />
            <Skeleton className="h-4 w-96 max-w-full" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
        <Skeleton className="size-12 rounded-full shrink-0" />
      </div>
    </div>
  )
}

function PathRow({
  path,
  index,
}: {
  path: CareerPath
  index: number
}) {
  const { getEnrollmentForPath, getPathProgress } = useCareerPathStore()
  const enrollment = getEnrollmentForPath(path.id)
  const progress = getPathProgress(path.id)
  const Icon = ICON_MAP[path.icon] ?? BookOpen
  const accent = PATH_ACCENT[path.id] ?? DEFAULT_ACCENT
  const totalCourses = path.stages.reduce((acc, s) => acc + s.courseIds.length, 0)
  const isEnrolled = !!enrollment

  return (
    <motion.div variants={fadeUp} role="listitem">
      <Link
        to={`/career-paths/${path.id}`}
        className={cn(
          'group relative block py-10 border-b border-border',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-4 focus-visible:ring-offset-background rounded-sm',
          'transition-colors hover:bg-muted/30'
        )}
        aria-label={`${path.title} — ${totalCourses} courses, ${path.totalEstimatedHours} hours${isEnrolled ? `, ${progress.percentage}% completed` : ''}`}
      >
        {/* Large decorative number */}
        <span
          className="absolute right-4 top-1/2 -translate-y-1/2 text-[120px] font-display font-bold text-muted-foreground opacity-[0.07] leading-none pointer-events-none select-none hidden sm:block"
          aria-hidden="true"
        >
          {padIndex(index)}
        </span>

        <div className="relative z-10 flex items-center justify-between gap-6 sm:gap-8">
          {/* Left section: icon + content */}
          <div className="flex items-start gap-4 sm:gap-6 flex-1 min-w-0">
            {/* Icon badge */}
            <div
              className={cn(
                'size-8 rounded-full flex items-center justify-center shrink-0 mt-1',
                accent.softBg
              )}
            >
              <Icon className={cn('size-4', accent.fg)} aria-hidden="true" />
            </div>

            {/* Text content */}
            <div className="min-w-0 flex-1 space-y-2">
              <h2 className="text-lg sm:text-xl font-semibold tracking-tight group-hover:text-brand transition-colors">
                {path.title}
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2 max-w-2xl">
                {path.description}
              </p>

              {/* Metadata row */}
              <div className="flex items-center gap-2 pt-1">
                {isEnrolled && (
                  <Badge
                    className={cn(
                      'text-[10px] uppercase tracking-[0.15em] border-0 font-medium',
                      accent.softBg,
                      accent.fg
                    )}
                  >
                    {progress.percentage >= 100 ? 'Completed' : 'In Progress'}
                  </Badge>
                )}
                <span className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground font-medium">
                  {totalCourses} Courses
                </span>
                <span
                  className="text-muted-foreground text-[11px]"
                  aria-hidden="true"
                >
                  &bull;
                </span>
                <span className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground font-medium">
                  {path.totalEstimatedHours}H
                </span>
                <span
                  className="text-muted-foreground text-[11px]"
                  aria-hidden="true"
                >
                  &bull;
                </span>
                <span className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground font-medium">
                  {path.stages.length} Stages
                </span>
              </div>
            </div>
          </div>

          {/* Right section: progress percentage or arrow button */}
          <div className="shrink-0">
            {isEnrolled ? (
              <div className="text-right">
                <div className="text-5xl font-display font-bold text-foreground leading-none">
                  {progress.percentage}
                  <span className="text-3xl">%</span>
                </div>
                <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-medium mt-1 block">
                  Completed
                </span>
              </div>
            ) : (
              <div
                className={cn(
                  'size-12 rounded-full border border-border flex items-center justify-center',
                  'group-hover:border-brand group-hover:text-brand transition-colors'
                )}
                aria-hidden="true"
              >
                <ArrowRight className="size-5 group-hover:translate-x-0.5 transition-transform" />
              </div>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

export function CareerPaths() {
  const { paths, isLoaded, loadPaths } = useCareerPathStore()
  const [search, setSearch] = useState('')
  const [loadError, setLoadError] = useState<string | null>(null)
  const isOnline = useOnlineStatus()

  const handleLoad = useCallback(async () => {
    setLoadError(null)
    try {
      await loadPaths()
    } catch (err) {
      console.error('[CareerPaths] Failed to load paths:', err)
      setLoadError(
        isOnline
          ? 'Failed to load learning paths. Please try again.'
          : "You're offline. Please check your connection and try again."
      )
    }
  }, [loadPaths, isOnline])

  useEffect(() => {
    let ignore = false
    handleLoad().catch(err => {
      if (!ignore) console.error('[CareerPaths] Load failed:', err)
    })
    return () => {
      ignore = true
    }
  }, [handleLoad])

  const filteredPaths = useMemo(() => {
    if (!search.trim()) return [...paths]
    const q = search.toLowerCase()
    return paths.filter(
      p =>
        p.title.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
    )
  }, [paths, search])

  if (!isLoaded && !loadError) {
    return (
      <DelayedFallback>
        <div className="space-y-2">
          <Skeleton className="h-14 w-80" />
          <Skeleton className="h-5 w-96" />
          <div className="pt-8">
            {Array.from({ length: 4 }, (_, i) => (
              <PathRowSkeleton key={i} />
            ))}
          </div>
        </div>
      </DelayedFallback>
    )
  }

  if (loadError) {
    return (
      <div className="space-y-8">
        <div className="space-y-4">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight font-display text-foreground">
            Career Paths
          </h1>
        </div>
        <div className="rounded-[24px] border border-destructive/50 bg-destructive/10 p-8 text-center">
          {!isOnline && (
            <WifiOff className="mx-auto mb-3 size-6 text-destructive" aria-hidden="true" />
          )}
          <p className="text-sm text-destructive">{loadError}</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={handleLoad}>
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="space-y-8"
      >
        {/* Page header — editorial display type */}
        <motion.div variants={fadeUp} className="space-y-4">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight font-display text-foreground">
            Career Paths
          </h1>
          <p className="text-muted-foreground text-base max-w-xl leading-relaxed">
            Structured multi-course journeys with staged progression and
            prerequisite tracking.
          </p>
        </motion.div>

        {/* Search bar — underline style */}
        <motion.div variants={fadeUp}>
          <div className="relative max-w-md">
            <Search
              className="absolute left-0 top-1/2 -translate-y-1/2 size-4 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search paths..."
              aria-label="Search learning paths"
              className={cn(
                'w-full bg-transparent border-0 border-b border-border pl-7 pr-2 py-2',
                'text-sm text-foreground placeholder:text-muted-foreground',
                'focus:outline-none focus:border-brand transition-colors'
              )}
            />
          </div>
        </motion.div>

        {/* Path list */}
        {filteredPaths.length === 0 && search.trim() ? (
          <motion.div variants={fadeUp}>
            <EmptyState
              icon={Search}
              title="No paths match your search"
              description={`No learning paths found for "${search}". Try a different search term.`}
            />
          </motion.div>
        ) : filteredPaths.length === 0 ? (
          <EmptyState
            icon={Route}
            title="No learning paths available"
            description="Curated learning paths will appear here once they are available."
          />
        ) : (
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            role="list"
            aria-label="Learning paths"
          >
            {filteredPaths.map((path, index) => (
              <PathRow key={path.id} path={path} index={index} />
            ))}
          </motion.div>
        )}
      </motion.div>
    </MotionConfig>
  )
}
