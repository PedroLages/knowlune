import { useState, useCallback, useEffect, useRef, useMemo, type KeyboardEvent } from 'react'
import { COURSE_IMPORTED } from './CurriculumComposer'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/app/components/ui/dialog'
import { Button } from '@/app/components/ui/button'
import { cn } from '@/app/components/ui/utils'
import { Progress } from '@/app/components/ui/progress'
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
  FileJson,
  ExternalLink,
  Globe,
} from 'lucide-react'
import {
  scanCourseFolder,
  scanFromDroppedFiles,
  persistScannedCourse,
  scanCourseFolderFromServer,
} from '@/lib/courseImport'
import { isValidImportUrl } from '@/lib/courseServerService'
import { getVideoFormat } from '@/lib/fileSystem'
import type { ScannedCourse, ScannedImage } from '@/lib/courseImport'
import type { CourseManifest } from '@/lib/courseManifest'
import { ImportDropZone } from './ImportDropZone'
import { useAISuggestions } from '@/ai/hooks/useAISuggestions'
import { usePathPlacementSuggestion } from '@/ai/hooks/usePathPlacementSuggestion'
import { useLearningPathStore } from '@/stores/useLearningPathStore'
import { toast } from 'sonner'
import { useImportProgressStore } from '@/stores/useImportProgressStore'
import { PremiumGate } from '@/app/components/PremiumGate'
import { DriveFolderBrowser } from '@/app/components/import/DriveFolderBrowser'
import type { DriveFolderBrowserResult } from '@/lib/googleDriveFileService'

type WizardStep = 'select' | 'details' | 'path'

// --- Singleton guard: module-level counter for wizard open state ---

let wizardOpenCount = 0

/** Returns true if any ImportWizardDialog is currently open. */
export function isImportWizardOpen(): boolean {
  return wizardOpenCount > 0
}

/** @internal Resets the wizard open counter (for test use only). */
export function __resetWizardOpenCount(): void {
  wizardOpenCount = 0
}

/** Custom event name for cross-component target path updates (R10). */
export const IMPORT_WIZARD_SET_TARGET = 'import-wizard-set-target' as const

export interface ImportWizardSetTargetEvent extends CustomEvent {
  detail: { pathId: string | null; gap?: { gapEntryId: string; searchTerm?: string } }
}

/** Live scan progress shown inside the wizard during folder scanning. */
function ScanProgressIndicator() {
  const courses = useImportProgressStore(s => s.courses)
  const courseList = [...courses.values()]
  const current = courseList[courseList.length - 1] // Most recent (single import = 1 entry)

  if (!current) return null

  const isScanning = current.phase === 'scanning'
  const totalFiles = current.totalFiles
  const processed = current.filesProcessed
  const percent =
    totalFiles && totalFiles > 0
      ? Math.min(100, Math.max(0, Math.round((processed / totalFiles) * 100)))
      : undefined

  return (
    <div
      className="w-full max-w-xs space-y-2 text-center"
      role="status"
      aria-live="polite"
      data-testid="wizard-scan-progress"
    >
      <div className="flex items-center gap-2 justify-center">
        <Loader2
          className="size-4 text-brand motion-safe:animate-spin shrink-0"
          aria-hidden="true"
        />
        <span className="text-sm font-medium truncate">{current.courseName}</span>
      </div>
      <Progress value={percent ?? 0} className="h-1.5" aria-label="Scan progress" />
      <p className="text-xs text-muted-foreground">
        {isScanning
          ? `Scanning folder\u2026 ${processed} ${processed === 1 ? 'file' : 'files'} found`
          : percent !== undefined
            ? `${processed} of ${totalFiles} files processed (${percent}%)`
            : `Scanning\u2026 ${processed} files found`}
      </p>
    </div>
  )
}

interface ImportWizardDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Pre-fill step 3 with this path ID when the dialog opens (R3, R4). */
  targetPathId?: string
  /** Gap entry context for auto-resolution on import success. */
  gapEntryId?: string
  /** Search term from gap entry justification, pre-fills course name. */
  searchTerm?: string
}

const DIFFICULTY_OPTIONS: { value: string; label: string }[] = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
  { value: 'expert', label: 'Expert' },
]

const CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: 'behavioral-analysis', label: 'Behavioral Analysis' },
  { value: 'influence-authority', label: 'Influence & Authority' },
  { value: 'confidence-mastery', label: 'Confidence Mastery' },
  { value: 'operative-training', label: 'Operative Training' },
  { value: 'research-library', label: 'Research Library' },
]

/**
 * ImportWizardDialog — step-by-step wizard for importing a single course.
 *
 * Guides the user through three steps:
 * 1. **Select** — choose a source (local folder, drag-drop, server URL, Google Drive)
 * 2. **Details** — review/edit course name, description, tags, difficulty, cover image
 * 3. **Organize** — optionally place the course into a Learning Track (or resolve a gap entry)
 *
 * After import, dispatches a `COURSE_IMPORTED` custom event so sibling components
 * (InlineCoursePicker, CurriculumComposer) can react to the new course.
 *
 * Uses a singleton guard (`wizardOpenCount`) to prevent multiple instances.
 *
 * @param props.open — Whether the dialog is visible
 * @param props.onOpenChange — Callback when the dialog open state changes
 * @param props.targetPathId — Pre-select a specific learning path in step 3
 * @param props.gapEntryId — Gap entry ID to auto-resolve on successful import
 * @param props.searchTerm — Pre-fill the course name with this search term (from gap context)
 */
