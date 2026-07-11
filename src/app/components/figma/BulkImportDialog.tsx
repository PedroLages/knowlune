/**
 * BulkImportDialog — batch import of multiple courses from a parent folder or server URL.
 *
 * NOTE: This component is 1487 lines long. For future maintainability, consider extracting:
 * - Step content (choose/enter-url/select-folders/scanning/review/importing/results) into sub-components
 * - The scan/persist loop into a custom hook
 * - Folder selection UI into a shared component
 */
import { useState, useCallback, useRef, useEffect } from 'react'
import { useStableCallback } from '@/app/hooks/useStableCallback'
import {
  Dialog,
  DialogClose,
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
  Globe,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Check,
  FileX,
  Image as ImageIcon,
  Pencil,
  X,
} from 'lucide-react'
import {
  scanCourseFromSource,
  listSubDirectories,
  listServerTrackRoot,
  collectLocalTrackCoverCandidates,
  applyImportedTrackCover,
  persistScannedCourse,
} from '@/lib/courseImport'
import type { ScannedCourse, BulkScanResult, TrackCoverCandidate } from '@/lib/courseImport'
import { isValidImportUrl } from '@/lib/courseServerService'
import {
  readTrackManifest,
  fetchTrackManifestFromUrl,
  batchImportTrackCourses,
} from '@/lib/trackManifestImport'
import type { TrackManifest } from '@/lib/courseManifest'
import { showDirectoryPicker } from '@/lib/fileSystem'
import { detectAuthorFromFolderName, matchOrCreateAuthor } from '@/lib/authorDetection'
import { useCourseImportStore } from '@/stores/useCourseImportStore'
import { useLearningPathStore } from '@/stores/useLearningPathStore'
import { useImportProgressStore } from '@/stores/useImportProgressStore'
import { toast } from 'sonner'

// --- Types ---

interface FolderEntry {
  handle: FileSystemDirectoryHandle | null
  name: string
  selected: boolean
  serverUrl?: string
}

type ImportItemStatus =
  | 'pending'
  | 'scanning'
  | 'importing'
  | 'success'
  | 'no-files'
  | 'error'
  | 'duplicate'
  | 'truncated'

interface ImportItem {
  folderName: string
  handle: FileSystemDirectoryHandle | null
  status: ImportItemStatus
  error?: string
  scannedCourse?: ScannedCourse
  videoCount?: number
  pdfCount?: number
  serverUrl?: string
  truncated?: boolean
}

type DialogStep =
  | 'choose'
  | 'enter-url'
  | 'select-folders'
  | 'scanning'
  | 'review'
  | 'importing'
  | 'results'

const MAX_CONCURRENCY = 5

/**
 * Auto-selection logic for track covers.
 *
 * Priority:
 * 1. Manifest-defined coverImage → auto-select as 'manifest'
 * 2. Single discovered root image → auto-select as 'automatic'
 * 3. Multiple candidates → leave unselected (user chooses in review step)
 * 4. Zero candidates → leave unselected (gradient fallback)
 */
function resolveTrackCoverAutoSelection(
  candidates: TrackCoverCandidate[],
  manifestCoverImage?: string
): { selectedId: string; source: 'automatic' | 'manifest' } | null {
  if (manifestCoverImage) {
    const manifestCandidate = candidates.find(c => c.source === 'manifest')
    if (manifestCandidate) {
      return { selectedId: manifestCandidate.id, source: 'manifest' }
    }
  }
  if (candidates.length === 1) {
    return { selectedId: candidates[0].id, source: 'automatic' }
  }
  return null
}

/**
 * Shared helper: updates an ImportItem in a results array by folderName and pushes the new
 * array to React state. Used by both handleScanFolders and handleConfirmImport to avoid
 * duplicating the find-and-replace logic.
 */
function updateItemInList(
  results: ImportItem[],
  folderName: string,
  update: Partial<ImportItem>,
  setter: React.Dispatch<React.SetStateAction<ImportItem[]>>
): void {
  // IMPORTANT: Must mutate the shared results array AND trigger a React state
  // update. Concurrent callbacks within the same parent handler share a local
  // `results` array (e.g. `handleScanFolders` and `handleConfirmImport` both
  // create `const results = [...items]` and pass it by reference). Each
  // callback's mutation is read by subsequent callbacks via the shared array.
  // A pure map-only approach would leave the original array untouched, causing
  // stale-closure overwrites between concurrent persistCourse calls — the
  // last callback to call setImportItems would overwrite the previous
  // callback's changes with stale data from the unmutated original array.
  const idx = results.findIndex(r => r.folderName === folderName)
  if (idx >= 0) {
    results[idx] = { ...results[idx], ...update }
    setter([...results])
  }
}

/**
 * Shared helper: runs an async function over an array of items with bounded concurrency.
 * The callback receives each item; errors are not caught here so the caller can handle
 * them per-item.
 */
async function runWithConcurrency<T>(
  items: T[],
  fn: (item: T) => Promise<void>,
  maxConcurrency: number,
  abortSignal: { current: boolean }
): Promise<void> {
  const running: Promise<void>[] = []
  let queueIndex = 0
  let settledCount = 0
  const totalItems = items.length

  while (queueIndex < totalItems && !abortSignal.current && settledCount < totalItems) {
    while (
      running.length < maxConcurrency &&
      queueIndex < totalItems &&
      settledCount < totalItems
    ) {
      const item = items[queueIndex++]
      const promise = fn(item).finally(() => {
        const idx = running.indexOf(promise)
        if (idx >= 0) running.splice(idx, 1)
        settledCount++
      })
      running.push(promise)
    }
    if (running.length > 0) await Promise.race(running)
  }
  await Promise.all(running)
}

// --- Component ---

interface BulkImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSingleImport: () => void // Delegate to existing ImportWizardDialog
  onYouTubeImport?: () => void // Delegate to YouTubeImportDialog (E28-S05)
  /** Called when batch import completes, with IDs of successfully imported courses and optional trackId */
  onComplete?: (courseIds: string[], trackId?: string) => void
}

