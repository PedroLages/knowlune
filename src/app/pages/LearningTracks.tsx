import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { motion } from 'motion/react'
import { Plus, Search, Route, Download } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { Card, CardContent } from '@/app/components/ui/card'
import { Skeleton } from '@/app/components/ui/skeleton'
import { Input } from '@/app/components/ui/input'
import { EmptyState } from '@/app/components/EmptyState'
import { DelayedFallback } from '@/app/components/DelayedFallback'

import { ImportWizardDialog } from '@/app/components/figma/ImportWizardDialog'
import { CurriculumComposer } from '@/app/components/figma/CurriculumComposer'
import { PathCoverDialog } from '@/app/components/learning-path/PathCoverDialog'
import { EditPathDialog } from '@/app/components/learning-path/EditPathDialog'
import { LearningPathCard } from '@/app/components/learning-path/LearningPathCard'
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
  courseThumbnails,
  onImport,
  onOpenCoverDialog,
  onOpenEditDialog,
  coverDialogTriggerRef,
}: {
  path: LearningPath
  courseCount: number
  completionPct: number
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
        courseThumbnails={courseThumbnails}
        isAIGenerated={path.isAIGenerated}
        coverImageUrl={path.coverImageUrl}
        coverPreset={path.coverPreset}
        href={`/learning-tracks/${path.id}`}
        action={footerAction}
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

  // Derive courseCount + completionPct per path
  const pathStats = useMemo(() => {
    const stats = new Map<string, { courseCount: number; completionPct: number }>()
    for (const path of paths) {
      const progress = pathProgressMap.get(path.id)
      const pathEntries = entries.filter(e => e.pathId === path.id)
      stats.set(path.id, {
        courseCount: pathEntries.length,
        completionPct: progress?.completionPct ?? 0,
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
        .sort((a, b) => {
          if (path.orderMode === 'manifest') {
            const aOrd = a.manifestOrdinal
            const bOrd = b.manifestOrdinal
            if (aOrd != null && bOrd != null) return aOrd - bOrd
            if (aOrd != null) return -1
            if (bOrd != null) return 1
          }
          return a.position - b.position
        })
      map.set(path.id, getPathCourseThumbnailUrls(pathEntries, thumbnailUrls, 4))
    }
    return map
  }, [paths, entries, thumbnailUrls])

  // Separate user paths from templates.
  // Template section intentionally removed — templates are only accessible via
  // the curriculum composer's AI mode, not from the main tracks list. The old
  // template section was dropped because users found it confusing to see both
  // personal tracks and system templates in the same view. If re-added, restore
  // the TemplateCard component and render a "Discover Templates" section above
  // the user path grid.
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

        {/* Content */}
        {userPaths.length === 0 ? (
          /* No tracks — empty state */
          <>
            <motion.div variants={fadeUp}>
              <EmptyState
                icon={Route}
                title="No learning tracks yet"
                description="Learning tracks help you organize courses into structured journeys. Create your first track to get started."
                actionLabel="Create Track"
                onAction={() => setCreateDialogOpen(true)}
              />
            </motion.div>
          </>
        ) : filteredPaths.length === 0 && search.trim() ? (
          /* No search results */
          <motion.div variants={fadeUp}>
            <EmptyState
              icon={Search}
              title="No tracks match your search"
              description={`No learning tracks found for "${search}". Try a different search term.`}
            />
          </motion.div>
        ) : (
          /* User track cards grid */
          <>
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-[var(--content-gap)]"
              role="list"
              aria-label="Learning tracks"
            >
              {filteredPaths.map(path => {
                const stats = pathStats.get(path.id) || { courseCount: 0, completionPct: 0 }
                return (
                  <div key={path.id} role="listitem" className="w-full">
                    <TrackCard
                      path={path}
                      courseCount={stats.courseCount}
                      completionPct={stats.completionPct}
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
