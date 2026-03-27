import { useState, useCallback, useEffect, useRef, useMemo, type KeyboardEvent } from 'react'
import { Link } from 'react-router'
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
import { Textarea } from '@/app/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select'
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
  Sparkles,
  Route,
  Plus,
  Settings,
  AlertTriangle,
} from 'lucide-react'
import { scanCourseFolder, scanFromDroppedFiles, persistScannedCourse } from '@/lib/courseImport'
import type { ScannedCourse, ScannedImage } from '@/lib/courseImport'
import { ImportDropZone } from './ImportDropZone'
import { useAISuggestions } from '@/ai/hooks/useAISuggestions'
import { usePathPlacementSuggestion } from '@/ai/hooks/usePathPlacementSuggestion'
import { useLearningPathStore } from '@/stores/useLearningPathStore'
import { isPathPlacementAvailable } from '@/ai/learningPath/suggestPlacement'
import { toast } from 'sonner'

type WizardStep = 'select' | 'details' | 'path'

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
  const [description, setDescription] = useState('')
  const [isScanning, setIsScanning] = useState(false)
  const [isPersisting, setIsPersisting] = useState(false)
  const [aiTagsApplied, setAiTagsApplied] = useState(false)
  const [aiDescriptionApplied, setAiDescriptionApplied] = useState(false)
  const tagInputRef = useRef<HTMLInputElement>(null)

  // Path placement state (E26-S04)
  const [selectedPathId, setSelectedPathId] = useState<string | null>(null)
  const [selectedPosition, setSelectedPosition] = useState<number>(1)
  const [pathChoice, setPathChoice] = useState<'accept' | 'choose' | 'skip' | 'new'>('accept')
  const [newPathName, setNewPathName] = useState('')

  // Learning path store
  const { paths: learningPaths, loadPaths, addCourseToPath, createPath } = useLearningPathStore()

  // Load paths when dialog opens
  useEffect(() => {
    if (open) {
      loadPaths()
    }
  }, [open, loadPaths])

  // Determine if path step should be shown
  const showPathStep = useMemo(() => {
    return learningPaths.length > 0 || isPathPlacementAvailable()
  }, [learningPaths.length])

  // AI suggestions hook — fires automatically when Ollama is configured
  const aiSuggestions = useAISuggestions(scannedCourse)

  // Path placement AI suggestion
  const pathPlacement = usePathPlacementSuggestion(
    courseName,
    tags,
    description,
    step === 'path' && showPathStep
  )

  // Apply AI suggestion when it arrives
  useEffect(() => {
    if (pathPlacement.hasFetched && pathPlacement.suggestion && pathChoice === 'accept') {
      if (pathPlacement.suggestion.pathId) {
        setSelectedPathId(pathPlacement.suggestion.pathId)
        setSelectedPosition(pathPlacement.suggestion.position)
      }
    }
  }, [pathPlacement.hasFetched, pathPlacement.suggestion, pathChoice])

  const resetWizard = useCallback(() => {
    setStep('select')
    setScannedCourse(null)
    setCourseName('')
    setTags([])
    setTagInput('')
    setDescription('')
    setSelectedCoverImage(null)
    setCoverPreviewUrl(null)
    setImagePreviewUrls(new Map())
    setIsScanning(false)
    setIsPersisting(false)
    setAiTagsApplied(false)
    setAiDescriptionApplied(false)
    setSelectedPathId(null)
    setSelectedPosition(1)
    setPathChoice('accept')
    setNewPathName('')
  }, [])

  // Apply AI-suggested tags when they arrive (only if user hasn't manually added tags yet)
  useEffect(() => {
    if (
      aiSuggestions.hasFetched &&
      aiSuggestions.suggestedTags.length > 0 &&
      !aiTagsApplied &&
      tags.length === 0
    ) {
      setTags(aiSuggestions.suggestedTags)
      setAiTagsApplied(true)
    }
  }, [aiSuggestions.hasFetched, aiSuggestions.suggestedTags, aiTagsApplied, tags.length])

  // Apply AI-suggested description when it arrives (only if user hasn't typed one yet)
  useEffect(() => {
    if (
      aiSuggestions.hasFetched &&
      aiSuggestions.suggestedDescription.length > 0 &&
      !aiDescriptionApplied &&
      description === ''
    ) {
      setDescription(aiSuggestions.suggestedDescription)
      setAiDescriptionApplied(true)
    }
  }, [
    aiSuggestions.hasFetched,
    aiSuggestions.suggestedDescription,
    aiDescriptionApplied,
    description,
  ])

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
      setTags([]) // Start with empty tags; AI or user will populate
      setDescription('')
      setAiTagsApplied(false)
      setAiDescriptionApplied(false)
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

  const handleFilesDropped = useCallback(async (files: File[]) => {
    setIsScanning(true)
    try {
      const scanned = await scanFromDroppedFiles(files, 'Imported Course')
      setScannedCourse(scanned)
      setCourseName(scanned.name)
      setTags([])
      setDescription('')
      setAiTagsApplied(false)
      setAiDescriptionApplied(false)
      setStep('details')
    } catch {
      // silent-catch-ok: scanFromDroppedFiles already handles toasts for ImportError
    } finally {
      setIsScanning(false)
    }
  }, [])

  const handleGoToPathStep = useCallback(() => {
    setStep('path')
  }, [])

  const handleImport = useCallback(async () => {
    if (!scannedCourse) return

    setIsPersisting(true)
    try {
      const trimmedName = courseName.trim()
      const trimmedDescription = description.trim()
      const hasNameChange = trimmedName !== scannedCourse.name
      const hasTags = tags.length > 0
      const hasCover = selectedCoverImage !== null
      const hasDescription = trimmedDescription.length > 0

      const overrides =
        hasNameChange || hasTags || hasCover || hasDescription
          ? {
              ...(hasNameChange ? { name: trimmedName } : {}),
              ...(hasTags ? { tags } : {}),
              ...(hasCover ? { coverImageHandle: selectedCoverImage.fileHandle } : {}),
              ...(hasDescription ? { description: trimmedDescription } : {}),
            }
          : undefined

      const importedCourse = await persistScannedCourse(scannedCourse, overrides)

      // Add to learning path if one was selected (E26-S04)
      if (pathChoice !== 'skip' && importedCourse) {
        const courseId = importedCourse.id
        try {
          if (pathChoice === 'new' && newPathName.trim()) {
            const newPath = await createPath(newPathName.trim())
            await addCourseToPath(newPath.id, courseId, 'imported')
            toast.success(`Added to new path "${newPathName.trim()}"`)
          } else if (selectedPathId) {
            await addCourseToPath(selectedPathId, courseId, 'imported')
            const pathName = learningPaths.find(p => p.id === selectedPathId)?.name
            toast.success(`Added to "${pathName}"`)
          }
        } catch {
          toast.error('Course imported, but failed to add to learning path')
        }
      }

      handleOpenChange(false)
    } catch {
      // silent-catch-ok: persistScannedCourse already shows error toasts
    } finally {
      setIsPersisting(false)
    }
  }, [
    scannedCourse,
    courseName,
    description,
    tags,
    selectedCoverImage,
    handleOpenChange,
    pathChoice,
    selectedPathId,
    newPathName,
    createPath,
    addCourseToPath,
    learningPaths,
  ])

  const handleRescan = useCallback(() => {
    setScannedCourse(null)
    setCourseName('')
    setTags([])
    setTagInput('')
    setDescription('')
    setSelectedCoverImage(null)
    setCoverPreviewUrl(null)
    setImagePreviewUrls(new Map())
    setAiTagsApplied(false)
    setAiDescriptionApplied(false)
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
          <DialogTitle>
            {step === 'select'
              ? 'Import Course'
              : step === 'details'
                ? 'Course Details'
                : 'Learning Path'}
          </DialogTitle>
          <DialogDescription id="import-wizard-description">
            {step === 'select'
              ? 'Select a folder containing your course videos and PDFs.'
              : step === 'details'
                ? 'Review and edit the course details before importing.'
                : 'Choose where to place this course in your learning journey.'}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        {(() => {
          const totalSteps = showPathStep ? 3 : 2
          const currentStep = step === 'select' ? 1 : step === 'details' ? 2 : 3
          const steps = [
            { num: 1, label: 'Select Folder' },
            { num: 2, label: 'Details' },
            ...(showPathStep ? [{ num: 3, label: 'Learning Path' }] : []),
          ]

          return (
            <div
              className="flex items-center gap-2 text-xs text-muted-foreground"
              aria-label={`Step ${currentStep} of ${totalSteps}`}
              role="status"
            >
              {steps.map((s, i) => (
                <span key={s.num} className="contents">
                  {i > 0 && <ChevronRight className="size-3" aria-hidden="true" />}
                  <span
                    className={`inline-flex items-center justify-center size-5 rounded-full text-xs font-medium ${
                      currentStep === s.num
                        ? 'bg-brand text-brand-foreground'
                        : currentStep > s.num
                          ? 'bg-brand-soft text-brand-soft-foreground'
                          : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {currentStep > s.num ? <Check className="size-3" aria-hidden="true" /> : s.num}
                  </span>
                  <span className={currentStep === s.num ? 'font-medium text-foreground' : ''}>
                    {s.label}
                  </span>
                </span>
              ))}
            </div>
          )
        })()}

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
            <ImportDropZone onFilesDropped={handleFilesDropped} disabled={isScanning} />
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

              {/* AI suggestions loading indicator */}
              {aiSuggestions.isAvailable && aiSuggestions.isLoading && (
                <div
                  className="flex items-center gap-2 rounded-xl border border-brand/20 bg-brand-soft/30 px-3 py-2"
                  data-testid="wizard-ai-loading"
                  role="status"
                  aria-live="polite"
                >
                  <Loader2
                    className="size-4 animate-spin text-brand-soft-foreground"
                    aria-hidden="true"
                  />
                  <span className="text-xs text-brand-soft-foreground">
                    AI is generating tag and description suggestions...
                  </span>
                </div>
              )}

              {/* Description field */}
              <div className="flex flex-col gap-2" data-testid="wizard-description-section">
                <Label htmlFor="wizard-description">
                  <span className="flex items-center gap-1.5">
                    Description
                    {aiDescriptionApplied && description === aiSuggestions.suggestedDescription && (
                      <Badge
                        variant="secondary"
                        className="gap-1 rounded-full px-1.5 py-0 text-[10px] font-normal bg-brand-soft text-brand-soft-foreground"
                        data-testid="wizard-ai-description-badge"
                      >
                        <Sparkles className="size-2.5" aria-hidden="true" />
                        AI Suggested
                      </Badge>
                    )}
                  </span>
                </Label>
                <Textarea
                  id="wizard-description"
                  data-testid="wizard-description-input"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder={
                    aiSuggestions.isAvailable && aiSuggestions.isLoading
                      ? 'AI is generating a description...'
                      : 'Enter a course description (optional)'
                  }
                  rows={2}
                  className="resize-none rounded-xl"
                />
              </div>

              {/* Tag management */}
              <div className="flex flex-col gap-2" data-testid="wizard-tags-section">
                <Label htmlFor="wizard-tag-input">
                  <span className="flex items-center gap-1.5">
                    <Tag className="size-3.5" aria-hidden="true" />
                    Tags
                    {aiTagsApplied &&
                      tags.length > 0 &&
                      tags.some(t => aiSuggestions.suggestedTags.includes(t)) && (
                        <Badge
                          variant="secondary"
                          className="gap-1 rounded-full px-1.5 py-0 text-[10px] font-normal bg-brand-soft text-brand-soft-foreground"
                          data-testid="wizard-ai-tags-badge"
                        >
                          <Sparkles className="size-2.5" aria-hidden="true" />
                          AI Suggested
                        </Badge>
                      )}
                  </span>
                </Label>
                <div className="flex flex-wrap items-center gap-1.5 min-h-[2.25rem] rounded-xl border border-border bg-background px-3 py-1.5 focus-within:ring-2 focus-within:ring-ring">
                  {tags.map(tag => {
                    const isAiTag = aiTagsApplied && aiSuggestions.suggestedTags.includes(tag)
                    return (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className={`gap-1 rounded-full pl-2.5 pr-1 py-0.5 ${
                          isAiTag ? 'bg-brand-soft text-brand-soft-foreground' : ''
                        }`}
                        data-testid={`wizard-tag-${tag}`}
                        data-ai-suggested={isAiTag || undefined}
                      >
                        {isAiTag && <Sparkles className="size-2.5" aria-hidden="true" />}
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
                    )
                  })}
                  <input
                    ref={tagInputRef}
                    id="wizard-tag-input"
                    data-testid="wizard-tag-input"
                    type="text"
                    value={tagInput}
                    onChange={e => setTagInput(e.target.value)}
                    onKeyDown={handleTagKeyDown}
                    onBlur={handleAddTag}
                    placeholder={
                      aiSuggestions.isAvailable && aiSuggestions.isLoading
                        ? 'AI is suggesting tags...'
                        : tags.length === 0
                          ? 'Type a tag and press Enter'
                          : 'Add tag...'
                    }
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

        {/* Learning Path Step (E26-S04) */}
        {step === 'path' && (
          <div className="max-h-[60vh] overflow-y-auto">
            <div className="flex flex-col gap-4 pr-1" data-testid="wizard-path-step">
              {/* AI suggestion */}
              {pathPlacement.isAvailable && pathPlacement.isLoading && (
                <div
                  className="flex items-center gap-2 rounded-xl border border-brand/20 bg-brand-soft/30 px-3 py-2"
                  data-testid="wizard-path-ai-loading"
                  role="status"
                  aria-live="polite"
                >
                  <Loader2
                    className="size-4 animate-spin text-brand-soft-foreground"
                    aria-hidden="true"
                  />
                  <span className="text-xs text-brand-soft-foreground">
                    AI is analyzing path placement...
                  </span>
                </div>
              )}

              {/* AI suggestion card */}
              {pathPlacement.hasFetched &&
                pathPlacement.suggestion &&
                pathPlacement.suggestion.pathId && (
                  <div
                    className="rounded-xl border border-brand/20 bg-brand-soft/30 p-4 space-y-3"
                    data-testid="wizard-path-ai-suggestion"
                  >
                    <div className="flex items-center gap-2">
                      <Sparkles className="size-4 text-brand" aria-hidden="true" />
                      <span className="text-sm font-medium">AI Suggestion</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Place in{' '}
                      <span className="font-medium text-foreground">
                        {pathPlacement.suggestion.pathName}
                      </span>{' '}
                      at position{' '}
                      <span className="font-medium text-foreground">
                        #{pathPlacement.suggestion.position}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground italic">
                      {pathPlacement.suggestion.justification}
                    </p>
                    <Button
                      variant="brand"
                      size="sm"
                      onClick={() => {
                        setPathChoice('accept')
                        setSelectedPathId(pathPlacement.suggestion!.pathId)
                        setSelectedPosition(pathPlacement.suggestion!.position)
                      }}
                      data-testid="wizard-path-accept-suggestion"
                      className="rounded-xl"
                    >
                      <Check className="size-4 mr-1.5" aria-hidden="true" />
                      Accept Suggestion
                    </Button>
                  </div>
                )}

              {/* AI not configured message */}
              {!pathPlacement.isAvailable && learningPaths.length > 0 && (
                <div
                  className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/5 p-3"
                  data-testid="wizard-path-no-ai"
                >
                  <AlertTriangle
                    className="size-4 mt-0.5 shrink-0 text-warning"
                    aria-hidden="true"
                  />
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">
                      AI placement suggestions require a configured AI provider.
                    </p>
                    <Link
                      to="/settings"
                      className="text-xs text-brand hover:underline"
                      onClick={() => handleOpenChange(false)}
                    >
                      <Settings className="size-3 inline mr-1" aria-hidden="true" />
                      Configure in Settings
                    </Link>
                  </div>
                </div>
              )}

              {/* Manual path selection */}
              {learningPaths.length > 0 && (
                <div className="space-y-3">
                  <Label>Choose a Learning Path</Label>
                  <Select
                    value={selectedPathId || ''}
                    onValueChange={value => {
                      setSelectedPathId(value)
                      setPathChoice('choose')
                    }}
                  >
                    <SelectTrigger
                      data-testid="wizard-path-select"
                      className="rounded-xl"
                      aria-label="Select a learning path"
                    >
                      <SelectValue placeholder="Select a path..." />
                    </SelectTrigger>
                    <SelectContent>
                      {learningPaths.map(path => (
                        <SelectItem key={path.id} value={path.id}>
                          <span className="flex items-center gap-2">
                            <Route className="size-3.5" aria-hidden="true" />
                            {path.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {selectedPathId && pathChoice !== 'skip' && pathChoice !== 'new' && (
                    <div className="flex items-center gap-2">
                      <Label htmlFor="wizard-position" className="shrink-0">
                        Position
                      </Label>
                      <Input
                        id="wizard-position"
                        data-testid="wizard-path-position"
                        type="number"
                        min={1}
                        value={selectedPosition}
                        onChange={e =>
                          setSelectedPosition(Math.max(1, parseInt(e.target.value) || 1))
                        }
                        className="w-20 rounded-xl"
                        aria-label="Position in path"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Create new path option */}
              <div className="space-y-2">
                <Button
                  variant={pathChoice === 'new' ? 'brand-outline' : 'outline'}
                  size="sm"
                  onClick={() => setPathChoice('new')}
                  data-testid="wizard-path-create-new"
                  className="rounded-xl"
                >
                  <Plus className="size-4 mr-1.5" aria-hidden="true" />
                  Create New Path
                </Button>
                {pathChoice === 'new' && (
                  <Input
                    data-testid="wizard-new-path-name"
                    value={newPathName}
                    onChange={e => setNewPathName(e.target.value)}
                    placeholder="e.g., Web Development Fundamentals"
                    className="rounded-xl"
                    autoFocus
                    aria-label="New path name"
                  />
                )}
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
            {showPathStep ? (
              <Button
                variant="brand"
                onClick={handleGoToPathStep}
                disabled={!isNameValid}
                data-testid="wizard-next-btn"
                className="rounded-xl"
              >
                Next
                <ChevronRight className="size-4 ml-1" aria-hidden="true" />
              </Button>
            ) : (
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
            )}
          </DialogFooter>
        )}

        {step === 'path' && (
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setPathChoice('skip')
                handleImport()
              }}
              disabled={isPersisting}
              data-testid="wizard-path-skip"
              className="rounded-xl sm:mr-auto"
            >
              Add Later
            </Button>
            <Button
              variant="outline"
              onClick={() => setStep('details')}
              disabled={isPersisting}
              data-testid="wizard-path-back"
              className="rounded-xl"
            >
              Back
            </Button>
            <Button
              variant="brand"
              onClick={handleImport}
              disabled={
                isPersisting ||
                (pathChoice === 'new' && !newPathName.trim()) ||
                (pathChoice !== 'skip' && pathChoice !== 'new' && !selectedPathId)
              }
              data-testid="wizard-path-import-btn"
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