export function BulkImportDialog({
  open,
  onOpenChange,
  onSingleImport,
  onYouTubeImport,
  onComplete: onCompleteProp,
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
  // URL batch import state
  const [serverUrlInput, setServerUrlInput] = useState('')
  const [serverUrlError, setServerUrlError] = useState<string | null>(null)
  const [isScanningUrl, setIsScanningUrl] = useState(false)

  // Track-cover detection state
  const [trackCoverCandidates, setTrackCoverCandidates] = useState<TrackCoverCandidate[]>([])
  const [selectedTrackCoverId, setSelectedTrackCoverId] = useState<string | null>(null)
  const [trackCoverSelectionSource, setTrackCoverSelectionSource] = useState<
    'automatic' | 'manifest' | 'manual' | null
  >(null)
  // Track cover result feedback shown in the results step
  const [trackCoverResult, setTrackCoverResult] = useState<string | null>(null)
  // Server URL preserved for cover persistence after track creation
  const serverUrlRef = useRef<string | null>(null)

  const abortRef = useRef(false)
  const stepRef = useRef<DialogStep>('choose')
  const completedSuccessfullyRef = useRef(false)
  const parentHandleRef = useRef<FileSystemDirectoryHandle | null>(null)
  const batchResultRef = useRef<{ trackId?: string; courseIds: string[] } | null>(null)
  const generationRef = useRef(0)
  const batchAbortRef = useRef<AbortController | null>(null)
  const isScanningUrlRef = useRef(false)
  const retryLockRef = useRef(false)
  const originalCourseIdMapRef = useRef<Map<string, string>>(new Map())

  // Track manifest data for rendering the review-step header and for batch import
  const [trackManifest, setTrackManifest] = useState<{
    manifest: TrackManifest
    trackName: string
  } | null>(null)
  const hasManifest = trackManifest !== null

  // Track when the dialog actually transitions through the results step,
  // so onComplete only fires when the import flow genuinely completed.
  useEffect(() => {
    stepRef.current = step
    if (step === 'results') {
      completedSuccessfullyRef.current = true
    }
  }, [step])

  // useStableCallback avoids stale closure issues with the onComplete prop
  const onComplete = useStableCallback(onCompleteProp ?? (() => {}))

  // Synchronize the URL scanning state ref so the onKeyDown handler is not stale-closed over the state
  useEffect(() => {
    isScanningUrlRef.current = isScanningUrl
  }, [isScanningUrl])

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
    setServerUrlInput('')
    setServerUrlError(null)
    setIsScanningUrl(false)
    // Revoke track-cover object URLs (local file previews)
    for (const c of trackCoverCandidates) {
      if (c.source === 'local' && c.previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(c.previewUrl)
      }
    }
    setTrackCoverCandidates([])
    setSelectedTrackCoverId(null)
    setTrackCoverSelectionSource(null)
    setTrackCoverResult(null)
    serverUrlRef.current = null
    // Note: abortRef is NOT reset here — it's managed by the calling context
    // (handleOpenChange sets it to true before calling resetDialog, and each
    // async handler resets it to false at its own start.)
    completedSuccessfullyRef.current = false
    truncationWarnedRef.current = false
    parentHandleRef.current = null
    batchResultRef.current = null
    originalCourseIdMapRef.current = new Map()
    setTrackManifest(null)
  }, [coverPreviewUrls])

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        // Fire onComplete only when the dialog actually transitioned through the results step
        // (avoiding false positives if the dialog is closed externally)
        if (completedSuccessfullyRef.current) {
          const batchResult = batchResultRef.current
          let ids: string[]
          let trackId: string | undefined
          if (batchResult) {
            ids = batchResult.courseIds
            trackId = batchResult.trackId
          } else {
            ids = importItems
              .filter(i => i.status === 'success' || i.status === 'truncated')
              .map(i => i.scannedCourse?.id)
              .filter((id): id is string => !!id)
          }
          if (ids.length > 0) {
            onComplete(ids, trackId)
          }
        }
        abortRef.current = true // Signal cancellation to in-flight async ops before resetting state
        batchAbortRef.current?.abort()
        batchAbortRef.current = null
        resetDialog()
      }
      onOpenChange(nextOpen)
    },
    [onOpenChange, resetDialog, importItems]
  )

  const handleSingleImport = useCallback(() => {
    handleOpenChange(false)
    onSingleImport()
  }, [handleOpenChange, onSingleImport])

  const handleYouTubeImport = useCallback(() => {
    handleOpenChange(false)
    onYouTubeImport?.()
  }, [handleOpenChange, onYouTubeImport])

  // Step 1 → Enter URL: Scan a server URL for subdirectories and track-cover images
  const handleServerUrlScan = useCallback(async () => {
    generationRef.current++
    abortRef.current = false
    const url = serverUrlInput.trim()

    // Clear stale parent handle — server-URL scans never have a filesystem handle
    parentHandleRef.current = null

    // Validate URL before any network call
    const validation = isValidImportUrl(url)
    if (!validation.valid) {
      setServerUrlError(validation.reason)
      return
    }

    isScanningUrlRef.current = true
    setServerUrlError(null)
    setIsScanningUrl(true)

    // Preserve server URL for cover persistence after track creation
    serverUrlRef.current = url

    try {
      // Use listServerTrackRoot to get both directories AND root-level images in one request
      const result = await listServerTrackRoot(url)
      if (abortRef.current || stepRef.current !== 'enter-url') return

      if (!result.ok) {
        setServerUrlError(result.error)
        return
      }

      const { directories, images } = result.data

      if (directories.length === 0) {
        setServerUrlError(
          'No course folders found at this URL. Check that the server exposes subdirectories via nginx autoindex.'
        )
        return
      }

      // Build track-cover candidates from server root images
      const serverCandidates: TrackCoverCandidate[] = images.map(img => ({
        id: crypto.randomUUID(),
        filename: img.name,
        source: 'server' as const,
        previewUrl: img.url,
        serverUrl: img.url,
      }))
      setTrackCoverCandidates(serverCandidates)

      // Attempt track-manifest detection for folder sorting and manifest coverImage
      const manifestResult = await fetchTrackManifestFromUrl(url)
      if (abortRef.current || stepRef.current !== 'enter-url') return

      if (manifestResult.ok) {
        const positionByFolder = new Map(
          manifestResult.manifest.track.courses.map(c => [c.folder, c.position])
        )
        directories.sort((a, b) => {
          const posA = positionByFolder.get(a.name) ?? Infinity
          const posB = positionByFolder.get(b.name) ?? Infinity
          return posA - posB
        })
        setTrackManifest({
          manifest: manifestResult.manifest,
          trackName: manifestResult.summary.trackName,
        })

        // Apply manifest-defined cover image if present (takes priority over discovered images)
        const manifestCoverImage = manifestResult.summary.trackCoverImage
        if (manifestCoverImage) {
          const manifestUrl = new URL(manifestCoverImage, url.endsWith('/') ? url : url + '/').href
          const manifestCandidate: TrackCoverCandidate = {
            id: `manifest-cover`,
            filename: manifestCoverImage,
            source: 'manifest',
            previewUrl: manifestUrl,
            serverUrl: manifestUrl,
          }
          // Prepend manifest cover so it appears first; it will be auto-selected below
          setTrackCoverCandidates(prev => [manifestCandidate, ...prev])
        }

        // Auto-select track cover using priority: manifest > single discovered image
        const allCandidates = manifestCoverImage
          ? [
              {
                id: 'manifest-cover',
                filename: manifestCoverImage,
                source: 'manifest' as const,
                previewUrl: new URL(manifestCoverImage, url.endsWith('/') ? url : url + '/').href,
                serverUrl: new URL(manifestCoverImage, url.endsWith('/') ? url : url + '/').href,
              },
              ...serverCandidates,
            ]
          : serverCandidates

        const autoSelection = resolveTrackCoverAutoSelection(allCandidates, manifestCoverImage)
        if (autoSelection) {
          setSelectedTrackCoverId(autoSelection.selectedId)
          setTrackCoverSelectionSource(autoSelection.source)
        } else if (allCandidates.length > 1) {
          // Multiple candidates — leave unselected, user picks in review step
          setSelectedTrackCoverId(null)
          setTrackCoverSelectionSource(null)
        } else {
          // Zero candidates — gradient fallback
          setSelectedTrackCoverId(null)
          setTrackCoverSelectionSource(null)
        }
      } else {
        setTrackManifest(null)
        // Auto-select from server-discovered images only (no manifest)
        const autoSelection = resolveTrackCoverAutoSelection(serverCandidates)
        if (autoSelection) {
          setSelectedTrackCoverId(autoSelection.selectedId)
          setTrackCoverSelectionSource(autoSelection.source)
        } else {
          setSelectedTrackCoverId(null)
          setTrackCoverSelectionSource(null)
        }
      }

      // Populate folders from server-discovered subdirectories
      setFolders(
        directories.map(d => ({
          handle: null,
          name: d.name,
          selected: true,
          serverUrl: d.url,
        }))
      )
      setStep('select-folders')
    } catch (error) {
      // Don't surface errors after cancellation — dialog may already be closed
      if (!abortRef.current) {
        const msg = error instanceof Error ? error.message : 'Failed to scan server URL'
        setServerUrlError(msg)
      }
    } finally {
      setIsScanningUrl(false)
    }
  }, [serverUrlInput])

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

      // Reorder sub-directories by track-manifest.json positions if a manifest exists
      const manifestResult = await readTrackManifest(parentHandle)
      if (manifestResult.ok) {
        const positionByFolder = new Map(
          manifestResult.manifest.track.courses.map(c => [c.folder, c.position])
        )
        subDirs.sort((a, b) => {
          const posA = positionByFolder.get(a.name) ?? Infinity
          const posB = positionByFolder.get(b.name) ?? Infinity
          return posA - posB
        })

        // Store handle and manifest for batch import
        parentHandleRef.current = parentHandle
        setTrackManifest({
          manifest: manifestResult.manifest,
          trackName: manifestResult.summary.trackName,
        })

        // Collect root-level images for track-cover detection
        const localCandidates = await collectLocalTrackCoverCandidates(parentHandle)
        const manifestCoverImage = manifestResult.summary.trackCoverImage

        // If manifest defines a coverImage, prepend it as a manifest-sourced candidate
        if (manifestCoverImage && localCandidates.some(c => c.filename === manifestCoverImage)) {
          // Manifest references a local file that was already collected — re-tag it
          const allCandidates = localCandidates.map(c =>
            c.filename === manifestCoverImage ? { ...c, source: 'manifest' as const } : c
          )
          // Move the manifest one to the front
          const manifestIdx = allCandidates.findIndex(c => c.source === 'manifest')
          if (manifestIdx > 0) {
            const [manifest] = allCandidates.splice(manifestIdx, 1)
            allCandidates.unshift(manifest)
          }
          setTrackCoverCandidates(allCandidates)

          const autoSelection = resolveTrackCoverAutoSelection(allCandidates, manifestCoverImage)
          if (autoSelection) {
            setSelectedTrackCoverId(autoSelection.selectedId)
            setTrackCoverSelectionSource(autoSelection.source)
          }
        } else if (manifestCoverImage) {
          // Manifest coverImage references a file not found in root — still register it
          // as a candidate so the user can see it referenced (persistence will attempt fetch)
          const manifestCandidate: TrackCoverCandidate = {
            id: 'manifest-cover',
            filename: manifestCoverImage,
            source: 'manifest',
            previewUrl: '', // No local preview; will be fetched from disk during persistence
            fileHandle: undefined,
          }
          const allCandidates = [manifestCandidate, ...localCandidates]
          setTrackCoverCandidates(allCandidates)
          setSelectedTrackCoverId(manifestCandidate.id)
          setTrackCoverSelectionSource('manifest')
        } else {
          setTrackCoverCandidates(localCandidates)

          const autoSelection = resolveTrackCoverAutoSelection(localCandidates)
          if (autoSelection) {
            setSelectedTrackCoverId(autoSelection.selectedId)
            setTrackCoverSelectionSource(autoSelection.source)
          } else {
            setSelectedTrackCoverId(null)
            setTrackCoverSelectionSource(null)
          }
        }
      } else {
        // No manifest found — clear any stale manifest data
        parentHandleRef.current = null
        setTrackManifest(null)
        setTrackCoverCandidates([])
        setSelectedTrackCoverId(null)
        setTrackCoverSelectionSource(null)
      }

      // Detect author from parent folder name (e.g., "Chase Hughes - The Operative Kit")
      const detectedAuthorName = detectAuthorFromFolderName(parentHandle.name)
      if (detectedAuthorName) {
        try {
          const authorId = await matchOrCreateAuthor(detectedAuthorName, undefined, {
            useSyncableWrite: true,
          })
          setParentAuthorId(authorId)
        } catch {
          // silent-catch-ok: author detection is non-critical — continue without it
        }
      }

      // Guard against state contamination if dialog was closed during async operation
      if (stepRef.current !== 'choose') return

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
  const scanningRef = useRef(false)
  const truncationWarnedRef = useRef(false)
  const handleScanFolders = useCallback(async () => {
    if (scanningRef.current) return
    scanningRef.current = true

    const selectedFolders = folders.filter(f => f.selected)
    if (selectedFolders.length === 0) {
      scanningRef.current = false
      return
    }

    abortRef.current = false
    generationRef.current++
    const generation = generationRef.current

    // Reset truncation toast guard for this scan cycle
    truncationWarnedRef.current = false
    try {
      // Revoke stale cover preview object URLs before starting a new scan cycle
      for (const urls of coverPreviewUrls.values()) {
        for (const url of urls.values()) {
          URL.revokeObjectURL(url)
        }
      }
      setCoverPreviewUrls(new Map())

      // Clear any stale overrides from a prior scan cycle — each scan
      // generates fresh UUIDs, so old overrides become unreachable.
      setCourseOverrides(new Map())

      setStep('scanning')

      const scanItems: ImportItem[] = selectedFolders.map(f => ({
        folderName: f.name,
        handle: f.handle,
        status: 'pending' as const,
        serverUrl: f.serverUrl,
      }))
      setImportItems(scanItems)

      const results: ImportItem[] = [...scanItems]
      const scanned = new Map<string, ScannedCourse>()

      async function scanFolder(item: ImportItem) {
        if (abortRef.current || generation !== generationRef.current) return
        updateItemInList(results, item.folderName, { status: 'scanning' }, setImportItems)

        const scanResult = await scanCourseFromSource(item)

        if (abortRef.current || generation !== generationRef.current) {
          return
        }

        if (scanResult.status === 'no-files') {
          updateItemInList(results, item.folderName, { status: 'no-files' }, setImportItems)
          return
        }
        if (scanResult.status === 'duplicate') {
          updateItemInList(
            results,
            item.folderName,
            { status: 'duplicate', error: 'Already imported' },
            setImportItems
          )
          return
        }
        if (scanResult.status === 'error') {
          updateItemInList(
            results,
            item.folderName,
            { status: 'error', error: scanResult.message },
            setImportItems
          )
          return
        }

        // KI-102: Surface truncation warning once per dialog open
        if (scanResult.truncated && !truncationWarnedRef.current) {
          truncationWarnedRef.current = true
          toast.warning('Some files were skipped — server directory exceeded the 5,000 file limit')
        }

        if (abortRef.current || generation !== generationRef.current) {
          return
        }

        scanned.set(scanResult.course.id, scanResult.course)
        // KI-105: Store each course's original ID keyed by folderName so
        // handleRetry can look up user-configured overrides by the original
        // ID even after a re-scan generates a new UUID.
        originalCourseIdMapRef.current.set(item.folderName, scanResult.course.id)
        const status: ImportItemStatus = scanResult.truncated ? 'truncated' : 'success'
        updateItemInList(
          results,
          item.folderName,
          {
            status,
            scannedCourse: scanResult.course,
            truncated: scanResult.truncated,
            videoCount: scanResult.course.videos.length,
            pdfCount: scanResult.course.pdfs.length,
          },
          setImportItems
        )

        if (abortRef.current || generation !== generationRef.current) {
          return
        }

        // Load image previews for cover selection
        if (scanResult.course.images.length > 0) {
          const urls = new Map<string, string>()
          for (const img of scanResult.course.images.slice(0, 8)) {
            try {
              if (!img.fileHandle) continue
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
      await runWithConcurrency(scanItems, scanFolder, MAX_CONCURRENCY, abortRef)

      if (abortRef.current || generation !== generationRef.current) {
        return
      }

      setScannedCourses(scanned)

      if (abortRef.current || generation !== generationRef.current) {
        return
      }

      if (scanned.size > 0) {
        setStep('review')
      } else {
        toast.error('No folders could be scanned. Check the results for details.')
        setStep('results')
      }
    } catch (err) {
      console.error('[BulkImport] handleScanFolders unexpected error:', err) // silent-catch-ok: errors are caught per-item in scanFolder, top-level catch logs unexpected exceptions
    } finally {
      scanningRef.current = false
    }
  }, [folders, coverPreviewUrls])

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
    (courseId: string, image: { path: string; fileHandle?: FileSystemFileHandle }) => {
      setCourseOverrides(prev => {
        const next = new Map(prev)
        const existing = next.get(courseId) ?? {}
        if (image.fileHandle) {
          next.set(courseId, { ...existing, coverImageHandle: image.fileHandle })
        }
        return next
      })
    },
    []
  )

  // Select a track cover candidate manually
  const handleSelectTrackCover = useCallback((candidateId: string) => {
    setSelectedTrackCoverId(candidateId)
    setTrackCoverSelectionSource('manual')
  }, [])

  // Clear track cover selection (use gradient instead)
  const handleClearTrackCover = useCallback(() => {
    setSelectedTrackCoverId(null)
    setTrackCoverSelectionSource(null)
  }, [])

  // Review → Importing: Persist all scanned courses with overrides
  const handleConfirmImport = useCallback(async () => {
    generationRef.current++
    const generation = generationRef.current
    const courses: ScannedCourse[] = importItems
      .filter(
        item =>
          (item.status === 'success' || item.status === 'truncated') && item.scannedCourse != null
      )
      .map(item => item.scannedCourse!)
    if (courses.length === 0) return

    abortRef.current = false
    const progressStore = useImportProgressStore.getState()

    // Check if a track manifest is present — use batch import if so
    const manifest = trackManifest?.manifest
    const parentHandle = parentHandleRef.current

    if (manifest && parentHandle) {
      // Batch mode: delegate to batchImportTrackCourses (handles scan, persist, track creation)
      try {
        batchAbortRef.current = new AbortController()
        const result = await batchImportTrackCourses(
          parentHandle,
          manifest,
          batchAbortRef.current.signal
        )
        batchAbortRef.current = null
        if (abortRef.current || generation !== generationRef.current) return

        // Convert batch result to ImportItem[] for the results display
        const items: ImportItem[] = result.courses.map(c => ({
          folderName: c.folder,
          handle: null,
          status: c.success ? ('success' as const) : ('error' as const),
          error: c.error,
        }))
        setImportItems(items)

        // Store result for onComplete to pass trackId
        if (generation === generationRef.current) {
          batchResultRef.current = {
            trackId: result.trackId,
            courseIds: result.courses.filter(r => r.success && r.courseId).map(r => r.courseId!),
          }
        }

        // Apply track cover after track creation
        if (result.trackId && generation === generationRef.current) {
          const selectedCandidate = trackCoverCandidates.find(c => c.id === selectedTrackCoverId)
          if (selectedCandidate) {
            const coverStatus = await applyImportedTrackCover({
              trackId: result.trackId,
              candidate: selectedCandidate,
              isExplicitSelection: trackCoverSelectionSource === 'manual',
              preserveExisting: true,
            })
            if (generation === generationRef.current) {
              setTrackCoverResult(coverStatus)
            }
          }
        }

        if (generation === generationRef.current) {
          setStep('results')
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unexpected error during batch import'
        toast.error(`Batch import failed: ${message}`)
        console.error('[BulkImport] batchImportTrackCourses threw:', err)
        // Reset to review step so the user can retry or go back
        setStep('review')
      }
      return
    }

    // No manifest — per-course persist loop (existing behavior, unchanged)
    // Build a lookup so server-sourced courses retain their serverUrl on ImportItem for retry support
    const serverUrlByFolder = new Map<string, string>()
    for (const f of folders) {
      if (f.serverUrl) serverUrlByFolder.set(f.name, f.serverUrl)
    }
    const items: ImportItem[] = courses.map(c => ({
      folderName: c.name,
      handle: c.directoryHandle ?? null,
      status: 'pending' as const,
      scannedCourse: c,
      truncated: c.truncated ?? false,
      videoCount: c.videos.length,
      pdfCount: c.pdfs.length,
      serverUrl: serverUrlByFolder.get(c.name),
    }))
    setImportItems(items)
    batchResultRef.current = null
    setStep('importing')

    for (const item of items) {
      progressStore.startImport(item.folderName, item.folderName)
    }

    const results: ImportItem[] = [...items]

    async function persistCourse(item: ImportItem) {
      if (abortRef.current || useImportProgressStore.getState().cancelRequested) return
      if (!item.scannedCourse) return

      updateItemInList(results, item.folderName, { status: 'importing' }, setImportItems)
      const totalFiles = (item.videoCount ?? 0) + (item.pdfCount ?? 0)
      progressStore.updateProcessingProgress(item.folderName, totalFiles, totalFiles)

      try {
        const courseOverride = courseOverrides.get(item.scannedCourse.id)
        const overrides = {
          skipStoreUpdate: true,
          ...(parentAuthorId ? { authorId: parentAuthorId } : {}),
          ...(courseOverride?.name ? { name: courseOverride.name } : {}),
          ...(courseOverride?.description ? { description: courseOverride.description } : {}),
          ...(courseOverride?.coverImageHandle
            ? { coverImageHandle: courseOverride.coverImageHandle }
            : {}),
        }

        await persistScannedCourse(item.scannedCourse, overrides)
        updateItemInList(
          results,
          item.folderName,
          { status: item.truncated ? 'truncated' : 'success' },
          setImportItems
        )
        progressStore.completeCourse(item.folderName)
      } catch (err) {
        // silent-catch-ok: persistScannedCourse already shows error toasts.
        // Preserve the actual error message so the user can see what went wrong.
        const message = err instanceof Error ? err.message : 'Failed to import'
        console.error('[BulkImport] persistCourse failed for', item.folderName, ':', err)
        updateItemInList(
          results,
          item.folderName,
          { status: 'error', error: message },
          setImportItems
        )
        progressStore.failCourse(item.folderName, message)
      }
    }

    // Concurrent persist
    await runWithConcurrency(items, persistCourse, MAX_CONCURRENCY, {
      get current() {
        return abortRef.current || useImportProgressStore.getState().cancelRequested
      },
    })

    if (useImportProgressStore.getState().cancelRequested) {
      abortRef.current = true
      for (const item of results) {
        if (item.status === 'pending') {
          updateItemInList(
            results,
            item.folderName,
            { status: 'error', error: 'Cancelled' },
            setImportItems
          )
          progressStore.failCourse(item.folderName, 'Cancelled')
        }
      }
      useImportProgressStore.getState().confirmCancellation()
    }
    await useCourseImportStore.getState().loadImportedCourses()

    // Server-aware batch import path: when manifest exists but parentHandle is null
    // (server URL import), create or update the track with successfully imported courses.
    if (trackManifest && !parentHandle && !abortRef.current && generation === generationRef.current) {
      const manifestPositions = new Map(
        trackManifest.manifest.track.courses.map(c => [c.folder, c.position])
      )
      const successResults = results
        .filter(r => r.status === 'success')
        .sort((a, b) => {
          const posA = manifestPositions.get(a.folderName) ?? Infinity
          const posB = manifestPositions.get(b.folderName) ?? Infinity
          return posA - posB
        })
      if (successResults.length > 0) {
        try {
          const lpStore = useLearningPathStore.getState()
          const trackName = trackManifest.manifest.track.name
          const trackDesc = trackManifest.manifest.track.description
          const existingPath = lpStore.paths.find(
            p => p.name.toLowerCase() === trackName.toLowerCase()
          )
          const coursesToAdd = successResults
            .filter(r => r.scannedCourse?.id)
            .map(r => ({
              courseId: r.scannedCourse!.id,
              courseType: 'imported' as const,
            }))
          let trackId: string
          if (existingPath) {
            trackId = existingPath.id
            await lpStore.batchAddCoursesToPath(trackId, coursesToAdd)
          } else {
            const newPath = await lpStore.createPathWithCourses(trackName, trackDesc, coursesToAdd)
            trackId = newPath.id
          }

          // Apply manifest-specified positions via reorder (matching the pattern
          // in batchImportTrackCourses).  Courses may have been added in scan
          // completion order — reorder to match the manifest's declared positions.
          //
          // Re-read live store state each iteration — reorderCourse mutates
          // entries, so a static snapshot captured before the loop would go stale.
          const positions = trackManifest.manifest.track.courses
          const sortedPositions = [...positions].sort((a, b) => a.position - b.position)

          for (const { folder, position } of sortedPositions) {
            const result = successResults.find(r => r.folderName === folder)
            if (!result?.scannedCourse?.id) continue

            const currentEntries = useLearningPathStore
              .getState()
              .entries.filter(e => e.pathId === trackId)
              .sort((a, b) => a.position - b.position)

            const entryIndex = currentEntries.findIndex(
              e => e.courseId === result.scannedCourse!.id
            )
            // Clamp target to valid range — when courses fail to import, the
            // entries array may be shorter than the highest manifest position.
            const targetIndex = Math.min(position - 1, currentEntries.length - 1)
            if (entryIndex >= 0 && entryIndex !== targetIndex) {
              await lpStore.reorderCourse(trackId, entryIndex, targetIndex)
            }
          }

          // Apply track cover after server-URL track creation
          if (generation === generationRef.current) {
            const selectedCandidate = trackCoverCandidates.find(c => c.id === selectedTrackCoverId)
            if (selectedCandidate) {
              const coverStatus = await applyImportedTrackCover({
                trackId,
                candidate: selectedCandidate,
                isExplicitSelection: trackCoverSelectionSource === 'manual',
                preserveExisting: true,
              })
              if (generation === generationRef.current) {
                setTrackCoverResult(coverStatus)
              }
            }

            batchResultRef.current = {
              trackId,
              courseIds: successResults
                .filter(r => r.scannedCourse?.id)
                .map(r => r.scannedCourse!.id),
            }
          }
        } catch (err) {
          console.error('[BulkImport] Failed to create/update track from server courses:', err)
          toast.warning('Courses imported but track could not be created')
        }
      }
    }

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

    if (generation === generationRef.current) {
      setStep('results')
    }
  }, [importItems, folders, courseOverrides, parentAuthorId, trackManifest])

  // Retry a single failed item
  const handleRetry = useCallback(
    async (folderName: string) => {
      if (retryLockRef.current) return
      retryLockRef.current = true

      try {
        const generation = generationRef.current

        if (abortRef.current) {
          return
        }

        // Get a fresh snapshot of the item from closure state
        const item = importItems.find(i => i.folderName === folderName)
        if (!item) {
          return
        }

        // KI-105: Look up original course ID from the map keyed by
        // folderName. The map holds the true original ID captured during
        // the initial scan. Fall back to the live item's scannedCourse.id
        // for pre-existing items without a map entry (e.g., items imported
        // before this fix was deployed).
        const originalCourseId =
          originalCourseIdMapRef.current.get(folderName) ?? item.scannedCourse?.id

        setImportItems(prev => {
          const items = [...prev]
          const idx = items.findIndex(i => i.folderName === folderName)
          if (idx >= 0) {
            items[idx] = { ...items[idx], status: 'scanning', error: undefined }
          }
          return items
        })

        // KI-101: Defensively wrap scanCourseFromSource so any unexpected
        // throw resets the item status to 'error' instead of leaving it
        // stuck in 'scanning'.
        let scanResult: BulkScanResult
        try {
          scanResult = await scanCourseFromSource(item)
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Failed to scan folder'
          if (generation === generationRef.current) {
            setImportItems(prev =>
              prev.map(i =>
                i.folderName === folderName ? { ...i, status: 'error', error: message } : i
              )
            )
          }
          toast.error(message)
          return
        }

        if (abortRef.current || generation !== generationRef.current) {
          return
        }

        if (scanResult.status !== 'success') {
          if (generation === generationRef.current) {
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
          }
          return
        }

        if (generation === generationRef.current) {
          setImportItems(prev =>
            prev.map(i =>
              i.folderName === folderName
                ? {
                    ...i,
                    status: 'importing' as const,
                    truncated: scanResult.truncated ?? false,
                    scannedCourse: scanResult.course,
                    videoCount: scanResult.course.videos.length,
                    pdfCount: scanResult.course.pdfs.length,
                  }
                : i
            )
          )
        }

        try {
          // KI-105: Look up overrides using the original course ID (captured
          // before re-scan), not the new scanResult.course.id which may have
          // changed after the re-scan generated a fresh UUID.
          const overrideId = originalCourseId || scanResult.course.id
          const courseOverride = overrideId ? courseOverrides.get(overrideId) : undefined
          const overrides = {
            skipStoreUpdate: true,
            ...(parentAuthorId ? { authorId: parentAuthorId } : {}),
            ...(courseOverride?.name ? { name: courseOverride.name } : {}),
            ...(courseOverride?.description ? { description: courseOverride.description } : {}),
            ...(courseOverride?.coverImageHandle
              ? { coverImageHandle: courseOverride.coverImageHandle }
              : {}),
          }
          await persistScannedCourse(scanResult.course, overrides)
          if (generation !== generationRef.current) {
            return
          }
          await useCourseImportStore.getState().loadImportedCourses()
          if (generation === generationRef.current) {
            setImportItems(prev =>
              prev.map(i =>
                i.folderName === folderName
                  ? { ...i, status: i.truncated ? 'truncated' : 'success' }
                  : i
              )
            )
          }
          toast.success(`Imported: ${folderName}`)
        } catch (err) {
          // silent-catch-ok: persistScannedCourse already shows error toasts.
          // Preserve the actual error message for the user.
          const message = err instanceof Error ? err.message : 'Failed to import'
          console.error('[BulkImport] retry persistCourse failed for', folderName, ':', err)
          if (generation === generationRef.current) {
            setImportItems(prev =>
              prev.map(i =>
                i.folderName === folderName
                  ? {
                      ...i,
                      status: 'error',
                      error: message,
                    }
                  : i
              )
            )
          }
        }
      } finally {
        retryLockRef.current = false
      }
    },
    [importItems, parentAuthorId, courseOverrides]
  )

  // Progress calculation
  const completedItems = importItems.filter(
    i =>
      i.status === 'success' ||
      i.status === 'truncated' ||
      i.status === 'error' ||
      i.status === 'no-files' ||
      i.status === 'duplicate'
  ).length
  const progressPercent =
    importItems.length > 0 ? Math.round((completedItems / importItems.length) * 100) : 0
  const isStillImporting = step === 'importing' && completedItems < importItems.length

  // Results summary
  const successItems = importItems.filter(i => i.status === 'success')
  const truncatedItems = importItems.filter(i => i.status === 'truncated')
  const failedItems = importItems.filter(i => i.status === 'error')
  const noFilesItems = importItems.filter(i => i.status === 'no-files')
  const duplicateItems = importItems.filter(i => i.status === 'duplicate')

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={`flex max-h-[calc(100dvh-2rem)] min-w-0 flex-col overflow-hidden sm:max-w-lg ${
          step === 'review' ? 'gap-0 p-0' : 'gap-4 p-6'
        }`}
        data-testid="bulk-import-dialog"
        aria-describedby="bulk-import-description"
        hideClose
      >
        <DialogClose asChild>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-3 top-3 z-10 size-11 rounded-sm text-muted-foreground opacity-70 hover:opacity-100"
            aria-label="Close"
          >
            <X className="size-4" aria-hidden="true" />
          </Button>
        </DialogClose>
        <div
          className={step === 'review' ? 'shrink-0 px-6 pb-3 pt-6' : 'shrink-0'}
          data-testid="bulk-import-header"
        >
          <DialogHeader className="pr-12">
            <DialogTitle>
              {step === 'choose' && 'Import Courses'}
              {step === 'enter-url' && 'Enter Server URL'}
              {step === 'select-folders' && 'Select Course Folders'}
              {step === 'scanning' && 'Scanning Folders'}
              {step === 'review' && 'Review Courses'}
              {step === 'importing' && 'Importing Courses'}
              {step === 'results' && 'Import Complete'}
            </DialogTitle>
            <DialogDescription id="bulk-import-description" aria-live="polite">
              {step === 'choose' && 'Choose how you want to import your courses.'}
              {step === 'enter-url' && 'Paste a server URL to scan for course folders.'}
              {step === 'select-folders' &&
                (hasManifest && trackManifest
                  ? `Found ${folders.length} sub-folders for "${trackManifest.trackName}". Select which ones to import.`
                  : `Found ${folders.length} sub-folders. Select which ones to import.`)}
              {step === 'scanning' && `Scanning ${importItems.length} folders for content...`}
              {step === 'review' &&
                (hasManifest && trackManifest
                  ? `${scannedCourses.size} courses ready — will be grouped under "${trackManifest.trackName}".`
                  : `${scannedCourses.size} courses ready. Edit details before importing.`)}
              {step === 'importing' && `Importing ${importItems.length} courses...`}
              {step === 'results' &&
                (batchResultRef.current?.trackId
                  ? `${successItems.length + truncatedItems.length} of ${importItems.length} courses imported into track.`
                  : `${successItems.length + truncatedItems.length} of ${importItems.length} courses imported.`)}
            </DialogDescription>
          </DialogHeader>

          {/* Step indicator — consistent with ImportWizardDialog pattern */}
          {(() => {
            const bulkSteps = [
              { step: 'choose' as const, label: 'Choose' },
              { step: 'select-folders' as const, label: 'Select' },
              { step: 'review' as const, label: 'Review' },
              { step: 'importing' as const, label: 'Import' },
            ]
            let currentIdx = 0
            if (step === 'choose' || step === 'enter-url') currentIdx = 0
            else if (step === 'select-folders' || step === 'scanning') currentIdx = 1
            else if (step === 'review') currentIdx = 2
            else if (step === 'importing' || step === 'results') currentIdx = 3

            return (
              <nav
                className="flex items-center gap-2 text-xs text-muted-foreground mb-2"
                aria-label={`Step ${currentIdx + 1} of ${bulkSteps.length}`}
              >
                {bulkSteps.map((s, i) => (
                  <span key={s.step} className="contents">
                    {i > 0 && <ChevronRight className="size-3" aria-hidden="true" />}
                    <span
                      className={`inline-flex items-center justify-center size-5 rounded-full text-xs font-medium ${
                        currentIdx === i
                          ? 'bg-brand text-brand-foreground'
                          : currentIdx > i
                            ? 'bg-brand-soft text-brand-soft-foreground'
                            : 'bg-muted text-muted-foreground'
                      }`}
                      aria-current={currentIdx === i ? 'step' : undefined}
                    >
                      {currentIdx > i ? <Check className="size-3" aria-hidden="true" /> : i + 1}
                    </span>
                    <span className={currentIdx === i ? 'font-medium text-foreground' : ''}>
                      {s.label}
                    </span>
                  </span>
                ))}
              </nav>
            )
          })()}
        </div>

        {/* Step: Choose import mode */}
        {step === 'choose' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-4">
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
                    className="size-6 text-brand-soft-foreground motion-safe:animate-spin"
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

            <button
              type="button"
              onClick={() => setStep('enter-url')}
              className={`flex items-center gap-4 rounded-xl border border-border p-4 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${!onYouTubeImport ? 'sm:col-span-2' : ''}`}
              data-testid="import-multiple-url-btn"
            >
              <div className="flex items-center justify-center size-12 rounded-full bg-brand-soft shrink-0">
                <Globe className="size-6 text-brand-soft-foreground" aria-hidden="true" />
              </div>
              <div>
                <p className="font-medium text-foreground">Import Multiple from URL</p>
                <p className="text-sm text-muted-foreground">
                  Paste a server URL to batch import courses
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

        {/* Step: Enter server URL */}
        {step === 'enter-url' && (
          <div className="flex flex-col gap-4 py-4">
            <p className="text-sm text-muted-foreground">
              Paste the server URL containing course folders to batch import.
            </p>
            <Label htmlFor="bulk-server-url-input">Server URL</Label>
            <Input
              id="bulk-server-url-input"
              placeholder="https://example.com/courses/"
              value={serverUrlInput}
              onChange={e => {
                setServerUrlInput(e.target.value)
                if (serverUrlError) setServerUrlError(null)
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  if (isScanningUrlRef.current) return
                  handleServerUrlScan()
                }
                if (e.key === 'Escape' && !isScanningUrlRef.current) {
                  setStep('choose')
                }
              }}
              autoFocus
              className="min-h-[44px] font-mono text-sm"
              data-testid="bulk-import-enter-url"
              aria-invalid={!!serverUrlError}
              aria-describedby={serverUrlError ? 'bulk-import-url-error-text' : undefined}
              disabled={isScanningUrl}
            />
            {serverUrlError && (
              <p
                className="text-xs text-destructive"
                role="alert"
                id="bulk-import-url-error-text"
                data-testid="bulk-import-url-error"
              >
                {serverUrlError}
              </p>
            )}
            <div className="flex gap-2">
              <Button
                variant="brand"
                onClick={handleServerUrlScan}
                disabled={!serverUrlInput.trim() || isScanningUrl}
                className="rounded-xl min-h-[44px]"
                data-testid="bulk-import-scan-url-btn"
              >
                {isScanningUrl ? (
                  <>
                    <Loader2 className="size-4 mr-2 motion-safe:animate-spin" aria-hidden="true" />
                    Scanning...
                  </>
                ) : (
                  'Scan'
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setServerUrlInput('')
                  setServerUrlError(null)
                  setStep('choose')
                }}
                className="rounded-xl min-h-[44px]"
                data-testid="bulk-import-url-back-btn"
                disabled={isScanningUrl}
              >
                Back
              </Button>
            </div>
          </div>
        )}

        {/* Step: Select sub-folders */}
        {step === 'select-folders' && (
          <>
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-2 gap-y-1 py-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSelectAll}
                className="shrink-0 text-xs"
                data-testid="bulk-select-all"
              >
                {folders.every(f => f.selected) ? 'Deselect All' : 'Select All'}
              </Button>
              <span
                className="text-right text-sm text-muted-foreground whitespace-nowrap sm:shrink-0"
                data-testid="bulk-selected-count"
              >
                {selectedCount} of {folders.length} selected
              </span>
            </div>

            <ScrollArea className="max-h-[40vh] min-w-0 w-full">
              <div
                className="flex min-w-0 flex-col gap-1 pr-3"
                role="list"
                aria-label="Course folders"
              >
                {folders.map((folder, index) => (
                  <label
                    key={folder.name}
                    className="flex min-w-0 w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-accent"
                    role="listitem"
                  >
                    <Checkbox
                      checked={folder.selected}
                      onCheckedChange={() => handleToggleFolder(index)}
                      aria-label={`Select ${folder.name}`}
                      data-testid={`bulk-folder-${folder.name}`}
                    />
                    <FolderOpen
                      className="size-4 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1 truncate text-left text-sm">{folder.name}</span>
                  </label>
                ))}
              </div>
            </ScrollArea>

            <DialogFooter className="w-full max-w-full sm:flex-wrap">
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
                            i.status === 'truncated' ||
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
                      i.status === 'truncated' ||
                      i.status === 'no-files' ||
                      i.status === 'duplicate' ||
                      i.status === 'error'
                  ).length
                  return `Scanned ${done} of ${importItems.length}`
                }}
              />
            </div>

            <ScrollArea className="max-h-[40vh] min-w-0 w-full">
              <div
                className="flex min-w-0 flex-col gap-1 pr-3"
                role="list"
                aria-label="Scan progress"
              >
                {importItems.map(item => (
                  <div
                    key={item.folderName}
                    className="flex min-w-0 items-center gap-3 rounded-lg px-3 py-2"
                    role="listitem"
                  >
                    {item.status === 'pending' && (
                      <div
                        className="size-5 rounded-full border-2 border-muted shrink-0"
                        aria-label="Pending"
                      />
                    )}
                    {item.status === 'scanning' && (
                      <Loader2 className="size-5 text-brand motion-safe:animate-spin shrink-0" />
                    )}
                    {(item.status === 'success' || item.status === 'truncated') &&
                      (item.status === 'truncated' ? (
                        <AlertTriangle className="size-5 text-warning shrink-0" />
                      ) : (
                        <CheckCircle2 className="size-5 text-success shrink-0" />
                      ))}
                    {item.status === 'no-files' && (
                      <FileX className="size-5 text-muted-foreground shrink-0" />
                    )}
                    {item.status === 'duplicate' && (
                      <AlertTriangle className="size-5 text-warning shrink-0" />
                    )}
                    {item.status === 'error' && (
                      <XCircle className="size-5 text-destructive shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{item.folderName}</p>
                      {(item.status === 'success' || item.status === 'truncated') &&
                        item.videoCount !== undefined && (
                          <p className="text-xs text-muted-foreground flex items-center gap-2">
                            <span className="flex items-center gap-1">
                              <Video className="size-3" /> {item.videoCount} videos
                            </span>
                            <span className="flex items-center gap-1">
                              <FileText className="size-3" /> {item.pdfCount} PDFs
                            </span>
                            {item.truncated && (
                              <span className="flex items-center gap-1 text-warning">
                                <AlertTriangle className="size-3" />
                                Truncated
                              </span>
                            )}
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
            <div className="min-h-0 flex-1 overflow-hidden" data-testid="bulk-review-scroll-region">
              <ScrollArea className="h-full min-w-0 w-full">
                <div className="space-y-3 px-6 py-3 pr-8">
                  {hasManifest && trackManifest && (
                    <div
                      className="rounded-xl border border-brand/20 bg-brand-soft/50 p-3"
                      data-testid="bulk-track-header"
                    >
                      <p className="text-xs text-brand-soft-foreground font-semibold uppercase tracking-wider">
                        Track
                      </p>
                      <p className="text-sm font-medium text-foreground mt-0.5">
                        {trackManifest.trackName}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        All courses will be grouped under this track after import.
                      </p>
                    </div>
                  )}

                  {/* Track Cover section — shown when root images are discovered */}
                  {trackCoverCandidates.length > 0 && (
                    <div
                      className="rounded-xl border border-border p-3"
                      data-testid="bulk-track-cover-section"
                    >
                      {trackCoverCandidates.length === 1 && selectedTrackCoverId ? (
                        /* Single auto-selected image */
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                          <div className="relative aspect-video w-full shrink-0 overflow-hidden rounded-lg bg-muted sm:w-36">
                            <img
                              src={trackCoverCandidates[0].previewUrl}
                              alt={trackCoverCandidates[0].filename}
                              className="h-full w-full object-cover"
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                              Track Cover
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {trackCoverSelectionSource === 'manifest'
                                ? 'Selected from track-manifest.json'
                                : 'Automatically selected from the track folder'}
                            </p>
                            {trackCoverSelectionSource === 'automatic' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="mt-1 h-auto px-0 py-0.5 text-xs text-muted-foreground hover:text-foreground"
                                onClick={handleClearTrackCover}
                                data-testid="bulk-track-cover-change"
                              >
                                Use gradient instead
                              </Button>
                            )}
                          </div>
                        </div>
                      ) : (
                        /* Multiple candidates — user chooses */
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                            Choose Track Cover
                          </p>
                          <p className="text-xs text-muted-foreground mb-2">
                            Select an image for "{trackManifest?.trackName ?? 'this track'}"
                          </p>
                          <div
                            className="grid grid-cols-2 gap-2 sm:grid-cols-4"
                            role="radiogroup"
                            aria-label="Select track cover image"
                          >
                            {trackCoverCandidates.map(candidate => {
                              const isSelected = selectedTrackCoverId === candidate.id
                              return (
                                <button
                                  key={candidate.id}
                                  type="button"
                                  role="radio"
                                  aria-checked={isSelected}
                                  aria-label={`${candidate.filename}${candidate.source === 'manifest' ? ' (from manifest)' : ''}`}
                                  onClick={() => handleSelectTrackCover(candidate.id)}
                                  className={`relative aspect-video overflow-hidden rounded-lg border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
                                    isSelected
                                      ? 'border-brand ring-1 ring-brand/30'
                                      : 'border-transparent hover:border-border'
                                  }`}
                                  data-testid={`bulk-track-cover-${candidate.id}`}
                                >
                                  {candidate.previewUrl ? (
                                    <img
                                      src={candidate.previewUrl}
                                      alt={candidate.filename}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <div className="w-full h-full bg-muted flex items-center justify-center">
                                      <ImageIcon className="size-5 text-muted-foreground" />
                                    </div>
                                  )}
                                  {isSelected && (
                                    <div className="absolute inset-0 bg-brand/10 flex items-center justify-center">
                                      <CheckCircle2 className="size-5 text-brand" />
                                    </div>
                                  )}
                                  {candidate.source === 'manifest' && (
                                    <span className="absolute bottom-0.5 right-0.5 bg-brand text-brand-foreground text-[9px] px-1 rounded">
                                      manifest
                                    </span>
                                  )}
                                </button>
                              )
                            })}
                          </div>
                          {selectedTrackCoverId && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs mt-2 h-auto py-0.5 px-0 text-muted-foreground hover:text-foreground"
                              onClick={handleClearTrackCover}
                              data-testid="bulk-track-cover-use-gradient"
                            >
                              Use gradient instead
                            </Button>
                          )}
                          {!selectedTrackCoverId && trackCoverCandidates.length > 0 && (
                            <p className="text-xs text-muted-foreground mt-2">
                              No image selected — gradient will be used.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex min-w-0 flex-col gap-2" data-testid="bulk-review-list">
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
                            aria-expanded={isExpanded}
                            aria-controls={`bulk-course-details-${course.id}`}
                            className="flex items-center gap-3 w-full px-4 py-3 text-left hover:bg-accent transition-colors"
                          >
                            <FolderOpen
                              className="size-4 text-muted-foreground shrink-0"
                              aria-hidden="true"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate" title={displayName}>
                                {displayName}
                              </p>
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
                                {course.truncated && (
                                  <span className="flex items-center gap-1 text-warning">
                                    <AlertTriangle className="size-3" />
                                    Truncated to {course.videos.length + course.pdfs.length} files
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
                            <div
                              id={`bulk-course-details-${course.id}`}
                              className="px-4 pb-4 space-y-3 border-t border-border pt-3"
                            >
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
                                  <div
                                    className="grid grid-cols-4 gap-2"
                                    role="radiogroup"
                                    aria-label="Select cover image"
                                  >
                                    {course.images.slice(0, 8).map(img => {
                                      const url = courseImages.get(img.path)
                                      if (!url) return null
                                      const isSelected =
                                        override?.coverImageHandle === img.fileHandle
                                      return (
                                        <button
                                          key={img.path}
                                          type="button"
                                          role="radio"
                                          aria-checked={isSelected}
                                          aria-label={`Select ${img.filename} as cover`}
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
                </div>
              </ScrollArea>
            </div>

            <DialogFooter
              className="w-full shrink-0 border-t border-border bg-background px-6 py-4 sm:flex-row sm:justify-between"
              data-testid="bulk-review-footer"
            >
              <Button
                variant="outline"
                onClick={() => setStep('select-folders')}
                className="w-full rounded-xl sm:w-auto"
                data-testid="bulk-review-back-btn"
              >
                Back
              </Button>
              <Button
                variant="brand"
                onClick={handleConfirmImport}
                className="w-full rounded-xl sm:w-auto"
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

            <ScrollArea className="max-h-[40vh] min-w-0 w-full">
              <div
                className="flex min-w-0 flex-col gap-1 pr-3"
                role="list"
                aria-label="Import progress"
              >
                {importItems.map(item => (
                  <div
                    key={item.folderName}
                    className="flex min-w-0 items-center gap-3 rounded-lg px-3 py-2"
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
                        className="size-5 text-brand motion-safe:animate-spin shrink-0"
                        aria-label="In progress"
                      />
                    )}
                    {item.status === 'success' && (
                      <CheckCircle2 className="size-5 text-success shrink-0" aria-label="Success" />
                    )}
                    {item.status === 'truncated' && (
                      <AlertTriangle
                        className="size-5 text-warning shrink-0"
                        aria-label="Truncated"
                      />
                    )}
                    {item.status === 'error' && (
                      <XCircle className="size-5 text-destructive shrink-0" aria-label="Error" />
                    )}
                    {item.status === 'no-files' && (
                      <FileX
                        className="size-5 text-muted-foreground shrink-0"
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
                      {(item.status === 'success' || item.status === 'truncated') &&
                        item.videoCount !== undefined && (
                          <p className="text-xs text-muted-foreground flex items-center gap-2">
                            <span className="flex items-center gap-1">
                              <Video className="size-3" aria-hidden="true" />
                              {item.videoCount}
                            </span>
                            <span className="flex items-center gap-1">
                              <FileText className="size-3" aria-hidden="true" />
                              {item.pdfCount}
                            </span>
                            {item.truncated && (
                              <span className="flex items-center gap-1 text-warning">
                                <AlertTriangle className="size-3" aria-hidden="true" />
                                Truncated
                              </span>
                            )}
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
                        disabled={retryLockRef.current}
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
                    {truncatedItems.length > 0 && (
                      <span className="flex items-center gap-1.5 text-warning">
                        <AlertTriangle className="size-4" aria-hidden="true" />
                        {truncatedItems.length} truncated
                      </span>
                    )}
                    {noFilesItems.length > 0 && (
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <FileX className="size-4" aria-hidden="true" />
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

                  {/* Track cover result feedback */}
                  {trackCoverResult && (
                    <div className="pt-1 border-t border-border/50">
                      {trackCoverResult === 'track-cover-added-automatically' && (
                        <span className="flex items-center gap-1.5 text-sm text-success">
                          <CheckCircle2 className="size-4" aria-hidden="true" />
                          Track cover added automatically
                        </span>
                      )}
                      {trackCoverResult === 'track-cover-selected' && (
                        <span className="flex items-center gap-1.5 text-sm text-success">
                          <CheckCircle2 className="size-4" aria-hidden="true" />
                          Track cover selected
                        </span>
                      )}
                      {trackCoverResult === 'track-cover-upload-failed' && (
                        <span className="flex items-center gap-1.5 text-sm text-warning">
                          <AlertTriangle className="size-4" aria-hidden="true" />
                          Track created, but cover upload failed
                        </span>
                      )}
                    </div>
                  )}
                  {!trackCoverResult &&
                    trackCoverCandidates.length > 0 &&
                    batchResultRef.current?.trackId && (
                      <div className="pt-1 border-t border-border/50">
                        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <ImageIcon className="size-4" aria-hidden="true" />
                          Track created with gradient
                        </span>
                      </div>
                    )}
                </div>

                <DialogFooter className="w-full max-w-full sm:flex-wrap">
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
