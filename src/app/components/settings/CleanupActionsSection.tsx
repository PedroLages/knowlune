// E69-S03: Cleanup Actions with Confirmation Dialogs
// Extracted component for storage management cleanup actions.

import { useState, useEffect } from 'react'
import { Image, Brain, Trash2, Loader2 } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { Checkbox } from '@/app/components/ui/checkbox'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/app/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/app/components/ui/dialog'
import { formatFileSize } from '@/lib/format'
import { toast } from 'sonner'
import {
  estimateThumbnailCacheSize,
  estimateOrphanedEmbeddingsSize,
  clearThumbnailCache,
  removeOrphanedEmbeddings,
  deleteCourseDataWithCount,
} from '@/lib/storageEstimate'
import { db } from '@/db'

interface CleanupActionsSectionProps {
  onRefresh: () => void
}

export function CleanupActionsSection({ onRefresh }: CleanupActionsSectionProps) {
  const [thumbnailSize, setThumbnailSize] = useState<number>(0)
  const [orphanInfo, setOrphanInfo] = useState<{ count: number; bytes: number }>({
    count: 0,
    bytes: 0,
  })
  const [clearingThumbnails, setClearingThumbnails] = useState(false)
  const [removingOrphans, setRemovingOrphans] = useState(false)
  const [deletingCourses, setDeletingCourses] = useState(false)
  const [courseList, setCourseList] = useState<{ id: string; name: string }[]>([])
  const [selectedCourses, setSelectedCourses] = useState<Set<string>>(new Set())
  const [courseDialogOpen, setCourseDialogOpen] = useState(false)

  // Load estimated savings on mount
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [thumbSize, orphans] = await Promise.all([
          estimateThumbnailCacheSize(),
          estimateOrphanedEmbeddingsSize(),
        ])
        if (!cancelled) {
          setThumbnailSize(thumbSize)
          setOrphanInfo(orphans)
        }
      } catch {
        // silent-catch-ok — estimation failure shows 0
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  async function handleClearThumbnails() {
    setClearingThumbnails(true)
    try {
      const result = await clearThumbnailCache()
      toast.success(`Cleared ~${formatFileSize(result.bytesFreed)} of thumbnail cache`)
      setThumbnailSize(0)
      onRefresh()
    } catch (err) {
      toast.error(
        `Failed to clear thumbnail cache: ${err instanceof Error ? err.message : 'Unknown error'}`
      )
    } finally {
      setClearingThumbnails(false)
    }
  }

  async function handleRemoveOrphans() {
    setRemovingOrphans(true)
    try {
      const result = await removeOrphanedEmbeddings()
      toast.success(
        `Removed ${result.count} orphaned embeddings (~${formatFileSize(result.bytesFreed)})`
      )
      setOrphanInfo({ count: 0, bytes: 0 })
      onRefresh()
    } catch (err) {
      toast.error(
        `Failed to remove orphaned embeddings: ${err instanceof Error ? err.message : 'Unknown error'}`
      )
    } finally {
      setRemovingOrphans(false)
    }
  }

  async function loadCourseList() {
    try {
      const courses = await db.importedCourses.toArray()
      setCourseList(courses.map(c => ({ id: c.id, name: c.name ?? c.id })))
    } catch {
      // silent-catch-ok — empty list on failure
      setCourseList([])
    }
  }

  function handleCourseToggle(courseId: string, checked: boolean) {
    setSelectedCourses(prev => {
      const next = new Set(prev)
      if (checked) next.add(courseId)
      else next.delete(courseId)
      return next
    })
  }

  async function handleDeleteCourses() {
    if (selectedCourses.size === 0) return
    setDeletingCourses(true)
    try {
      const result = await deleteCourseDataWithCount(Array.from(selectedCourses))
      toast.success(
        `Deleted ${result.count} course(s), freed ~${formatFileSize(result.bytesFreed)}`
      )
      setSelectedCourses(new Set())
      setCourseDialogOpen(false)
      onRefresh()
    } catch (err) {
      toast.error(
        `Failed to delete course data: ${err instanceof Error ? err.message : 'Unknown error'}`
      )
    } finally {
      setDeletingCourses(false)
    }
  }

  return (
    <div id="cleanup-actions" className="space-y-3">
      <h3 className="text-sm font-medium text-muted-foreground">Cleanup Actions</h3>

      {/* Thumbnail Cache Card */}
      <div className="rounded-xl border border-border bg-surface-elevated p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-brand-soft p-2">
            <Image className="size-4 text-brand-soft-foreground" aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Clear Thumbnail Cache</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Remove cached course thumbnails. They will regenerate on next view.
            </p>
            <p className="text-xs font-medium text-success mt-1">
              Estimated savings: ~{formatFileSize(thumbnailSize)}
            </p>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="flex-shrink-0 min-h-[44px]"
                disabled={clearingThumbnails}
              >
                {clearingThumbnails ? (
                  <Loader2 className="size-4 animate-spin mr-1" />
                ) : null}
                Clear Cache
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear thumbnail cache?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will remove all cached course thumbnails (~
                  {formatFileSize(thumbnailSize)}). Thumbnails will regenerate automatically when
                  you view a course.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleClearThumbnails}>Clear Cache</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Orphaned Embeddings Card */}
      <div className="rounded-xl border border-border bg-surface-elevated p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-brand-soft p-2">
            <Brain className="size-4 text-brand-soft-foreground" aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Remove Unused AI Search Data</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Delete orphaned embeddings whose source notes no longer exist.
            </p>
            <p className="text-xs font-medium text-success mt-1">
              Estimated savings: ~{formatFileSize(orphanInfo.bytes)}
            </p>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="flex-shrink-0 min-h-[44px]"
                disabled={removingOrphans}
              >
                {removingOrphans ? <Loader2 className="size-4 animate-spin mr-1" /> : null}
                Remove Orphaned
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove orphaned embeddings?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will remove {orphanInfo.count} orphaned AI search embeddings (~
                  {formatFileSize(orphanInfo.bytes)}) whose source notes have been deleted. This
                  will not affect search for existing notes.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleRemoveOrphans}>Remove</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Delete Course Data Card */}
      <div className="rounded-xl border border-border bg-surface-elevated p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-destructive/10 p-2">
            <Trash2 className="size-4 text-destructive" aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Delete Course Data</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Permanently remove all data for selected courses including notes, flashcards, and
              progress.
            </p>
          </div>
          <Dialog
            open={courseDialogOpen}
            onOpenChange={open => {
              setCourseDialogOpen(open)
              if (open) {
                loadCourseList()
                setSelectedCourses(new Set())
              }
            }}
          >
            <DialogTrigger asChild>
              <Button
                variant="destructive"
                size="sm"
                className="flex-shrink-0 min-h-[44px]"
                disabled={deletingCourses}
              >
                {deletingCourses ? <Loader2 className="size-4 animate-spin mr-1" /> : null}
                Select Courses...
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[80vh] flex flex-col">
              <DialogHeader>
                <DialogTitle>Delete course data</DialogTitle>
                <DialogDescription>
                  Select courses to permanently delete. This removes all associated data including
                  videos, notes, flashcards, and progress. This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <div className="flex-1 overflow-y-auto space-y-2 py-2">
                {courseList.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No imported courses found.
                  </p>
                ) : (
                  courseList.map(course => (
                    <label
                      key={course.id}
                      className="flex items-center gap-3 rounded-lg border border-border p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                    >
                      <Checkbox
                        checked={selectedCourses.has(course.id)}
                        onCheckedChange={checked =>
                          handleCourseToggle(course.id, checked === true)
                        }
                      />
                      <span className="text-sm truncate">{course.name}</span>
                    </label>
                  ))
                )}
              </div>
              {selectedCourses.size > 0 && (
                <p className="text-xs text-muted-foreground">
                  {selectedCourses.size} course(s) selected
                </p>
              )}
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setCourseDialogOpen(false)}
                  className="min-h-[44px]"
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDeleteCourses}
                  disabled={selectedCourses.size === 0 || deletingCourses}
                  className="min-h-[44px]"
                >
                  {deletingCourses ? <Loader2 className="size-4 animate-spin mr-1" /> : null}
                  Delete Selected ({selectedCourses.size})
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  )
}
