import { useState, useCallback, useRef, useEffect } from 'react'
import { Document, Page } from 'react-pdf'
import 'react-pdf/dist/Page/TextLayer.css'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import '@/lib/pdfWorker'
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  FileText,
  ExternalLink,
  ChevronsLeftRight,
  Maximize2,
} from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { Skeleton } from '@/app/components/ui/skeleton'
import { cn } from '@/app/components/ui/utils'

interface PdfViewerProps {
  src: string
  title?: string
  initialPage?: number
  courseId?: string
  resourceId?: string
  onPageChange?: (page: number, totalPages: number) => void
  className?: string
}

const ZOOM_PRESETS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3]
const ZOOM_LABELS: Record<number, string> = {
  0.25: '25%',
  0.5: '50%',
  0.75: '75%',
  1: '100%',
  1.25: '125%',
  1.5: '150%',
  2: '200%',
  3: '300%',
}

type ZoomMode = 'fit-width' | 'fit-page' | 'custom'

export function PdfViewer({
  src,
  title,
  initialPage = 1,
  onPageChange,
  className,
}: PdfViewerProps) {
  const [totalPages, setTotalPages] = useState(0)
  const [currentPage, setCurrentPage] = useState(initialPage)
  const [scale, setScale] = useState(1)
  const [zoomMode, setZoomMode] = useState<ZoomMode>('fit-width')
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  const [containerWidth, setContainerWidth] = useState(0)
  const [containerHeight, setContainerHeight] = useState(0)
  const [pageWidth, setPageWidth] = useState(0)
  const [pageHeight, setPageHeight] = useState(0)
  const [zoomDropdownOpen, setZoomDropdownOpen] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Measure container
  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    const observer = new ResizeObserver(entries => {
      const entry = entries[0]
      if (entry) {
        setContainerWidth(entry.contentRect.width)
        setContainerHeight(entry.contentRect.height)
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Compute fit scales when dimensions change
  useEffect(() => {
    if (!pageWidth || !containerWidth) return
    if (zoomMode === 'fit-width') {
      const padding = 32
      setScale((containerWidth - padding) / pageWidth)
    } else if (zoomMode === 'fit-page') {
      const padding = 32
      const sw = (containerWidth - padding) / pageWidth
      const sh = (containerHeight - padding) / pageHeight
      setScale(Math.min(sw, sh))
    }
  }, [zoomMode, containerWidth, containerHeight, pageWidth, pageHeight])

  // Close zoom dropdown on outside click
  useEffect(() => {
    if (!zoomDropdownOpen) return
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setZoomDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [zoomDropdownOpen])

  const goToPage = useCallback(
    (page: number) => {
      const clamped = Math.max(1, Math.min(page, totalPages))
      if (clamped === currentPage) return
      setCurrentPage(clamped)
      setAnnouncement(`Page ${clamped} of ${totalPages}`)
      onPageChange?.(clamped, totalPages)
    },
    [totalPages, currentPage, onPageChange]
  )

  const handleDocumentLoadSuccess = useCallback(
    ({ numPages }: { numPages: number }) => {
      setTotalPages(numPages)
      setIsLoading(false)
      const startPage = Math.min(initialPage, numPages)
      setCurrentPage(startPage)
      setAnnouncement(`PDF loaded. ${numPages} pages. Showing page ${startPage}.`)
    },
    [initialPage]
  )

  const handleDocumentLoadError = useCallback(() => {
    setLoadError(true)
    setIsLoading(false)
  }, [])

  const handlePageLoadSuccess = useCallback(
    (page: { width: number; height: number }) => {
      if (!pageWidth) {
        setPageWidth(page.width)
        setPageHeight(page.height)
      }
    },
    [pageWidth]
  )

  const zoomIn = useCallback(() => {
    const next = ZOOM_PRESETS.find(z => z > scale + 0.01)
    if (next) {
      setScale(next)
      setZoomMode('custom')
      setAnnouncement(`Zoom ${ZOOM_LABELS[next]}`)
    }
  }, [scale])

  const zoomOut = useCallback(() => {
    const prev = [...ZOOM_PRESETS].reverse().find(z => z < scale - 0.01)
    if (prev) {
      setScale(prev)
      setZoomMode('custom')
      setAnnouncement(`Zoom ${ZOOM_LABELS[prev]}`)
    }
  }, [scale])

  const setZoomPreset = useCallback((value: number) => {
    setScale(value)
    setZoomMode('custom')
    setZoomDropdownOpen(false)
    setAnnouncement(`Zoom ${ZOOM_LABELS[value]}`)
  }, [])

  const fitWidth = useCallback(() => {
    setZoomMode('fit-width')
    setZoomDropdownOpen(false)
    setAnnouncement('Fit to width')
  }, [])

  const fitPage = useCallback(() => {
    setZoomMode('fit-page')
    setZoomDropdownOpen(false)
    setAnnouncement('Fit to page')
  }, [])

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Don't capture when typing in the page input
      if ((e.target as HTMLElement).tagName === 'INPUT') return

      switch (e.key) {
        case 'PageDown':
        case 'ArrowDown':
        case 'ArrowRight':
          e.preventDefault()
          goToPage(currentPage + 1)
          break
        case 'PageUp':
        case 'ArrowUp':
        case 'ArrowLeft':
          e.preventDefault()
          goToPage(currentPage - 1)
          break
        case 'Home':
          e.preventDefault()
          goToPage(1)
          break
        case 'End':
          e.preventDefault()
          goToPage(totalPages)
          break
        case '+':
        case '=':
          e.preventDefault()
          zoomIn()
          break
        case '-':
          e.preventDefault()
          zoomOut()
          break
        case '0':
          e.preventDefault()
          setScale(1)
          setZoomMode('custom')
          setAnnouncement('Zoom 100%')
          break
      }
    },
    [currentPage, totalPages, goToPage, zoomIn, zoomOut]
  )

  const handlePageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10)
    if (!isNaN(val)) {
      goToPage(val)
    }
  }

  const handlePageInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      ;(e.target as HTMLInputElement).blur()
    }
  }

  const displayZoom = () => {
    if (zoomMode === 'fit-width') return 'Width'
    if (zoomMode === 'fit-page') return 'Page'
    const closest = ZOOM_PRESETS.reduce((prev, curr) =>
      Math.abs(curr - scale) < Math.abs(prev - scale) ? curr : prev
    )
    return ZOOM_LABELS[closest] || `${Math.round(scale * 100)}%`
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted p-12">
        <FileText className="mb-4 h-12 w-12 text-muted-foreground" />
        <p className="mb-2 text-sm font-medium text-muted-foreground">
          {title || 'PDF Document'}
        </p>
        <p className="mb-4 text-xs text-muted-foreground">
          Unable to preview this document inline
        </p>
        <Button variant="outline" size="sm" onClick={() => window.open(src, '_blank')}>
          <ExternalLink className="mr-2 h-4 w-4" />
          Open in New Tab
        </Button>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      data-testid="pdf-viewer"
      role="document"
      aria-label={`PDF viewer: ${title || 'document'}`}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className={cn(
        'flex flex-col overflow-hidden rounded-[24px] border border-border bg-card focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none',
        className
      )}
    >
      {/* Toolbar */}
      <div
        data-testid="pdf-toolbar"
        role="toolbar"
        aria-label="PDF controls"
        className="flex flex-wrap items-center gap-1 border-b border-border bg-muted px-2 py-1.5 sm:gap-2 sm:px-3"
      >
        {/* Page navigation */}
        <div className="flex items-center gap-1">
          <Button
            data-testid="pdf-prev-page"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage <= 1}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div
            data-testid="pdf-page-indicator"
            className="flex items-center gap-1 text-sm"
          >
            <input
              data-testid="pdf-page-input"
              type="number"
              min={1}
              max={totalPages}
              value={currentPage}
              onChange={handlePageInputChange}
              onKeyDown={handlePageInputKeyDown}
              aria-label="Current page"
              className="w-10 rounded border border-border bg-background px-1 py-0.5 text-center text-sm [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <span className="text-muted-foreground">/</span>
            <span data-testid="pdf-total-pages" className="text-muted-foreground">
              {totalPages}
            </span>
          </div>

          <Button
            data-testid="pdf-next-page"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage >= totalPages}
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Separator */}
        <div className="hidden h-5 w-px bg-border sm:block" />

        {/* Zoom controls */}
        <div className="flex items-center gap-1">
          <Button
            data-testid="pdf-zoom-out"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={zoomOut}
            aria-label="Zoom out"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>

          {/* Zoom dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              data-testid="pdf-zoom-select"
              onClick={() => setZoomDropdownOpen(o => !o)}
              className="flex h-8 items-center rounded px-2 text-sm hover:bg-accent"
              aria-label="Zoom level"
              aria-expanded={zoomDropdownOpen}
              aria-haspopup="listbox"
            >
              {displayZoom()}
            </button>
            {zoomDropdownOpen && (
              <div
                role="listbox"
                aria-label="Zoom presets"
                className="absolute left-0 top-full z-50 mt-1 min-w-[100px] rounded-md border border-border bg-popover py-1 shadow-md"
              >
                {ZOOM_PRESETS.map(z => (
                  <button
                    key={z}
                    role="option"
                    aria-selected={zoomMode === 'custom' && Math.abs(scale - z) < 0.01}
                    onClick={() => setZoomPreset(z)}
                    className="block w-full px-3 py-1.5 text-left text-sm hover:bg-accent"
                  >
                    {ZOOM_LABELS[z]}
                  </button>
                ))}
              </div>
            )}
          </div>

          <Button
            data-testid="pdf-zoom-in"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={zoomIn}
            aria-label="Zoom in"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>

          {/* Fit width / Fit page */}
          <Button
            data-testid="pdf-fit-width"
            variant={zoomMode === 'fit-width' ? 'secondary' : 'ghost'}
            size="icon"
            className="hidden h-8 w-8 sm:inline-flex"
            onClick={fitWidth}
            aria-label="Fit to width"
            title="Fit to width"
          >
            <ChevronsLeftRight className="h-4 w-4" />
          </Button>

          <Button
            data-testid="pdf-fit-page"
            variant={zoomMode === 'fit-page' ? 'secondary' : 'ghost'}
            size="icon"
            className="hidden h-8 w-8 sm:inline-flex"
            onClick={fitPage}
            aria-label="Fit to page"
            title="Fit to page"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Open in new tab */}
        <Button
          data-testid="pdf-open-new-tab"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => window.open(src, '_blank')}
          aria-label="Open PDF in new tab"
          title="Open in new tab"
        >
          <ExternalLink className="h-4 w-4" />
        </Button>
      </div>

      {/* PDF content area */}
      <div
        ref={contentRef}
        className="relative flex-1 overflow-auto h-[400px] sm:h-[500px] lg:h-[700px] xl:h-[800px]"
      >
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-8">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-[60%] w-[70%]" />
            <Skeleton className="h-4 w-32" />
          </div>
        )}

        <Document
          file={src}
          onLoadSuccess={handleDocumentLoadSuccess}
          onLoadError={handleDocumentLoadError}
          loading={null}
        >
          <div className="flex items-start justify-center p-4">
            <Page
              pageNumber={currentPage}
              scale={scale}
              onLoadSuccess={handlePageLoadSuccess}
              renderTextLayer={true}
              renderAnnotationLayer={true}
              loading={
                <Skeleton className="h-[500px] w-[400px]" />
              }
            />
          </div>
        </Document>
      </div>

      {/* ARIA live region */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>
    </div>
  )
}
