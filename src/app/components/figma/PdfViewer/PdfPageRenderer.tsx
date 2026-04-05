import { Document, Page } from 'react-pdf'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import 'react-pdf/dist/Page/TextLayer.css'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import '@/lib/pdfWorker'
import { Skeleton } from '@/app/components/ui/skeleton'
import { cn } from '@/app/components/ui/utils'

interface PdfPageRendererProps {
  src: string
  currentPage: number
  scale: number
  rotation: number
  darkMode: boolean
  isFullscreen: boolean
  isLoading: boolean
  contentRef: React.RefObject<HTMLDivElement | null>
  onDocumentLoadSuccess: (doc: PDFDocumentProxy) => void
  onDocumentLoadError: (error: Error) => void
  onPageLoadSuccess: (page: { width: number; height: number }) => void
  customTextRenderer?: (layer: { str: string; itemIndex: number }) => string
}

export function PdfPageRenderer({
  src,
  currentPage,
  scale,
  rotation,
  darkMode,
  isFullscreen,
  isLoading,
  contentRef,
  onDocumentLoadSuccess,
  onDocumentLoadError,
  onPageLoadSuccess,
  customTextRenderer,
}: PdfPageRendererProps) {
  return (
    <div
      ref={contentRef}
      className={cn(
        'relative min-w-0 flex-1',
        isFullscreen ? 'overflow-y-scroll overflow-x-auto' : 'overflow-auto',
        !isFullscreen && 'h-[400px] sm:h-[500px] lg:h-[700px] xl:h-[800px]',
        darkMode && '[&_canvas]:invert [&_canvas]:hue-rotate-180'
      )}
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
        onLoadSuccess={onDocumentLoadSuccess}
        onLoadError={onDocumentLoadError}
        loading={null}
      >
        <div className="flex min-h-full items-center justify-center p-4">
          <Page
            pageNumber={currentPage}
            scale={scale}
            rotate={rotation}
            onLoadSuccess={onPageLoadSuccess}
            renderTextLayer={true}
            renderAnnotationLayer={true}
            customTextRenderer={customTextRenderer}
            loading={<Skeleton className="h-[500px] w-[400px]" />}
          />
        </div>
      </Document>
    </div>
  )
}
