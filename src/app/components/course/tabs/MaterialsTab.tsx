/**
 * MaterialsTab — Inline PDF viewers in collapsible sections.
 *
 * Each imported PDF gets a collapsible section with a PdfViewer.
 * Blob URLs are created on demand (when expanded) to avoid loading
 * all PDFs at once. Page position is persisted per PDF via db.progress.
 *
 * @see PdfContent.tsx for the permission/blob URL pattern
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  FileText,
  ChevronRight,
  Loader2,
  ShieldAlert,
  FolderSearch,
  FileWarning,
} from 'lucide-react'
import { cn } from '@/app/components/ui/utils'
import { toast } from 'sonner'
import { Badge } from '@/app/components/ui/badge'
import { Button } from '@/app/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/app/components/ui/collapsible'
import { EmptyState } from '@/app/components/EmptyState'
import { Skeleton } from '@/app/components/ui/skeleton'
import { PdfViewer } from '@/app/components/figma/PdfViewer'
import { db } from '@/db/schema'
import { syncableWrite, type SyncableRecord } from '@/lib/sync/syncableWrite'
import { releasePdfSource, resolvePdfSource, type ReadyPdfSource } from '@/lib/pdfSource'
import type { ImportedPdf } from '@/data/types'

import type { CourseAdapter } from '@/lib/courseAdapter'
import type { LessonGroupItem } from '@/lib/lessonBasedCurriculum'

interface MaterialsTabProps {
  courseId: string
  lessonId: string
  adapter: CourseAdapter
}

// ---------------------------------------------------------------------------
// Per-PDF collapsible section
// ---------------------------------------------------------------------------

interface PdfSectionProps {
  pdf: ImportedPdf
  courseId: string
  /** Controlled open state for accordion behavior */
  isOpen: boolean
  /** Called when the section wants to open/close */
  onToggle: (pdfId: string, open: boolean) => void
  onPdfUpdate: (pdf: ImportedPdf) => void
}

