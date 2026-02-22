import { useRef, useEffect, useState } from 'react'
import { Document, Page } from 'react-pdf'
import 'react-pdf/dist/Page/TextLayer.css'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import '@/lib/pdfWorker'
import { Skeleton } from '@/app/components/ui/skeleton'
import { cn } from '@/app/components/ui/utils'

interface PdfThumbnailSidebarProps {
  src: string
  totalPages: number
  currentPage: number
  onPageClick: (page: number) => void
}

function LazyThumbnail({
  src,
  pageNumber,
  isCurrent,
  onClick,
}: {
  src: string
  pageNumber: number
  isCurrent: boolean
  onClick: () => void
}) {
  const ref = useRef<HTMLButtonElement>(null)
  const [isVisible, setIsVisible] = useState(false)

  // Lazy load via IntersectionObserver
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: '100px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <button
      ref={ref}
      onClick={onClick}
      aria-label={`Go to page ${pageNumber}`}
      aria-current={isCurrent ? 'page' : undefined}
      className={cn(
        'group relative flex flex-col items-center gap-1 rounded-lg p-1.5 transition-colors hover:bg-accent',
        isCurrent && 'bg-accent'
      )}
    >
      <div
        className={cn(
          'overflow-hidden rounded border-2 transition-colors',
          isCurrent ? 'border-blue-600' : 'border-transparent group-hover:border-border'
        )}
      >
        {isVisible ? (
          <Document file={src} loading={null}>
            <Page
              pageNumber={pageNumber}
              width={120}
              renderTextLayer={false}
              renderAnnotationLayer={false}
              loading={<Skeleton className="h-[160px] w-[120px]" />}
            />
          </Document>
        ) : (
          <Skeleton className="h-[160px] w-[120px]" />
        )}
      </div>
      <span
        className={cn(
          'text-xs tabular-nums',
          isCurrent ? 'font-medium text-blue-600' : 'text-muted-foreground'
        )}
      >
        {pageNumber}
      </span>
    </button>
  )
}

export function PdfThumbnailSidebar({
  src,
  totalPages,
  currentPage,
  onPageClick,
}: PdfThumbnailSidebarProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to current page thumbnail
  const scrollToPage = (page: number) => {
    const container = scrollRef.current
    if (!container) return
    const thumb = container.querySelector(`[data-thumb-page="${page}"]`)
    if (thumb) {
      thumb.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }

  useEffect(() => {
    scrollToPage(currentPage)
  }, [currentPage, scrollToPage])

  return (
    <div
      ref={scrollRef}
      className="flex flex-col gap-1 overflow-y-auto p-2"
      role="listbox"
      aria-label="Page thumbnails"
    >
      {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNumber => (
        <div key={pageNumber} data-thumb-page={pageNumber}>
          <LazyThumbnail
            src={src}
            pageNumber={pageNumber}
            isCurrent={pageNumber === currentPage}
            onClick={() => onPageClick(pageNumber)}
          />
        </div>
      ))}
    </div>
  )
}
