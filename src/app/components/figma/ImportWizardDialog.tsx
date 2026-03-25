import { useState, useCallback, useEffect, useRef, type KeyboardEvent } from 'react'
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
import { Badge } from '@/app/components/ui/badge'
import {
  FolderOpen,
  Loader2,
  Video,
  FileText,
  ChevronRight,
  X,
  Image as ImageIcon,
  Tag,
  Check,
} from 'lucide-react'
import { scanCourseFolder, persistScannedCourse } from '@/lib/courseImport'
import type { ScannedCourse, ScannedImage } from '@/lib/courseImport'

type WizardStep = 'select' | 'details'

interface ImportWizardDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ImportWizardDialog({ open, onOpenChange }: ImportWizardDialogProps) {
  const [step, setStep] = useState<WizardStep>('select')
  const [scannedCourse, setScannedCourse] = useState<ScannedCourse | null>(null)
  const [courseName, setCourseName] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [selectedCoverImage, setSelectedCoverImage] = useState<ScannedImage | null>(null)
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null)
  const [imagePreviewUrls, setImagePreviewUrls] = useState<Map<string, string>>(new Map())
  const [isScanning, setIsScanning] = useState(false)
  const [isPersisting, setIsPersisting] = useState(false)
  const tagInputRef = useRef<HTMLInputElement>(null)

  const resetWizard = useCallback(() => {
    setStep('select')
    setScannedCourse(null)
    setCourseName('')
    setTags([])
    setTagInput('')
    setSelectedCoverImage(null)
    setCoverPreviewUrl(null)
    setImagePreviewUrls(new Map())
    setIsScanning(false)
    setIsPersisting(false)
  }, [])

  // Generate preview URLs for scanned images
  useEffect(() => {
    if (!scannedCourse?.images.length) return

    let cancelled = false
    const objectUrls: string[] = []

    async function loadPreviews() {
      const urls = new Map<string, string>()

      for (const image of scannedCourse!.images) {
        if (cancelled) return
        try {
          const file = await image.fileHandle.getFile()
          const url = URL.createObjectURL(file)
          urls.set(image.path, url)
          objectUrls.push(url)
        } catch {
          // silent-catch-ok: image preview is optional, skip on error
        }
      }

      if (cancelled) return

      setImagePreviewUrls(new Map(urls))

      // Auto-select first image as cover if available (use ref-like callback to avoid stale closure)
      setSelectedCoverImage(prev => {
        if (prev) return prev // already selected, don't override
        const firstImage = scannedCourse!.images[0]
        const firstUrl = urls.get(firstImage.path)
        if (firstUrl) setCoverPreviewUrl(firstUrl)
        return firstImage
      })
    }

    loadPreviews()

    return () => {
      cancelled = true
      objectUrls.forEach(url => URL.revokeObjectURL(url))
    }
  }, [scannedCourse?.images]) // Only re-run when images change

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
      setTags([]) // Start with empty tags; user adds their own
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
      const hasNameChange = trimmedName !== scannedCourse.name
      const hasTags = tags.length > 0
      const hasCover = selectedCoverImage !== null

      const overrides =
        hasNameChange || hasTags || hasCover
          ? {
              ...(hasNameChange ? { name: trimmedName } : {}),
              ...(hasTags ? { tags } : {}),
              ...(hasCover ? { coverImageHandle: selectedCoverImage.fileHandle } : {}),
            }
          : undefined

      await persistScannedCourse(scannedCourse, overrides)
      handleOpenChange(false)
    } catch {
      // silent-catch-ok: persistScannedCourse already shows error toasts
    } finally {
      setIsPersisting(false)
    }
  }, [scannedCourse, courseName, tags, selectedCoverImage, handleOpenChange])

  const handleRescan = useCallback(() => {
    setScannedCourse(null)
    setCourseName('')
    setTags([])
    setTagInput('')
    setSelectedCoverImage(null)
    setCoverPreviewUrl(null)
    setImagePreviewUrls(new Map())
    setStep('select')
  }, [])

  const handleAddTag = useCallback(() => {
    const trimmed = tagInput.trim().toLowerCase()
    if (trimmed && !tags.includes(trimmed)) {
      setTags(prev => [...prev, trimmed])
    }
    setTagInput('')
  }, [tagInput, tags])

  const handleTagKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        handleAddTag()
      } else if (e.key === 'Backspace' && tagInput === '' && tags.length > 0) {
        setTags(prev => prev.slice(0, -1))
      }
    },
    [handleAddTag, tagInput, tags.length]
  )

  const handleRemoveTag = useCallback((tagToRemove: string) => {
    setTags(prev => prev.filter(t => t !== tagToRemove))
  }, [])

  const handleSelectCoverImage = useCallback(
    (image: ScannedImage | null) => {
      setSelectedCoverImage(image)
      if (image) {
        const url = imagePreviewUrls.get(image.path)
        setCoverPreviewUrl(url ?? null)
      } else {
        setCoverPreviewUrl(null)
      }
    },
    [imagePreviewUrls]
  )

  const isNameValid = courseName.trim().length > 0

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-lg"
        data-testid="import-wizard-dialog"
        aria-describedby="import-wizard-description"
      >
        <DialogHeader>
          <DialogTitle>{step === 'select' ? 'Import Course' : 'Course Details'}</DialogTitle>
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
          <span className={step === 'details' ? 'font-medium text-foreground' : ''}>Details</span>
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
          <div className="max-h-[60vh] overflow-y-auto">
            <div className="flex flex-col gap-4 pr-1" data-testid="wizard-details-step">
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

              {/* Tag management */}
              <div className="flex flex-col gap-2" data-testid="wizard-tags-section">
                <Label htmlFor="wizard-tag-input">
                  <span className="flex items-center gap-1.5">
                    <Tag className="size-3.5" aria-hidden="true" />
                    Tags
                  </span>
                </Label>
                <div className="flex flex-wrap items-center gap-1.5 min-h-[2.25rem] rounded-xl border border-border bg-background px-3 py-1.5 focus-within:ring-2 focus-within:ring-ring">
                  {tags.map(tag => (
                    <Badge
                      key={tag}
                      variant="secondary"
                      className="gap-1 rounded-full pl-2.5 pr-1 py-0.5"
                      data-testid={`wizard-tag-${tag}`}
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20 transition-colors"
                        aria-label={`Remove tag ${tag}`}
                        data-testid={`wizard-remove-tag-${tag}`}
                      >
                        <X className="size-3" />
                      </button>
                    </Badge>
                  ))}
                  <input
                    ref={tagInputRef}
                    id="wizard-tag-input"
                    data-testid="wizard-tag-input"
                    type="text"
                    value={tagInput}
                    onChange={e => setTagInput(e.target.value)}
                    onKeyDown={handleTagKeyDown}
                    onBlur={handleAddTag}
                    placeholder={tags.length === 0 ? 'Type a tag and press Enter' : 'Add tag...'}
                    className="flex-1 min-w-[8rem] bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                    aria-label="Add tag"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Press Enter to add a tag. Click the X to remove.
                </p>
              </div>

              {/* Cover image selection */}
              <div className="flex flex-col gap-2" data-testid="wizard-cover-section">
                <Label>
                  <span className="flex items-center gap-1.5">
                    <ImageIcon className="size-3.5" aria-hidden="true" />
                    Cover Image
                  </span>
                </Label>
                {scannedCourse.images.length > 0 ? (
                  <>
                    {/* Current selection preview */}
                    {coverPreviewUrl && (
                      <div
                        className="relative w-full h-32 rounded-xl overflow-hidden border border-border"
                        data-testid="wizard-cover-preview"
                      >
                        <img
                          src={coverPreviewUrl}
                          alt="Selected cover image"
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => handleSelectCoverImage(null)}
                          className="absolute top-2 right-2 rounded-full bg-background/80 p-1 hover:bg-background transition-colors"
                          aria-label="Remove cover image"
                          data-testid="wizard-remove-cover"
                        >
                          <X className="size-4" />
                        </button>
                      </div>
                    )}

                    {/* Image grid */}
                    <div
                      className="grid grid-cols-4 gap-2"
                      role="radiogroup"
                      aria-label="Select cover image"
                      data-testid="wizard-image-grid"
                    >
                      {scannedCourse.images.map(image => {
                        const previewUrl = imagePreviewUrls.get(image.path)
                        const isSelected = selectedCoverImage?.path === image.path
                        return (
                          <button
                            key={image.path}
                            type="button"
                            role="radio"
                            aria-checked={isSelected}
                            aria-label={`Select ${image.filename} as cover`}
                            onClick={() => handleSelectCoverImage(isSelected ? null : image)}
                            className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-colors ${
                              isSelected
                                ? 'border-brand ring-2 ring-brand/30'
                                : 'border-border hover:border-muted-foreground'
                            }`}
                            data-testid={`wizard-image-option-${image.filename}`}
                          >
                            {previewUrl ? (
                              <img
                                src={previewUrl}
                                alt={image.filename}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full bg-muted flex items-center justify-center">
                                <ImageIcon className="size-4 text-muted-foreground" />
                              </div>
                            )}
                            {isSelected && (
                              <div className="absolute inset-0 bg-brand/20 flex items-center justify-center">
                                <Check className="size-5 text-brand" />
                              </div>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </>
                ) : (
                  <div
                    className="flex flex-col items-center gap-2 py-4 rounded-xl border border-dashed border-border bg-muted/30"
                    data-testid="wizard-no-images"
                  >
                    <ImageIcon className="size-6 text-muted-foreground" aria-hidden="true" />
                    <p className="text-xs text-muted-foreground">
                      No images found in folder. A default cover will be used.
                    </p>
                  </div>
                )}
              </div>

              {/* Confirmation summary */}
              <div
                className="rounded-xl border border-border bg-muted/50 p-4 space-y-2"
                data-testid="wizard-scan-summary"
              >
                <h3 className="text-sm font-medium">Import Summary</h3>
                <div className="space-y-1.5 text-sm text-muted-foreground">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1.5" data-testid="wizard-video-count">
                      <Video className="size-4" aria-hidden="true" />
                      {scannedCourse.videos.length}{' '}
                      {scannedCourse.videos.length === 1 ? 'video' : 'videos'}
                    </span>
                    <span className="flex items-center gap-1.5" data-testid="wizard-pdf-count">
                      <FileText className="size-4" aria-hidden="true" />
                      {scannedCourse.pdfs.length} {scannedCourse.pdfs.length === 1 ? 'PDF' : 'PDFs'}
                    </span>
                    {scannedCourse.images.length > 0 && (
                      <span className="flex items-center gap-1.5" data-testid="wizard-image-count">
                        <ImageIcon className="size-4" aria-hidden="true" />
                        {scannedCourse.images.length}{' '}
                        {scannedCourse.images.length === 1 ? 'image' : 'images'}
                      </span>
                    )}
                  </div>
                  {tags.length > 0 && (
                    <div className="flex items-center gap-1.5" data-testid="wizard-tag-count">
                      <Tag className="size-4" aria-hidden="true" />
                      {tags.length} {tags.length === 1 ? 'tag' : 'tags'}
                    </div>
                  )}
                  {selectedCoverImage && (
                    <div className="flex items-center gap-1.5" data-testid="wizard-cover-selected">
                      <ImageIcon className="size-4" aria-hidden="true" />
                      Cover: {selectedCoverImage.filename}
                    </div>
                  )}
                </div>
                <p
                  className="text-xs text-muted-foreground truncate"
                  data-testid="wizard-folder-path"
                >
                  Folder: {scannedCourse.name}
                </p>
              </div>
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