function PdfSection({ pdf, courseId, isOpen, onToggle, onPdfUpdate }: PdfSectionProps) {
  const [source, setSource] = useState<ReadyPdfSource | null>(null)
  const [blobLoading, setBlobLoading] = useState(false)
  const [fileError, setFileError] = useState<'permission-denied' | 'not-found' | null>(null)
  const [permissionPending, setPermissionPending] = useState(false)
  const [savedPage, setSavedPage] = useState<number | undefined>(undefined)
  const pageRestored = useRef(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sourceRef = useRef<ReadyPdfSource | null>(null)
  const sourceRequestRef = useRef(0)

  const displayName = pdf.filename.replace(/\.pdf$/i, '')

  const replaceSource = useCallback((nextSource: ReadyPdfSource | null) => {
    releasePdfSource(sourceRef.current)
    sourceRef.current = nextSource
    setSource(nextSource)
  }, [])

  const loadSource = useCallback(
    async (targetPdf: ImportedPdf, requestPermission: boolean) => {
      const requestId = ++sourceRequestRef.current
      setBlobLoading(true)
      setFileError(null)

      const result = await resolvePdfSource(targetPdf, { requestPermission })
      if (requestId !== sourceRequestRef.current) {
        if (result.status === 'ready') releasePdfSource(result)
        return result
      }

      if (result.status === 'ready') {
        replaceSource(result)
      } else {
        replaceSource(null)
        setFileError(result.status)
      }
      setBlobLoading(false)
      return result
    },
    [replaceSource]
  )

  // Handle trigger click — resolve file handles in user-gesture context so
  // the File System Access API's requestPermission() is allowed by the browser.
  // We call e.preventDefault() when opening to stop Radix from toggling, then
  // manually set isOpen after permission + blob URL are resolved.
  const handleTriggerClick = useCallback(
    async (e: React.MouseEvent) => {
      // Closing — let parent handle via onToggle
      if (isOpen) {
        onToggle(pdf.id, false)
        return
      }

      // Re-opening with a source already resolved
      if (source) {
        onToggle(pdf.id, true)
        return
      }

      // Opening for the first time — intercept Radix toggle
      e.preventDefault()

      onToggle(pdf.id, true)
      await loadSource(pdf, true)
    },
    [isOpen, source, pdf, onToggle, loadSource]
  )

  // Release object URLs and invalidate pending source requests on unmount.
  useEffect(() => {
    return () => {
      sourceRequestRef.current += 1
      releasePdfSource(sourceRef.current)
      sourceRef.current = null
    }
  }, [])

  // Restore saved page from progress table
  useEffect(() => {
    if (pageRestored.current || !isOpen) return
    let ignore = false
    db.progress
      .get([courseId, pdf.id])
      .then(p => {
        if (!ignore && p?.currentPage) {
          setSavedPage(p.currentPage)
        }
        pageRestored.current = true
      })
      .catch(() => {
        // silent-catch-ok — page restore is non-critical
        pageRestored.current = true
      })
    return () => {
      ignore = true
    }
  }, [courseId, pdf.id, isOpen])

  // Debounced page change save (500ms)
  const handlePageChange = useCallback(
    (page: number, _totalPages: number) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => {
        // E92-S09: syncableWrite routes to Supabase video_progress via
        // upsert_video_progress() (monotonic on watchedSeconds). Unify the
        // previous two-branch update/put logic into a single put that spreads
        // any existing record so currentTime/completionPercentage are
        // preserved when only the PDF currentPage changes.
        db.progress
          .where('[courseId+videoId]')
          .equals([courseId, pdf.id])
          .first()
          .then(async existing => {
            await syncableWrite('progress', 'put', {
              ...(existing ?? {
                currentTime: 0,
                completionPercentage: 0,
              }),
              durationSeconds: existing?.durationSeconds ?? 0,
              courseId,
              videoId: pdf.id,
              currentPage: page,
            })
          })
          .catch(() => {
            // silent-catch-ok — page save is non-critical
          })
      }, 500)
    },
    [courseId, pdf.id]
  )

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  // Re-grant permission flow
  const handleReGrantPermission = useCallback(async () => {
    if (!pdf.fileHandle) return
    setPermissionPending(true)
    try {
      const result = await loadSource(pdf, true)
      if (result.status === 'ready') {
        toast.success('Permission granted')
      } else {
        toast.error('Permission was denied')
      }
    } catch {
      toast.error('Failed to request permission')
    } finally {
      setPermissionPending(false)
    }
  }, [pdf, loadSource])

  const supportsFilePicker = 'showOpenFilePicker' in window
  const handleLocateFile = useCallback(async () => {
    try {
      const [fileHandle] = await window.showOpenFilePicker({
        types: [
          {
            description: 'PDF files',
            accept: { 'application/pdf': ['.pdf'] },
          },
        ],
        multiple: false,
      })
      await fileHandle.getFile()

      const updatedPdf: ImportedPdf = {
        ...pdf,
        fileHandle,
        fileBlob: undefined,
        serverUrl: undefined,
      }
      await syncableWrite('importedPdfs', 'put', updatedPdf as unknown as SyncableRecord)
      onPdfUpdate(updatedPdf)

      const result = await loadSource(updatedPdf, false)
      if (result.status === 'ready') toast.success(`Located: ${fileHandle.name}`)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      toast.error('Could not access the selected PDF')
    }
  }, [pdf, onPdfUpdate, loadSource])

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={open => onToggle(pdf.id, open)}
      data-testid="materials-entry"
    >
      <CollapsibleTrigger asChild>
        <button
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-muted/50"
          aria-expanded={isOpen}
          onClick={handleTriggerClick}
        >
          <ChevronRight
            className={cn(
              'size-4 shrink-0 text-muted-foreground transition-transform duration-200',
              isOpen && 'rotate-90'
            )}
            aria-hidden="true"
          />
          <FileText className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="flex-1 min-w-0 text-sm font-medium truncate">{displayName}</span>
          {pdf.pageCount > 0 && (
            <Badge variant="secondary" className="text-xs shrink-0">
              {pdf.pageCount} page{pdf.pageCount !== 1 ? 's' : ''}
            </Badge>
          )}
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="pb-2 pt-1">
          {/* Loading state */}
          {blobLoading && (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-muted p-8 text-center">
              <Loader2
                className="size-6 text-muted-foreground motion-safe:animate-spin"
                aria-hidden="true"
              />
              <p className="text-sm text-muted-foreground" role="status">
                Loading PDF…
              </p>
            </div>
          )}

          {/* Permission error */}
          {fileError === 'permission-denied' && (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-muted p-6 text-center">
              <ShieldAlert className="size-8 text-warning" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">Permission required to view this PDF.</p>
              <Button
                onClick={handleReGrantPermission}
                variant="brand"
                size="sm"
                disabled={permissionPending}
              >
                {permissionPending ? 'Requesting…' : 'Grant Permission'}
              </Button>
              {supportsFilePicker && (
                <Button onClick={handleLocateFile} variant="outline" size="sm">
                  <FolderSearch className="size-4" aria-hidden="true" />
                  Locate File
                </Button>
              )}
            </div>
          )}

          {/* File not found error */}
          {fileError === 'not-found' && (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-muted p-6 text-center">
              <FileText className="size-8 text-muted-foreground" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">PDF file not found or inaccessible.</p>
              {supportsFilePicker && (
                <Button onClick={handleLocateFile} variant="brand" size="sm">
                  <FolderSearch className="size-4" aria-hidden="true" />
                  Locate File
                </Button>
              )}
            </div>
          )}

          {/* PDF Viewer */}
          {source && !blobLoading && !fileError && (
            <PdfViewer
              src={source.url}
              title={pdf.filename}
              compact
              initialPage={savedPage ?? 1}
              onPageChange={handlePageChange}
              className="max-h-[70vh]"
            />
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

// ---------------------------------------------------------------------------
// Main MaterialsTab
// ---------------------------------------------------------------------------

export function MaterialsTab({ courseId, lessonId, adapter }: MaterialsTabProps) {
  const [allPdfs, setAllPdfs] = useState<ImportedPdf[]>([])
  const [materials, setMaterials] = useState<LessonGroupItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [showAll, setShowAll] = useState(false)
  const [openPdfId, setOpenPdfId] = useState<string | null>(null)

  // Accordion: only one PDF open at a time
  const handlePdfToggle = useCallback((pdfId: string, open: boolean) => {
    setOpenPdfId(open ? pdfId : null)
  }, [])
  const handlePdfUpdate = useCallback((updatedPdf: ImportedPdf) => {
    setAllPdfs(pdfs => pdfs.map(pdf => (pdf.id === updatedPdf.id ? updatedPdf : pdf)))
  }, [])

  // Load all PDFs and lesson-based curriculum in parallel
  useEffect(() => {
    let ignore = false
    setIsLoading(true)
    setLoadError(null)
    setShowAll(false)

    Promise.all([
      db.importedPdfs.where('courseId').equals(courseId).toArray(),
      adapter.getLessonBasedCurriculum(),
    ])
      .then(([pdfs, sections]) => {
        if (!ignore) {
          setAllPdfs(pdfs)

          // Find the current lesson's group and extract its materials
          const lessonMaterials: LessonGroupItem[] = []
          for (const section of sections) {
            for (const group of section.lessons) {
              if (group.primary.id === lessonId) {
                lessonMaterials.push(...group.materials)
                break
              }
              // Also check if we're viewing a material - show all materials of that group
              const materialMatch = group.materials.find(m => m.id === lessonId)
              if (materialMatch) {
                lessonMaterials.push(...group.materials)
                break
              }
            }
          }
          setMaterials(lessonMaterials)
          setIsLoading(false)
        }
      })
      .catch(error => {
        // silent-catch-ok — the failure and retry action are rendered inline
        console.error('[MaterialsTab] Failed to load materials:', error)
        if (!ignore) {
          setLoadError('Materials could not be loaded.')
          setIsLoading(false)
        }
      })

    return () => {
      ignore = true
    }
  }, [courseId, lessonId, adapter, reloadKey])

  // Reset view state when lesson changes
  useEffect(() => {
    setShowAll(false)
    setOpenPdfId(null)
  }, [lessonId])

  if (isLoading) {
    return (
      <div className="p-4 space-y-3" aria-busy="true" aria-label="Loading materials">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center gap-3 p-8 text-center" role="alert">
        <FileWarning className="size-9 text-destructive" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">{loadError}</p>
        <Button variant="outline" size="sm" onClick={() => setReloadKey(key => key + 1)}>
          Retry
        </Button>
      </div>
    )
  }

  if (allPdfs.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="No materials"
        description="This course has no PDF documents"
      />
    )
  }

  // Build companion PDF set from lesson-based materials
  const companionPdfIds = new Set(materials.map(m => m.id))
  const companionPdfs = allPdfs.filter(p => companionPdfIds.has(p.id))

  // Show all mode or no companions found
  if (showAll) {
    return (
      <div className="p-3 space-y-1" data-testid="materials-tab">
        <div className="flex items-center justify-between mb-2 px-1">
          <p className="text-xs text-muted-foreground">All course materials ({allPdfs.length})</p>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-6 px-2"
            onClick={() => setShowAll(false)}
          >
            Show lesson only
          </Button>
        </div>
        {allPdfs.map(pdf => (
          <PdfSection
            key={pdf.id}
            pdf={pdf}
            courseId={courseId}
            isOpen={openPdfId === pdf.id}
            onToggle={handlePdfToggle}
            onPdfUpdate={handlePdfUpdate}
          />
        ))}
      </div>
    )
  }

  if (companionPdfs.length === 0) {
    return (
      <div className="p-3 space-y-3" data-testid="materials-tab">
        <EmptyState
          icon={FileText}
          title="No materials for this lesson"
          description="This lesson has no companion PDF documents"
        />
        <div className="flex justify-center">
          <Button variant="outline" size="sm" onClick={() => setShowAll(true)}>
            View all course materials ({allPdfs.length})
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-3 space-y-1" data-testid="materials-tab">
      <div className="flex items-center justify-between mb-2 px-1">
        <p className="text-xs text-muted-foreground">
          {companionPdfs.length} material{companionPdfs.length !== 1 ? 's' : ''} for this lesson
        </p>
        {allPdfs.length > companionPdfs.length && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-6 px-2"
            onClick={() => setShowAll(true)}
          >
            All ({allPdfs.length})
          </Button>
        )}
      </div>
      {companionPdfs.map(pdf => (
        <PdfSection
          key={pdf.id}
          pdf={pdf}
          courseId={courseId}
          isOpen={openPdfId === pdf.id}
          onToggle={handlePdfToggle}
          onPdfUpdate={handlePdfUpdate}
        />
      ))}
    </div>
  )
}
