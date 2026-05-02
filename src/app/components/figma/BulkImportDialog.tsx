import { useState, useCallback, useRef, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/app/components/ui/dialog'
import { Button } from '@/app/components/ui/button'
import { Progress } from '@/app/components/ui/progress'
import { Checkbox } from '@/app/components/ui/checkbox'
import { ScrollArea } from '@/app/components/ui/scroll-area'
import { Input } from '@/app/components/ui/input'
import { Label } from '@/app/components/ui/label'
import { Textarea } from '@/app/components/ui/textarea'
import {
  FolderOpen,
  Folders,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  Video,
  FileText,
  Youtube,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  Pencil,
} from 'lucide-react'
import {
  scanCourseFolderFromHandle,
  listSubDirectories,
  persistScannedCourse,
} from '@/lib/courseImport'
import type { BulkScanResult, ScannedCourse } from '@/lib/courseImport'
import { showDirectoryPicker } from '@/lib/fileSystem'
import { detectAuthorFromFolderName, matchOrCreateAuthor } from '@/lib/authorDetection'
import { useCourseImportStore } from '@/stores/useCourseImportStore'
import { useImportProgressStore } from '@/stores/useImportProgressStore'
import { toast } from 'sonner'

// --- Types ---

interface FolderEntry {
  handle: FileSystemDirectoryHandle
  name: string
  selected: boolean
}

type ImportItemStatus =
  | 'pending'
  | 'scanning'
  | 'importing'
  | 'success'
  | 'no-files'
  | 'error'
  | 'duplicate'

interface ImportItem {
  folderName: string
  handle: FileSystemDirectoryHandle
  status: ImportItemStatus
  error?: string
  scannedCourse?: ScannedCourse
  videoCount?: number
  pdfCount?: number
}

type DialogStep = 'choose' | 'select-folders' | 'scanning' | 'review' | 'importing' | 'results'

const MAX_CONCURRENCY = 5

// --- Component ---

interface BulkImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSingleImport: () => void // Delegate to existing ImportWizardDialog
  onYouTubeImport?: () => void // Delegate to YouTubeImportDialog (E28-S05)
}

