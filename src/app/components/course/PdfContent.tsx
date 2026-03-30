/**
 * PdfContent — PDF viewing with FileSystemAccess permission handling.
 *
 * Mirrors the LocalVideoContent pattern: loads PDF metadata from Dexie,
 * resolves a blob URL via the file handle, handles permission re-grant,
 * and delegates to the existing PdfViewer for rendering.
 *
 * @see E89-S06
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import { Link } from 'react-router'
import { FileWarning, FolderSearch, RefreshCw, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'
import { db } from '@/db/schema'
import { revokeObjectUrl } from '@/lib/courseAdapter'
import { PdfViewer } from '@/app/components/figma/PdfViewer'
import { Button } from '@/app/components/ui/button'
import { Skeleton } from '@/app/components/ui/skeleton'
import { DelayedFallback } from '@/app/components/DelayedFallback'
import type { ImportedPdf } from '@/data/types'

interface PdfContentProps {
  courseId: string
  lessonId: string
}

export function PdfContent({ courseId, lessonId }: PdfContentProps) {
  const [pdf, setPdf] = useState<ImportedPdf | null | undefined>(undefined)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [dexieLoading, setDexieLoading] = useState(false)
  const [permissionPending, setPermissionPending] = useState(false)
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [fileError, setFileError] = useState<'permission-denied' | 'not-found' | null>(null)
  const [blobLoading, setBlobLoading] = useState(false)

  // Load PDF record from Dexie
  const loadPdf = useCallback(() => {
    if (!lessonId) {
      setPdf(null)
      return
    }
    setLoadError(null)
    setPdf(undefined)
    setDexieLoading(true)
    let ignore = false

    db.importedPdfs
      .get(lessonId)
      .then(p => {
        if (!ignore) {
          setPdf(p ?? null)
          setDexieLoading(false)
        }
      })
      .catch((err: unknown) => {
        if (!ignore) {
          const message = err instanceof Error ? err.message : 'Failed to load PDF data'
          setLoadError(message)
          setDexieLoading(false)
          toast.error('Failed to load PDF data')
        }
      })

    return () => {
      ignore = true
    }
  }, [lessonId])

  useEffect(() => {
    return loadPdf()
  }, [loadPdf])

  // Resolve blob URL from FileSystemFileHandle
  useEffect(() => {
    if (!pdf?.fileHandle) return

    let ignore = false
    setBlobLoading(true)
    setFileError(null)

    async function resolveBlobUrl(handle: FileSystemFileHandle) {
      try {
        const permission = await handle.queryPermission({ mode: 'read' })
        if (permission !== 'granted') {
          const result = await handle.requestPermission({ mode: 'read' })
          if (result !== 'granted') {
            if (!ignore) {
              setFileError('permission-denied')
              setBlobLoading(false)
            }
            return
          }
        }
        const file = await handle.getFile()
        const url = URL.createObjectURL(file)
        if (!ignore) {
          setBlobUrl(url)
          setBlobLoading(false)
        } else {
          // Component unmounted before we could set state — revoke immediately
          revokeObjectUrl(url)
        }
      } catch {
        if (!ignore) {
          setFileError('not-found')
          setBlobLoading(false)
        }
      }
    }

    resolveBlobUrl(pdf.fileHandle)

    return () => {
      ignore = true
    }
  }, [pdf])

  // Revoke blob URL on unmount or when it changes
  useEffect(() => {
    return () => {
      if (blobUrl) {
        revokeObjectUrl(blobUrl)
      }
    }
  }, [blobUrl])

  // Re-grant permission flow (AC5)
  const handleReGrantPermission = useCallback(async () => {
    if (!pdf?.fileHandle) return
    setPermissionPending(true)
    try {
      const result = await pdf.fileHandle.requestPermission({ mode: 'read' })
      if (result === 'granted') {
        // Re-load PDF record to trigger blob URL resolution
        const updated = await db.importedPdfs.get(lessonId)
        setPdf(updated ?? null)
        setFileError(null)
        toast.success('Permission granted')
      } else {
        toast.error('Permission was denied')
      }
    } catch {
      toast.error('Failed to request permission')
    } finally {
      setPermissionPending(false)
    }
  }, [pdf, lessonId])

  // Locate file picker for moved/missing PDFs
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
      await db.importedPdfs.update(lessonId, { fileHandle })
      const updated = await db.importedPdfs.get(lessonId)
      setPdf(updated ?? null)
      setFileError(null)
    } catch {
      // silent-catch-ok: User cancelled the picker
    }
  }, [lessonId])

  // PDF page tracking: restore last-viewed page from progress table
  const [savedPage, setSavedPage] = useState<number | undefined>(undefined)
  const pageRestored = useRef(false)

  useEffect(() => {
    if (pageRestored.current) return
    let ignore = false
    db.progress
      .get([courseId, lessonId])
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
  }, [courseId, lessonId])

  // Debounced save of current page to progress table
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handlePageChange = useCallback(
    (page: number, _totalPages: number) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => {
        db.progress
          .where('[courseId+videoId]')
          .equals([courseId, lessonId])
          .first()
          .then(async existing => {
            if (existing) {
              await db.progress.update([courseId, lessonId] as unknown as string, {
                currentPage: page,
              })
            } else {
              await db.progress.put({
                courseId,
                videoId: lessonId,
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
    [courseId, lessonId]
  )

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  // Dexie read failed
  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
        <FileWarning className="size-12 text-destructive" aria-hidden="true" />
        <p className="text-sm">{loadError}</p>
        <Button onClick={loadPdf} variant="outline" className="gap-2" disabled={dexieLoading}>
          <RefreshCw className="size-4" aria-hidden="true" />
          Retry
        </Button>
      </div>
    )
  }

  // Loading state
  if (pdf === undefined || blobLoading) {
    return (
      <DelayedFallback>
        <div aria-busy="true" aria-label="Loading PDF">
          <Skeleton className="w-full aspect-[3/4] rounded-xl" />
        </div>
      </DelayedFallback>
    )
  }

  // PDF record not found
  if (pdf === null) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
        <p>PDF not found.</p>
        <Link to={`/courses/${courseId}`} className="text-sm text-brand hover:underline">
          Back to Course
        </Link>
      </div>
    )
  }

  // Error state: permission denied or file not found
  if (fileError) {
    return (
      <div
        data-testid="pdf-error-state"
        className="flex flex-col items-center justify-center h-full gap-6 px-4"
      >
        <div className="flex flex-col items-center gap-3 text-center max-w-sm">
          {fileError === 'permission-denied' ? (
            <>
              <ShieldAlert className="size-12 text-warning" aria-hidden="true" />
              <h2 className="font-semibold text-lg">Permission required</h2>
              <p className="text-sm text-muted-foreground">
                File access was revoked. Grant permission to view this PDF.
              </p>
            </>
          ) : (
            <>
              <FileWarning className="size-12 text-muted-foreground" aria-hidden="true" />
              <h2 className="font-semibold text-lg">PDF file not found</h2>
              <p className="text-sm text-muted-foreground">Would you like to locate it?</p>
            </>
          )}
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          {fileError === 'permission-denied' ? (
            <Button
              onClick={handleReGrantPermission}
              variant="brand"
              className="gap-2"
              disabled={permissionPending}
            >
              <ShieldAlert className="size-4" aria-hidden="true" />
              {permissionPending ? 'Requesting...' : 'Grant Permission'}
            </Button>
          ) : supportsFilePicker ? (
            <Button onClick={handleLocateFile} className="gap-2">
              <FolderSearch className="size-4" aria-hidden="true" />
              Locate File
            </Button>
          ) : null}
          <Button variant="outline" asChild>
            <Link to={`/courses/${courseId}`}>Back to Course</Link>
          </Button>
        </div>
      </div>
    )
  }

  // PDF display
  if (!blobUrl) return null

  return (
    <PdfViewer
      src={blobUrl}
      title={pdf.filename}
      className="h-full"
      initialPage={savedPage ?? 1}
      onPageChange={handlePageChange}
    />
  )
}
