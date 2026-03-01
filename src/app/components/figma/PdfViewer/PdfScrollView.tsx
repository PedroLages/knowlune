import { useEffect, useRef, useState } from 'react'
import { Document, Page } from 'react-pdf'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import 'react-pdf/dist/Page/TextLayer.css'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import '@/lib/pdfWorker'
import { Skeleton } from '@/app/components/ui/skeleton'
import { cn } from '@/app/components/ui/utils'

interface PdfScrollViewProps {
  src: string
  totalPages: number
  currentPage: number
  scale: number
  rotation: number
  darkMode: boolean
  isFullscreen: boolean
  pageWidth: number
  pageHeight: number
  onPageChange: (page: number) => void
  onDocumentLoadSuccess: (doc: PDFDocumentProxy) => void
  onDocumentLoadError: () => void
  makeTextRenderer?: (
    pageNumber: number
  ) => ((layer: { str: string; itemIndex: number }) => string) | undefined
}

function getScaledDimensions(
  pageWidth: number,
  pageHeight: number,
  scale: number,
  rotation: number
): { width: number; height: number } {
  const isRotated = rotation === 90 || rotation === 270
  const w = isRotated ? pageHeight : pageWidth
  const h = isRotated ? pageWidth : pageHeight
  return { width: w * scale, height: h * scale }
}

export function PdfScrollView({
  src,
  totalPages,
  currentPage,
  scale,
  rotation,
  darkMode,
  isFullscreen,
  pageWidth,
  pageHeight,
  onPageChange,
  onDocumentLoadSuccess,
  onDocumentLoadError,
  makeTextRenderer,
}: PdfScrollViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  const [visiblePages, setVisiblePages] = useState<Set<number>>(new Set())
  const isExternalJumpRef = useRef(false)
  const lastReportedPageRef = useRef(currentPage)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { width: slotWidth, height: slotHeight } = getScaledDimensions(
    pageWidth,
    pageHeight,
    scale,
    rotation
  )

  const BUFFER = 2

  const renderedPages = (() => {
    if (visiblePages.size === 0) {
      // Render currentPage as initial fallback
      const initial = new Set<number>()
      for (
        let p = Math.max(1, currentPage - BUFFER);
        p <= Math.min(totalPages, currentPage + BUFFER);
        p++
      ) {
        initial.add(p)
      }
      return initial
    }

    const minVisible = Math.min(...visiblePages)
    const maxVisible = Math.max(...visiblePages)
    const buffered = new Set<number>()
    for (
      let p = Math.max(1, minVisible - BUFFER);
      p <= Math.min(totalPages, maxVisible + BUFFER);
      p++
    ) {
      buffered.add(p)
    }
    return buffered
  })()

  // IntersectionObserver to track visible pages
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new IntersectionObserver(
      entries => {
        setVisiblePages(prev => {
          const next = new Set(prev)
          for (const entry of entries) {
            const pageNum = Number((entry.target as HTMLElement).dataset.pageNumber)
            if (!pageNum) continue
            if (entry.isIntersecting) {
              next.add(pageNum)
            } else {
              next.delete(pageNum)
            }
          }
          return next
        })
      },
      {
        root: container,
        rootMargin: '200px',
        threshold: 0,
      }
    )

    // Observe all page slot elements
    pageRefs.current.forEach(el => observer.observe(el))

    return () => observer.disconnect()
  }, [totalPages, slotHeight])

  // Scroll event listener for current page detection (debounced 100ms)
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleScroll = () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }

      debounceTimerRef.current = setTimeout(() => {
        if (isExternalJumpRef.current) {
          isExternalJumpRef.current = false
          return
        }

        const containerRect = container.getBoundingClientRect()
        const midpoint = containerRect.top + containerRect.height / 2
        let closestPage = 1
        let closestDistance = Infinity

        pageRefs.current.forEach((el, pageNum) => {
          const rect = el.getBoundingClientRect()
          const distance = Math.abs(rect.top - midpoint)
          if (distance < closestDistance) {
            closestDistance = distance
            closestPage = pageNum
          }
        })

        if (closestPage !== lastReportedPageRef.current) {
          lastReportedPageRef.current = closestPage
          onPageChange(closestPage)
        }
      }, 100)
    }

    container.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      container.removeEventListener('scroll', handleScroll)
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [onPageChange])

  // External page jump: scroll into view when currentPage changes from outside
  useEffect(() => {
    if (currentPage === lastReportedPageRef.current) return

    const el = pageRefs.current.get(currentPage)
    if (el) {
      isExternalJumpRef.current = true
      lastReportedPageRef.current = currentPage
      el.scrollIntoView({ block: 'start', behavior: 'smooth' })
    }
  }, [currentPage])

  const setPageRef = (pageNum: number) => (el: HTMLDivElement | null) => {
    if (el) {
      pageRefs.current.set(pageNum, el)
    } else {
      pageRefs.current.delete(pageNum)
    }
  }

  const pageSlots = (() => {
    const slots: React.ReactNode[] = []
    for (let n = 1; n <= totalPages; n++) {
      const shouldRender = renderedPages.has(n)
      slots.push(
        <div
          key={n}
          ref={setPageRef(n)}
          data-page-number={n}
          className={cn('flex items-start justify-center', n < totalPages && 'mb-4')}
          style={{
            minWidth: slotWidth,
            minHeight: slotHeight,
          }}
        >
          {shouldRender ? (
            <Page
              pageNumber={n}
              scale={scale}
              rotate={rotation}
              renderTextLayer={true}
              renderAnnotationLayer={true}
              customTextRenderer={makeTextRenderer?.(n)}
              loading={<Skeleton className="h-full w-full" />}
            />
          ) : (
            <div style={{ width: slotWidth, height: slotHeight }} />
          )}
        </div>
      )
    }
    return slots
  })()

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative min-w-0 flex-1 overflow-auto',
        !isFullscreen && 'h-[400px] sm:h-[500px] lg:h-[700px] xl:h-[800px]',
        darkMode && '[&_canvas]:invert [&_canvas]:hue-rotate-180'
      )}
    >
      <Document
        file={src}
        onLoadSuccess={onDocumentLoadSuccess}
        onLoadError={onDocumentLoadError}
        loading={null}
      >
        {pageSlots}
      </Document>
    </div>
  )
}
