import { useState, useCallback, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/app/components/ui/sheet'
import { Button } from '@/app/components/ui/button'
import { Input } from '@/app/components/ui/input'
import { Textarea } from '@/app/components/ui/textarea'
import { Label } from '@/app/components/ui/label'
import { InlineCoursePicker, suggestNameFromTags } from '@/app/components/figma/InlineCoursePicker'
import { useLearningPathStore } from '@/stores/useLearningPathStore'
import { useCourseImportStore } from '@/stores/useCourseImportStore'
import { ImportWizardDialog } from '@/app/components/figma/ImportWizardDialog'
import { useIsMobile } from '@/app/hooks/useMediaQuery'
import { useImportWizardTrigger } from '@/app/hooks/useImportWizardTrigger'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

/** Custom event name dispatched after a successful course import (Unit 3, R9). */
export const COURSE_IMPORTED = 'course-imported' as const

export interface CourseImportedEvent extends CustomEvent {
  detail: { courseId: string }
}

interface CurriculumComposerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CurriculumComposer({ open, onOpenChange }: CurriculumComposerProps) {
  const navigate = useNavigate()
  const createPathWithCourses = useLearningPathStore(s => s.createPathWithCourses)
  const loadPaths = useLearningPathStore(s => s.loadPaths)
  const loadImportedCourses = useCourseImportStore(s => s.loadImportedCourses)
  const importedCourses = useCourseImportStore(s => s.importedCourses)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const nameAutoFilled = useRef(false)

  const isMobile = useIsMobile()
  const {
    trigger: handleImportTrigger,
    isOpen: importWizardOpen,
    setIsOpen: setImportWizardOpen,
  } = useImportWizardTrigger()

  // Reset all state when dialog opens/closes
  useEffect(() => {
    if (open) {
      setName('')
      setDescription('')
      setSelectedCourseIds([])
      setIsSubmitting(false)
      nameAutoFilled.current = false
    }
  }, [open])

  // Auto-name suggestion: when courses are selected and name is empty, suggest a name
  useEffect(() => {
    if (selectedCourseIds.length > 0 && !name.trim() && !nameAutoFilled.current) {
      const selectedItems = importedCourses
        .filter(c => selectedCourseIds.includes(c.id))
        .map(c => ({
          id: c.id,
          name: c.name,
          type: 'imported' as const,
          authorName: undefined,
          thumbnailUrl: undefined,
          tags: c.tags ?? [],
        }))
      const suggested = suggestNameFromTags(selectedItems, importedCourses)
      if (suggested !== 'Untitled Path') {
        setName(suggested)
        nameAutoFilled.current = true
      }
    }
  }, [selectedCourseIds, name, importedCourses])

  // Listen for course-imported event from ImportWizardDialog
  useEffect(() => {
    function handleCourseImported(e: Event) {
      const event = e as CourseImportedEvent
      if (event.detail?.courseId) {
        // Add the new course to the selection
        setSelectedCourseIds(prev => {
          if (prev.includes(event.detail.courseId)) return prev
          return [...prev, event.detail.courseId]
        })
        // Refresh imported courses to include the new one
        loadImportedCourses().catch(() => {})
      }
    }
    window.addEventListener(COURSE_IMPORTED, handleCourseImported)
    return () => window.removeEventListener(COURSE_IMPORTED, handleCourseImported)
  }, [loadImportedCourses])

  // Handle import course action
  const handleImportCourse = useCallback(() => handleImportTrigger(null), [handleImportTrigger])

  // Build the list of all course IDs that are available (not excluded by anything yet)
  const excludeCourseIds = new Set<string>()

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (selectedCourseIds.length === 0) return

      const finalName = name.trim() || 'Untitled Path'
      setIsSubmitting(true)

      try {
        const courses = selectedCourseIds.map(id => ({
          courseId: id,
          courseType: 'imported' as const,
        }))

        const path = await createPathWithCourses(finalName, description.trim() || undefined, courses)
        await loadPaths()
        toast.success(`Created "${finalName}"`)
        onOpenChange(false)
        navigate(`/learning-paths/${path.id}`)
      } catch {
        toast.error('Failed to create learning path')
      } finally {
        setIsSubmitting(false)
      }
    },
    [name, description, selectedCourseIds, createPathWithCourses, loadPaths, onOpenChange, navigate]
  )

  const canSubmit = selectedCourseIds.length > 0 && !isSubmitting

  const pickerContent = (
    <InlineCoursePicker
      mode="multiSelect"
      excludeCourseIds={excludeCourseIds}
      onAdd={() => {
        // In multiSelect mode with controlled selection, onAdd is used
        // for the confirm action. Selection is tracked via selectedCourseIds.
      }}
      selectedCourseIds={selectedCourseIds}
      onSelectionChange={setSelectedCourseIds}
      showRecentlyImported
      showSuggestedNext={false}
      showImportAction
      onImportCourse={handleImportCourse}
      loading={importedCourses.length === 0}
    />
  )

  const formContent = (
    <>
      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <Label htmlFor="composer-name">Name</Label>
          <Input
            id="composer-name"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g., Web Development Fundamentals"
            autoFocus
            maxLength={100}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="composer-description">
            Description{' '}
            <span className="text-muted-foreground font-normal">(optional)</span>
          </Label>
          <Textarea
            id="composer-description"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="A brief description of what this path covers..."
            rows={3}
            maxLength={500}
          />
        </div>
        <div className="space-y-2">
          <Label>Courses</Label>
          {pickerContent}
        </div>
      </div>

      <DialogFooter className="gap-2">
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button type="submit" variant="brand" disabled={!canSubmit}>
          {isSubmitting ? (
            <>
              <Loader2 className="size-4 mr-2 animate-spin" aria-hidden="true" />
              Creating...
            </>
          ) : (
            'Create Path'
          )}
        </Button>
      </DialogFooter>
    </>
  )

  return (
    <>
      {isMobile ? (
        <Sheet open={open} onOpenChange={onOpenChange}>
          <SheetContent side="bottom" className="h-[90vh] p-0">
            <form onSubmit={handleSubmit} className="flex flex-col h-full">
              <SheetHeader className="p-6 pb-0">
                <SheetTitle>Create Learning Path</SheetTitle>
                <SheetDescription>
                  Build a learning path by selecting courses from your library.
                </SheetDescription>
              </SheetHeader>
              <div className="flex-1 overflow-y-auto px-6">
                {pickerContent}
              </div>
              <SheetFooter className="p-6 border-t border-border">
                <div className="flex gap-2 w-full">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="brand"
                    disabled={!canSubmit}
                    className="flex-1"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="size-4 mr-2 animate-spin" aria-hidden="true" />
                        Creating...
                      </>
                    ) : (
                      'Create Path'
                    )}
                  </Button>
                </div>
              </SheetFooter>
            </form>
          </SheetContent>
        </Sheet>
      ) : (
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>Create Learning Path</DialogTitle>
                <DialogDescription>
                  Build a learning path by selecting courses from your library.
                </DialogDescription>
              </DialogHeader>
              {formContent}
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Import Wizard */}
      <ImportWizardDialog
        open={importWizardOpen}
        onOpenChange={setImportWizardOpen}
      />
    </>
  )
}
