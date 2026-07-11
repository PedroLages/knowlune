import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { motion } from 'motion/react'
import { Plus, Search, Route, Download, ArrowUpDown, Check, CheckCircle2 } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { Card, CardContent } from '@/app/components/ui/card'
import { Skeleton } from '@/app/components/ui/skeleton'
import { Input } from '@/app/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu'
import { cn } from '@/app/components/ui/utils'
import { EmptyState } from '@/app/components/EmptyState'
import { DelayedFallback } from '@/app/components/DelayedFallback'

import { ImportWizardDialog } from '@/app/components/figma/ImportWizardDialog'
import { CurriculumComposer } from '@/app/components/figma/CurriculumComposer'
import { PathCoverDialog } from '@/app/components/learning-path/PathCoverDialog'
import { EditPathDialog } from '@/app/components/learning-path/EditPathDialog'
import { LearningPathCard } from '@/app/components/learning-path/LearningPathCard'
import { ContinueLearningPathSection } from '@/app/components/ContinueLearningPathSection'
import { useLearningPathStore } from '@/stores/useLearningPathStore'
import { useCourseImportStore } from '@/stores/useCourseImportStore'

import { useMultiPathProgress } from '@/app/hooks/usePathProgress'
import { useNextBestCourse } from '@/app/hooks/useNextBestCourse'
import { useImportWizardTrigger } from '@/app/hooks/useImportWizardTrigger'
import { useLoadCourseThumbnails } from '@/app/hooks/useLoadCourseThumbnails'
import { staggerContainer, fadeUp } from '@/lib/motion'
import { getPathCourseThumbnailUrls } from '@/lib/learningPathThumbnails'
import type { LearningPath, LearningPathEntry } from '@/data/types'

// --- Track Card ---

function TrackCard({
  path,
  courseCount,
  completionPct,
  totalLessons,
  estimatedRemainingHours,
  courseThumbnails,
  onImport,
  onOpenCoverDialog,
  onOpenEditDialog,
  coverDialogTriggerRef,
}: {
  path: LearningPath
  courseCount: number
  completionPct: number
  totalLessons: number
  estimatedRemainingHours: number
  courseThumbnails: string[]
  onImport: (pathId: string) => void
  onOpenCoverDialog: (path: LearningPath) => void
  onOpenEditDialog: (path: LearningPath) => void
  coverDialogTriggerRef: React.MutableRefObject<HTMLElement | null>
}) {
  const deletePathWithUndo = useLearningPathStore(s => s.deletePathWithUndo)
  const isCompleted = completionPct >= 100

  const { entry, course, action, targetLessonId } = useNextBestCourse(path.id)

  const footerAction = useMemo(() => {
    if (action === 'resume' && course) {
      const navTo = targetLessonId
        ? `/courses/${entry!.courseId}/lessons/${targetLessonId}`
        : `/courses/${entry!.courseId}`
      return { label: 'Continue', to: navTo, variant: 'brand' as const, courseName: course.name }
    }
    if (action === 'start' && course) {
      const navTo = targetLessonId
        ? `/courses/${entry!.courseId}/lessons/${targetLessonId}`
        : `/courses/${entry!.courseId}`
      return { label: 'Start', to: navTo, variant: 'brand' as const, courseName: course.name }
    }
    if (action === 'complete' || (action === null && isCompleted)) {
      return { label: 'Review', to: `/learning-tracks/${path.id}`, variant: 'outline' as const }
    }
    return null
  }, [action, course, entry, targetLessonId, isCompleted, path.id])

  return (
    <motion.div variants={fadeUp}>
      <LearningPathCard
        pathName={path.name}
        completionPct={completionPct}
        courseCount={courseCount}
        totalLessons={totalLessons}
        estimatedRemainingHours={estimatedRemainingHours}
        courseThumbnails={courseThumbnails}
        isAIGenerated={path.isAIGenerated}
        coverImageUrl={path.coverImageUrl}
        coverPreset={path.coverPreset}
        href={`/learning-tracks/${path.id}`}
        action={footerAction}
        nextCourseName={footerAction?.courseName}
        onEdit={() => onOpenEditDialog(path)}
        onChangeCover={() => {
          coverDialogTriggerRef.current = document.activeElement as HTMLElement
          onOpenCoverDialog(path)
        }}
        onImportCourse={() => onImport(path.id)}
        onDelete={() => deletePathWithUndo(path.id)}
      />
    </motion.div>
  )
}

// --- Skeleton ---