export function BulkImportDialog({
  open,
  onOpenChange,
  onSingleImport,
  onYouTubeImport,
}: BulkImportDialogProps) {
  const [step, setStep] = useState<DialogStep>('choose')
  const [folders, setFolders] = useState<FolderEntry[]>([])
  const [importItems, setImportItems] = useState<ImportItem[]>([])
  const [isLoadingFolders, setIsLoadingFolders] = useState(false)
  const [parentAuthorId, setParentAuthorId] = useState<string | null>(null)
  const [scannedCourses, setScannedCourses] = useState<Map<string, ScannedCourse>>(new Map())
  const [courseOverrides, setCourseOverrides] = useState<
    Map<string, { name?: string; description?: string; coverImageHandle?: FileSystemFileHandle }>
  >(new Map())
  const [expandedCourseId, setExpandedCourseId] = useState<string | null>(null)
  const [coverPreviewUrls, setCoverPreviewUrls] = useState<Map<string, Map<string, string>>>(
    new Map()
  )
  const abortRef = useRef(false)

  // Sync dialog open state with progress store so overlay hides while dialog is showing progress
  useEffect(() => {
    if (open && (step === 'scanning' || step === 'importing' || step === 'results')) {
      useImportProgressStore.getState().setDialogOpen(true)
    }
    return () => {
      useImportProgressStore.getState().setDialogOpen(false)
    }
  }, [open, step])

  const resetDialog = useCallback(() => {
    setStep('choose')
    setFolders([])
    setImportItems([])
    setIsLoadingFolders(false)
    setParentAuthorId(null)
    setScannedCourses(new Map())
    setCourseOverrides(new Map())
    setExpandedCourseId(null)
    // Revoke object URLs to prevent memory leaks
    for (const urls of coverPreviewUrls.values()) {
      for (const url of urls.values()) {
        URL.revokeObjectURL(url)
      }
    }
    setCoverPreviewUrls(new Map())
    abortRef.current = false
  }, [coverPreviewUrls])

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        resetDialog()
      }
      onOpenChange(nextOpen)
    },
    [onOpenChange, resetDialog]
  )

  const handleSingleImport = useCallback(() => {
    handleOpenChange(false)
    onSingleImport()
  }, [handleOpenChange, onSingleImport])

  const handleYouTubeImport = useCallback(() => {
    handleOpenChange(false)
    onYouTubeImport?.()
  }, [handleOpenChange, onYouTubeImport])

  // Step 1 → Step 2: Pick parent folder and list sub-dirs
  const handleSelectParentFolder = useCallback(async () => {
    setIsLoadingFolders(true)
    try {
      const parentHandle = await showDirectoryPicker()
      const subDirs = await listSubDirectories(parentHandle)

      if (subDirs.length === 0) {
        toast.error('No sub-folders found. Select a parent folder that contains course folders.')
        setIsLoadingFolders(false)
        return
      }

      // Detect author from parent folder name (e.g., "Chase Hughes - The Operative Kit")
      const detectedAuthorName = detectAuthorFromFolderName(parentHandle.name)
      if (detectedAuthorName) {
        try {
          const authorId = await matchOrCreateAuthor(detectedAuthorName)
          setParentAuthorId(authorId)
        } catch {
          // silent-catch-ok: author detection is non-critical — continue without it
        }
      }

      setFolders(
        subDirs.map(handle => ({
          handle,
          name: handle.name,
          selected: true,
        }))
      )
      setStep('select-folders')
    } catch (error) {
      if (error instanceof Error && error.message.includes('cancelled')) {
        // User cancelled — stay on choose step
      } else {
        toast.error('Failed to read the selected folder. Please try again.')
        console.error('[BulkImport] Failed to list sub-directories:', error)
      }
    } finally {
      setIsLoadingFolders(false)
    }
  }, [])

  const handleToggleFolder = useCallback((index: number) => {
    setFolders(prev => prev.map((f, i) => (i === index ? { ...f, selected: !f.selected } : f)))
  }, [])

  const handleSelectAll = useCallback(() => {
    setFolders(prev => {
      const allSelected = prev.every(f => f.selected)
      return prev.map(f => ({ ...f, selected: !allSelected }))
    })
  }, [])

  const selectedCount = folders.filter(f => f.selected).length

  // Step 2 → Scan → Review: Scan selected folders concurrently, then show review step
  const handleScanFolders = useCallback(async () => {
    const selectedFolders = folders.filter(f => f.selected)
    if (selectedFolders.length === 0) return

    abortRef.current = false
    setStep('scanning')

    const scanItems: ImportItem[] = selectedFolders.map(f => ({
      folderName: f.name,
      handle: f.handle,
      status: 'pending' as const,
    }))
    setImportItems(scanItems)

    const results: ImportItem[] = [...scanItems]
    const scanned = new Map<string, ScannedCourse>()

    function updateItem(folderName: string, update: Partial<ImportItem>) {
      const idx = results.findIndex(r => r.folderName === folderName)
      if (idx >= 0) {
        results[idx] = { ...results[idx], ...update }
        setImportItems([...results])
      }
    }

    async function scanFolder(item: ImportItem) {
      if (abortRef.current) return
      updateItem(item.folderName, { status: 'scanning' })

      const scanResult: BulkScanResult = await scanCourseFolderFromHandle(item.handle)

      if (abortRef.current) {
        updateItem(item.folderName, { status: 'error', error: 'Cancelled' })
        return
      }

      if (scanResult.status === 'no-files') {
        updateItem(item.folderName, { status: 'no-files' })
        return
      }
      if (scanResult.status === 'duplicate') {
        updateItem(item.folderName, { status: 'duplicate', error: 'Already imported' })
        return
      }
      if (scanResult.status === 'error') {
        updateItem(item.folderName, { status: 'error', error: scanResult.message })
        return
      }

      scanned.set(scanResult.course.id, scanResult.course)
      updateItem(item.folderName, {
        status: 'success',
        scannedCourse: scanResult.course,
        videoCount: scanResult.course.videos.length,
        pdfCount: scanResult.course.pdfs.length,
      })

      // Load image previews for cover selection
      if (scanResult.course.images.length > 0) {
        const urls = new Map<string, string>()
        for (const img of scanResult.course.images.slice(0, 8)) {
          try {
            const file = await img.fileHandle.getFile()
            urls.set(img.path, URL.createObjectURL(file))
          } catch {
            // silent-catch-ok: image preview is optional, skip on error
          }
        }
        if (urls.size > 0) {
          setCoverPreviewUrls(prev => new Map(prev).set(scanResult.course.id, urls))
        }
      }
    }

    // Concurrent scanning
    const running: Promise<void>[] = []
    let queueIndex = 0
    while (queueIndex < scanItems.length && !abortRef.current) {
      while (running.length < MAX_CONCURRENCY && queueIndex < scanItems.length) {
        const item = scanItems[queueIndex++]
        const promise = scanFolder(item).then(() => {
          running.splice(running.indexOf(promise), 1)
        })
        running.push(promise)
      }
      if (running.length > 0) await Promise.race(running)
    }
    await Promise.all(running)

    setScannedCourses(scanned)

    if (scanned.size > 0) {
      setStep('review')
    } else {
      toast.error('No folders could be scanned. Check the results for details.')
      setStep('results')
    }
  }, [folders])

  // Update course override
  const handleCourseOverride = useCallback(
    (courseId: string, field: 'name' | 'description', value: string) => {
      setCourseOverrides(prev => {
        const next = new Map(prev)
        const existing = next.get(courseId) ?? {}
        next.set(courseId, { ...existing, [field]: value })
        return next
      })
    },
    []
  )

  // Select cover image for a course
  const handleSelectCover = useCallback(
    (courseId: string, image: { path: string; fileHandle: FileSystemFileHandle }) => {
      setCourseOverrides(prev => {
        const next = new Map(prev)
        const existing = next.get(courseId) ?? {}
        next.set(courseId, { ...existing, coverImageHandle: image.fileHandle })
        return next
      })
    },
    []
  )

  // Review → Importing: Persist all scanned courses with overrides
  const handleConfirmImport = useCallback(async () => {
    const courses = [...scannedCourses.values()]
    if (courses.length === 0) return

    abortRef.current = false
    const progressStore = useImportProgressStore.getState()

    const items: ImportItem[] = courses.map(c => ({
      folderName: c.name,
      handle: c.directoryHandle,
      status: 'pending' as const,
      scannedCourse: c,
      videoCount: c.videos.length,
      pdfCount: c.pdfs.length,
    }))
    setImportItems(items)
    setStep('importing')

    for (const item of items) {
      progressStore.startImport(item.folderName, item.folderName)
    }

    const results: ImportItem[] = [...items]

    function updateItem(folderName: string, update: Partial<ImportItem>) {
      const idx = results.findIndex(r => r.folderName === folderName)
      if (idx >= 0) {
        results[idx] = { ...results[idx], ...update }
        setImportItems([...results])
      }
    }

    async function persistCourse(item: ImportItem) {
      if (abortRef.current || useImportProgressStore.getState().cancelRequested) return
      if (!item.scannedCourse) return

      updateItem(item.folderName, { status: 'importing' })
      const totalFiles = (item.videoCount ?? 0) + (item.pdfCount ?? 0)
      progressStore.updateProcessingProgress(item.folderName, totalFiles, totalFiles)

      try {
        const courseOverride = courseOverrides.get(item.scannedCourse.id)
        const overrides: Record<string, unknown> = { skipStoreUpdate: true }
        if (parentAuthorId) overrides.authorId = parentAuthorId
        if (courseOverride?.name) overrides.name = courseOverride.name
        if (courseOverride?.description) overrides.description = courseOverride.description
        if (courseOverride?.coverImageHandle)
          overrides.coverImageHandle = courseOverride.coverImageHandle

        await persistScannedCourse(item.scannedCourse, overrides)
        updateItem(item.folderName, { status: 'success' })
        progressStore.completeCourse(item.folderName)
      } catch {
        // silent-catch-ok: persistScannedCourse already shows error toasts
        updateItem(item.folderName, { status: 'error', error: 'Failed to import' })
        progressStore.failCourse(item.folderName, 'Failed to import')
      }
    }

    // Concurrent persist
    const running: Promise<void>[] = []
    let queueIndex = 0
    while (
      queueIndex < items.length &&
      !abortRef.current &&
      !useImportProgressStore.getState().cancelRequested
    ) {
      while (running.length < MAX_CONCURRENCY && queueIndex < items.length) {
        const item = items[queueIndex++]
        const promise = persistCourse(item).then(() => {
          running.splice(running.indexOf(promise), 1)
        })
        running.push(promise)
      }
      if (running.length > 0) await Promise.race(running)
    }

    if (useImportProgressStore.getState().cancelRequested) {
      abortRef.current = true
      for (const item of results) {
        if (item.status === 'pending') {
          updateItem(item.folderName, { status: 'error', error: 'Cancelled' })
          progressStore.failCourse(item.folderName, 'Cancelled')
        }
      }
      useImportProgressStore.getState().confirmCancellation()
    }

    await Promise.all(running)
    await useCourseImportStore.getState().loadImportedCourses()

    const successCount = results.filter(r => r.status === 'success').length
    const noFilesCount = results.filter(r => r.status === 'no-files').length
    const errorCount = results.filter(r => r.status === 'error').length
    const duplicateCount = results.filter(r => r.status === 'duplicate').length
    const totalAttempted = results.length

    if (successCount === totalAttempted) {
      toast.success(`All ${successCount} courses imported successfully!`)
    } else if (successCount > 0) {
      const issues: string[] = []
      if (noFilesCount > 0) issues.push(`${noFilesCount} had no supported files`)
      if (errorCount > 0) issues.push(`${errorCount} failed`)
      if (duplicateCount > 0) issues.push(`${duplicateCount} already imported`)
      toast.warning(`${successCount} of ${totalAttempted} folders imported. ${issues.join(', ')}.`)
    } else {
      toast.error('No folders were imported. Check the results for details.')
    }

    setStep('results')
  }, [scannedCourses, courseOverrides, parentAuthorId])

  // Retry a single failed item
  const handleRetry = useCallback(
    async (folderName: string) => {
      setImportItems(prev => {
        const items = [...prev]
        const idx = items.findIndex(i => i.folderName === folderName)
        if (idx >= 0) {
          items[idx] = { ...items[idx], status: 'scanning', error: undefined }
        }
        return items
      })

      const item = importItems.find(i => i.folderName === folderName)
      if (!item) return

      const scanResult = await scanCourseFolderFromHandle(item.handle)

      if (scanResult.status !== 'success') {
        setImportItems(prev =>
          prev.map(i =>
            i.folderName === folderName
              ? {
                  ...i,
                  status: scanResult.status === 'no-files' ? 'no-files' : 'error',
                  error:
                    scanResult.status === 'error'
                      ? scanResult.message
                      : scanResult.status === 'duplicate'
                        ? 'Already imported'
                        : undefined,
                }
              : i
          )
        )
        return
      }

      setImportItems(prev =>
        prev.map(i =>
          i.folderName === folderName
            ? {
                ...i,
                status: 'importing' as const,
                scannedCourse: scanResult.course,
                videoCount: scanResult.course.videos.length,
                pdfCount: scanResult.course.pdfs.length,
              }
            : i
        )
      )

      try {
        const overrides = parentAuthorId
          ? { authorId: parentAuthorId, skipStoreUpdate: true }
          : { skipStoreUpdate: true }
        await persistScannedCourse(scanResult.course, overrides)
        await useCourseImportStore.getState().loadImportedCourses()
        setImportItems(prev =>
          prev.map(i => (i.folderName === folderName ? { ...i, status: 'success' } : i))
        )
        toast.success(`Imported: ${folderName}`)
      } catch {
        // silent-catch-ok: persistScannedCourse already shows error toasts, we just update item status
        setImportItems(prev =>
          prev.map(i =>
            i.folderName === folderName
              ? {
                  ...i,
                  status: 'error',
                  error: 'Failed to import',
                }
              : i
          )
        )
      }
    },
    [importItems, parentAuthorId]
  )

  // Progress calculation
  const completedItems = importItems.filter(
    i =>
      i.status === 'success' ||
      i.status === 'error' ||
      i.status === 'no-files' ||
      i.status === 'duplicate'
  ).length
  const progressPercent =
    importItems.length > 0 ? Math.round((completedItems / importItems.length) * 100) : 0
  const isStillImporting = step === 'importing' && completedItems < importItems.length

  // Results summary
  const successItems = importItems.filter(i => i.status === 'success')
  const failedItems = importItems.filter(i => i.status === 'error')
  const noFilesItems = importItems.filter(i => i.status === 'no-files')
  const duplicateItems = importItems.filter(i => i.status === 'duplicate')

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-lg"
        data-testid="bulk-import-dialog"
        aria-describedby="bulk-import-description"
      >
        <DialogHeader>
          <DialogTitle>
            {step === 'choose' && 'Import Courses'}
            {step === 'select-folders' && 'Select Course Folders'}
            {step === 'scanning' && 'Scanning Folders'}
            {step === 'review' && 'Review Courses'}
            {step === 'importing' && 'Importing Courses'}
            {step === 'results' && 'Import Complete'}
          </DialogTitle>
          <DialogDescription id="bulk-import-description">
            {step === 'choose' && 'Choose how you want to import your courses.'}
            {step === 'select-folders' &&
              `Found ${folders.length} sub-folders. Select which ones to import.`}
            {step === 'scanning' && `Scanning ${importItems.length} folders for content...`}
            {step === 'review' &&
              `${scannedCourses.size} courses ready. Edit details before importing.`}
            {step === 'importing' && `Importing ${importItems.length} courses...`}
            {step === 'results' &&
              `${successItems.length} of ${importItems.length} courses imported.`}
          </DialogDescription>
        </DialogHeader>

        {/* Step: Choose import mode */}
        {step === 'choose' && (
          <div className="flex flex-col gap-3 py-4">
            <button
              type="button"
              onClick={handleSingleImport}
              className="flex items-center gap-4 rounded-xl border border-border p-4 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              data-testid="import-single-btn"
            >
              <div className="flex items-center justify-center size-12 rounded-full bg-brand-soft shrink-0">
                <FolderOpen className="size-6 text-brand-soft-foreground" aria-hidden="true" />
              </div>
              <div>
                <p className="font-medium text-foreground">Import Single Folder</p>
                <p className="text-sm text-muted-foreground">
                  Select a folder to import as one course (includes all sub-folders)
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={handleSelectParentFolder}
              disabled={isLoadingFolders}
              className="flex items-center gap-4 rounded-xl border border-border p-4 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:opacity-50"
              data-testid="import-multiple-btn"
            >
              <div className="flex items-center justify-center size-12 rounded-full bg-brand-soft shrink-0">
                {isLoadingFolders ? (
                  <Loader2
                    className="size-6 text-brand-soft-foreground animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <Folders className="size-6 text-brand-soft-foreground" aria-hidden="true" />
                )}
              </div>
              <div>
                <p className="font-medium text-foreground">Import Multiple Folders</p>
                <p className="text-sm text-muted-foreground">
                  Select a parent folder — each sub-folder becomes a separate course
                </p>
              </div>
            </button>

            {onYouTubeImport && (
              <button
                type="button"
                onClick={handleYouTubeImport}
                className="flex items-center gap-4 rounded-xl border border-border p-4 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                data-testid="import-youtube-btn"
              >
                <div className="flex items-center justify-center size-12 rounded-full bg-brand-soft shrink-0">
                  <Youtube className="size-6 text-brand-soft-foreground" aria-hidden="true" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Build from YouTube</p>
                  <p className="text-sm text-muted-foreground">
                    Create a course from YouTube videos or playlists
                  </p>
                </div>
              </button>
            )}
          </div>
        )}

        {/* Step: Select sub-folders */}
        {step === 'select-folders' && (
          <>
            <div className="flex items-center justify-between py-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSelectAll}
                className="text-xs"
                data-testid="bulk-select-all"
              >
                {folders.every(f => f.selected) ? 'Deselect All' : 'Select All'}
              </Button>
              <span className="text-sm text-muted-foreground" data-testid="bulk-selected-count">
                {selectedCount} of {folders.length} selected
              </span>
            </div>

            <ScrollArea className="max-h-[40vh]">
              <div className="flex flex-col gap-1 pr-3" role="list" aria-label="Course folders">
                {folders.map((folder, index) => (
                  <label
                    key={folder.name}
                    className="flex items-center gap-3 rounded-lg px-3 py-2 cursor-pointer hover:bg-accent transition-colors"
                    role="listitem"
                  >
                    <Checkbox
                      checked={folder.selected}
                      onCheckedChange={() => handleToggleFolder(index)}
                      aria-label={`Select ${folder.name}`}
                      data-testid={`bulk-folder-${folder.name}`}
                    />
                    <FolderOpen
                      className="size-4 text-muted-foreground shrink-0"
                      aria-hidden="true"
                    />
                    <span className="text-sm truncate">{folder.name}</span>
                  </label>
                ))}
              </div>
            </ScrollArea>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setStep('choose')}
                className="rounded-xl"
                data-testid="bulk-back-btn"
              >
                Back
              </Button>
              <Button
                variant="brand"
                onClick={handleScanFolders}
                disabled={selectedCount === 0}
                className="rounded-xl"
                data-testid="bulk-start-import-btn"
              >
                Scan {selectedCount} {selectedCount === 1 ? 'Folder' : 'Folders'}
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Step: Scanning folders */}
        {step === 'scanning' && (
          <>
            <div className="py-2">
              <Progress
                value={
                  importItems.length > 0
                    ? Math.round(
                        (importItems.filter(
                          i =>
                            i.status === 'success' ||
                            i.status === 'no-files' ||
                            i.status === 'duplicate' ||
                            i.status === 'error'
                        ).length /
                          importItems.length) *
                          100
                      )
                    : 0
                }
                className="h-2"
                showLabel
                labelFormat={() => {
                  const done = importItems.filter(
                    i =>
                      i.status === 'success' ||
                      i.status === 'no-files' ||
                      i.status === 'duplicate' ||
                      i.status === 'error'
                  ).length
                  return `Scanned ${done} of ${importItems.length}`
                }}
              />
            </div>

            <ScrollArea className="max-h-[40vh]">
              <div className="flex flex-col gap-1 pr-3" role="list" aria-label="Scan progress">
                {importItems.map(item => (
                  <div
                    key={item.folderName}
                    className="flex items-center gap-3 rounded-lg px-3 py-2"
                    role="listitem"
                  >
                    {item.status === 'pending' && (
                      <div className="size-5 rounded-full border-2 border-muted shrink-0" />
                    )}
                    {item.status === 'scanning' && (
                      <Loader2 className="size-5 text-brand animate-spin shrink-0" />
                    )}
                    {item.status === 'success' && (
                      <CheckCircle2 className="size-5 text-success shrink-0" />
                    )}
                    {(item.status === 'no-files' || item.status === 'duplicate') && (
                      <AlertTriangle className="size-5 text-warning shrink-0" />
                    )}
                    {item.status === 'error' && (
                      <XCircle className="size-5 text-destructive shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{item.folderName}</p>
                      {item.status === 'success' && item.videoCount !== undefined && (
                        <p className="text-xs text-muted-foreground flex items-center gap-2">
                          <span className="flex items-center gap-1">
                            <Video className="size-3" /> {item.videoCount} videos
                          </span>
                          <span className="flex items-center gap-1">
                            <FileText className="size-3" /> {item.pdfCount} PDFs
                          </span>
                        </p>
                      )}
                      {item.status === 'no-files' && (
                        <p className="text-xs text-warning">No supported files</p>
                      )}
                      {item.status === 'duplicate' && (
                        <p className="text-xs text-warning">Already imported</p>
                      )}
                      {item.status === 'error' && item.error && (
                        <p className="text-xs text-destructive">{item.error}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </>
        )}

        {/* Step: Review course details before importing */}
        {step === 'review' && (
          <>
            <ScrollArea className="max-h-[50vh]">
              <div className="flex flex-col gap-2 pr-3" data-testid="bulk-review-list">
                {[...scannedCourses.values()].map(course => {
                  const isExpanded = expandedCourseId === course.id
                  const override = courseOverrides.get(course.id)
                  const displayName = override?.name ?? course.name
                  const courseImages = coverPreviewUrls.get(course.id)

                  return (
                    <div
                      key={course.id}
                      className="rounded-xl border border-border overflow-hidden"
                      data-testid={`bulk-review-${course.name}`}
                    >
                      {/* Collapsed header */}
                      <button
                        type="button"
                        onClick={() => setExpandedCourseId(isExpanded ? null : course.id)}
                        className="flex items-center gap-3 w-full px-4 py-3 text-left hover:bg-accent transition-colors"
                      >
                        <FolderOpen
                          className="size-4 text-muted-foreground shrink-0"
                          aria-hidden="true"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{displayName}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-2">
                            <span className="flex items-center gap-1">
                              <Video className="size-3" /> {course.videos.length}
                            </span>
                            <span className="flex items-center gap-1">
                              <FileText className="size-3" /> {course.pdfs.length}
                            </span>
                            {course.images.length > 0 && (
                              <span className="flex items-center gap-1">
                                <ImageIcon className="size-3" /> {course.images.length}
                              </span>
                            )}
                          </p>
                        </div>
                        <Pencil className="size-3.5 text-muted-foreground shrink-0" />
                        {isExpanded ? (
                          <ChevronUp className="size-4 text-muted-foreground shrink-0" />
                        ) : (
                          <ChevronDown className="size-4 text-muted-foreground shrink-0" />
                        )}
                      </button>

                      {/* Expanded edit form */}
                      {isExpanded && (
                        <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
                          <div className="space-y-1.5">
                            <Label htmlFor={`bulk-name-${course.id}`} className="text-xs">
                              Course Name
                            </Label>
                            <Input
                              id={`bulk-name-${course.id}`}
                              value={displayName}
                              onChange={e =>
                                handleCourseOverride(course.id, 'name', e.target.value)
                              }
                              className="h-8 text-sm"
                              data-testid={`bulk-name-input-${course.name}`}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor={`bulk-desc-${course.id}`} className="text-xs">
                              Description
                            </Label>
                            <Textarea
                              id={`bulk-desc-${course.id}`}
                              value={override?.description ?? ''}
                              onChange={e =>
                                handleCourseOverride(course.id, 'description', e.target.value)
                              }
                              placeholder="Optional description"
                              rows={2}
                              className="text-sm resize-none rounded-xl"
                              data-testid={`bulk-desc-input-${course.name}`}
                            />
                          </div>

                          {/* Cover image gallery */}
                          {courseImages && courseImages.size > 0 && (
                            <div className="space-y-1.5">
                              <Label className="text-xs flex items-center gap-1.5">
                                <ImageIcon className="size-3" aria-hidden="true" />
                                Cover Image
                              </Label>
                              <div className="grid grid-cols-4 gap-2">
                                {course.images.slice(0, 8).map(img => {
                                  const url = courseImages.get(img.path)
                                  if (!url) return null
                                  const isSelected = override?.coverImageHandle === img.fileHandle
                                  return (
                                    <button
                                      key={img.path}
                                      type="button"
                                      onClick={() => handleSelectCover(course.id, img)}
                                      className={`relative aspect-video rounded-lg overflow-hidden border-2 transition-colors ${
                                        isSelected
                                          ? 'border-brand ring-1 ring-brand/30'
                                          : 'border-transparent hover:border-border'
                                      }`}
                                    >
                                      <img
                                        src={url}
                                        alt={img.filename}
                                        className="w-full h-full object-cover"
                                      />
                                      {isSelected && (
                                        <div className="absolute inset-0 bg-brand/10 flex items-center justify-center">
                                          <CheckCircle2 className="size-5 text-brand" />
                                        </div>
                                      )}
                                    </button>
                                  )
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </ScrollArea>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setStep('select-folders')}
                className="rounded-xl"
                data-testid="bulk-review-back-btn"
              >
                Back
              </Button>
              <Button
                variant="brand"
                onClick={handleConfirmImport}
                className="rounded-xl"
                data-testid="bulk-confirm-import-btn"
              >
                Import {scannedCourses.size} {scannedCourses.size === 1 ? 'Course' : 'Courses'}
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Step: Importing progress */}
        {(step === 'importing' || step === 'results') && (
          <>
            {isStillImporting && (
              <div className="py-2">
                <Progress
                  value={progressPercent}
                  className="h-2"
                  labelFormat={_v => `${completedItems} of ${importItems.length} complete`}
                  showLabel
                />
              </div>
            )}

            <ScrollArea className="max-h-[40vh]">
              <div className="flex flex-col gap-1 pr-3" role="list" aria-label="Import progress">
                {importItems.map(item => (
                  <div
                    key={item.folderName}
                    className="flex items-center gap-3 rounded-lg px-3 py-2"
                    role="listitem"
                    data-testid={`bulk-item-${item.folderName}`}
                  >
                    {/* Status icon */}
                    {item.status === 'pending' && (
                      <div
                        className="size-5 rounded-full border-2 border-muted shrink-0"
                        aria-label="Pending"
                      />
                    )}
                    {(item.status === 'scanning' || item.status === 'importing') && (
                      <Loader2
                        className="size-5 text-brand animate-spin shrink-0"
                        aria-label="In progress"
                      />
                    )}
                    {item.status === 'success' && (
                      <CheckCircle2 className="size-5 text-success shrink-0" aria-label="Success" />
                    )}
                    {item.status === 'error' && (
                      <XCircle className="size-5 text-destructive shrink-0" aria-label="Error" />
                    )}
                    {item.status === 'no-files' && (
                      <AlertTriangle
                        className="size-5 text-warning shrink-0"
                        aria-label="No supported files"
                      />
                    )}
                    {item.status === 'duplicate' && (
                      <AlertTriangle
                        className="size-5 text-warning shrink-0"
                        aria-label="Duplicate"
                      />
                    )}

                    {/* Folder name + details */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{item.folderName}</p>
                      {item.status === 'success' && item.videoCount !== undefined && (
                        <p className="text-xs text-muted-foreground flex items-center gap-2">
                          <span className="flex items-center gap-1">
                            <Video className="size-3" aria-hidden="true" />
                            {item.videoCount}
                          </span>
                          <span className="flex items-center gap-1">
                            <FileText className="size-3" aria-hidden="true" />
                            {item.pdfCount}
                          </span>
                        </p>
                      )}
                      {item.status === 'no-files' && (
                        <p className="text-xs text-warning">No supported files found</p>
                      )}
                      {item.status === 'duplicate' && (
                        <p className="text-xs text-warning">Already imported</p>
                      )}
                      {item.status === 'error' && item.error && (
                        <p className="text-xs text-destructive">{item.error}</p>
                      )}
                    </div>

                    {/* Retry button for failed items */}
                    {item.status === 'error' && step === 'results' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRetry(item.folderName)}
                        className="shrink-0 min-h-[44px] min-w-[44px]"
                        aria-label={`Retry importing ${item.folderName}`}
                        data-testid={`bulk-retry-${item.folderName}`}
                      >
                        <RotateCcw className="size-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>

            {/* Results summary */}
            {step === 'results' && (
              <>
                <div
                  className="rounded-xl border border-border bg-muted/50 p-3 space-y-1"
                  data-testid="bulk-results-summary"
                >
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                    {successItems.length > 0 && (
                      <span className="flex items-center gap-1.5 text-success">
                        <CheckCircle2 className="size-4" aria-hidden="true" />
                        {successItems.length} imported
                      </span>
                    )}
                    {noFilesItems.length > 0 && (
                      <span className="flex items-center gap-1.5 text-warning">
                        <AlertTriangle className="size-4" aria-hidden="true" />
                        {noFilesItems.length} no files
                      </span>
                    )}
                    {duplicateItems.length > 0 && (
                      <span className="flex items-center gap-1.5 text-warning">
                        <AlertTriangle className="size-4" aria-hidden="true" />
                        {duplicateItems.length} duplicates
                      </span>
                    )}
                    {failedItems.length > 0 && (
                      <span className="flex items-center gap-1.5 text-destructive">
                        <XCircle className="size-4" aria-hidden="true" />
                        {failedItems.length} failed
                      </span>
                    )}
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    variant="brand"
                    onClick={() => handleOpenChange(false)}
                    className="rounded-xl"
                    data-testid="bulk-done-btn"
                  >
                    Done
                  </Button>
                </DialogFooter>
              </>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
