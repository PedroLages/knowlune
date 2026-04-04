// E69-S03: Sub-components used by CleanupActionsSection.
// Split out to keep the main component file under 300 lines.

import { Loader2 } from 'lucide-react'
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
import { DialogFooter } from '@/app/components/ui/dialog'

// ---------------------------------------------------------------------------
// AlertCard — shared card layout for thumbnail/orphan cleanup actions
// ---------------------------------------------------------------------------

export interface AlertCardProps {
  iconClass: string
  icon: React.ElementType
  title: string
  description: string
  savings: string
  buttonLabel: string
  loading: boolean
  dialogTitle: string
  dialogDescription: React.ReactNode
  onConfirm: () => void
}

export function AlertCard({
  iconClass,
  icon: Icon,
  title,
  description,
  savings,
  buttonLabel,
  loading,
  dialogTitle,
  dialogDescription,
  onConfirm,
}: AlertCardProps) {
  return (
    <div className="rounded-xl border border-border bg-surface-elevated p-4">
      <div className="flex items-start gap-3">
        <div className={`rounded-lg p-2 ${iconClass}`}>
          <Icon className="size-4" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          <p className="text-xs font-medium text-success mt-1">Estimated savings: ~{savings}</p>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="flex-shrink-0 min-h-[44px]"
              disabled={loading}
            >
              {loading ? <Loader2 className="size-4 animate-spin mr-1" /> : null}
              {buttonLabel}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{dialogTitle}</AlertDialogTitle>
              <AlertDialogDescription>{dialogDescription}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={onConfirm}>{buttonLabel}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// DeleteDialogBody — course list + footer for the Delete Course Data dialog
// ---------------------------------------------------------------------------

export interface DeleteDialogBodyProps {
  courseList: { id: string; name: string }[]
  selectedCourses: Set<string>
  deletingCourses: boolean
  onToggle: (id: string, checked: boolean) => void
  onCancel: () => void
  onDelete: () => void
}

export function DeleteDialogBody({
  courseList,
  selectedCourses,
  deletingCourses,
  onToggle,
  onCancel,
  onDelete,
}: DeleteDialogBodyProps) {
  return (
    <>
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
                onCheckedChange={checked => onToggle(course.id, checked === true)}
              />
              <span className="text-sm truncate">{course.name}</span>
            </label>
          ))
        )}
      </div>
      {selectedCourses.size > 0 && (
        <p className="text-xs text-muted-foreground">{selectedCourses.size} course(s) selected</p>
      )}
      <DialogFooter>
        <Button variant="outline" onClick={onCancel} className="min-h-[44px]">
          Cancel
        </Button>
        <Button
          variant="destructive"
          onClick={onDelete}
          disabled={selectedCourses.size === 0 || deletingCourses}
          className="min-h-[44px]"
        >
          {deletingCourses ? <Loader2 className="size-4 animate-spin mr-1" /> : null}
          Delete Selected ({selectedCourses.size})
        </Button>
      </DialogFooter>
    </>
  )
}