function TrackCardSkeleton() {
  return (
    <Card className="overflow-hidden rounded-2xl">
      <Skeleton className="h-32 w-full rounded-none" />
      <CardContent className="px-6 pb-5 pt-1 relative">
        <Skeleton className="absolute top-0 left-6 -translate-y-1/2 size-[96px] rounded-full" />
        <div className="mt-7 space-y-3">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-px w-full" />
          <div className="flex justify-between pt-4">
            <div className="flex -space-x-3">
              <Skeleton className="size-8 rounded-full" />
              <Skeleton className="size-8 rounded-full" />
              <Skeleton className="size-8 rounded-full" />
            </div>
            <Skeleton className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// --- Main Page ---

export function LearningTracks() {
  const { paths, entries, loadPaths } = useLearningPathStore()
  const { importedCourses, loadImportedCourses, thumbnailUrls, loadThumbnailUrls } =
    useCourseImportStore()
  const [isLoaded, setIsLoaded] = useState(false)
  const [search, setSearch] = useState('')
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [coverDialogPath, setCoverDialogPath] = useState<LearningPath | null>(null)
  const coverDialogTriggerRef = useRef<HTMLElement | null>(null)
  const [editDialogPath, setEditDialogPath] = useState<LearningPath | null>(null)

  // Filter and sort state
  const [activeTab, setActiveTab] = useState<'all' | 'in-progress' | 'not-started' | 'completed'>('all')
  const [sortBy, setSortBy] = useState<'recent' | 'progress' | 'newest' | 'most-courses' | 'a-z'>('recent')

  // Import wizard trigger (singleton guard pattern)
  const {
    trigger,
    isOpen: importWizardOpen,
    setIsOpen: setImportWizardOpen,
    targetPathId: importTargetPathId,
  } = useImportWizardTrigger()

  // Header "Import Course" handler — opens wizard without a target path
  const handleHeaderImport = useCallback(() => trigger(null), [trigger])

  // Path card "Import Course" handler — opens wizard with that path's ID
  const handlePathImport = useCallback((pathId: string) => trigger(pathId), [trigger])

  useEffect(() => {
    let ignore = false
    // silent-catch-ok: error logged to console, page still renders with empty state
    Promise.all([loadPaths(), loadImportedCourses()])
      .then(() => {
        if (!ignore) setIsLoaded(true)
      })
      .catch(err => {
        if (!ignore) {
          console.error('[LearningTracks] Failed to load:', err)
          setIsLoaded(true)
        }
      })
    return () => {
      ignore = true
    }
  }, [loadPaths, loadImportedCourses])

  // Load thumbnail URLs when imported courses are available
  useLoadCourseThumbnails(importedCourses, loadThumbnailUrls)

  // Build a stable map of pathId → entries for useMultiPathProgress
  const pathEntriesMap = useMemo(() => {
    const map = new Map<string, LearningPathEntry[]>()
    for (const path of paths) {
      map.set(
        path.id,
        entries.filter(e => e.pathId === path.id)
      )
    }
    return map
  }, [paths, entries])

  // Compute real progress from contentProgress (catalog) and progress table (imported)
  const pathProgressMap = useMultiPathProgress(pathEntriesMap)

  // Derive per-path stats from progress data
  const pathStats = useMemo(() => {
    const stats = new Map<
      string,
      { courseCount: number; completionPct: number; totalLessons: number; estimatedRemainingHours: number }
    >()
    for (const path of paths) {
      const progress = pathProgressMap.get(path.id)
      const pathEntries = entries.filter(e => e.pathId === path.id)
      stats.set(path.id, {
        courseCount: pathEntries.length,
        completionPct: progress?.completionPct ?? 0,
        totalLessons: progress?.totalLessons ?? 0,
        estimatedRemainingHours: progress?.estimatedRemainingHours ?? 0,
      })
    }
    return stats
  }, [paths, entries, pathProgressMap])

  // Build thumbnail lists per path (first 4 course thumbnails, syllabus order)
  const pathThumbnails = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const path of paths) {
      const pathEntries = entries
        .filter(e => e.pathId === path.id)
        .sort((a, b) => a.position - b.position)
      map.set(path.id, getPathCourseThumbnailUrls(pathEntries, thumbnailUrls, 4))
    }
    return map
  }, [paths, entries, thumbnailUrls])

  // Separate user paths from templates
  const userPaths = useMemo(() => paths.filter(p => !p.isTemplate), [paths])

  const filteredPaths = useMemo(() => {
    if (!search.trim()) return userPaths
    const q = search.toLowerCase()
    return userPaths.filter(
      p =>
        p.name.toLowerCase().includes(q) ||
        (p.description && p.description.toLowerCase().includes(q))
    )
  }, [userPaths, search])

  // Compute counts for filter tabs
  const tabCounts = useMemo(() => ({
    all: filteredPaths.length,
    'in-progress': filteredPaths.filter(p => {
      const pct = pathStats.get(p.id)?.completionPct ?? 0
      return pct > 0 && pct < 100
    }).length,
    'not-started': filteredPaths.filter(p => {
      const pct = pathStats.get(p.id)?.completionPct ?? 0
      return pct === 0
    }).length,
    completed: filteredPaths.filter(p => {
      const pct = pathStats.get(p.id)?.completionPct ?? 0
      return pct >= 100
    }).length,
  }), [filteredPaths, pathStats])

  // Filter by active tab, then sort
  const sortedFilteredPaths = useMemo(() => {
    // Filter by tab
    const tabFiltered = activeTab === 'all'
      ? filteredPaths
      : filteredPaths.filter(p => {
          const pct = pathStats.get(p.id)?.completionPct ?? 0
          if (activeTab === 'in-progress') return pct > 0 && pct < 100
          if (activeTab === 'not-started') return pct === 0
          return pct >= 100 // completed
        })

    // Sort
    return [...tabFiltered].sort((a, b) => {
      switch (sortBy) {
        case 'progress': {
          const pctA = pathStats.get(a.id)?.completionPct ?? 0
          const pctB = pathStats.get(b.id)?.completionPct ?? 0
          return pctB - pctA
        }
        case 'newest':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        case 'most-courses': {
          const countA = pathStats.get(a.id)?.courseCount ?? 0
          const countB = pathStats.get(b.id)?.courseCount ?? 0
          return countB - countA
        }
        case 'a-z':
          return a.name.localeCompare(b.name)
        case 'recent':
        default: {
          const pctA = pathStats.get(a.id)?.completionPct ?? 0
          const pctB = pathStats.get(b.id)?.completionPct ?? 0
          const tier = (pct: number) => (pct === 0 ? 1 : pct >= 100 ? 2 : 0)
          const tierDiff = tier(pctA) - tier(pctB)
          if (tierDiff !== 0) return tierDiff
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        }
      }
    })
  }, [filteredPaths, activeTab, sortBy, pathStats])

  if (!isLoaded) {
    return (
      <DelayedFallback>
        <div className="space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-5 w-96" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-[var(--content-gap)]">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="w-full">
                <TrackCardSkeleton />
              </div>
            ))}
          </div>
        </div>
      </DelayedFallback>
    )
  }

  return (
    <>
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="space-y-6"
      >
        {/* Header */}
        <motion.div
          variants={fadeUp}
          className="flex flex-col md:flex-row md:items-end justify-between gap-[var(--content-gap)]"
        >
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight font-display">Learning Tracks</h1>
            <p className="text-muted-foreground text-lg mt-2">
              Follow structured learning journeys and track your progress
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            {userPaths.length > 0 && (
              <div className="relative flex-grow">
                <Search
                  className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search tracks..."
                  aria-label="Search learning tracks"
                  className="pl-12 py-3"
                />
              </div>
            )}
            <Button
              variant="brand"
              onClick={() => setCreateDialogOpen(true)}
              className="px-6 py-3 shadow-lg shadow-brand/20"
            >
              <Plus className="size-4 mr-2" aria-hidden="true" />
              Create Track
            </Button>
            <Button variant="brand-outline" onClick={handleHeaderImport} className="px-6 py-3">
              <Download className="size-4 mr-2" aria-hidden="true" />
              Import Course
            </Button>
          </div>
        </motion.div>

        {/* Live region for search result announcements */}
        <span role="status" aria-live="polite" className="sr-only">
          {search.trim()
            ? `${filteredPaths.length} ${filteredPaths.length === 1 ? 'track' : 'tracks'} found`
            : ''}
        </span>

        {/* Continue Learning Paths section — renders null when no actionable paths */}
        {userPaths.length > 0 && (
          <motion.div variants={fadeUp}>
            <ContinueLearningPathSection />
          </motion.div>
        )}

        {/* Content */}
        {userPaths.length === 0 ? (
          /* Empty state — no user paths */
          <motion.div variants={fadeUp}>
            <EmptyState
              icon={Route}
              title="No learning tracks yet"
              description="Learning tracks help you organize courses into structured journeys. Create a track or import courses to get started."
              actionLabel="Create Track"
              onAction={() => setCreateDialogOpen(true)}
            />
          </motion.div>
        ) : filteredPaths.length === 0 && search.trim() ? (
          /* No search results */
          <motion.div variants={fadeUp}>
            <EmptyState
              icon={Search}
              title="No tracks match your search"
              description={`No learning tracks found for "${search}". Try searching by course, lesson, or use a different term.`}
            />
          </motion.div>
        ) : (
          /* User track cards grid */
          <>
            {/* Filter tabs + sort bar */}
            {userPaths.length > 0 && (
              <motion.div
                variants={fadeUp}
                className="flex items-center justify-between flex-wrap gap-3 mb-4"
              >
                <div className="flex items-center gap-1" role="tablist">
                  {(['all', 'in-progress', 'not-started', 'completed'] as const).map(tab => (
                    <button
                      key={tab}
                      role="tab"
                      aria-selected={activeTab === tab}
                      onClick={() => setActiveTab(tab)}
                      className={cn(
                        'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                        activeTab === tab
                          ? 'bg-brand text-brand-foreground'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                      )}
                    >
                      {tab === 'all'
                        ? 'All'
                        : tab === 'in-progress'
                          ? 'In Progress'
                          : tab === 'not-started'
                            ? 'Not Started'
                            : 'Completed'}
                      <span className="ml-1.5 text-xs opacity-70">{tabCounts[tab]}</span>
                    </button>
                  ))}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground">
                      <ArrowUpDown className="size-3.5" />
                      Sort
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {([
                      { key: 'recent', label: 'Recently opened' },
                      { key: 'progress', label: 'Progress' },
                      { key: 'newest', label: 'Newest' },
                      { key: 'most-courses', label: 'Most courses' },
                      { key: 'a-z', label: 'A–Z' },
                    ] as const).map(({ key, label }) => (
                      <DropdownMenuItem key={key} onClick={() => setSortBy(key)}>
                        {label}
                        {sortBy === key && <Check className="ml-auto size-4" />}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </motion.div>
            )}

            {/* Tracks grid or filter-empty state */}
            {sortedFilteredPaths.length === 0 && activeTab !== 'all' ? (
              <motion.div variants={fadeUp}>
                <EmptyState
                  icon={
                    activeTab === 'completed'
                      ? CheckCircle2
                      : Route
                  }
                  title={`No ${
                    activeTab === 'in-progress'
                      ? 'in-progress'
                      : activeTab === 'not-started'
                        ? 'unstarted'
                        : 'completed'
                  } tracks`}
                  description={
                    activeTab === 'in-progress'
                      ? 'Start a course in any track to see it here.'
                      : activeTab === 'not-started'
                        ? 'All your tracks have been started. Great progress!'
                        : 'Complete all courses in a track to see it here.'
                  }
                />
              </motion.div>
            ) : (
              <motion.div
                variants={staggerContainer}
                initial="hidden"
                animate="visible"
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-[var(--content-gap)]"
                role="list"
                aria-label="Learning tracks"
              >
                {sortedFilteredPaths.map(path => {
                  const stats = pathStats.get(path.id) || {
                    courseCount: 0,
                    completionPct: 0,
                    totalLessons: 0,
                    estimatedRemainingHours: 0,
                  }
                  return (
                    <div key={path.id} role="listitem" className="w-full">
                      <TrackCard
                        path={path}
                        courseCount={stats.courseCount}
                        completionPct={stats.completionPct}
                        totalLessons={stats.totalLessons}
                        estimatedRemainingHours={stats.estimatedRemainingHours}
                        courseThumbnails={pathThumbnails.get(path.id) || []}
                        onImport={handlePathImport}
                        onOpenCoverDialog={setCoverDialogPath}
                        onOpenEditDialog={setEditDialogPath}
                        coverDialogTriggerRef={coverDialogTriggerRef}
                      />
                    </div>
                  )
                })}
              </motion.div>
            )}
          </>
        )}
      </motion.div>

      {/* Dialogs */}
      <CurriculumComposer
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        redirectBase="/learning-tracks"
      />

      {/* Path Cover Dialog */}
      {coverDialogPath && (
        <PathCoverDialog
          open={!!coverDialogPath}
          onOpenChange={open => {
            if (!open) setCoverDialogPath(null)
          }}
          path={coverDialogPath}
          triggerRef={coverDialogTriggerRef}
        />
      )}

      {/* Edit Path Dialog */}
      {editDialogPath && (
        <EditPathDialog
          open={!!editDialogPath}
          onOpenChange={open => {
            if (!open) setEditDialogPath(null)
          }}
          path={editDialogPath}
        />
      )}

      {/* Import Wizard Dialog */}
      <ImportWizardDialog
        open={importWizardOpen}
        onOpenChange={setImportWizardOpen}
        targetPathId={importTargetPathId ?? undefined}
      />
    </>
  )
}
