import { useState, useCallback, useRef } from 'react'
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
} from 'lucide-react'
import {
  scanCourseFolderFromHandle,
  listSubDirectories,
  persistScannedCourse,
} from '@/lib/courseImport'
import type { BulkScanResult, ScannedCourse } from '@/lib/courseImport'
import { showDirectoryPicker } from '@/lib/fileSystem'
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

type DialogStep = 'choose' | 'select-folders' | 'importing' | 'results'

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
  const abortRef = useRef(false)

  const resetDialog = useCallback(() => {
    setStep('choose')
    setFolders([])
    setImportItems([])
    setIsLoadingFolders(false)
    abortRef.current = false
  }, [])

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

  // Step 2 → Step 3: Run parallel imports
  const handleStartImport = useCallback(async () => {
    const selectedFolders = folders.filter(f => f.selected)
    if (selectedFolders.length === 0) return

    abortRef.current = false
    const progressStore = useImportProgressStore.getState()

    const items: ImportItem[] = selectedFolders.map(f => ({
      folderName: f.name,
      handle: f.handle,
      status: 'pending' as const,
    }))
    setImportItems(items)
    setStep('importing')

    // Start progress tracking for each course (AC3: bulk import progress)
    for (const item of items) {
      progressStore.startImport(item.folderName, item.folderName)
    }

    // Concurrent import with max concurrency
    const queue = [...items]
    const results: ImportItem[] = [...items]

    function updateItem(folderName: string, update: Partial<ImportItem>) {
      const idx = results.findIndex(r => r.folderName === folderName)
      if (idx >= 0) {
        results[idx] = { ...results[idx], ...update }
        setImportItems([...results])
      }
    }

    async function processFolder(item: ImportItem) {
      if (abortRef.current || useImportProgressStore.getState().cancelRequested) return

      updateItem(item.folderName, { status: 'scanning' })
      progressStore.updateScanProgress(item.folderName, 0, null)

      // Phase 1: Scan
      const scanResult: BulkScanResult = await scanCourseFolderFromHandle(item.handle)

      if (abortRef.current || useImportProgressStore.getState().cancelRequested) {
        updateItem(item.folderName, { status: 'error', error: 'Cancelled' })
        progressStore.failCourse(item.folderName, 'Cancelled')
        return
      }

      if (scanResult.status === 'no-files') {
        updateItem(item.folderName, { status: 'no-files' })
        progressStore.failCourse(item.folderName, 'No supported files')
        return
      }

      if (scanResult.status === 'duplicate') {
        updateItem(item.folderName, { status: 'duplicate', error: 'Already imported' })
        progressStore.failCourse(item.folderName, 'Already imported')
        return
      }

      if (scanResult.status === 'error') {
        updateItem(item.folderName, { status: 'error', error: scanResult.message })
        progressStore.failCourse(item.folderName, scanResult.message)
        return
      }

      // Phase 2: Persist
      updateItem(item.folderName, {
        status: 'importing',
        scannedCourse: scanResult.course,
        videoCount: scanResult.course.videos.length,
        pdfCount: scanResult.course.pdfs.length,
      })
      const totalFiles = scanResult.course.videos.length + scanResult.course.pdfs.length
      progressStore.updateProcessingProgress(item.folderName, totalFiles, totalFiles)

      try {
        await persistScannedCourse(scanResult.course)
        updateItem(item.folderName, { status: 'success' })
        progressStore.completeCourse(item.folderName)
      } catch {
        // silent-catch-ok: persistScannedCourse already shows error toasts, we just update item status
        updateItem(item.folderName, {
          status: 'error',
          error: 'Failed to import',
        })
        progressStore.failCourse(item.folderName, 'Failed to import')
      }
    }

    // Process with concurrency limit
    const running: Promise<void>[] = []
    let queueIndex = 0

    while (
      queueIndex < queue.length &&
      !abortRef.current &&
      !useImportProgressStore.getState().cancelRequested
    ) {
      while (running.length < MAX_CONCURRENCY && queueIndex < queue.length) {
        const item = queue[queueIndex++]
        const promise = processFolder(item).then(() => {
          running.splice(running.indexOf(promise), 1)
        })
        running.push(promise)
      }
      if (running.length > 0) {
        await Promise.race(running)
      }
    }

    // Handle cancellation for remaining items
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

    // Wait for remaining
    await Promise.all(running)

    // Show consolidated toast (AC4)
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
  }, [folders])

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
        await persistScannedCourse(scanResult.course)
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
    [importItems]
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
            {step === 'importing' && 'Importing Courses'}
            {step === 'results' && 'Import Complete'}
          </DialogTitle>
          <DialogDescription id="bulk-import-description">
            {step === 'choose' && 'Choose how you want to import your courses.'}
            {step === 'select-folders' &&
              `Found ${folders.length} sub-folders. Select which ones to import.`}
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
              className="flex items-center gap-4 rounded-xl border border-border p-4 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              data-testid="import-single-btn"
            >
              <div className="flex items-center justify-center size-12 rounded-full bg-brand-soft shrink-0">
                <FolderOpen className="size-6 text-brand-soft-foreground" aria-hidden="true" />
              </div>
              <div>
                <p className="font-medium text-foreground">Import Single Folder</p>
                <p className="text-sm text-muted-foreground">
                  Select one course folder with guided setup
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={handleSelectParentFolder}
              disabled={isLoadingFolders}
              className="flex items-center gap-4 rounded-xl border border-border p-4 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
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
                  Select a parent folder and import multiple courses at once
                </p>
              </div>
            </button>

            {onYouTubeImport && (
              <button
                type="button"
                onClick={handleYouTubeImport}
                className="flex items-center gap-4 rounded-xl border border-border p-4 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                onClick={handleStartImport}
                disabled={selectedCount === 0}
                className="rounded-xl"
                data-testid="bulk-start-import-btn"
              >
                Import {selectedCount} {selectedCount === 1 ? 'Folder' : 'Folders'}
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