export function ImportWizardDialog({
  open,
  onOpenChange,
  targetPathId,
  gapEntryId,
  searchTerm,
}: ImportWizardDialogProps) {
  const [step, setStep] = useState<WizardStep>('select')
  const [scannedCourse, setScannedCourse] = useState<ScannedCourse | null>(null)
  const [courseName, setCourseName] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [selectedCoverImage, setSelectedCoverImage] = useState<ScannedImage | null>(null)
  const [useVideoFrameCover, setUseVideoFrameCover] = useState(false)
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null)
  const [imagePreviewUrls, setImagePreviewUrls] = useState<Map<string, string>>(new Map())
  const [description, setDescription] = useState('')
  const [isScanning, setIsScanning] = useState(false)
  const [isPersisting, setIsPersisting] = useState(false)
  const [aiTagsApplied, setAiTagsApplied] = useState(false)
  const [aiDescriptionApplied, setAiDescriptionApplied] = useState(false)
  const [selectedDifficulty, setSelectedDifficulty] = useState<
    'beginner' | 'intermediate' | 'advanced' | 'expert' | undefined
  >(undefined)
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const tagInputRef = useRef<HTMLInputElement>(null)
  const manifestDataRef = useRef<CourseManifest | undefined>(undefined)
  const [driveFolderBrowserOpen, setDriveFolderBrowserOpen] = useState(false)
  const [serverUrlInput, setServerUrlInput] = useState('')
  const [showServerUrlInput, setShowServerUrlInput] = useState(false)
  const isScanningRef = useRef(false)
  const abortRef = useRef(false)

  // Sync isScanningRef with isScanning state so keydown handlers have live access
  useEffect(() => {
    isScanningRef.current = isScanning
  }, [isScanning])

  // Optional Learning Track organization state (E26-S04)
  const [selectedPathId, setSelectedPathId] = useState<string | null>(null)
  const [pathChoice, setPathChoice] = useState<'none' | 'existing' | 'new'>('none')
  const [newPathName, setNewPathName] = useState('')
  const [acceptedAiPlacement, setAcceptedAiPlacement] = useState(false)

  // Learning Track store. Templates are examples, not destinations for imported courses.
  const {
    paths: learningPaths,
    loadPaths,
    addCourseToPath,
    createPath,
    applyPlacementSuggestion,
  } = useLearningPathStore()
  const userTracks = useMemo(() => learningPaths.filter(path => !path.isTemplate), [learningPaths])

  // Refs for singleton guard and target path tracking
  const targetPathIdRef = useRef(targetPathId)
  const gapEntryIdRef = useRef(gapEntryId)
  const searchTermRef = useRef(searchTerm)
  const prevOpenRef = useRef(false)
  const targetPrefilledRef = useRef(false)

  // Keep refs in sync with props
  useEffect(() => {
    targetPathIdRef.current = targetPathId
    targetPrefilledRef.current = false
  }, [targetPathId])
  useEffect(() => {
    gapEntryIdRef.current = gapEntryId
  }, [gapEntryId])
  useEffect(() => {
    searchTermRef.current = searchTerm
  }, [searchTerm])

  // Singleton guard: track open state transitions for wizardOpenCount (R10)
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      wizardOpenCount++
    } else if (!open && prevOpenRef.current) {
      wizardOpenCount = Math.max(0, wizardOpenCount - 1)
    }
    prevOpenRef.current = open
  }, [open])

  // Listen for cross-component target path updates (R10)
  useEffect(() => {
    function handleSetTarget(e: Event) {
      const event = e as ImportWizardSetTargetEvent
      const newTarget = event.detail?.pathId ?? undefined
      const newGap = event.detail?.gap
      targetPathIdRef.current = newTarget
      if (newGap) {
        gapEntryIdRef.current = newGap.gapEntryId
        searchTermRef.current = newGap.searchTerm
        // Pre-fill course name with search term from gap
        if (newGap.searchTerm) {
          setCourseName(newGap.searchTerm)
        }
      }
      // When target is updated while wizard is open, update step 3 UI
      const targetIsUserTrack = useLearningPathStore
        .getState()
        .paths.some(path => path.id === newTarget && !path.isTemplate)
      if (newTarget && scannedCourse && targetIsUserTrack) {
        targetPrefilledRef.current = true
        setSelectedPathId(newTarget)
        setPathChoice('existing')
        setAcceptedAiPlacement(false)
        setStep('path')
      }
    }
    window.addEventListener(IMPORT_WIZARD_SET_TARGET, handleSetTarget)
    return () => {
      window.removeEventListener(IMPORT_WIZARD_SET_TARGET, handleSetTarget)
    }
  }, [scannedCourse])

  // Load paths when dialog opens
  useEffect(() => {
    if (open) {
      loadPaths()
    }
  }, [open, loadPaths])

  // Sync dialog open state with progress store so overlay hides while dialog is showing activity
  useEffect(() => {
    if (open && (isScanning || isPersisting)) {
      useImportProgressStore.getState().setDialogOpen(true)
    }
    return () => {
      useImportProgressStore.getState().setDialogOpen(false)
    }
  }, [open, isScanning, isPersisting])

  // Organization is always offered, but defaults to importing without a track.
  const showPathStep = true

  // AI suggestions hook — fires automatically when Ollama is configured
  const aiSuggestions = useAISuggestions(scannedCourse)

  // Path placement AI suggestion — pass targetPathId for constrained context (R3)
  const pathPlacement = usePathPlacementSuggestion(
    courseName,
    tags,
    description,
    step === 'path' && userTracks.length > 0,
    targetPathIdRef.current ?? undefined
  )

  // Pre-fill step 3 when targetPathId is provided (R3, R4)
  useEffect(() => {
    if (
      step === 'path' &&
      targetPathIdRef.current &&
      userTracks.length > 0 &&
      !targetPrefilledRef.current
    ) {
      targetPrefilledRef.current = true
      const targetPathExists = userTracks.some(p => p.id === targetPathIdRef.current)
      if (targetPathExists) {
        setSelectedPathId(targetPathIdRef.current)
        setPathChoice('existing')
        setAcceptedAiPlacement(false)
      }
    }
  }, [step, userTracks])

  const resetWizard = useCallback(() => {
    setStep('select')
    setScannedCourse(null)
    setCourseName('')
    setTags([])
    setTagInput('')
    setDescription('')
    setSelectedCoverImage(null)
    setUseVideoFrameCover(false)
    setCoverPreviewUrl(null)
    setImagePreviewUrls(new Map())
    setIsScanning(false)
    setIsPersisting(false)
    setAiTagsApplied(false)
    setAiDescriptionApplied(false)
    setSelectedDifficulty(undefined)
    setSelectedCategory('')
    manifestDataRef.current = undefined
    setDriveFolderBrowserOpen(false)
    setServerUrlInput('')
    setShowServerUrlInput(false)
    setSelectedPathId(null)
    setPathChoice('none')
    setNewPathName('')
    setAcceptedAiPlacement(false)
    targetPrefilledRef.current = false
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
          if (image.serverUrl) {
            urls.set(image.path, image.serverUrl)
            continue
          }
          const file = image.file ?? (await image.fileHandle?.getFile())
          if (!file) continue
          const url = URL.createObjectURL(file)
          urls.set(image.path, url)
          objectUrls.push(url)
        } catch {
          // silent-catch-ok: image preview is optional, skip on error
        }
      }

      if (cancelled) return

      setImagePreviewUrls(new Map(urls))

      // A single root image is an unambiguous cover. Multiple images require an
      // explicit choice unless the manifest already selected one.
      setSelectedCoverImage(prev => {
        if (prev && scannedCourse!.images.some(image => image.path === prev.path)) return prev
        if (scannedCourse!.images.length !== 1) {
          setCoverPreviewUrl(null)
          return null
        }
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

  // Sync coverPreviewUrl when manifest pre-selected a cover image and preview URL becomes available
  useEffect(() => {
    if (!selectedCoverImage || !coverPreviewUrl) {
      if (selectedCoverImage) {
        const url = imagePreviewUrls.get(selectedCoverImage.path)
        if (url) setCoverPreviewUrl(url)
      }
      return
    }
    const urlForImage = imagePreviewUrls.get(selectedCoverImage.path)
    if (urlForImage && urlForImage !== coverPreviewUrl) {
      setCoverPreviewUrl(urlForImage)
    }
  }, [selectedCoverImage?.path, imagePreviewUrls, coverPreviewUrl])

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        abortRef.current = true
        resetWizard()
      }
      onOpenChange(nextOpen)
    },
    [onOpenChange, resetWizard]
  )

  const handleSelectFolder = useCallback(async () => {
    abortRef.current = false
    setIsScanning(true)
    isScanningRef.current = true
    try {
      const scanned = await scanCourseFolder()
      if (abortRef.current) return
      manifestDataRef.current = scanned.manifestData
      setScannedCourse(scanned)
      // Pre-fill from manifest if present (before AI effects run)
      if (scanned.manifestData) {
        const m = scanned.manifestData.course
        setCourseName(searchTermRef.current || m.name)
        setDescription(m.description ?? '')
        setTags(m.tags ?? [])
        setSelectedDifficulty(m.difficulty)
        setSelectedCategory(m.category ?? '')
        // Cover image pre-selection from manifest
        if (m.coverImage) {
          const match = scanned.images.find(
            img => img.filename.toLowerCase() === m.coverImage!.toLowerCase()
          )
          if (match) setSelectedCoverImage(match)
        }
      } else {
        setCourseName(searchTermRef.current || scanned.name)
        setTags([])
        setDescription('')
      }
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
    abortRef.current = false
    setIsScanning(true)
    isScanningRef.current = true
    try {
      const scanned = await scanFromDroppedFiles(files, 'Imported Course')
      if (abortRef.current) return
      manifestDataRef.current = scanned.manifestData
      setScannedCourse(scanned)
      if (scanned.manifestData) {
        const m = scanned.manifestData.course
        setCourseName(searchTermRef.current || m.name)
        setDescription(m.description ?? '')
        setTags(m.tags ?? [])
        setSelectedDifficulty(m.difficulty)
        setSelectedCategory(m.category ?? '')
        if (m.coverImage) {
          const match = scanned.images.find(
            img => img.filename.toLowerCase() === m.coverImage!.toLowerCase()
          )
          if (match) setSelectedCoverImage(match)
        }
      } else {
        setCourseName(searchTermRef.current || scanned.name)
        setTags([])
        setDescription('')
      }
      setAiTagsApplied(false)
      setAiDescriptionApplied(false)
      setStep('details')
    } catch {
      // silent-catch-ok: scanFromDroppedFiles already handles toasts for ImportError
    } finally {
      setIsScanning(false)
    }
  }, [])

  /** Handle a folder selected from the Google Drive folder browser. */
  const handleDriveFolderSelected = useCallback((result: DriveFolderBrowserResult) => {
    // Map Drive files to a ScannedCourse structure
    const videos = result.files.filter(f => f.mimeType.startsWith('video/'))
    const audios = result.files.filter(f => f.mimeType.startsWith('audio/'))
    const pdfs = result.files.filter(f => f.mimeType === 'application/pdf')
    const epubs = result.files.filter(f => f.mimeType === 'application/epub+zip')
    const dummyHandle = null as unknown as FileSystemFileHandle
    const dummyDirHandle = null as unknown as FileSystemDirectoryHandle

    // Create a scanned course from Drive folder data
    const scanned: ScannedCourse = {
      id: crypto.randomUUID(),
      name: result.folderName,
      scannedAt: new Date().toISOString(),
      directoryHandle: dummyDirHandle,
      videos: [...videos, ...audios].map((f, i) => ({
        id: crypto.randomUUID(),
        filename: f.name,
        path: `drive://${f.id}`,
        duration: 0,
        format: getVideoFormat(f.name),
        order: i + 1,
        fileHandle: dummyHandle,
        fileSize: f.size ?? 0,
        width: 0,
        height: 0,
      })),
      pdfs: [
        ...pdfs.map(f => ({
          id: crypto.randomUUID(),
          filename: f.name,
          path: `drive://${f.id}`,
          pageCount: 0,
          fileHandle: dummyHandle,
        })),
        ...epubs.map(f => ({
          id: crypto.randomUUID(),
          filename: f.name,
          path: `drive://${f.id}`,
          pageCount: 0,
          fileHandle: dummyHandle,
        })),
      ],
      images: [],
      manifestData: undefined,
    }

    setScannedCourse(scanned)
    setCourseName(result.folderName)
    setDescription('')
    setTags([])
    setAiTagsApplied(false)
    setAiDescriptionApplied(false)
    setStep('details')
  }, [])

  /** Handle importing from a course server URL (E133-S01). */
  const handleServerUrlImport = useCallback(async () => {
    abortRef.current = false
    const url = serverUrlInput.trim()
    if (!url) {
      toast.error('Please enter a folder URL')
      return
    }
    // Validate URL before any network call — uses shared validator from courseServerService
    const validation = isValidImportUrl(url)
    if (!validation.valid) {
      toast.error(validation.reason)
      return
    }

    setIsScanning(true)
    isScanningRef.current = true
    setShowServerUrlInput(false)

    try {
      const scanned = await scanCourseFolderFromServer(url)
      if (abortRef.current) return
      manifestDataRef.current = scanned.manifestData
      setScannedCourse(scanned)
      setCourseName(scanned.name)
      setTags([])
      setDescription('')
      setAiTagsApplied(false)
      setAiDescriptionApplied(false)
      setStep('details')
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to scan server folder'
      toast.error(msg)
    } finally {
      setIsScanning(false)
    }
  }, [serverUrlInput])

  const handleGoToPathStep = useCallback(() => {
    setStep('path')
  }, [])

  const handleImport = useCallback(async () => {
    if (!scannedCourse) return
    if (scannedCourse.images.length > 1 && !selectedCoverImage && !useVideoFrameCover) {
      toast.error('Choose a cover image or use a video frame before importing.')
      return
    }
    if (pathChoice === 'new' && !newPathName.trim()) {
      toast.error('Enter a name for the new Learning Track.')
      return
    }
    if (
      pathChoice === 'existing' &&
      (!selectedPathId || !userTracks.some(track => track.id === selectedPathId))
    ) {
      toast.error('Choose an existing Learning Track or select No track.')
      return
    }

    setIsPersisting(true)
    let courseImported = false
    try {
      const trimmedName = courseName.trim()
      const trimmedDescription = description.trim()
      const hasNameChange = trimmedName !== scannedCourse.name
      const hasTags = tags.length > 0
      const hasCover = selectedCoverImage !== null || useVideoFrameCover
      const hasDescription = trimmedDescription.length > 0
      const hasDifficulty = selectedDifficulty !== undefined
      const hasCategory = selectedCategory !== ''
      const authorName = scannedCourse.manifestData?.course.author?.name

      const overrides =
        hasNameChange ||
        hasTags ||
        hasCover ||
        hasDescription ||
        hasDifficulty ||
        hasCategory ||
        !!authorName
          ? {
              ...(hasNameChange ? { name: trimmedName } : {}),
              ...(hasTags ? { tags } : {}),
              ...(selectedCoverImage ? { coverImage: selectedCoverImage } : {}),
              ...(useVideoFrameCover ? { useVideoFrameCover: true } : {}),
              ...(hasDescription ? { description: trimmedDescription } : {}),
              ...(hasDifficulty ? { difficulty: selectedDifficulty } : {}),
              ...(hasCategory ? { category: selectedCategory } : {}),
              ...(authorName ? { authorName } : {}),
            }
          : undefined

      // Let the global progress overlay become visible during the persist phase
      // so the user sees per-file progress instead of a static "Importing…" button.
      useImportProgressStore.getState().setDialogOpen(false)

      const importedCourse = await persistScannedCourse(scannedCourse, overrides)
      courseImported = true

      // Dispatch course-imported event so the InlineCoursePicker (or CurriculumComposer)
      // can react to the new course and add it to the selection.
      if (importedCourse) {
        window.dispatchEvent(
          new CustomEvent(COURSE_IMPORTED, {
            detail: { courseId: importedCourse.id },
          })
        )
      }

      // Add to learning path or resolve gap entry
      if (importedCourse) {
        const courseId = importedCourse.id
        const currentGapEntryId = gapEntryIdRef.current
        const currentTargetPathId = targetPathIdRef.current

        try {
          const eligibleTarget = currentTargetPathId
            ? userTracks.find(track => track.id === currentTargetPathId)
            : undefined

          if (currentGapEntryId && eligibleTarget) {
            // Resolve the gap entry: replace the placeholder with the newly imported course
            await useLearningPathStore
              .getState()
              .replaceGapEntry(eligibleTarget.id, currentGapEntryId, courseId, 'imported')
            const wasAssigned = useLearningPathStore
              .getState()
              .entries.some(
                entry =>
                  entry.pathId === eligibleTarget.id &&
                  entry.id === currentGapEntryId &&
                  entry.courseId === courseId
              )
            if (!wasAssigned) throw new Error('Gap entry was not updated')
            toast.success('Course added to the Learning Track')
          } else if (pathChoice !== 'none') {
            if (pathChoice === 'new' && newPathName.trim()) {
              const newPath = await createPath(newPathName.trim())
              await addCourseToPath(newPath.id, courseId, 'imported')
              const wasAssigned = useLearningPathStore
                .getState()
                .entries.some(entry => entry.pathId === newPath.id && entry.courseId === courseId)
              if (!wasAssigned) throw new Error('Course entry was not created')
              toast.success(`Added to new Learning Track "${newPathName.trim()}"`)
            } else if (selectedPathId && userTracks.some(track => track.id === selectedPathId)) {
              await addCourseToPath(selectedPathId, courseId, 'imported')
              const wasAssigned = useLearningPathStore
                .getState()
                .entries.some(
                  entry => entry.pathId === selectedPathId && entry.courseId === courseId
                )
              if (!wasAssigned) throw new Error('Course entry was not created')
              if (acceptedAiPlacement && pathPlacement.suggestion?.pathId === selectedPathId) {
                await applyPlacementSuggestion(
                  selectedPathId,
                  courseId,
                  pathPlacement.suggestion.position,
                  pathPlacement.suggestion.justification
                )
              }
              const trackName = userTracks.find(track => track.id === selectedPathId)?.name
              toast.success(`Added to "${trackName}"`)
            }
          }
        } catch (error) {
          console.error('[Import] Learning Track assignment failed:', error)
          toast.error('Course imported, but it was not added to the Learning Track.')
        }
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Course import failed. Please try again.'
      toast.error(message)
      useImportProgressStore.getState().setDialogOpen(true)
    } finally {
      setIsPersisting(false)
      if (courseImported) handleOpenChange(false)
    }
  }, [
    scannedCourse,
    courseName,
    description,
    tags,
    selectedCoverImage,
    useVideoFrameCover,
    selectedDifficulty,
    selectedCategory,
    handleOpenChange,
    pathChoice,
    selectedPathId,
    newPathName,
    createPath,
    addCourseToPath,
    applyPlacementSuggestion,
    acceptedAiPlacement,
    pathPlacement.suggestion,
    userTracks,
  ])

  const handleRescan = useCallback(() => {
    setScannedCourse(null)
    setCourseName('')
    setTags([])
    setTagInput('')
    setDescription('')
    setSelectedCoverImage(null)
    setUseVideoFrameCover(false)
    setCoverPreviewUrl(null)
    setImagePreviewUrls(new Map())
    setAiTagsApplied(false)
    setAiDescriptionApplied(false)
    setSelectedDifficulty(undefined)
    setSelectedCategory('')
    manifestDataRef.current = undefined
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
      setUseVideoFrameCover(false)
      if (image) {
        const url = imagePreviewUrls.get(image.path)
        setCoverPreviewUrl(url ?? null)
      } else {
        setCoverPreviewUrl(null)
      }
    },
    [imagePreviewUrls]
  )

  const handleUseVideoFrameCover = useCallback(() => {
    setSelectedCoverImage(null)
    setCoverPreviewUrl(null)
    setUseVideoFrameCover(true)
  }, [])

  const isNameValid = courseName.trim().length > 0
  const canUseVideoFrame = typeof scannedCourse?.videos[0]?.fileHandle?.getFile === 'function'
  const coverChoiceRequired =
    (scannedCourse?.images.length ?? 0) > 1 && !selectedCoverImage && !useVideoFrameCover
  const isDetailsValid = isNameValid && !coverChoiceRequired
  const suggestedTrack = pathPlacement.suggestion?.pathId
    ? userTracks.find(track => track.id === pathPlacement.suggestion?.pathId)
    : undefined

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
                : 'Organize Course'}
          </DialogTitle>
          <DialogDescription id="import-wizard-description" aria-live="polite">
            {step === 'select'
              ? 'Select a folder containing your course videos and PDFs.'
              : step === 'details'
                ? 'Review and edit the course details before importing.'
                : 'Optionally add this course to a Learning Track. You can also organize it later.'}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        {(() => {
          const totalSteps = showPathStep ? 3 : 2
          const currentStep = step === 'select' ? 1 : step === 'details' ? 2 : 3
          const steps = [
            { num: 1, label: 'Select Folder' },
            { num: 2, label: 'Details' },
            ...(showPathStep ? [{ num: 3, label: 'Organize (optional)' }] : []),
          ]

          return (
            <nav
              className="flex items-center gap-2 text-xs text-muted-foreground"
              aria-label={`Step ${currentStep} of ${totalSteps}`}
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
                    aria-current={currentStep === s.num ? 'step' : undefined}
                  >
                    {currentStep > s.num ? <Check className="size-3" aria-hidden="true" /> : s.num}
                  </span>
                  <span className={currentStep === s.num ? 'font-medium text-foreground' : ''}>
                    {s.label}
                  </span>
                </span>
              ))}
            </nav>
          )
        })()}

        {step === 'select' && (
          <div className="flex flex-col gap-4 py-4">
            {isScanning ? (
              <div className="flex flex-col items-center py-8" data-testid="wizard-scanning-state">
                <ScanProgressIndicator />
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground text-center">
                  Choose how you want to import your course materials.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Select Folder card */}
                  <button
                    type="button"
                    onClick={handleSelectFolder}
                    disabled={isScanning}
                    className="flex flex-col items-start gap-3 rounded-xl border border-border p-4 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:opacity-50"
                    data-testid="wizard-select-folder-btn"
                  >
                    <div className="flex items-center justify-center size-12 rounded-full bg-brand-soft shrink-0 self-center">
                      <FolderOpen
                        className="size-6 text-brand-soft-foreground"
                        aria-hidden="true"
                      />
                    </div>
                    <div className="text-left">
                      <p className="font-medium text-foreground">Select Folder</p>
                      <p className="text-sm text-muted-foreground">
                        Choose a folder with your course videos and PDFs
                      </p>
                    </div>
                  </button>

                  {/* Drag & Drop card */}
                  <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-border p-4">
                    <div className="flex items-center justify-center size-12 rounded-full bg-brand-soft shrink-0 self-center">
                      <FolderOpen
                        className="size-6 text-brand-soft-foreground"
                        aria-hidden="true"
                      />
                    </div>
                    <div className="text-left">
                      <p className="font-medium text-foreground">Drag & Drop</p>
                      <p className="text-sm text-muted-foreground">
                        Drop files here to import as a course
                      </p>
                    </div>
                    <ImportDropZone onFilesDropped={handleFilesDropped} disabled={isScanning} />
                  </div>

                  {/* Import from URL card */}
                  {showServerUrlInput ? (
                    <div className="sm:col-span-2 space-y-3 rounded-xl border border-border bg-surface-elevated p-4">
                      <Label htmlFor="wizard-server-url-input">Server URL</Label>
                      <Input
                        id="wizard-server-url-input"
                        placeholder="https://example.com/AI/Course/"
                        value={serverUrlInput}
                        onChange={e => setServerUrlInput(e.target.value)}
                        autoFocus
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            if (isScanningRef.current) return
                            handleServerUrlImport()
                          }
                          if (e.key === 'Escape') {
                            e.preventDefault()
                            if (isScanningRef.current) return
                            setShowServerUrlInput(false)
                          }
                        }}
                        className="min-h-[44px] font-mono text-sm"
                        data-testid="wizard-url-input"
                      />
                      <div className="flex gap-2">
                        <Button
                          variant="brand"
                          size="sm"
                          onClick={handleServerUrlImport}
                          disabled={!serverUrlInput.trim() || isScanning}
                          className="gap-1 min-h-[44px] rounded-xl"
                          data-testid="wizard-server-scan-btn"
                        >
                          {isScanning ? (
                            <Loader2 className="size-4 motion-safe:animate-spin" />
                          ) : (
                            <Globe className="size-4" />
                          )}
                          Scan
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowServerUrlInput(false)}
                          className="min-h-[44px] rounded-xl"
                          data-testid="wizard-server-cancel-btn"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowServerUrlInput(true)}
                      disabled={isScanning}
                      className="flex flex-col items-start gap-3 rounded-xl border border-border p-4 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:opacity-50"
                      data-testid="wizard-server-url-btn"
                    >
                      <div className="flex items-center justify-center size-12 rounded-full bg-brand-soft shrink-0 self-center">
                        <Globe className="size-6 text-brand-soft-foreground" aria-hidden="true" />
                      </div>
                      <div className="text-left">
                        <p className="font-medium text-foreground">Import from URL</p>
                        <p className="text-sm text-muted-foreground">
                          Paste a course server URL to import
                        </p>
                      </div>
                    </button>
                  )}

                  {/* Google Drive card */}
                  <PremiumGate featureLabel="Google Drive import">
                    <button
                      type="button"
                      onClick={() => setDriveFolderBrowserOpen(true)}
                      disabled={isScanning}
                      className="flex flex-col items-start gap-3 rounded-xl border border-border p-4 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:opacity-50 w-full"
                      data-testid="wizard-drive-import-btn"
                    >
                      <div className="flex items-center justify-center size-12 rounded-full bg-brand-soft shrink-0 self-center">
                        <ExternalLink
                          className="size-6 text-brand-soft-foreground"
                          aria-hidden="true"
                        />
                      </div>
                      <div className="text-left">
                        <p className="font-medium text-foreground">Google Drive</p>
                        <p className="text-sm text-muted-foreground">
                          Import from Google Drive folders
                        </p>
                      </div>
                    </button>
                  </PremiumGate>
                </div>
              </>
            )}
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

              {/* Manifest detected banner */}
              {scannedCourse.manifestData && (
                <div
                  className="rounded-xl border border-brand/20 bg-brand-soft/30 p-4"
                  role="status"
                  aria-live="polite"
                  data-testid="wizard-manifest-banner"
                >
                  <p className="text-sm text-brand-soft-foreground flex items-center gap-2">
                    <FileJson className="size-4 text-brand shrink-0" aria-hidden="true" />
                    Manifest detected — fields pre-filled from course-manifest.json. You can edit
                    any field below.
                  </p>
                </div>
              )}

              {/* AI suggestions loading indicator */}
              {aiSuggestions.isAvailable && aiSuggestions.isLoading && (
                <div
                  className="flex items-center gap-2 rounded-xl border border-brand/20 bg-brand-soft/30 px-3 py-2"
                  data-testid="wizard-ai-loading"
                  role="status"
                  aria-live="polite"
                >
                  <Loader2
                    className="size-4 motion-safe:animate-spin text-brand-soft-foreground"
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

              {/* Difficulty & Category */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="wizard-difficulty">Difficulty</Label>
                  <Select
                    value={selectedDifficulty ?? ''}
                    onValueChange={value =>
                      setSelectedDifficulty(
                        value === ''
                          ? undefined
                          : (value as 'beginner' | 'intermediate' | 'advanced' | 'expert')
                      )
                    }
                  >
                    <SelectTrigger
                      id="wizard-difficulty"
                      data-testid="wizard-difficulty-select"
                      className="rounded-xl"
                      aria-label="Select difficulty"
                    >
                      <SelectValue placeholder="Auto-detect" />
                    </SelectTrigger>
                    <SelectContent>
                      {DIFFICULTY_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="wizard-category">Category</Label>
                  <Select
                    value={selectedCategory}
                    onValueChange={value => setSelectedCategory(value)}
                  >
                    <SelectTrigger
                      id="wizard-category"
                      data-testid="wizard-category-select"
                      className="rounded-xl"
                      aria-label="Select category"
                    >
                      <SelectValue placeholder="Auto-detect" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORY_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
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
                  Optional. Tags make courses easier to filter and help Knowlune connect related
                  topics. You can edit them later.
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
                {scannedCourse.images.length > 1 && (
                  <p className="text-xs text-muted-foreground">
                    Choose one root-folder image, or generate the cover from the first video.
                  </p>
                )}
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
                          width={640}
                          height={256}
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => handleSelectCoverImage(null)}
                          className="absolute top-2 right-2 rounded-full bg-background/80 px-2 py-1 hover:bg-background transition-colors flex items-center gap-1 text-xs font-medium"
                          aria-label="Remove cover image"
                          data-testid="wizard-remove-cover"
                        >
                          <X className="size-3" />
                          Change
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
                                width={160}
                                height={160}
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
                      {canUseVideoFrame && (
                        <button
                          type="button"
                          role="radio"
                          aria-checked={useVideoFrameCover}
                          aria-label="Use a frame from the first video as the course cover"
                          onClick={handleUseVideoFrameCover}
                          className={cn(
                            'relative aspect-square rounded-lg overflow-hidden border-2 transition-colors',
                            'flex flex-col items-center justify-center gap-1 bg-muted/50 px-2 text-center',
                            useVideoFrameCover
                              ? 'border-brand ring-2 ring-brand/30 text-foreground'
                              : 'border-border text-muted-foreground hover:border-muted-foreground'
                          )}
                          data-testid="wizard-use-video-frame"
                        >
                          <Video className="size-5" aria-hidden="true" />
                          <span className="text-[10px] font-medium leading-tight">
                            Use Video Frame
                          </span>
                          {useVideoFrameCover && (
                            <span className="absolute inset-0 bg-brand/10" aria-hidden="true" />
                          )}
                        </button>
                      )}
                    </div>
                    {coverChoiceRequired && (
                      <p className="text-xs text-destructive" role="alert">
                        Choose a cover before continuing.
                      </p>
                    )}
                  </>
                ) : (
                  <div
                    className="flex flex-col items-center gap-2 py-4 rounded-xl border border-dashed border-border bg-muted/30"
                    data-testid="wizard-no-images"
                  >
                    <ImageIcon className="size-6 text-muted-foreground" aria-hidden="true" />
                    <p className="text-xs text-muted-foreground">
                      {canUseVideoFrame
                        ? 'No root images found. A cover will be generated from the first video.'
                        : 'No root images found. You can import this course without a cover.'}
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
                      Selected cover file: {selectedCoverImage.filename}
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

        {/* Optional Learning Track organization (E26-S04) */}
        {step === 'path' && (
          <div className="max-h-[60vh] overflow-y-auto">
            <div className="flex flex-col gap-4 pr-1" data-testid="wizard-path-step">
              {/* AI suggestion */}
              {pathPlacement.isAvailable && userTracks.length > 0 && pathPlacement.isLoading && (
                <div
                  className="flex items-center gap-2 rounded-xl border border-brand/20 bg-brand-soft/30 px-3 py-2"
                  data-testid="wizard-path-ai-loading"
                  role="status"
                  aria-live="polite"
                >
                  <Loader2
                    className="size-4 motion-safe:animate-spin text-brand-soft-foreground"
                    aria-hidden="true"
                  />
                  <span className="text-xs text-brand-soft-foreground">
                    AI is checking your Learning Tracks...
                  </span>
                </div>
              )}

              {/* AI suggestion card */}
              {pathPlacement.hasFetched && pathPlacement.suggestion && suggestedTrack && (
                <div
                  className="rounded-xl border border-brand/20 bg-brand-soft/30 p-4 space-y-3"
                  data-testid="wizard-path-ai-suggestion"
                >
                  <div className="flex items-center gap-2">
                    <Sparkles className="size-4 text-brand" aria-hidden="true" />
                    <span className="text-sm font-medium">AI Suggestion</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Add to{' '}
                    <span className="font-medium text-foreground">{suggestedTrack.name}</span>{' '}
                  </p>
                  <p className="text-xs text-muted-foreground italic">
                    {pathPlacement.suggestion.justification}
                  </p>
                  <Button
                    variant="brand"
                    size="sm"
                    onClick={() => {
                      setPathChoice('existing')
                      setSelectedPathId(pathPlacement.suggestion!.pathId)
                      setAcceptedAiPlacement(true)
                    }}
                    data-testid="wizard-path-accept-suggestion"
                    className="rounded-xl"
                  >
                    <Check className="size-4 mr-1.5" aria-hidden="true" />
                    Accept Suggestion
                  </Button>
                </div>
              )}

              <div
                className="space-y-2"
                role="radiogroup"
                aria-label="Choose Learning Track organization"
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={pathChoice === 'none'}
                  onClick={() => {
                    setPathChoice('none')
                    setSelectedPathId(null)
                    setAcceptedAiPlacement(false)
                  }}
                  className={cn(
                    'flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors',
                    pathChoice === 'none'
                      ? 'border-brand bg-brand-soft/30'
                      : 'border-border hover:bg-accent'
                  )}
                  data-testid="wizard-track-none"
                >
                  <span
                    className={cn(
                      'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border',
                      pathChoice === 'none' ? 'border-brand' : 'border-muted-foreground'
                    )}
                    aria-hidden="true"
                  >
                    {pathChoice === 'none' && <span className="size-2 rounded-full bg-brand" />}
                  </span>
                  <span>
                    <span className="block text-sm font-medium text-foreground">No track</span>
                    <span className="block text-xs text-muted-foreground">
                      Import now and organize later.
                    </span>
                  </span>
                </button>

                <button
                  type="button"
                  role="radio"
                  aria-checked={pathChoice === 'existing'}
                  disabled={userTracks.length === 0}
                  onClick={() => {
                    setPathChoice('existing')
                    setAcceptedAiPlacement(false)
                  }}
                  className={cn(
                    'flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                    pathChoice === 'existing'
                      ? 'border-brand bg-brand-soft/30'
                      : 'border-border hover:bg-accent'
                  )}
                  data-testid="wizard-track-existing"
                >
                  <span
                    className={cn(
                      'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border',
                      pathChoice === 'existing' ? 'border-brand' : 'border-muted-foreground'
                    )}
                    aria-hidden="true"
                  >
                    {pathChoice === 'existing' && <span className="size-2 rounded-full bg-brand" />}
                  </span>
                  <span>
                    <span className="block text-sm font-medium text-foreground">
                      Existing track
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      Add this course to one of your Learning Tracks.
                    </span>
                  </span>
                </button>

                {pathChoice === 'existing' && (
                  <div className="pl-7 pb-1">
                    <Label htmlFor="wizard-track-select" className="sr-only">
                      Choose a Learning Track
                    </Label>
                    <Select
                      value={selectedPathId || ''}
                      onValueChange={value => {
                        setSelectedPathId(value)
                        setAcceptedAiPlacement(false)
                      }}
                    >
                      <SelectTrigger
                        id="wizard-track-select"
                        data-testid="wizard-path-select"
                        className="rounded-xl"
                        aria-label="Choose a Learning Track"
                      >
                        <SelectValue placeholder="Choose a Learning Track..." />
                      </SelectTrigger>
                      <SelectContent>
                        {userTracks.map(track => (
                          <SelectItem key={track.id} value={track.id}>
                            <span className="flex items-center gap-2">
                              <Route className="size-3.5" aria-hidden="true" />
                              {track.name}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <button
                  type="button"
                  role="radio"
                  aria-checked={pathChoice === 'new'}
                  onClick={() => {
                    setPathChoice('new')
                    setSelectedPathId(null)
                    setAcceptedAiPlacement(false)
                  }}
                  className={cn(
                    'flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors',
                    pathChoice === 'new'
                      ? 'border-brand bg-brand-soft/30'
                      : 'border-border hover:bg-accent'
                  )}
                  data-testid="wizard-path-create-new"
                >
                  <span
                    className={cn(
                      'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border',
                      pathChoice === 'new' ? 'border-brand' : 'border-muted-foreground'
                    )}
                    aria-hidden="true"
                  >
                    {pathChoice === 'new' && <span className="size-2 rounded-full bg-brand" />}
                  </span>
                  <span className="flex gap-2">
                    <Plus className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    <span>
                      <span className="block text-sm font-medium text-foreground">
                        Create a new track
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        Start a Learning Track with this course.
                      </span>
                    </span>
                  </span>
                </button>

                {pathChoice === 'new' && (
                  <div className="space-y-1.5 pl-7 pb-1">
                    <Label htmlFor="wizard-new-path-name">Learning Track name</Label>
                    <Input
                      id="wizard-new-path-name"
                      data-testid="wizard-new-path-name"
                      value={newPathName}
                      onChange={e => setNewPathName(e.target.value)}
                      placeholder="e.g., Behavioral Analysis Foundations"
                      className="rounded-xl"
                      autoFocus
                      aria-label="New Learning Track name"
                    />
                  </div>
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
                disabled={!isDetailsValid}
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
                disabled={!isDetailsValid || isPersisting}
                data-testid="wizard-import-btn"
                className="rounded-xl"
              >
                {isPersisting ? (
                  <>
                    <Loader2 className="size-4 mr-2 motion-safe:animate-spin" />
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
          <DialogFooter className="gap-2">
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
                (pathChoice === 'existing' &&
                  (!selectedPathId || !userTracks.some(track => track.id === selectedPathId)))
              }
              data-testid="wizard-path-import-btn"
              className="rounded-xl"
            >
              {isPersisting ? (
                <>
                  <Loader2 className="size-4 mr-2 motion-safe:animate-spin" />
                  Importing...
                </>
              ) : (
                'Import Course'
              )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>

      {/* Google Drive folder browser dialog — separate Dialog, rendered alongside */}
      <DriveFolderBrowser
        open={driveFolderBrowserOpen}
        onOpenChange={setDriveFolderBrowserOpen}
        onFolderSelected={handleDriveFolderSelected}
      />
    </Dialog>
  )
}
