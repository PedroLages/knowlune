import { useState, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/app/components/ui/dialog'
import { Button } from '@/app/components/ui/button'
import { Input } from '@/app/components/ui/input'
import { Label } from '@/app/components/ui/label'
import { FolderOpen, Loader2, Video, FileText, ChevronRight } from 'lucide-react'
import { scanCourseFolder, persistScannedCourse } from '@/lib/courseImport'
import type { ScannedCourse } from '@/lib/courseImport'

type WizardStep = 'select' | 'details'

interface ImportWizardDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ImportWizardDialog({ open, onOpenChange }: ImportWizardDialogProps) {
  const [step, setStep] = useState<WizardStep>('select')
  const [scannedCourse, setScannedCourse] = useState<ScannedCourse | null>(null)
  const [courseName, setCourseName] = useState('')
  const [isScanning, setIsScanning] = useState(false)
  const [isPersisting, setIsPersisting] = useState(false)

  const resetWizard = useCallback(() => {
    setStep('select')
    setScannedCourse(null)
    setCourseName('')
    setIsScanning(false)
    setIsPersisting(false)
  }, [])

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        resetWizard()
      }
      onOpenChange(nextOpen)
    },
    [onOpenChange, resetWizard]
  )

  const handleSelectFolder = useCallback(async () => {
    setIsScanning(true)
    try {
      const scanned = await scanCourseFolder()
      setScannedCourse(scanned)
      setCourseName(scanned.name)
      setStep('details')
    } catch (error) {
      // silent-catch-ok: scanCourseFolder already handles toasts for ImportError and cancellation
      if (error instanceof Error && error.message.includes('cancelled')) {
        // User cancelled the picker — stay on select step
      }
    } finally {
      setIsScanning(false)
    }
  }, [])

  const handleImport = useCallback(async () => {
    if (!scannedCourse) return

    setIsPersisting(true)
    try {
      const trimmedName = courseName.trim()
      const overrides = trimmedName !== scannedCourse.name ? { name: trimmedName } : undefined
      await persistScannedCourse(scannedCourse, overrides)
      handleOpenChange(false)
    } catch {
      // silent-catch-ok: persistScannedCourse already shows error toasts
    } finally {
      setIsPersisting(false)
    }
  }, [scannedCourse, courseName, handleOpenChange])

  const handleRescan = useCallback(() => {
    setScannedCourse(null)
    setCourseName('')
    setStep('select')
  }, [])

  const isNameValid = courseName.trim().length > 0

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        data-testid="import-wizard-dialog"
        aria-describedby="import-wizard-description"
      >
        <DialogHeader>
          <DialogTitle>
            {step === 'select' ? 'Import Course' : 'Course Details'}
          </DialogTitle>
          <DialogDescription id="import-wizard-description">
            {step === 'select'
              ? 'Select a folder containing your course videos and PDFs.'
              : 'Review and edit the course details before importing.'}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div
          className="flex items-center gap-2 text-xs text-muted-foreground"
          aria-label={`Step ${step === 'select' ? '1' : '2'} of 2`}
          role="status"
        >
          <span
            className={`inline-flex items-center justify-center size-5 rounded-full text-xs font-medium ${
              step === 'select'
                ? 'bg-brand text-brand-foreground'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            1
          </span>
          <span className={step === 'select' ? 'font-medium text-foreground' : ''}>
            Select Folder
          </span>
          <ChevronRight className="size-3" aria-hidden="true" />
          <span
            className={`inline-flex items-center justify-center size-5 rounded-full text-xs font-medium ${
              step === 'details'
                ? 'bg-brand text-brand-foreground'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            2
          </span>
          <span className={step === 'details' ? 'font-medium text-foreground' : ''}>
            Details
          </span>
        </div>

        {step === 'select' && (
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="flex items-center justify-center size-16 rounded-full bg-brand-soft">
              <FolderOpen className="size-8 text-brand-soft-foreground" aria-hidden="true" />
            </div>
            <p className="text-sm text-muted-foreground text-center max-w-xs">
              Choose a folder with your course materials. We'll scan it for videos and PDFs.
            </p>
            <Button
              variant="brand"
              onClick={handleSelectFolder}
              disabled={isScanning}
              data-testid="wizard-select-folder-btn"
              className="rounded-xl"
            >
              {isScanning ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  Scanning...
                </>
              ) : (
                <>
                  <FolderOpen className="size-4 mr-2" />
                  Select Folder
                </>
              )}
            </Button>
          </div>
        )}

        {step === 'details' && scannedCourse && (
          <div className="flex flex-col gap-4" data-testid="wizard-details-step">
            {/* Course name */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="wizard-course-name">Course Name</Label>
              <Input
                id="wizard-course-name"
                data-testid="wizard-course-name-input"
                value={courseName}
                onChange={e => setCourseName(e.target.value)}
                placeholder="Enter course name"
                aria-invalid={!isNameValid}
                autoFocus
              />
              {!isNameValid && (
                <p className="text-xs text-destructive" role="alert">
                  Course name is required.
                </p>
              )}
            </div>

            {/* Scanned content summary */}
            <div
              className="rounded-xl border border-border bg-muted/50 p-4 space-y-2"
              data-testid="wizard-scan-summary"
            >
              <h3 className="text-sm font-medium">Scanned Content</h3>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5" data-testid="wizard-video-count">
                  <Video className="size-4" aria-hidden="true" />
                  {scannedCourse.videos.length}{' '}
                  {scannedCourse.videos.length === 1 ? 'video' : 'videos'}
                </span>
                <span className="flex items-center gap-1.5" data-testid="wizard-pdf-count">
                  <FileText className="size-4" aria-hidden="true" />
                  {scannedCourse.pdfs.length}{' '}
                  {scannedCourse.pdfs.length === 1 ? 'PDF' : 'PDFs'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground truncate" data-testid="wizard-folder-path">
                Folder: {scannedCourse.name}
              </p>
            </div>
          </div>
        )}

        {step === 'details' && (
          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleRescan}
              disabled={isPersisting}
              data-testid="wizard-back-btn"
              className="rounded-xl"
            >
              Back
            </Button>
            <Button
              variant="brand"
              onClick={handleImport}
              disabled={!isNameValid || isPersisting}
              data-testid="wizard-import-btn"
              className="rounded-xl"
            >
              {isPersisting ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                'Import Course'
              )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
