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
import { FileText, ChevronRight, Loader2, ShieldAlert } from 'lucide-react'
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
import { revokeObjectUrl } from '@/lib/courseAdapter'
import type { ImportedPdf } from '@/data/types'

import type { CourseAdapter } from '@/lib/courseAdapter'
import { getCompanionMaterials, type MaterialGroup } from '@/lib/lessonMaterialMatcher'

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
}

function PdfSection({ pdf, courseId, isOpen, onToggle }: PdfSectionProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [blobLoading, setBlobLoading] = useState(false)
  const [fileError, setFileError] = useState<'permission-denied' | 'not-found' | null>(null)
  const [permissionPending, setPermissionPending] = useState(false)
  const [savedPage, setSavedPage] = useState<number | undefined>(undefined)
  const pageRestored = useRef(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const displayName = pdf.filename.replace(/\.pdf$/i, '')

  // Handle trigger click — resolve blob URL in user-gesture context so
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

      // Re-opening with blob already resolved
      if (blobUrl) {
        onToggle(pdf.id, true)
        return
      }

      // Opening for the first time — intercept Radix toggle
      e.preventDefault()

      if (!pdf.fileHandle) {
        setFileError('not-found')
        onToggle(pdf.id, true)
        return
      }

      setBlobLoading(true)
      onToggle(pdf.id, true)

      try {
        const permission = await pdf.fileHandle.queryPermission({ mode: 'read' })
        if (permission !== 'granted') {
          const result = await pdf.fileHandle.requestPermission({ mode: 'read' })
          if (result !== 'granted') {
            setFileError('permission-denied')
            setBlobLoading(false)
            return
          }
        }
        const file = await pdf.fileHandle.getFile()
        const url = URL.createObjectURL(file)
        setBlobUrl(url)
        setBlobLoading(false)
      } catch {
        // silent-catch-ok — error surfaced via fileError state (shows "not found" UI)
        setFileError('not-found')
        setBlobLoading(false)
      }
    },
    [isOpen, blobUrl, pdf.fileHandle]
  )

  // Revoke blob URL on unmount
  useEffect(() => {
    return () => {
      if (blobUrl) revokeObjectUrl(blobUrl)
    }
  }, [blobUrl])

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
        db.progress
          .where('[courseId+videoId]')
          .equals([courseId, pdf.id])
          .first()
          .then(async existing => {
            if (existing) {
              await db.progress.update([courseId, pdf.id] as unknown as string, {
                currentPage: page,
              })
            } else {
              await db.progress.put({
                courseId,
                videoId: pdf.id,
                currentTime: 0,
                completionPercentage: 0,
                currentPage: page,
              })
            }
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
      const result = await pdf.fileHandle.requestPermission({ mode: 'read' })
      if (result === 'granted') {
        setFileError(null)
        setBlobUrl(null)
        setBlobLoading(false)
        toast.success('Permission granted')
      } else {
        toast.error('Permission was denied')
      }
    } catch {
      toast.error('Failed to request permission')
    } finally {
      setPermissionPending(false)
    }
  }, [pdf.fileHandle])

  return (
    <Collapsible open={isOpen} onOpenChange={open => onToggle(pdf.id, open)} data-testid="materials-entry">
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
              <Loader2 className="size-6 text-muted-foreground motion-safe:animate-spin" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">Loading PDF...</p>
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
                {permissionPending ? 'Requesting...' : 'Grant Permission'}
              </Button>
            </div>
          )}

          {/* File not found error */}
          {fileError === 'not-found' && (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-muted p-6 text-center">
              <FileText className="size-8 text-muted-foreground" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">PDF file not found or inaccessible.</p>
            </div>
          )}

          {/* PDF Viewer */}
          {blobUrl && !blobLoading && !fileError && (
            <PdfViewer
              src={blobUrl}
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
  const [groups, setGroups] = useState<MaterialGroup[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showAll, setShowAll] = useState(false)
  const [openPdfId, setOpenPdfId] = useState<string | null>(null)

  // Accordion: only one PDF open at a time
  const handlePdfToggle = useCallback((pdfId: string, open: boolean) => {
    setOpenPdfId(open ? pdfId : null)
  }, [])

  // Load all PDFs and grouped lesson data in parallel
  useEffect(() => {
    let ignore = false
    setIsLoading(true)
    setShowAll(false)

    Promise.all([
      db.importedPdfs.where('courseId').equals(courseId).toArray(),
      adapter.getGroupedLessons(),
    ])
      .then(([pdfs, materialGroups]) => {
        if (!ignore) {
          setAllPdfs(pdfs)
          setGroups(materialGroups)
          setIsLoading(false)
        }
      })
      .catch(() => {
        // silent-catch-ok — handled by empty state
        if (!ignore) setIsLoading(false)
      })

    return () => {
      ignore = true
    }
  }, [courseId, adapter])

  // Reset view state when lesson changes
  useEffect(() => {
    setShowAll(false)
    setOpenPdfId(null)
  }, [lessonId])

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
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

  // Find companion materials for current lesson
  const companionMaterials = getCompanionMaterials(lessonId, groups)
  const companionPdfIds = new Set(companionMaterials.map(m => m.id))
  const companionPdfs = allPdfs.filter(p => companionPdfIds.has(p.id))

  // Show all mode or no companions found
  if (showAll) {
    return (
      <div className="p-3 space-y-1" data-testid="materials-tab">
        <div className="flex items-center justify-between mb-2 px-1">
          <p className="text-xs text-muted-foreground">
            All course materials ({allPdfs.length})
          </p>
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
          <PdfSection key={pdf.id} pdf={pdf} courseId={courseId} isOpen={openPdfId === pdf.id} onToggle={handlePdfToggle} />
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAll(true)}
          >
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
        <PdfSection key={pdf.id} pdf={pdf} courseId={courseId} isOpen={openPdfId === pdf.id} onToggle={handlePdfToggle} />
      ))}
    </div>
  )
}
