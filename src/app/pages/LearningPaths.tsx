import { useState, useEffect, useMemo, useCallback } from 'react'
import { Link } from 'react-router'
import { MotionConfig, motion } from 'motion/react'
import {
  Plus,
  Search,
  Route,
  MoreHorizontal,
  Pencil,
  FileText,
  Trash2,
  BookOpen,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { Card, CardContent } from '@/app/components/ui/card'
import { Badge } from '@/app/components/ui/badge'
import { Skeleton } from '@/app/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/app/components/ui/alert-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu'
import { Input } from '@/app/components/ui/input'
import { Textarea } from '@/app/components/ui/textarea'
import { Label } from '@/app/components/ui/label'
import { EmptyState } from '@/app/components/EmptyState'
import { DelayedFallback } from '@/app/components/DelayedFallback'
import { cn } from '@/app/components/ui/utils'
import { PathProgressRing } from '@/app/components/figma/PathProgressRing'
import { PathCardHeader } from '@/app/components/figma/PathCardHeader'
import { useLearningPathStore } from '@/stores/useLearningPathStore'
import { useCourseImportStore } from '@/stores/useCourseImportStore'
import { useMultiPathProgress } from '@/app/hooks/usePathProgress'
import { staggerContainer, fadeUp } from '@/lib/motion'
import { toast } from 'sonner'
import type { LearningPath, LearningPathEntry } from '@/data/types'

// --- Create Path Dialog ---

function CreatePathDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const createPath = useLearningPathStore(s => s.createPath)

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      const trimmedName = name.trim()
      if (!trimmedName) return

      setIsSubmitting(true)
      try {
        await createPath(trimmedName, description.trim() || undefined)
        toast.success(`Created "${trimmedName}"`)
        setName('')
        setDescription('')
        onOpenChange(false)
      } catch {
        toast.error('Failed to create learning path')
      } finally {
        setIsSubmitting(false)
      }
    },
    [name, description, createPath, onOpenChange]
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create Learning Path</DialogTitle>
            <DialogDescription>
              Organize courses into a structured learning journey.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="path-name">Name</Label>
              <Input
                id="path-name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g., Web Development Fundamentals"
                autoFocus
                required
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="path-description">
                Description <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Textarea
                id="path-description"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="A brief description of what this path covers..."
                rows={3}
                maxLength={500}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="brand" disabled={!name.trim() || isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Path'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// --- Rename Dialog ---

function RenameDialog({
  path,
  open,
  onOpenChange,
}: {
  path: LearningPath | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [name, setName] = useState('')
  const renamePath = useLearningPathStore(s => s.renamePath)

  useEffect(() => {
    if (path && open) {
      setName(path.name)
    }
  }, [path, open])

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!path || !name.trim()) return

      try {
        await renamePath(path.id, name.trim())
        toast.success('Path renamed')
        onOpenChange(false)
      } catch {
        toast.error('Failed to rename path')
      }
    },
    [path, name, renamePath, onOpenChange]
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Rename Learning Path</DialogTitle>
            <DialogDescription>Enter a new name for this learning path.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="rename-input">Name</Label>
            <Input
              id="rename-input"
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
              required
              maxLength={100}
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="brand" disabled={!name.trim()}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// --- Edit Description Dialog ---

function EditDescriptionDialog({
  path,
  open,
  onOpenChange,
}: {
  path: LearningPath | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [description, setDescription] = useState('')
  const updateDescription = useLearningPathStore(s => s.updateDescription)

  useEffect(() => {
    if (path && open) {
      setDescription(path.description || '')
    }
  }, [path, open])

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!path) return

      try {
        await updateDescription(path.id, description.trim())
        toast.success('Description updated')
        onOpenChange(false)
      } catch {
        toast.error('Failed to update description')
      }
    },
    [path, description, updateDescription, onOpenChange]
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Description</DialogTitle>
            <DialogDescription>Update the description for this learning path.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="edit-description">Description</Label>
            <Textarea
              id="edit-description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe this learning path..."
              rows={4}
              maxLength={500}
              autoFocus
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="brand">
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// --- Delete Confirmation ---

function DeleteConfirmDialog({
  path,
  open,
  onOpenChange,
}: {
  path: LearningPath | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const deletePath = useLearningPathStore(s => s.deletePath)

  const handleDelete = useCallback(async () => {
    if (!path) return

    try {
      await deletePath(path.id)
      toast.success(`Deleted "${path.name}"`)
      onOpenChange(false)
    } catch {
      toast.error('Failed to delete path')
    }
  }, [path, deletePath, onOpenChange])

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Learning Path</AlertDialogTitle>
          <AlertDialogDescription>
            This will delete &quot;{path?.name}&quot; and remove all course assignments. The courses
            themselves will not be deleted.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Delete Path
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// --- Path Card ---

function PathCard({
  path,
  courseCount,
  completionPct,
  courseThumbnails,
  onRename,
  onEditDescription,
  onDelete,
}: {
  path: LearningPath
  courseCount: number
  completionPct: number
  courseThumbnails: string[]
  onRename: (path: LearningPath) => void
  onEditDescription: (path: LearningPath) => void
  onDelete: (path: LearningPath) => void
}) {
  const isNotStarted = completionPct === 0 && courseCount > 0
  const isCompleted = completionPct >= 100

  return (
    <motion.div variants={fadeUp}>
      <Card
        className={cn(
          'group relative transition-all duration-300 hover:shadow-xl overflow-hidden rounded-[24px]',
          'focus-within:ring-2 focus-within:ring-brand focus-within:ring-offset-2 focus-within:ring-offset-background',
          isNotStarted && 'opacity-70'
        )}
      >
        {/* Gradient header */}
        <PathCardHeader
          pathName={path.name}
          completionPct={completionPct}
          isAIGenerated={path.isAIGenerated}
        />

        {/* Dropdown menu — over gradient */}
        <div className="absolute top-4 right-4 z-10">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 bg-white/20 hover:bg-white/40 backdrop-blur-md text-white rounded-full"
                aria-label={`Actions for ${path.name}`}
              >
                <MoreHorizontal className="size-4" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => onRename(path)}>
                <Pencil className="mr-2 size-4" aria-hidden="true" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onEditDescription(path)}>
                <FileText className="mr-2 size-4" aria-hidden="true" />
                Edit Description
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => onDelete(path)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 size-4" aria-hidden="true" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Card body */}
        <CardContent className="px-6 pb-6 pt-1 relative">
          {/* Progress ring — overlapping header */}
          <div className="absolute -top-10 left-6">
            <div className="bg-card rounded-full p-1.5 shadow-lg">
              <PathProgressRing percentage={completionPct} size="md">
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
            className="block focus:outline-none mt-10"
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
            <h3 className="text-xl font-bold leading-tight line-clamp-1 mb-2 group-hover:text-brand transition-colors">
              {path.name}
            </h3>
            {path.description && (
              <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed mb-6">
                {path.description}
              </p>
            )}
            {!path.description && <div className="mb-6" />}

            {/* Footer: course thumbnails + arrow */}
            <div className="flex items-center justify-between border-t border-border pt-4">
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
              {isCompleted ? (
                <span className="text-xs font-bold text-success uppercase">Review</span>
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
          </Link>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// --- Skeleton ---

function PathCardSkeleton() {
  return (
    <Card className="overflow-hidden rounded-[24px]">
      <Skeleton className="h-32 w-full rounded-none" />
      <CardContent className="px-6 pb-6 pt-1 relative">
        <Skeleton className="absolute -top-10 left-6 size-[72px] rounded-full" />
        <div className="mt-10 space-y-3">
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
  const { paths, entries, loadPaths } = useLearningPathStore()
  const { importedCourses, loadImportedCourses, thumbnailUrls, loadThumbnailUrls } =
    useCourseImportStore()
  const [isLoaded, setIsLoaded] = useState(false)
  const [search, setSearch] = useState('')
  const [createDialogOpen, setCreateDialogOpen] = useState(false)

  // Dialog states
  const [renamePath, setRenamePath] = useState<LearningPath | null>(null)
  const [editDescPath, setEditDescPath] = useState<LearningPath | null>(null)
  const [deletePath, setDeletePath] = useState<LearningPath | null>(null)

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
  useEffect(() => {
    if (importedCourses.length > 0) {
      loadThumbnailUrls(importedCourses.map(c => c.id))
    }
  }, [importedCourses, loadThumbnailUrls])

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

  const filteredPaths = useMemo(() => {
    if (!search.trim()) return paths
    const q = search.toLowerCase()
    return paths.filter(
      p =>
        p.name.toLowerCase().includes(q) ||
        (p.description && p.description.toLowerCase().includes(q))
    )
  }, [paths, search])

  if (!isLoaded) {
    return (
      <DelayedFallback>
        <div className="space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-5 w-96" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 3 }, (_, i) => (
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
        <motion.div
          variants={fadeUp}
          className="flex flex-col md:flex-row md:items-end justify-between gap-6"
        >
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight font-display">Learning Paths</h1>
            <p className="text-muted-foreground text-lg mt-2">
              Organize courses into structured learning journeys
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            {paths.length > 0 && (
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
          </div>
        </motion.div>

        {/* Live region for search result announcements */}
        <span role="status" aria-live="polite" className="sr-only">
          {search.trim()
            ? `${filteredPaths.length} ${filteredPaths.length === 1 ? 'path' : 'paths'} found`
            : ''}
        </span>

        {/* Content */}
        {paths.length === 0 ? (
          /* Empty state — no paths at all */
          <motion.div variants={fadeUp}>
            <EmptyState
              icon={Route}
              title="No learning paths yet"
              description="Learning paths help you organize courses into structured journeys. Create your first path to get started."
              actionLabel="Create Path"
              onAction={() => setCreateDialogOpen(true)}
            />
          </motion.div>
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
          /* Path cards grid */
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
            role="list"
            aria-label="Learning paths"
          >
            {filteredPaths.map(path => {
              const stats = pathStats.get(path.id) || { courseCount: 0, completionPct: 0 }
              return (
                <div key={path.id} role="listitem">
                  <PathCard
                    path={path}
                    courseCount={stats.courseCount}
                    completionPct={stats.completionPct}
                    courseThumbnails={pathThumbnails.get(path.id) || []}
                    onRename={setRenamePath}
                    onEditDescription={setEditDescPath}
                    onDelete={setDeletePath}
                  />
                </div>
              )
            })}
          </motion.div>
        )}
      </motion.div>

      {/* Dialogs */}
      <CreatePathDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} />
      <RenameDialog
        path={renamePath}
        open={!!renamePath}
        onOpenChange={open => {
          if (!open) setRenamePath(null)
        }}
      />
      <EditDescriptionDialog
        path={editDescPath}
        open={!!editDescPath}
        onOpenChange={open => {
          if (!open) setEditDescPath(null)
        }}
      />
      <DeleteConfirmDialog
        path={deletePath}
        open={!!deletePath}
        onOpenChange={open => {
          if (!open) setDeletePath(null)
        }}
      />
    </MotionConfig>
  )
}
