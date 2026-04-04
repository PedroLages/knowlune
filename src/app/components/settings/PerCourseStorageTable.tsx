// E69-S02: Per-Course Storage Table
// Extracted from StorageManagement.tsx to keep file size under 500 lines.

import { useState } from 'react'
import { ArrowUp, ArrowDown, ArrowUpDown, MoreHorizontal, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableCaption,
} from '@/app/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu'
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
import { Button } from '@/app/components/ui/button'
import { formatFileSize } from '@/lib/format'
import {
  clearCourseThumbnail,
  deleteCourseData,
  type CourseStorageEntry,
} from '@/lib/storageEstimate'

// --- Types ---

type SortDirection = 'default' | 'asc' | 'desc'

// --- Component ---

export function PerCourseStorageTable({
  courses,
  onRefresh,
}: {
  courses: CourseStorageEntry[]
  onRefresh: () => void
}) {
  const [sortDir, setSortDir] = useState<SortDirection>('default')
  const [visibleCount, setVisibleCount] = useState(10)
  const [dialogState, setDialogState] = useState<{
    type: 'clear-thumbnail' | 'delete-course'
    courseId: string
    courseName: string
    estimatedSize: number
  } | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  // Sort logic
  const sorted = [...courses]
  if (sortDir === 'asc') {
    sorted.sort((a, b) => a.totalBytes - b.totalBytes)
  } else {
    // default and desc are both descending
    sorted.sort((a, b) => b.totalBytes - a.totalBytes)
  }

  const visible = sorted.slice(0, visibleCount)
  const hasMore = sorted.length > visibleCount

  function cycleSortDirection() {
    setSortDir(prev => {
      if (prev === 'default') return 'asc'
      if (prev === 'asc') return 'desc'
      return 'default'
    })
  }

  function getSortIcon() {
    if (sortDir === 'asc') return <ArrowUp className="size-4 text-brand" />
    if (sortDir === 'desc') return <ArrowDown className="size-4 text-brand" />
    return <ArrowUpDown className="size-4" />
  }

  function getAriaSortValue(): 'ascending' | 'descending' {
    // Table is always sorted by total size; default and 'desc' both sort descending
    if (sortDir === 'asc') return 'ascending'
    return 'descending'
  }

  async function handleClearThumbnail(courseId: string) {
    setActionLoading(true)
    try {
      const freed = await clearCourseThumbnail(courseId)
      toast.success(`Cleared thumbnail — freed ~${formatFileSize(freed)}`)
      onRefresh()
    } catch {
      toast.error('Failed to clear thumbnail')
    } finally {
      setActionLoading(false)
      setDialogState(null)
    }
  }

  async function handleDeleteCourse(courseId: string) {
    setActionLoading(true)
    try {
      const freed = await deleteCourseData([courseId])
      toast.success(`Deleted course data — freed ~${formatFileSize(freed)}`)
      onRefresh()
    } catch {
      toast.error('Failed to delete course data')
    } finally {
      setActionLoading(false)
      setDialogState(null)
    }
  }

  // Empty state
  if (courses.length === 0) {
    return (
      <div data-testid="per-course-table-empty">
        <p className="text-sm text-muted-foreground text-center py-4">No courses imported yet.</p>
      </div>
    )
  }

  return (
    <div data-testid="per-course-storage-table">
      <div className="overflow-x-auto">
        <Table>
          <TableCaption className="caption-top">Storage usage per course</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Course Name</TableHead>
              <TableHead aria-sort={getAriaSortValue()}>
                <button
                  onClick={cycleSortDirection}
                  className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                  aria-label="Sort by total size"
                >
                  Total Size
                  {getSortIcon()}
                </button>
              </TableHead>
              <TableHead className="hidden sm:table-cell">Media</TableHead>
              <TableHead className="hidden sm:table-cell">Notes</TableHead>
              <TableHead className="hidden sm:table-cell">Thumbnails</TableHead>
              <TableHead className="w-10">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map(course => (
              <TableRow key={course.courseId} data-testid={`course-row-${course.courseId}`}>
                <TableCell className="font-medium max-w-[200px] truncate">
                  {course.courseName}
                </TableCell>
                <TableCell className="tabular-nums">~{formatFileSize(course.totalBytes)}</TableCell>
                <TableCell className="tabular-nums hidden sm:table-cell">
                  ~{formatFileSize(course.mediaBytes)}
                </TableCell>
                <TableCell className="tabular-nums hidden sm:table-cell">
                  ~{formatFileSize(course.notesBytes)}
                </TableCell>
                <TableCell className="tabular-nums hidden sm:table-cell">
                  ~{formatFileSize(course.thumbnailBytes)}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        aria-label={`Actions for ${course.courseName}`}
                      >
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() =>
                          setDialogState({
                            type: 'clear-thumbnail',
                            courseId: course.courseId,
                            courseName: course.courseName,
                            estimatedSize: course.thumbnailBytes,
                          })
                        }
                      >
                        Clear thumbnails
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() =>
                          setDialogState({
                            type: 'delete-course',
                            courseId: course.courseId,
                            courseName: course.courseName,
                            estimatedSize: course.totalBytes,
                          })
                        }
                      >
                        Delete course data
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {hasMore && (
        <div className="flex justify-center mt-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setVisibleCount(prev => prev + 10)}
            className="min-h-[44px]"
          >
            Show more ({sorted.length - visibleCount} remaining)
          </Button>
        </div>
      )}

      {/* AlertDialog for clear thumbnail */}
      <AlertDialog
        open={dialogState?.type === 'clear-thumbnail'}
        onOpenChange={open => {
          if (!open) setDialogState(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear thumbnail?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete the thumbnail for &ldquo;{dialogState?.courseName}&rdquo;
              (~{formatFileSize(dialogState?.estimatedSize ?? 0)} estimated). This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={actionLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (dialogState) handleClearThumbnail(dialogState.courseId)
              }}
            >
              {actionLoading ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
              Clear thumbnail
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* AlertDialog for delete course data */}
      <AlertDialog
        open={dialogState?.type === 'delete-course'}
        onOpenChange={open => {
          if (!open) setDialogState(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete course data?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all data for &ldquo;{dialogState?.courseName}&rdquo;
              (~{formatFileSize(dialogState?.estimatedSize ?? 0)} estimated), including videos, PDFs,
              notes, flashcards, and progress. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={actionLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (dialogState) handleDeleteCourse(dialogState.courseId)
              }}
            >
              {actionLoading ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
              Delete course data
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
