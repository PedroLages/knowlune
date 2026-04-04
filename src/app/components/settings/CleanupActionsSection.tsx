// E69-S03: Cleanup Actions with Confirmation Dialogs
// Sub-components (AlertCard, DeleteDialogBody) live in CleanupActionsParts.tsx.

import { useState, useEffect } from 'react'
import { Image, Brain, Trash2, Loader2 } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { AlertCard, DeleteDialogBody } from './CleanupActionsParts'

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

      <AlertCard
        icon={Image}
        iconClass="bg-brand-soft"
        title="Clear Thumbnail Cache"
        description="Remove cached course thumbnails. They will regenerate on next view."
        savings={formatFileSize(thumbnailSize)}
        buttonLabel="Clear Cache"
        loading={clearingThumbnails}
        dialogTitle="Clear thumbnail cache?"
        dialogDescription={
          <>
            This will remove all cached course thumbnails (~{formatFileSize(thumbnailSize)}).
            Thumbnails will regenerate automatically when you view a course.
          </>
        }
        onConfirm={handleClearThumbnails}
      />

      <AlertCard
        icon={Brain}
        iconClass="bg-brand-soft"
        title="Remove Unused AI Search Data"
        description="Delete orphaned embeddings whose source notes no longer exist."
        savings={formatFileSize(orphanInfo.bytes)}
        buttonLabel="Remove Orphaned"
        loading={removingOrphans}
        dialogTitle="Remove orphaned embeddings?"
        dialogDescription={
          <>
            This will remove {orphanInfo.count} orphaned AI search embeddings (~
            {formatFileSize(orphanInfo.bytes)}) whose source notes have been deleted. This will not
            affect search for existing notes.
          </>
        }
        onConfirm={handleRemoveOrphans}
      />

      {/* Delete Course Data — uses Dialog (not AlertDialog) for multi-select */}
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
              <DeleteDialogBody
                courseList={courseList}
                selectedCourses={selectedCourses}
                deletingCourses={deletingCourses}
                onToggle={handleCourseToggle}
                onCancel={() => setCourseDialogOpen(false)}
                onDelete={handleDeleteCourses}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  )
}
