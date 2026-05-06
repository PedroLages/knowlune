import { useState, useEffect, useMemo, useCallback } from 'react'
import { Link, useNavigate } from 'react-router'
import { motion } from 'motion/react'
import {
  Plus,
  Search,
  Route,
  MoreHorizontal,
  Trash2,
  BookOpen,
  ArrowRight,
  CheckCircle2,
  Download,
  LayoutTemplate,
  ChevronDown,
  Image,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { Card, CardContent } from '@/app/components/ui/card'
import { Badge } from '@/app/components/ui/badge'
import { Skeleton } from '@/app/components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu'
import { Input } from '@/app/components/ui/input'
import { Textarea } from '@/app/components/ui/textarea'
import { Label } from '@/app/components/ui/label'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/app/components/ui/collapsible'
import { EmptyState } from '@/app/components/EmptyState'
import { DelayedFallback } from '@/app/components/DelayedFallback'
import { TemplateCard } from '@/app/components/course/TemplateCard'
import { cn } from '@/app/components/ui/utils'
import { PathProgressRing } from '@/app/components/figma/PathProgressRing'
import { PathCardHeader } from '@/app/components/figma/PathCardHeader'
import { ImportWizardDialog } from '@/app/components/figma/ImportWizardDialog'
import { CurriculumComposer } from '@/app/components/figma/CurriculumComposer'
import { InlineEditableField } from '@/app/components/figma/InlineEditableField'
import { PathCoverDialog } from '@/app/components/learning-path/PathCoverDialog'
import { PremiumGate } from '@/app/components/PremiumGate'
import { useLearningPathStore } from '@/stores/useLearningPathStore'
import { useCourseImportStore } from '@/stores/useCourseImportStore'
import { extractGapSearchTerm } from '@/data/learningPathUtils'
import { useMultiPathProgress } from '@/app/hooks/usePathProgress'
import { useNextBestCourse } from '@/app/hooks/useNextBestCourse'
import { useImportWizardTrigger } from '@/app/hooks/useImportWizardTrigger'
import { useLoadCourseThumbnails } from '@/app/hooks/useLoadCourseThumbnails'
import { staggerContainer, fadeUp } from '@/lib/motion'
import type { LearningPath, LearningPathEntry } from '@/data/types'

// --- AI Goal Input (empty state) ---

function AIGoalInput({
  goalText,
  onGoalTextChange,
  onGenerate,
}: {
  goalText: string
  onGoalTextChange: (value: string) => void
  onGenerate: () => void
}) {
  return (
    <PremiumGate featureLabel="AI path generation">
      <div className="rounded-2xl border border-border/50 bg-surface-sunken/30 p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="size-5 text-brand" aria-hidden="true" />
          <h3 className="text-base font-semibold">Generate with AI</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Describe your learning goal and let AI build a path from your course library.
        </p>
        <Label htmlFor="ai-goal-textarea" className="sr-only">
          Describe your learning goal
        </Label>
        <Textarea
          id="ai-goal-textarea"
          value={goalText}
          onChange={e => onGoalTextChange(e.target.value)}
          placeholder="e.g., I want to become a full-stack web developer in 6 months..."
          rows={3}
          maxLength={500}
          aria-label="Describe your learning goal"
        />
        <Button
          variant="brand"
          className="w-full"
          disabled={!goalText.trim()}
          onClick={onGenerate}
        >
          <Sparkles className="size-4 mr-2" aria-hidden="true" />
          Generate Path
        </Button>
      </div>
    </PremiumGate>
  )
}

// --- Path Card ---

function PathCard({
  path,
  courseCount,
  completionPct,
  courseThumbnails,
  onImport,
  onOpenCoverDialog,
}: {
  path: LearningPath
  courseCount: number
  completionPct: number
  courseThumbnails: string[]
  onImport: (pathId: string) => void
  onOpenCoverDialog: (path: LearningPath) => void
}) {
  const navigate = useNavigate()
  const renamePath = useLearningPathStore(s => s.renamePath)
  const updateDescription = useLearningPathStore(s => s.updateDescription)
  const deletePathWithUndo = useLearningPathStore(s => s.deletePathWithUndo)
  const isNotStarted = completionPct === 0 && courseCount > 0
  const isCompleted = completionPct >= 100

  // Get next best course info (internally — not from parent props)
  const { entry, course, action, targetLessonId } = useNextBestCourse(path.id)

  // Determine footer action text and navigation
  const footerAction = useMemo(() => {
    if (action === 'resume' && course) {
      const label = `Continue ${course.name.length > 30 ? course.name.slice(0, 28) + '...' : course.name}`
      const navTo = targetLessonId
        ? `/courses/${entry!.courseId}/lessons/${targetLessonId}`
        : `/courses/${entry!.courseId}`
      return { label, navTo, variant: 'brand' as const }
    }
    if (action === 'start' && course) {
      const label = `Start ${course.name.length > 30 ? course.name.slice(0, 28) + '...' : course.name}`
      const navTo = targetLessonId
        ? `/courses/${entry!.courseId}/lessons/${targetLessonId}`
        : `/courses/${entry!.courseId}`
      return { label, navTo, variant: 'brand' as const }
    }
    if (action === 'complete' || (action === null && isCompleted)) {
      return { label: 'Review', navTo: `/learning-paths/${path.id}`, variant: 'outline' as const }
    }
    return null
  }, [action, course, entry, targetLessonId, isCompleted, path.id])

  const handleFooterClick = useCallback(
    (e: React.MouseEvent) => {
      if (!footerAction) return
      e.preventDefault()
      e.stopPropagation()
      navigate(footerAction.navTo)
    },
    [footerAction, navigate]
  )

  return (
    <motion.div variants={fadeUp}>
      <Card
        className={cn(
          'group relative transition-all duration-300 hover:shadow-xl overflow-hidden rounded-2xl h-[320px] md:h-[340px]'
        )}
      >
        {/* Gradient header — dimmed when not started */}
        <div className={cn(isNotStarted && 'opacity-70')}>
          <PathCardHeader
            pathName={path.name}
            completionPct={completionPct}
            isAIGenerated={path.isAIGenerated}
            coverImageUrl={path.coverImageUrl}
          />
        </div>

        {/* Dropdown menu — over gradient */}
        <div className="absolute top-4 right-4 z-10">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-11 bg-white/20 hover:bg-white/40 backdrop-blur-md text-white rounded-full"
                aria-label={`Actions for ${path.name}`}
              >
                <MoreHorizontal className="size-4" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => onOpenCoverDialog(path)}>
                <Image className="mr-2 size-4" aria-hidden="true" />
                Change Cover
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onImport(path.id)}>
                <Download className="mr-2 size-4" aria-hidden="true" />
                Import Course
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => deletePathWithUndo(path.id)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 size-4" aria-hidden="true" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Card body */}
        <CardContent className="px-4 pb-4 pt-1 relative flex flex-col h-[calc(100%-6rem)]">
          {/* Progress ring — overlapping header */}
          <div className="absolute -top-10 left-4">
            <div className="bg-card rounded-full p-1.5 shadow-lg">
              <PathProgressRing percentage={completionPct} size="sm">
                {isCompleted ? (
                  <CheckCircle2 className="size-5 text-success" aria-hidden="true" />
                ) : (
                  <span className="text-xs font-bold text-foreground">
                    {Math.round(completionPct)}%
                  </span>
                )}
              </PathProgressRing>
            </div>
          </div>

          <Link
            to={`/learning-paths/${path.id}`}
            className="flex flex-col flex-1 min-h-0 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 rounded-lg mt-7"
            aria-label={`${path.name} — ${courseCount} courses, ${completionPct}% completed`}
          >
            {/* Course count badge */}
            <div className="flex items-center gap-2 mb-2">
              <Badge
                variant="secondary"
                className={cn(
                  'text-[10px] uppercase tracking-wider',
                  isCompleted && 'bg-success-soft text-success'
                )}
              >
                {courseCount} {courseCount === 1 ? 'course' : 'courses'}
              </Badge>
            </div>

            {/* Title + description */}
            <div onClick={e => e.stopPropagation()}>
              <InlineEditableField
                value={path.name}
                onSave={name => renamePath(path.id, name)}
                ariaLabel={`Edit path name: ${path.name}`}
                maxLength={100}
                className="text-xl font-bold leading-tight mb-1.5 line-clamp-2"
              />
            </div>
            <div onClick={e => e.stopPropagation()} className="mb-4">
              <InlineEditableField
                value={path.description || ''}
                onSave={desc => updateDescription(path.id, desc)}
                as="textarea"
                ariaLabel={`Edit path description`}
                placeholder="Add a description..."
                maxLength={500}
                className="text-sm text-muted-foreground leading-relaxed line-clamp-2"
              />
            </div>

            {/* Footer: course thumbnails + continue/start/review button */}
            <div className="mt-auto flex items-center justify-between border-t border-border pt-4">
              <div className="flex -space-x-3">
                {courseThumbnails.slice(0, 3).map((url, i) => (
                  <img
                    key={i}
                    src={url}
                    alt=""
                    className="size-8 rounded-full border-2 border-card bg-muted object-cover"
                    loading="lazy"
                  />
                ))}
                {courseCount === 0 && (
                  <div className="size-8 rounded-full border-2 border-card bg-muted flex items-center justify-center">
                    <BookOpen className="size-3.5 text-muted-foreground" aria-hidden="true" />
                  </div>
                )}
                {courseCount > 3 && (
                  <div className="size-8 rounded-full border-2 border-card bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                    +{courseCount - 3}
                  </div>
                )}
              </div>

              {/* Action button */}
              <div onClick={e => e.stopPropagation()}>
                {footerAction ? (
                  <Button
                    variant={footerAction.variant}
                    size="sm"
                    className="text-xs whitespace-nowrap"
                    onClick={handleFooterClick}
                    aria-label={footerAction.label}
                  >
                    {footerAction.label}
                    {footerAction.variant === 'brand' && (
                      <ArrowRight className="ml-1.5 size-3.5" aria-hidden="true" />
                    )}
                  </Button>
                ) : isNotStarted ? (
                  <span className="text-xs font-bold text-muted-foreground uppercase">
                    Not Started
                  </span>
                ) : (
                  <ArrowRight
                    className="size-4 text-muted-foreground group-hover:text-brand transition-colors"
                    aria-hidden="true"
                  />
                )}
              </div>
            </div>
          </Link>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// --- Skeleton ---

function PathCardSkeleton() {
  return (
    <Card className="overflow-hidden rounded-2xl">
      <Skeleton className="h-24 w-full rounded-none" />
      <CardContent className="px-4 pb-4 pt-1 relative">
        <Skeleton className="absolute -top-9 left-4 size-[56px] rounded-full" />
        <div className="mt-7 space-y-3">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <div className="flex justify-between pt-4 border-t border-border">
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

export function LearningPaths() {
  const { paths, entries, loadPaths, getEntriesForPath } = useLearningPathStore()
  const { importedCourses, loadImportedCourses, thumbnailUrls, loadThumbnailUrls } =
    useCourseImportStore()
  const [isLoaded, setIsLoaded] = useState(false)
  const [search, setSearch] = useState('')
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [aiDialogOpen, setAiDialogOpen] = useState(false)
  const [aiGoalText, setAiGoalText] = useState('')
  const [discoverOpen, setDiscoverOpen] = useState(false)
  const [coverDialogPath, setCoverDialogPath] = useState<LearningPath | null>(null)

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
          console.error('[LearningPaths] Failed to load:', err)
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

  // Build thumbnail lists per path (first 4 course thumbnails)
  const pathThumbnails = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const path of paths) {
      const pathEntries = entries.filter(e => e.pathId === path.id)
      const thumbs: string[] = []
      for (const entry of pathEntries) {
        if (thumbs.length >= 4) break
        const url = thumbnailUrls[entry.courseId]
        if (url) thumbs.push(url)
      }
      map.set(path.id, thumbs)
    }
    return map
  }, [paths, entries, thumbnailUrls])

  // Separate user paths from templates
  const userPaths = useMemo(() => paths.filter(p => !p.isTemplate), [paths])
  const templates = useMemo(() => paths.filter(p => p.isTemplate), [paths])

  // Compute match count per template (for card display)
  const templateMatchCounts = useMemo(() => {
    const normalize = (s: string) =>
      s
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
    const importedNames = new Set(importedCourses.map(c => normalize(c.name)))
    const counts = new Map<string, number>()
    for (const tpl of templates) {
      const tplEntries = entries.filter(e => e.pathId === tpl.id)
      const matched = tplEntries.filter(e => {
        const searchTerm = extractGapSearchTerm(e.justification)
        return searchTerm && importedNames.has(normalize(searchTerm))
      }).length
      counts.set(tpl.id, matched)
    }
    return counts
  }, [templates, entries, importedCourses])

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
                <PathCardSkeleton />
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
            <h1 className="text-4xl font-extrabold tracking-tight font-display">Learning Paths</h1>
            <p className="text-muted-foreground text-lg mt-2">
              Organize courses into structured learning journeys
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
                  placeholder="Search paths..."
                  aria-label="Search learning paths"
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
              Create Path
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
            ? `${filteredPaths.length} ${filteredPaths.length === 1 ? 'path' : 'paths'} found`
            : ''}
        </span>

        {/* Content */}
        {userPaths.length === 0 && templates.length > 0 ? (
          /* Empty user paths — templates as primary CTA */
          <>
            <motion.div variants={fadeUp} className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <LayoutTemplate className="w-5 h-5 text-brand-soft-foreground" />
                <h2 className="text-xl font-semibold">Start with a template</h2>
              </div>
              <p className="text-muted-foreground mb-6">
                Browse curated learning paths to discover how paths work. Fork one to get started
                instantly.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-[var(--content-gap)]">
                {templates.map(tpl => {
                  const tplEntries = getEntriesForPath(tpl.id)
                  return (
                    <div key={tpl.id} className="w-full">
                      <TemplateCard
                        template={tpl}
                        courseCount={tplEntries.length}
                        matchCount={templateMatchCounts.get(tpl.id) ?? 0}
                      />
                    </div>
                  )
                })}
              </div>
            </motion.div>

            <motion.div variants={fadeUp}>
              <EmptyState
                icon={Route}
                title="Or create your own path"
                description="Prefer to build from scratch? Create a custom learning path with your own course sequence."
                actionLabel="Create Path"
                onAction={() => setCreateDialogOpen(true)}
              />
            </motion.div>

            {/* AI goal-to-path generation (premium-gated) */}
            <motion.div variants={fadeUp} className="mt-8 max-w-lg mx-auto">
              <AIGoalInput
                goalText={aiGoalText}
                onGoalTextChange={setAiGoalText}
                onGenerate={() => setAiDialogOpen(true)}
              />
            </motion.div>
          </>
        ) : userPaths.length === 0 && templates.length === 0 ? (
          /* No templates, no paths — original empty state */
          <>
            <motion.div variants={fadeUp}>
              <EmptyState
                icon={Route}
                title="No learning paths yet"
                description="Learning paths help you organize courses into structured journeys. Create your first path to get started."
                actionLabel="Create Path"
                onAction={() => setCreateDialogOpen(true)}
              />
            </motion.div>

            {/* AI goal-to-path generation (premium-gated) */}
            <motion.div variants={fadeUp} className="mt-8 max-w-lg mx-auto">
              <AIGoalInput
                goalText={aiGoalText}
                onGoalTextChange={setAiGoalText}
                onGenerate={() => setAiDialogOpen(true)}
              />
            </motion.div>
          </>
        ) : filteredPaths.length === 0 && search.trim() ? (
          /* No search results */
          <motion.div variants={fadeUp}>
            <EmptyState
              icon={Search}
              title="No paths match your search"
              description={`No learning paths found for "${search}". Try a different search term.`}
            />
          </motion.div>
        ) : (
          /* User path cards grid */
          <>
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-[var(--content-gap)]"
              role="list"
              aria-label="Learning paths"
            >
              {filteredPaths.map(path => {
                const stats = pathStats.get(path.id) || { courseCount: 0, completionPct: 0 }
                return (
                  <div key={path.id} role="listitem" className="w-full">
                    <PathCard
                      path={path}
                      courseCount={stats.courseCount}
                      completionPct={stats.completionPct}
                      courseThumbnails={pathThumbnails.get(path.id) || []}
                      onImport={handlePathImport}
                      onOpenCoverDialog={setCoverDialogPath}
                    />
                  </div>
                )
              })}
            </motion.div>

            {/* Collapsible "Discover more paths" section */}
            {templates.length > 0 && (
              <motion.div variants={fadeUp} className="mt-12">
                <Collapsible open={discoverOpen} onOpenChange={setDiscoverOpen}>
                  <CollapsibleTrigger
                    className="flex items-center gap-2 w-full text-left py-2 group"
                    aria-controls="discover-more-paths-panel"
                  >
                    <LayoutTemplate className="w-5 h-5 text-muted-foreground" />
                    <h2 className="text-lg font-semibold flex-1">Discover more paths</h2>
                    <Badge variant="secondary" className="text-xs mr-2">
                      {templates.length}
                    </Badge>
                    <ChevronDown
                      className={`w-4 h-4 text-muted-foreground transition-transform ${discoverOpen ? 'rotate-180' : ''}`}
                    />
                  </CollapsibleTrigger>
                  <CollapsibleContent id="discover-more-paths-panel" className="pt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-[var(--content-gap)]">
                      {templates.map(tpl => {
                        const tplEntries = getEntriesForPath(tpl.id)
                        return (
                          <div key={tpl.id} className="w-full">
                            <TemplateCard
                              template={tpl}
                              courseCount={tplEntries.length}
                              matchCount={templateMatchCounts.get(tpl.id) ?? 0}
                            />
                          </div>
                        )
                      })}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </motion.div>
            )}
          </>
        )}
      </motion.div>

      {/* Dialogs */}
      <CurriculumComposer open={createDialogOpen} onOpenChange={setCreateDialogOpen} />
      <CurriculumComposer
        open={aiDialogOpen}
        onOpenChange={setAiDialogOpen}
        mode="ai"
        initialGoal={aiGoalText}
      />

      {/* Path Cover Dialog */}
      {coverDialogPath && (
        <PathCoverDialog
          open={!!coverDialogPath}
          onOpenChange={open => {
            if (!open) setCoverDialogPath(null)
          }}
          path={coverDialogPath}
        />
      )}

      {/* Import Wizard Dialog (R1) */}
      <ImportWizardDialog
        open={importWizardOpen}
        onOpenChange={setImportWizardOpen}
        targetPathId={importTargetPathId ?? undefined}
      />
    </>
  )
}
